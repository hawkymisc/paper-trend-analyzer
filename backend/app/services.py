from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from datetime import datetime, timedelta, timezone

from . import models, schemas
import logging
import time

# 定数
MIN_RECENT_COUNT = 2
TRENDING_KEYWORDS_LIMIT = 10
RECENT_DAYS = 90
PREVIOUS_DAYS = 180

# シンプルなインメモリキャッシュ
cache = {}
CACHE_TTL = 300 # 5分

def get_utc_now():
    return datetime.now(timezone.utc)

def get_time_ago(days: int = 0, hours: int = 0):
    return get_utc_now() - timedelta(days=days, hours=hours)

def get_trending_keywords_data(db: Session) -> list[schemas.TrendingKeyword]:
    cache_key = "trending_keywords"
    if cache_key in cache and time.time() - cache[cache_key]["timestamp"] < CACHE_TTL:
        logging.info("Returning trending keywords from cache.")
        return cache[cache_key]["data"]

    start_time = time.time()
    logging.info("Fetching trending keywords from DB...")

    recent_threshold = get_time_ago(days=RECENT_DAYS)
    previous_threshold = get_time_ago(days=PREVIOUS_DAYS)

    # 1段階のクエリで必要なデータをすべて取得
    query_results = (
        db.query(
            models.Keyword.name,
            func.sum(
                case((models.Paper.published_at >= recent_threshold, 1), else_=0)
            ).label("recent_count"),
            func.sum(
                case((
                    and_(
                        models.Paper.published_at >= previous_threshold,
                        models.Paper.published_at < recent_threshold
                    ), 1
                ), else_=0)
            ).label("previous_count")
        )
        .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
        .join(models.Paper, models.PaperKeyword.paper_id == models.Paper.id)
        .filter(models.Paper.published_at >= previous_threshold)
        .group_by(models.Keyword.name)
        .having(func.sum(case((models.Paper.published_at >= recent_threshold, 1), else_=0)) >= MIN_RECENT_COUNT)
        .all()
    )

    # Python側で成長率を計算し、ソート
    trending_keywords = []
    for name, recent_count, previous_count in query_results:
        growth_count = recent_count - previous_count
        if previous_count > 0:
            growth_rate_percent = round((growth_count / previous_count) * 100, 2)
        else:
            growth_rate_percent = float(growth_count * 100) # 無限大の代わりに大きな数
        
        trending_keywords.append(
            schemas.TrendingKeyword(
                name=name,
                recent_count=recent_count,
                previous_count=previous_count,
                growth_count=growth_count,
                growth_rate_percent=growth_rate_percent
            )
        )

    # 成長数と最近のカウントでソート
    trending_keywords.sort(key=lambda k: (k.growth_count, k.recent_count), reverse=True)
    
    result = trending_keywords[:TRENDING_KEYWORDS_LIMIT]

    cache[cache_key] = {"data": result, "timestamp": time.time()}
    logging.info(f"Fetched trending keywords in {time.time() - start_time:.2f} seconds.")
    return result

def get_trends_data(db: Session, keywords: list[str], start_date: datetime | None, end_date: datetime | None) -> list[schemas.TrendResult]:
    start_time_func = time.time()
    logging.info(f"Fetching trend data for keywords: {keywords} from {start_date} to {end_date}...")
    results = []
    for keyword_name in keywords:
        start_time_keyword = time.time()
        # キーワードIDを取得
        keyword_obj = db.query(models.Keyword).filter(models.Keyword.name == keyword_name).first()
        if not keyword_obj:
            results.append(schemas.TrendResult(keyword=keyword_name, data=[]))
            logging.info(f"Keyword '{keyword_name}' not found. Took {time.time() - start_time_keyword:.2f} seconds.")
            continue

        query = (
            db.query(
                func.strftime('%Y-%m', models.Paper.published_at).label('month'),
                func.count(models.Paper.id).label('count')
            )
            .join(models.PaperKeyword, models.Paper.id == models.PaperKeyword.paper_id)
            .filter(models.PaperKeyword.keyword_id == keyword_obj.id)
        )
        
        if start_date:
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            query = query.filter(models.Paper.published_at >= start_date)
        if end_date:
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            query = query.filter(models.Paper.published_at <= end_date)

        query = query.group_by('month').order_by('month')
        
        trend_data = []
        for row in query.all():
            trend_data.append(schemas.TrendDataPoint(date=row.month, count=row.count))
        
        results.append(schemas.TrendResult(keyword=keyword_name, data=trend_data))
        logging.info(f"Fetched trend data for keyword '{keyword_name}' in {time.time() - start_time_keyword:.2f} seconds.")
    logging.info(f"Total trend data fetching took {time.time() - start_time_func:.2f} seconds.")
    return results

def get_summary_data(db: Session) -> schemas.DashboardSummary:
    total_papers = db.query(func.count(models.Paper.id)).scalar()
    total_keywords = db.query(func.count(models.Keyword.id)).scalar()
    latest_paper_date = db.query(func.max(models.Paper.published_at)).scalar()

    now = get_utc_now()
    recent_papers_24h = db.query(func.count(models.Paper.id)).filter(models.Paper.published_at >= now - timedelta(hours=24)).scalar()
    recent_papers_7d = db.query(func.count(models.Paper.id)).filter(models.Paper.published_at >= now - timedelta(days=7)).scalar()
    recent_papers_30d = db.query(func.count(models.Paper.id)).filter(models.Paper.published_at >= now - timedelta(days=30)).scalar()

    return schemas.DashboardSummary(
        total_papers=total_papers,
        total_keywords=total_keywords,
        latest_paper_date=latest_paper_date,
        recent_papers_24h=recent_papers_24h,
        recent_papers_7d=recent_papers_7d,
        recent_papers_30d=recent_papers_30d,
    )

def search_papers(db: Session, query: str, skip: int = 0, limit: int = 100) -> schemas.PaperSearchResponse:
    search_query = f"%{query.lower()}%"
    
    base_query = db.query(models.Paper).filter(
        (func.lower(models.Paper.title).like(search_query)) |
        (func.lower(models.Paper.summary).like(search_query))
    )
    
    total_count = base_query.count()
    papers = base_query.offset(skip).limit(limit).all()

    results = []
    for paper in papers:
        arxiv_url = f"https://arxiv.org/abs/{paper.arxiv_id}"
        results.append(schemas.PaperSearchResult(
            id=paper.id,
            arxiv_id=paper.arxiv_id,
            title=paper.title,
            authors=paper.authors,
            summary=paper.summary,
            published_at=paper.published_at,
            arxiv_url=arxiv_url
        ))
    return schemas.PaperSearchResponse(papers=results, total_count=total_count)

def get_word_cloud_data(db: Session) -> list[schemas.WordData]:
    cache_key = "word_cloud"
    if cache_key in cache and time.time() - cache[cache_key]["timestamp"] < CACHE_TTL:
        logging.info("Returning word cloud data from cache.")
        return cache[cache_key]["data"]

    start_time = time.time()
    logging.info("Fetching word cloud data from DB...")

    seven_days_ago = get_time_ago(days=7)

    results = (
        db.query(models.Keyword.name, func.count(models.PaperKeyword.paper_id).label('count'))
        .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
        .join(models.Paper, models.PaperKeyword.paper_id == models.Paper.id)
        .filter(models.Paper.published_at >= seven_days_ago)
        .group_by(models.Keyword.name)
        .order_by(func.count(models.PaperKeyword.paper_id).desc())
        .limit(50)
        .all()
    )

    word_cloud_data = [schemas.WordData(text=row.name, value=row.count) for row in results]

    cache[cache_key] = {"data": word_cloud_data, "timestamp": time.time()}
    logging.info(f"Fetched word cloud data in {time.time() - start_time:.2f} seconds.")
    return word_cloud_data
