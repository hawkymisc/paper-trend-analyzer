import sys
import os
import requests
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
import feedparser
from dateutil import parser as dateutil_parser
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any, Optional
import argparse

# backendディレクトリをsys.pathに追加
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal
from app.models import Paper, Keyword, PaperKeyword


from datetime import datetime, timedelta, timezone
import re
import logging
import time
from logging.handlers import RotatingFileHandler

log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fetch_papers.log')
file_handler = RotatingFileHandler(log_file, maxBytes=1024*1024*5, backupCount=5) # 5MB, 5ファイル
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

logging.basicConfig(level=logging.INFO, handlers=[file_handler, console_handler])

# 定数
DEFAULT_DAYS_TO_FETCH = 30
MAX_ARXIV_RESULTS = 1000
ARXIV_BASE_URL = "http://export.arxiv.org/api/query?"



LLM_KEYWORDS = [
    "LLM", "Large Language Model", "Transformer", "Attention", "Generative AI",
    "GPT", "BERT", "T5", "Llama", "Mixtral", "Mistral", "Gemini", "Claude",
    "RAG", "Retrieval Augmented Generation", "Fine-tuning", "Prompt Engineering",
    "Reinforcement Learning from Human Feedback", "RLHF", "Multimodal",
    "Neural Network", "Deep Learning", "Machine Learning", "AI", "Artificial Intelligence"
]

def extract_keywords(text: str) -> list[str]:
    extracted = []
    text_lower = text.lower()
    for keyword in LLM_KEYWORDS:
        if re.search(r'\b' + re.escape(keyword.lower()) + r'\b', text_lower):
            extracted.append(keyword)
    return list(set(extracted)) # 重複を排除

@retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(5), retry=retry_if_exception_type(requests.exceptions.RequestException))
def fetch_papers_from_arxiv(search_query: str, max_results: int, start: int = 0) -> Optional[Any]:
    """
    arXiv APIから論文データを取得する
    """
    base_url = ARXIV_BASE_URL
    query = f"search_query={search_query}&start={start}&max_results={max_results}"
    
    try:
        response = requests.get(base_url + query)
        response.raise_for_status() # HTTPエラーが発生した場合に例外を発生させる
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching data from arXiv API: {e}")
        return None
        
    feed = feedparser.parse(response.content)
    
    return feed.entries

def fetch_all_papers_from_arxiv(search_query: str, max_results_per_page: int = MAX_ARXIV_RESULTS) -> list[Any]:
    """
    arXiv APIから指定されたクエリに合致する全ての論文をページネーションを使って取得する
    """
    all_papers = []
    offset = 0
    # arXiv APIの最大取得件数は1000件
    # https://arxiv.org/help/api/user-manual#_request_parameters
    ARXIV_MAX_RETURN = 1000 

    while True:
        logging.info(f"Fetching papers with offset {offset}...")
        # max_results_per_page は ARXIV_MAX_RETURN を超えないようにする
        current_max_results = min(max_results_per_page, ARXIV_MAX_RETURN)
        papers_page = fetch_papers_from_arxiv(search_query, current_max_results, offset)
        
        if len(papers_page) == 0:
            break
        
        all_papers.extend(papers_page)
        
        offset += len(papers_page) # 実際に取得できた件数分オフセットを進める
        time.sleep(3) # APIへの負荷軽減のため、リクエスト間に遅延を入れる

    return all_papers

def save_papers_to_db(db: Session, papers: list) -> None:
    """
    取得した論文データをデータベースに保存する
    """
    added_count = 0
    for entry in papers:
        try:
            # arxiv_idはURLの末尾から取得
            arxiv_id = entry.id.split('/')[-1]
            
            # 既に同じarxiv_idの論文が存在しないか確認
            existing_paper = db.query(Paper).filter(Paper.arxiv_id == arxiv_id).first()
            if existing_paper:
                continue

            new_paper = Paper(
                arxiv_id=arxiv_id,
                title=entry.title,
                authors=[author.name for author in entry.authors],
                summary=entry.summary,
                published_at=dateutil_parser.parse(entry.published).astimezone(timezone.utc)
            )
            db.add(new_paper)
            db.flush() # IDを生成するためにflush

            # キーワードを抽出して保存
            combined_text = entry.title + " " + entry.summary
            extracted_keywords = extract_keywords(combined_text)

            for kw_name in extracted_keywords:
                keyword_obj = db.query(Keyword).filter(Keyword.name == kw_name).first()
                if not keyword_obj:
                    keyword_obj = Keyword(name=kw_name)
                    db.add(keyword_obj)
                    db.flush() # IDを生成するためにflush

                paper_keyword = PaperKeyword(paper_id=new_paper.id, keyword_id=keyword_obj.id)
                db.add(paper_keyword)
            
            added_count += 1
        except Exception as e:
            db.rollback()
            logging.error(f"Error saving paper {entry.id} to database: {e}", exc_info=True)
            continue
    
    db.commit()
    logging.info(f"Successfully added {added_count} new papers and their keywords to the database.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch papers from arXiv.")
    parser.add_argument("--start-date", type=str, help="Start date in YYYY-MM-DD format.")
    parser.add_argument("--end-date", type=str, help="End date in YYYY-MM-DD format. Defaults to today.")
    args = parser.parse_args()

    try:
        from app.database import engine, Base
        Base.metadata.create_all(bind=engine)
    except ImportError as e:
        logging.error(f"Failed to import database modules: {e}")
        sys.exit(1)

    if args.start_date:
        start_dt = datetime.strptime(args.start_date, "%Y-%m-%d").astimezone(timezone.utc)
    else:
        start_dt = datetime.now(timezone.utc) - timedelta(days=DEFAULT_DAYS_TO_FETCH)

    if args.end_date:
        end_dt = datetime.strptime(args.end_date, "%Y-%m-%d").astimezone(timezone.utc)
    else:
        end_dt = datetime.now(timezone.utc)

    start_date_str = start_dt.strftime('%Y%m%d%H%M%S')
    end_date_str = end_dt.strftime('%Y%m%d%H%M%S')
    
    search_query = f"(cat:cs.CL OR cat:cs.AI OR cat:cs.LG) AND submittedDate:[{start_date_str} TO {end_date_str}]"

    db = SessionLocal()
    try:
        # データベース接続をテスト
        db.execute(text("SELECT 1"))
        logging.info("Database connection successful")
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        sys.exit(1)

    start_time = time.time()
    total_papers_fetched = 0
    current_month_start = start_dt.replace(day=1)

    while current_month_start <= end_dt:
        next_month_start = (current_month_start + timedelta(days=32)).replace(day=1) # 次の月の1日
        current_month_end = min(next_month_start - timedelta(days=1), end_dt) # その月の最終日、または指定されたend_dt

        month_start_str = current_month_start.strftime('%Y%m%d%H%M%S')
        month_end_str = current_month_end.strftime('%Y%m%d%H%M%S')
        
        search_query = f"(cat:cs.CL OR cat:cs.AI OR cat:cs.LG) AND submittedDate:[{month_start_str} TO {month_end_str}]"

        try:
            logging.info(f"Fetching papers from arXiv for {current_month_start.strftime('%Y-%m')}...")
            papers = fetch_all_papers_from_arxiv(search_query=search_query)
            if papers:
                logging.info(f"Fetched {len(papers)} papers for {current_month_start.strftime('%Y-%m')}.")
                logging.info("Saving papers to the database...")
                save_papers_to_db(db, papers)
                total_papers_fetched += len(papers)
            else:
                logging.info(f"No papers were fetched for {current_month_start.strftime('%Y-%m')}.")
        except Exception as e:
            logging.error(f"Error fetching papers for {current_month_start.strftime('%Y-%m')}: {e}", exc_info=True)
        
        current_month_start = next_month_start

    logging.info(f"Total papers fetched and saved: {total_papers_fetched}")
    logging.info(f"Paper fetching completed in {time.time() - start_time:.2f} seconds")
    logging.info("Database session closed.")