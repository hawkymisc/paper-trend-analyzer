from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, text
from datetime import datetime, timedelta, timezone
from typing import Optional
import asyncio
import hashlib
import subprocess
import os

from . import models, schemas
import logging
import time
import re
import requests
import xml.etree.ElementTree as ET
from collections import Counter
from .ai_service import get_ai_service
from .config import settings

# 定数
MIN_RECENT_COUNT = 2
TRENDING_KEYWORDS_LIMIT = 10
RECENT_DAYS = 8 * 7  # 8 weeks
PREVIOUS_DAYS = 16 * 7  # 16 weeks (for comparison)

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

        # Week-based grouping: Get Monday of each week as the date label
        query = (
            db.query(
                func.date(models.Paper.published_at, 'weekday 1', '-6 days').label('week_start'),
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

        query = query.group_by('week_start').order_by('week_start')
        
        trend_data = []
        for row in query.all():
            trend_data.append(schemas.TrendDataPoint(date=row.week_start, count=row.count))
        
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

def search_papers(db: Session, query: str, skip: int = 0, limit: int = 100, start_date: datetime = None, end_date: datetime = None, sort_by: str = "date") -> schemas.PaperSearchResponse:
    search_query = f"%{query.lower()}%"
    
    base_query = db.query(models.Paper).filter(
        (func.lower(models.Paper.title).like(search_query)) |
        (func.lower(models.Paper.summary).like(search_query))
    )
    
    # 日付範囲フィルターを追加
    if start_date:
        base_query = base_query.filter(models.Paper.published_at >= start_date)
    if end_date:
        base_query = base_query.filter(models.Paper.published_at <= end_date)
    
    # 並び順を適用
    if sort_by == "date":
        # 新しい順 (published_at降順)
        base_query = base_query.order_by(models.Paper.published_at.desc())
    elif sort_by == "relevance":
        # 関連度順 - タイトルマッチを優先し、その後日付順
        base_query = base_query.order_by(
            # タイトルに検索語が含まれる論文を上位に
            func.lower(models.Paper.title).like(search_query).desc(),
            # その後は新しい順
            models.Paper.published_at.desc()
        )
    else:
        # デフォルトは日付順
        base_query = base_query.order_by(models.Paper.published_at.desc())
    
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

    # 期間を16週間に延長してより多くのキーワードを取得
    sixteen_weeks_ago = get_time_ago(days=16*7)  # 16 weeks

    results = (
        db.query(models.Keyword.name, func.count(models.PaperKeyword.paper_id).label('count'))
        .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
        .join(models.Paper, models.PaperKeyword.paper_id == models.Paper.id)
        .filter(models.Paper.published_at >= sixteen_weeks_ago)
        .group_by(models.Keyword.name)
        .order_by(func.count(models.PaperKeyword.paper_id).desc())
        .limit(100)
        .all()
    )

    word_cloud_data = [schemas.WordData(text=row.name, value=row.count) for row in results]

    cache[cache_key] = {"data": word_cloud_data, "timestamp": time.time()}
    logging.info(f"Fetched word cloud data in {time.time() - start_time:.2f} seconds.")
    return word_cloud_data

def get_word_cloud_data_with_dictionary(db: Session, dictionary: list[schemas.DictionaryKeyword]) -> list[schemas.WordData]:
    """辞書を考慮したワードクラウドデータを取得"""
    start_time = time.time()
    logging.info("Fetching word cloud data with dictionary from DB...")

    # 期間を16週間に設定
    sixteen_weeks_ago = get_time_ago(days=16*7)

    # 通常のキーワード統計を取得
    results = (
        db.query(models.Keyword.name, func.count(models.PaperKeyword.paper_id).label('count'))
        .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
        .join(models.Paper, models.PaperKeyword.paper_id == models.Paper.id)
        .filter(models.Paper.published_at >= sixteen_weeks_ago)
        .group_by(models.Keyword.name)
        .order_by(func.count(models.PaperKeyword.paper_id).desc())
        .limit(200)  # より多くのキーワードを取得
        .all()
    )

    # 辞書キーワードのマッピングを作成（大文字小文字を無視）
    dict_importance = {}
    for dict_keyword in dictionary:
        dict_importance[dict_keyword.keyword.lower()] = dict_keyword.importance

    word_cloud_data = []
    for row in results:
        keyword_lower = row.name.lower()
        base_value = row.count
        
        # 辞書にあるキーワードは重要度に応じて重み付け
        if keyword_lower in dict_importance:
            importance = dict_importance[keyword_lower]
            if importance == 'high':
                weighted_value = int(base_value * 2.0)  # 2倍の重み
            elif importance == 'medium':
                weighted_value = int(base_value * 1.5)  # 1.5倍の重み
            else:  # low
                weighted_value = int(base_value * 1.2)  # 1.2倍の重み
        else:
            weighted_value = base_value
        
        word_cloud_data.append(schemas.WordData(text=row.name, value=weighted_value))

    # 重み付け後に再ソート
    word_cloud_data.sort(key=lambda x: x.value, reverse=True)
    word_cloud_data = word_cloud_data[:100]  # 上位100件に制限

    logging.info(f"Fetched weighted word cloud data in {time.time() - start_time:.2f} seconds.")
    return word_cloud_data

def get_keyword_suggestions(dictionary: list[schemas.DictionaryKeyword], query: str) -> list[str]:
    """辞書から検索クエリに基づくキーワード候補を返す"""
    if not query:
        # クエリが空の場合は重要度の高いキーワードを返す
        high_importance = [kw.keyword for kw in dictionary if kw.importance == 'high']
        return high_importance[:10]
    
    query_lower = query.lower()
    suggestions = []
    
    # 部分一致でキーワードを検索
    for dict_keyword in dictionary:
        if query_lower in dict_keyword.keyword.lower():
            suggestions.append(dict_keyword.keyword)
    
    # 重要度でソート（高い順）
    suggestions.sort(key=lambda kw: next(
        (2 if dk.importance == 'high' else 1 if dk.importance == 'medium' else 0 
         for dk in dictionary if dk.keyword == kw), 0
    ), reverse=True)
    
    return suggestions[:10]  # 上位10件

# arXivカテゴリコードとキーワードのマッピング
ARXIV_CATEGORY_KEYWORDS = {
    'cs.AI': ['Artificial Intelligence', 'AI Systems', 'Intelligent Agents', 'AI Applications'],
    'cs.CL': ['Natural Language Processing', 'NLP', 'Computational Linguistics', 'Language Models', 'Text Processing'],
    'cs.CV': ['Computer Vision', 'Image Processing', 'Pattern Recognition', 'Scene Understanding', 'Visual Recognition'],
    'cs.LG': ['Machine Learning', 'Deep Learning', 'Neural Networks', 'Learning Algorithms', 'Statistical Learning'],
    'cs.RO': ['Robotics', 'Robot Control', 'Autonomous Systems', 'Robot Learning'],
    'cs.IR': ['Information Retrieval', 'Search Engines', 'Document Retrieval', 'Recommendation Systems'],
    'cs.HC': ['Human-Computer Interaction', 'User Interfaces', 'Usability', 'Interactive Systems'],
    'cs.CR': ['Cryptography', 'Security', 'Privacy', 'Cybersecurity'],
    'cs.SE': ['Software Engineering', 'Programming Languages', 'Software Development', 'Code Analysis'],
    'cs.DC': ['Distributed Computing', 'Parallel Computing', 'Cloud Computing', 'Distributed Systems'],
    'stat.ML': ['Statistical Machine Learning', 'Bayesian Methods', 'Statistical Models'],
    'math.OC': ['Optimization', 'Mathematical Optimization', 'Convex Optimization'],
    'eess.IV': ['Image Processing', 'Signal Processing', 'Medical Imaging'],
    'eess.AS': ['Audio Processing', 'Speech Processing', 'Audio Signal Processing'],
    'q-bio.QM': ['Quantitative Methods', 'Computational Biology', 'Bioinformatics']
}

def get_arxiv_categories(arxiv_id: str) -> list[str]:
    """指定されたarXiv IDのカテゴリ情報を取得"""
    try:
        # arXiv IDからvバージョンを除去
        clean_id = arxiv_id.split('v')[0] if 'v' in arxiv_id else arxiv_id
        
        url = f"https://export.arxiv.org/api/query?id_list={clean_id}"
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            return []
        
        # XMLをパース
        root = ET.fromstring(response.content)
        
        # 名前空間を定義
        namespaces = {
            'atom': 'http://www.w3.org/2005/Atom',
            'arxiv': 'http://arxiv.org/schemas/atom'
        }
        
        categories = []
        
        # カテゴリ情報を抽出
        for entry in root.findall('atom:entry', namespaces):
            for category in entry.findall('atom:category', namespaces):
                term = category.get('term')
                if term:
                    categories.append(term)
        
        return categories
        
    except Exception as e:
        logging.warning(f"Failed to get categories for {arxiv_id}: {e}")
        return []

def extract_keywords_from_categories(categories: list[str]) -> list[str]:
    """カテゴリ情報からキーワードを抽出"""
    keywords = set()
    
    for category in categories:
        if category in ARXIV_CATEGORY_KEYWORDS:
            keywords.update(ARXIV_CATEGORY_KEYWORDS[category])
    
    return list(keywords)

def extract_technical_terms_from_text(text: str) -> list[str]:
    """テキストから技術的な用語を抽出（特化辞書方式）"""
    if not text:
        return []
    
    # 包括的なストップワードリスト
    stop_words = {
        # 基本的な英単語
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 
        'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 
        'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 
        'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 
        'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
        'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 
        'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 
        'themselves', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
        'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
        'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'll', 'don',
        # 一般的な動詞・形容詞
        'get', 'got', 'give', 'given', 'take', 'taken', 'make', 'made', 'come', 'came', 'go', 'went',
        'see', 'seen', 'know', 'known', 'think', 'thought', 'look', 'find', 'found', 'want', 'need',
        'try', 'tried', 'ask', 'asked', 'work', 'worked', 'seem', 'seemed', 'feel', 'felt', 'leave', 'left',
        'call', 'called', 'keep', 'kept', 'let', 'put', 'say', 'said', 'tell', 'told', 'become', 'became',
        'turn', 'turned', 'move', 'moved', 'play', 'played', 'run', 'ran', 'believe', 'believed',
        'hold', 'held', 'bring', 'brought', 'happen', 'happened', 'write', 'written', 'provide', 'provided',
        'sit', 'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met', 'include', 'included',
        'continue', 'continued', 'set', 'change', 'changed', 'lead', 'led', 'understand', 'understood',
        'watch', 'watched', 'follow', 'followed', 'stop', 'stopped', 'create', 'created', 'speak', 'spoke',
        'read', 'read', 'allow', 'allowed', 'add', 'added', 'spend', 'spent', 'grow', 'grew', 'open', 'opened',
        'walk', 'walked', 'win', 'won', 'offer', 'offered', 'remember', 'remembered', 'love', 'loved',
        'consider', 'considered', 'appear', 'appeared', 'buy', 'bought', 'wait', 'waited', 'serve', 'served',
        'die', 'died', 'send', 'sent', 'expect', 'expected', 'build', 'built', 'stay', 'stayed',
        'fall', 'fell', 'cut', 'reach', 'reached', 'kill', 'killed', 'remain', 'remained',
        # 一般的な形容詞
        'good', 'great', 'big', 'small', 'large', 'long', 'short', 'high', 'low', 'old', 'new', 'young',
        'different', 'same', 'right', 'wrong', 'important', 'possible', 'impossible', 'easy', 'hard',
        'early', 'late', 'first', 'last', 'next', 'previous', 'best', 'better', 'worse', 'worst',
        'hot', 'cold', 'warm', 'cool', 'fast', 'slow', 'quick', 'heavy', 'light', 'strong', 'weak',
        'full', 'empty', 'clean', 'dirty', 'clear', 'dark', 'bright', 'free', 'busy', 'sure',
        'ready', 'available', 'real', 'true', 'false', 'simple', 'complex', 'single', 'multiple',
        # 論文でよく使われる一般的な単語
        'paper', 'work', 'study', 'research', 'result', 'results', 'method', 'methods', 'approach',
        'technique', 'techniques', 'way', 'ways', 'problem', 'problems', 'solution', 'solutions',
        'system', 'systems', 'process', 'processes', 'application', 'applications', 'example', 'examples',
        'case', 'cases', 'number', 'numbers', 'time', 'times', 'year', 'years', 'day', 'days',
        'way', 'ways', 'place', 'places', 'part', 'parts', 'point', 'points', 'line', 'lines',
        'area', 'areas', 'level', 'levels', 'kind', 'kinds', 'type', 'types', 'form', 'forms',
        'end', 'ends', 'side', 'sides', 'hand', 'hands', 'eye', 'eyes', 'head', 'heads',
        'fact', 'facts', 'question', 'questions', 'answer', 'answers', 'reason', 'reasons',
        'idea', 'ideas', 'information', 'data', 'detail', 'details', 'feature', 'features',
        'value', 'values', 'rate', 'rates', 'size', 'sizes', 'amount', 'amounts', 'total', 'totals',
        'order', 'orders', 'group', 'groups', 'team', 'teams', 'member', 'members', 'person', 'people',
        'man', 'men', 'woman', 'women', 'child', 'children', 'family', 'families', 'friend', 'friends',
        'company', 'companies', 'business', 'businesses', 'service', 'services', 'product', 'products',
        'market', 'markets', 'price', 'prices', 'cost', 'costs', 'money', 'dollar', 'dollars',
        'country', 'countries', 'state', 'states', 'city', 'cities', 'town', 'towns', 'world', 'worlds',
        'life', 'lives', 'death', 'deaths', 'health', 'healthcare', 'food', 'foods', 'water', 'waters',
        'house', 'houses', 'home', 'homes', 'school', 'schools', 'student', 'students', 'teacher', 'teachers',
        'book', 'books', 'page', 'pages', 'word', 'words', 'name', 'names', 'story', 'stories',
        'news', 'report', 'reports', 'article', 'articles', 'website', 'websites', 'internet',
        'computer', 'computers', 'phone', 'phones', 'email', 'emails', 'message', 'messages',
        'image', 'images', 'picture', 'pictures', 'video', 'videos', 'music', 'sound', 'sounds',
        'game', 'games', 'movie', 'movies', 'show', 'shows', 'tv', 'television',
        'car', 'cars', 'road', 'roads', 'street', 'streets', 'building', 'buildings',
        'room', 'rooms', 'office', 'offices', 'door', 'doors', 'window', 'windows',
        'table', 'tables', 'chair', 'chairs', 'bed', 'beds', 'floor', 'floors',
        # 数字、記号、コード関連
        'com', 'org', 'net', 'edu', 'gov', 'www', 'http', 'https', 'html', 'css', 'js',
        'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
        # よくある誤抽出
        'using', 'used', 'use', 'uses', 'show', 'shows', 'shown', 'based', 'propose', 'proposed',
        'present', 'presented', 'demonstrate', 'demonstrated', 'evaluate', 'evaluated', 'compare', 'compared',
        'analyze', 'analyzed', 'examine', 'examined', 'investigate', 'investigated', 'explore', 'explored',
        'discuss', 'discussed', 'describe', 'described', 'explain', 'explained', 'review', 'reviewed',
        'survey', 'surveyed', 'focus', 'focused', 'address', 'addressed', 'tackle', 'tackled',
        'achieve', 'achieved', 'obtain', 'obtained', 'improve', 'improved', 'enhance', 'enhanced',
        'develop', 'developed', 'design', 'designed', 'implement', 'implemented', 'apply', 'applied',
        'introduce', 'introduced', 'establish', 'established', 'formulate', 'formulated',
        'perform', 'performed', 'conduct', 'conducted', 'carry', 'carried', 'execute', 'executed',
        'test', 'tested', 'validate', 'validated', 'verify', 'verified', 'confirm', 'confirmed',
        'measure', 'measured', 'calculate', 'calculated', 'compute', 'computed', 'determine', 'determined',
        'estimate', 'estimated', 'predict', 'predicted', 'model', 'models', 'modeling', 'modelling'
    }
    
    # 特化された技術用語辞書（完全一致のみ）
    specialized_tech_dictionary = {
        # === AI/MLモデル名 ===
        'bert': 'BERT',
        'gpt': 'GPT', 
        'gpt-3': 'GPT-3',
        'gpt-4': 'GPT-4',
        'chatgpt': 'ChatGPT',
        't5': 'T5',
        'bart': 'BART',
        'roberta': 'RoBERTa',
        'electra': 'ELECTRA',
        'deberta': 'DeBERTa',
        'albert': 'ALBERT',
        'distilbert': 'DistilBERT',
        'xlnet': 'XLNet',
        'ernie': 'ERNIE',
        'claude': 'Claude',
        'gemini': 'Gemini',
        'llama': 'LLaMA',
        'mistral': 'Mistral',
        'mixtral': 'Mixtral',
        
        # === コンピュータビジョンモデル ===
        'resnet': 'ResNet',
        'vgg': 'VGG',
        'inception': 'Inception',
        'densenet': 'DenseNet',
        'efficientnet': 'EfficientNet',
        'mobilenet': 'MobileNet',
        'yolo': 'YOLO',
        'r-cnn': 'R-CNN',
        'faster r-cnn': 'Faster R-CNN',
        'mask r-cnn': 'Mask R-CNN',
        'clip': 'CLIP',
        'dall-e': 'DALL-E',
        'stable diffusion': 'Stable Diffusion',
        'midjourney': 'Midjourney',
        
        # === アーキテクチャ・手法 ===
        'transformer': 'Transformer',
        'vision transformer': 'Vision Transformer',
        'attention mechanism': 'Attention Mechanism',
        'self-attention': 'Self-Attention',
        'cross-attention': 'Cross-Attention',
        'multi-head attention': 'Multi-Head Attention',
        'lstm': 'LSTM',
        'gru': 'GRU',
        'cnn': 'CNN',
        'rnn': 'RNN',
        'convolutional neural network': 'Convolutional Neural Network',
        'recurrent neural network': 'Recurrent Neural Network',
        'graph neural network': 'Graph Neural Network',
        'generative adversarial network': 'Generative Adversarial Network',
        'variational autoencoder': 'Variational Autoencoder',
        'autoencoder': 'Autoencoder',
        'diffusion model': 'Diffusion Model',
        'gan': 'GAN',
        'vae': 'VAE',
        
        # === 学習パラダイム ===
        'large language model': 'Large Language Model',
        'foundation model': 'Foundation Model',
        'multimodal model': 'Multimodal Model',
        'machine learning': 'Machine Learning',
        'deep learning': 'Deep Learning',
        'reinforcement learning': 'Reinforcement Learning',
        'supervised learning': 'Supervised Learning',
        'unsupervised learning': 'Unsupervised Learning',
        'self-supervised learning': 'Self-Supervised Learning',
        'semi-supervised learning': 'Semi-Supervised Learning',
        'transfer learning': 'Transfer Learning',
        'meta-learning': 'Meta-Learning',
        'continual learning': 'Continual Learning',
        'federated learning': 'Federated Learning',
        'few-shot learning': 'Few-Shot Learning',
        'zero-shot learning': 'Zero-Shot Learning',
        'one-shot learning': 'One-Shot Learning',
        'in-context learning': 'In-Context Learning',
        'multi-task learning': 'Multi-Task Learning',
        'contrastive learning': 'Contrastive Learning',
        
        # === ファインチューニング技術 ===
        'fine-tuning': 'Fine-Tuning',
        'pre-training': 'Pre-Training',
        'parameter-efficient fine-tuning': 'Parameter-Efficient Fine-Tuning',
        'lora': 'LoRA',
        'adalora': 'AdaLoRA', 
        'prefix tuning': 'Prefix Tuning',
        'prompt tuning': 'Prompt Tuning',
        'prompt engineering': 'Prompt Engineering',
        'instruction tuning': 'Instruction Tuning',
        'rlhf': 'RLHF',
        'reinforcement learning from human feedback': 'Reinforcement Learning from Human Feedback',
        
        # === タスク・アプリケーション ===
        'natural language processing': 'Natural Language Processing',
        'computer vision': 'Computer Vision',
        'speech recognition': 'Speech Recognition',
        'automatic speech recognition': 'Automatic Speech Recognition',
        'machine translation': 'Machine Translation',
        'question answering': 'Question Answering',
        'text summarization': 'Text Summarization',
        'sentiment analysis': 'Sentiment Analysis',
        'named entity recognition': 'Named Entity Recognition',
        'object detection': 'Object Detection',
        'semantic segmentation': 'Semantic Segmentation',
        'instance segmentation': 'Instance Segmentation',
        'image classification': 'Image Classification',
        'image generation': 'Image Generation',
        'text-to-image': 'Text-to-Image',
        'image-to-text': 'Image-to-Text',
        'vision-language': 'Vision-Language',
        'multimodal learning': 'Multimodal Learning',
        
        # === 最適化・訓練 ===
        'gradient descent': 'Gradient Descent',
        'stochastic gradient descent': 'Stochastic Gradient Descent',
        'adam optimizer': 'Adam Optimizer',
        'backpropagation': 'Backpropagation',
        'batch normalization': 'Batch Normalization',
        'layer normalization': 'Layer Normalization',
        'dropout': 'Dropout',
        'regularization': 'Regularization',
        'adversarial training': 'Adversarial Training',
        'knowledge distillation': 'Knowledge Distillation',
        'model compression': 'Model Compression',
        'neural architecture search': 'Neural Architecture Search',
        'hyperparameter optimization': 'Hyperparameter Optimization',
        
        # === 評価指標 ===
        'cross-entropy': 'Cross-Entropy',
        'mean squared error': 'Mean Squared Error',
        'kl divergence': 'KL Divergence',
        'cosine similarity': 'Cosine Similarity',
        'intersection over union': 'Intersection over Union',
        'receiver operating characteristic': 'ROC',
        'area under curve': 'AUC',
        'f1 score': 'F1 Score',
        'precision': 'Precision',
        'recall': 'Recall',
        'accuracy': 'Accuracy',
        
        # === 技術ツール・フレームワーク ===
        'pytorch': 'PyTorch',
        'tensorflow': 'TensorFlow', 
        'keras': 'Keras',
        'jax': 'JAX',
        'hugging face': 'Hugging Face',
        'transformers': 'Transformers',
        'openai': 'OpenAI',
        'anthropic': 'Anthropic',
        'cuda': 'CUDA',
        'cudnn': 'cuDNN',
        'nvidia': 'NVIDIA',
        'tpu': 'TPU',
        'gpu': 'GPU',
        'distributed training': 'Distributed Training',
        
        # === AI安全性・個人情報 ===
        'ai safety': 'AI Safety',
        'ai alignment': 'AI Alignment',
        'constitutional ai': 'Constitutional AI',
        'differential privacy': 'Differential Privacy',
        'adversarial robustness': 'Adversarial Robustness',
        'fairness in ai': 'Fairness in AI',
        'explainable ai': 'Explainable AI',
        'interpretable machine learning': 'Interpretable Machine Learning',
        
        # === 新しい技術トレンド ===
        'retrieval-augmented generation': 'Retrieval-Augmented Generation',
        'rag': 'RAG',
        'chain-of-thought': 'Chain-of-Thought',
        'reasoning': 'Reasoning',
        'causal inference': 'Causal Inference',
        'causal machine learning': 'Causal Machine Learning',
        'neuromorphic computing': 'Neuromorphic Computing',
        'quantum machine learning': 'Quantum Machine Learning',
        'edge ai': 'Edge AI',
        'federated learning': 'Federated Learning',
        'differential privacy': 'Differential Privacy'
    }
    
    keywords = set()
    text_lower = text.lower()
    
    # 1. 特化辞書からの完全一致検索（長い順にソートして優先度を付ける）
    sorted_terms = sorted(specialized_tech_dictionary.items(), key=lambda x: len(x[0]), reverse=True)
    
    for term_lower, term_proper in sorted_terms:
        if term_lower in text_lower:
            keywords.add(term_proper)
            # 既にマッチした部分を除去して重複を防ぐ
            text_lower = text_lower.replace(term_lower, ' ')
    
    # 2. 略語の特別処理（大文字のみ、2-5文字）
    acronym_pattern = r'\b[A-Z]{2,5}\b'
    acronyms = re.findall(acronym_pattern, text)
    for acronym in acronyms:
        if (acronym not in ['THE', 'AND', 'FOR', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'GET', 'OUT', 'WHO', 'HAS', 'HAD'] and
            len(acronym) >= 2):
            keywords.add(acronym)
    
    
    return list(keywords)

def update_keywords_from_papers_improved(db: Session, limit: int = 1000) -> int:
    """改良されたキーワード抽出（arXivカテゴリ + テキスト解析）"""
    start_time = time.time()
    logging.info(f"Starting improved keyword extraction from {limit} recent papers...")
    
    # 最近の論文を取得
    recent_papers = (
        db.query(models.Paper)
        .order_by(models.Paper.published_at.desc())
        .limit(limit)
        .all()
    )
    
    # 全論文からキーワードを抽出
    all_keywords = []
    processed_count = 0
    
    for paper in recent_papers:
        processed_count += 1
        if processed_count % 100 == 0:
            logging.info(f"Processed {processed_count}/{len(recent_papers)} papers...")
        
        # 1. arXivカテゴリからキーワードを抽出
        categories = get_arxiv_categories(paper.arxiv_id)
        if categories:
            category_keywords = extract_keywords_from_categories(categories)
            all_keywords.extend(category_keywords)
        
        # 2. タイトルから技術用語を抽出
        title_keywords = extract_technical_terms_from_text(paper.title)
        all_keywords.extend(title_keywords)
        
        # 3. 要約から技術用語を抽出（最初の500文字のみ）
        summary_excerpt = paper.summary[:500] if paper.summary else ""
        summary_keywords = extract_technical_terms_from_text(summary_excerpt)
        all_keywords.extend(summary_keywords)
    
    # 頻出度をカウント
    keyword_counts = Counter(all_keywords)
    
    # 既存のキーワードを取得
    existing_keywords = {kw.name for kw in db.query(models.Keyword).all()}
    
    # 新しいキーワードを追加（最低3回以上出現するもの）
    new_keywords_added = 0
    for keyword, count in keyword_counts.most_common():
        # 高品質キーワードのみをフィルタリング
        if (count >= 5 and  # 闾値を上げて品質を向上
            keyword not in existing_keywords and 
            len(keyword) > 3 and  # 最小長を増加
            is_high_quality_keyword(keyword)):
            
            # 新しいキーワードを追加
            new_keyword = models.Keyword(name=keyword)
            db.add(new_keyword)
            existing_keywords.add(keyword)
            new_keywords_added += 1
            
            logging.info(f"Added keyword: {keyword} (count: {count})")
            
            # 最大150個まで
            if new_keywords_added >= 150:
                break
    
    db.commit()
    
    logging.info(f"Added {new_keywords_added} new keywords in {time.time() - start_time:.2f} seconds.")
    return new_keywords_added

def is_high_quality_keyword(keyword: str) -> bool:
    """キーワードの品質をチェック（特化辞書ベース）"""
    keyword_clean = keyword.strip()
    keyword_lower = keyword_clean.lower()
    
    # 特化辞書にあるキーワードは高品質
    specialized_values = {
        'BERT', 'GPT', 'GPT-3', 'GPT-4', 'ChatGPT', 'T5', 'BART', 'RoBERTa', 'ELECTRA', 'DeBERTa',
        'ALBERT', 'DistilBERT', 'XLNet', 'ERNIE', 'Claude', 'Gemini', 'LLaMA', 'Mistral', 'Mixtral',
        'ResNet', 'VGG', 'Inception', 'DenseNet', 'EfficientNet', 'MobileNet', 'YOLO', 'R-CNN',
        'Faster R-CNN', 'Mask R-CNN', 'CLIP', 'DALL-E', 'Stable Diffusion', 'Midjourney',
        'Transformer', 'Vision Transformer', 'Attention Mechanism', 'Self-Attention', 'Cross-Attention',
        'Multi-Head Attention', 'LSTM', 'GRU', 'CNN', 'RNN', 'Convolutional Neural Network',
        'Recurrent Neural Network', 'Graph Neural Network', 'Generative Adversarial Network',
        'Variational Autoencoder', 'Autoencoder', 'Diffusion Model', 'GAN', 'VAE',
        'Large Language Model', 'Foundation Model', 'Multimodal Model', 'Machine Learning',
        'Deep Learning', 'Reinforcement Learning', 'Supervised Learning', 'Unsupervised Learning',
        'Self-Supervised Learning', 'Semi-Supervised Learning', 'Transfer Learning', 'Meta-Learning',
        'Continual Learning', 'Federated Learning', 'Few-Shot Learning', 'Zero-Shot Learning',
        'One-Shot Learning', 'In-Context Learning', 'Multi-Task Learning', 'Contrastive Learning',
        'Fine-Tuning', 'Pre-Training', 'Parameter-Efficient Fine-Tuning', 'LoRA', 'AdaLoRA',
        'Prefix Tuning', 'Prompt Tuning', 'Prompt Engineering', 'Instruction Tuning', 'RLHF',
        'Reinforcement Learning from Human Feedback', 'Natural Language Processing', 'Computer Vision',
        'Speech Recognition', 'Automatic Speech Recognition', 'Machine Translation', 'Question Answering',
        'Text Summarization', 'Sentiment Analysis', 'Named Entity Recognition', 'Object Detection',
        'Semantic Segmentation', 'Instance Segmentation', 'Image Classification', 'Image Generation',
        'Text-to-Image', 'Image-to-Text', 'Vision-Language', 'Multimodal Learning',
        'Gradient Descent', 'Stochastic Gradient Descent', 'Adam Optimizer', 'Backpropagation',
        'Batch Normalization', 'Layer Normalization', 'Dropout', 'Regularization', 'Adversarial Training',
        'Knowledge Distillation', 'Model Compression', 'Neural Architecture Search', 'Hyperparameter Optimization',
        'Cross-Entropy', 'Mean Squared Error', 'KL Divergence', 'Cosine Similarity', 'Intersection over Union',
        'ROC', 'AUC', 'F1 Score', 'Precision', 'Recall', 'Accuracy', 'PyTorch', 'TensorFlow', 'Keras',
        'JAX', 'Hugging Face', 'Transformers', 'OpenAI', 'Anthropic', 'CUDA', 'cuDNN', 'NVIDIA', 'TPU',
        'GPU', 'Distributed Training', 'AI Safety', 'AI Alignment', 'Constitutional AI', 'Differential Privacy',
        'Adversarial Robustness', 'Fairness in AI', 'Explainable AI', 'Interpretable Machine Learning',
        'Retrieval-Augmented Generation', 'RAG', 'Chain-of-Thought', 'Reasoning', 'Causal Inference',
        'Causal Machine Learning', 'Neuromorphic Computing', 'Quantum Machine Learning', 'Edge AI'
    }
    
    if keyword_clean in specialized_values:
        return True
    
    # 絶対的に除外する低品質ワード
    low_quality_words = {
        # 一般的すぎる単語
        'model', 'models', 'data', 'out', 'while', 'multi', 'large', 'existing',
        'however', 'system', 'training', 'dataset', 'text', 'framework', 'performance',
        'method', 'approach', 'result', 'results', 'work', 'paper', 'study', 'research',
        'analysis', 'evaluation', 'experiment', 'test', 'baseline', 'comparison', 'novel',
        'new', 'existing', 'current', 'previous', 'recent', 'proposed', 'based', 'using',
        'show', 'shows', 'demonstrate', 'demonstrates', 'achieve', 'achieves', 'improve', 'improves',
        'enhance', 'enhances', 'provide', 'provides', 'present', 'presents', 'introduce', 'introduces',
        'effective', 'efficient', 'robust', 'accurate', 'better', 'best', 'good', 'high', 'low',
        'various', 'different', 'multiple', 'several', 'many', 'few', 'single', 'simple', 'complex',
        # 特に一般的な動詞・形容詞
        'can', 'could', 'should', 'would', 'may', 'might', 'will', 'shall', 'must',
        'get', 'got', 'give', 'take', 'make', 'come', 'go', 'see', 'know', 'think',
        'look', 'find', 'want', 'need', 'try', 'use', 'work', 'call', 'ask', 'seem',
        'feel', 'become', 'leave', 'move', 'play', 'run', 'turn', 'start', 'begin',
        'end', 'stop', 'keep', 'let', 'put', 'set', 'hold', 'bring', 'follow', 'lead',
        # ストップワード系
        'the', 'and', 'for', 'with', 'this', 'that', 'these', 'those', 'are', 'was', 'were',
        'have', 'has', 'had', 'our', 'we', 'they', 'their', 'them', 'his', 'her', 'its',
        'your', 'you', 'all', 'any', 'some', 'more', 'most', 'such', 'only', 'same',
        'very', 'just', 'now', 'also', 'one', 'two', 'three', 'first', 'second', 'third'
    }
    
    if keyword_lower in low_quality_words:
        return False
    
    # 基本的なフィルタリング
    if len(keyword_clean) <= 2:
        return False
    
    if keyword_lower.isdigit():
        return False
    
    if any(keyword_lower.startswith(prefix) for prefix in ['http', 'www', 'ftp']):
        return False
    
    # 技術的な特徴を持つかチェック
    # 1. 大文字略語 (AI, ML, NLP, etc.)
    if keyword_clean.isupper() and 2 <= len(keyword_clean) <= 5:
        return True
    
    # 2. ハイフン付き技術用語 
    if '-' in keyword_clean and len(keyword_clean) > 5:
        return True
    
    # 3. 技術的キーワードの指示語を含む
    tech_indicators = {
        'learning', 'neural', 'network', 'algorithm', 'optimization', 'training',
        'inference', 'embedding', 'attention', 'transformer', 'convolution',
        'generation', 'classification', 'regression', 'clustering', 'segmentation',
        'detection', 'recognition', 'processing', 'computing', 'vision', 'language',
        'speech', 'multimodal', 'adversarial', 'generative', 'discriminative',
        'supervised', 'unsupervised', 'reinforcement', 'self-supervised'
    }
    
    if any(indicator in keyword_lower for indicator in tech_indicators):
        return True
    
    # その他の場合は低品質とみなす
    return False

def cleanup_low_quality_keywords(db: Session) -> int:
    """低品質なキーワードをデータベースから削除"""
    start_time = time.time()
    logging.info("Starting cleanup of low quality keywords...")
    
    # 全キーワードを取得
    all_keywords = db.query(models.Keyword).all()
    
    removed_count = 0
    
    # 1. 低品質キーワードの削除
    for keyword in all_keywords:
        if not is_high_quality_keyword(keyword.name):
            # 関連付けを削除
            db.query(models.PaperKeyword).filter(
                models.PaperKeyword.keyword_id == keyword.id
            ).delete()
            
            # キーワードを削除
            db.delete(keyword)
            removed_count += 1
            
            if removed_count % 50 == 0:
                logging.info(f"Removed {removed_count} low quality keywords...")
    
    db.commit()
    
    # 2. 大文字小文字の重複を統合
    duplicate_count = merge_case_duplicates(db)
    
    logging.info(f"Removed {removed_count} low quality keywords and merged {duplicate_count} duplicates in {time.time() - start_time:.2f} seconds.")
    return removed_count + duplicate_count

def merge_case_duplicates(db: Session) -> int:
    """大文字小文字の違いによる重複キーワードを統合"""
    logging.info("Merging case-sensitive duplicate keywords...")
    
    # すべてのキーワードを取得
    all_keywords = db.query(models.Keyword).all()
    
    # 正規化されたキーワード名でグループ化
    keyword_groups = {}
    for kw in all_keywords:
        normalized = kw.name.lower()
        if normalized not in keyword_groups:
            keyword_groups[normalized] = []
        keyword_groups[normalized].append(kw)
    
    merged_count = 0
    
    for normalized_name, keywords in keyword_groups.items():
        if len(keywords) <= 1:
            continue
            
        # 最適なキーワード名を選択（特化辞書にある場合はそれを優先）
        specialized_tech_dictionary = {
            'bert': 'BERT', 'gpt': 'GPT', 'transformer': 'Transformer',
            'machine learning': 'Machine Learning', 'deep learning': 'Deep Learning',
            'neural network': 'Neural Network', 'large language model': 'Large Language Model',
            'attention': 'Attention', 'fine-tuning': 'Fine-tuning', 'multimodal': 'Multimodal',
            'rag': 'RAG', 'language models': 'Language Models', 'generative ai': 'Generative AI',
            'learning': 'Learning', 'language': 'Language', 'network': 'Network',
            'generation': 'Generation', 'natural language processing': 'Natural Language Processing',
            'computer vision': 'Computer Vision', 'reinforcement learning': 'Reinforcement Learning'
        }
        
        # 特化辞書にある場合はその形式を使用
        preferred_name = specialized_tech_dictionary.get(normalized_name)
        if not preferred_name:
            # より適切な形式を選択（大文字で始まる、技術用語らしい形式）
            preferred_keyword = max(keywords, key=lambda k: (
                k.name[0].isupper(),  # 大文字で始まる
                len(k.name),  # より長い
                sum(1 for c in k.name if c.isupper())  # 大文字が多い
            ))
            preferred_name = preferred_keyword.name
        
        # 優先キーワードを見つけるか作成
        preferred_keyword = None
        for kw in keywords:
            if kw.name == preferred_name:
                preferred_keyword = kw
                break
        
        if not preferred_keyword:
            # 優先する名前のキーワードがない場合、最初のものを使って名前を更新
            preferred_keyword = keywords[0]
            preferred_keyword.name = preferred_name
            db.add(preferred_keyword)
        
        # 他のキーワードの関連付けを優先キーワードに移動
        for kw in keywords:
            if kw.id == preferred_keyword.id:
                continue
                
            # 関連付けを移動
            associations = db.query(models.PaperKeyword).filter(
                models.PaperKeyword.keyword_id == kw.id
            ).all()
            
            for assoc in associations:
                # 既に同じ論文とキーワードの関連付けがないかチェック
                existing = db.query(models.PaperKeyword).filter(
                    models.PaperKeyword.paper_id == assoc.paper_id,
                    models.PaperKeyword.keyword_id == preferred_keyword.id
                ).first()
                
                if not existing:
                    assoc.keyword_id = preferred_keyword.id
                    db.add(assoc)
                else:
                    # 重複する場合は古い関連付けを削除
                    db.delete(assoc)
            
            # 古いキーワードを削除
            db.delete(kw)
            merged_count += 1
            
        logging.info(f"Merged {len(keywords)-1} duplicates for '{preferred_name}'")
    
    db.commit()
    
    # キャッシュを自動クリア
    cache.clear()
    logging.info("Cache cleared after keyword cleanup")
    
    return merged_count

# 旧関数を維持（互換性のため）
def update_keywords_from_papers(db: Session, limit: int = 1000) -> int:
    """互換性のためのラッパー関数"""
    return update_keywords_from_papers_improved(db, limit)

def rebuild_paper_keyword_associations(db: Session) -> int:
    """既存の論文と新しいキーワードの関連付けを再構築"""
    start_time = time.time()
    logging.info("Rebuilding paper-keyword associations...")
    
    # 既存の関連付けをクリア（必要に応じて）
    # db.query(models.PaperKeyword).delete()
    
    # 全キーワードを取得
    keywords = {kw.name: kw.id for kw in db.query(models.Keyword).all()}
    
    # 最近の論文を取得
    recent_papers = (
        db.query(models.Paper)
        .order_by(models.Paper.published_at.desc())
        .limit(5000)  # 最新5000件
        .all()
    )
    
    associations_added = 0
    
    for paper in recent_papers:
        # 論文のテキストから該当するキーワードを検索
        paper_text = f"{paper.title} {paper.summary}".lower()
        
        for keyword_name, keyword_id in keywords.items():
            if keyword_name.lower() in paper_text:
                # 既存の関連付けをチェック
                existing = (
                    db.query(models.PaperKeyword)
                    .filter(
                        models.PaperKeyword.paper_id == paper.id,
                        models.PaperKeyword.keyword_id == keyword_id
                    )
                    .first()
                )
                
                if not existing:
                    # 新しい関連付けを追加
                    association = models.PaperKeyword(
                        paper_id=paper.id,
                        keyword_id=keyword_id
                    )
                    db.add(association)
                    associations_added += 1
    
    db.commit()
    
    logging.info(f"Added {associations_added} new associations in {time.time() - start_time:.2f} seconds.")
    return associations_added

async def get_hot_topics_summary(
    db: Session, 
    language: str = "auto", 
    days: int = 30, 
    max_topics: int = 10
) -> schemas.HotTopicsResponse:
    """Get hot topics summary using AI analysis"""
    start_time = time.time()
    logging.info(f"Generating hot topics summary for last {days} days in {language}...")
    
    # Get recent papers for analysis
    cutoff_date = get_time_ago(days=days)
    
    recent_papers_query = (
        db.query(models.Paper)
        .filter(models.Paper.published_at >= cutoff_date)
        .order_by(models.Paper.published_at.desc())
        .limit(500)  # Limit to prevent token overflow
    )
    
    recent_papers = recent_papers_query.all()
    total_papers_analyzed = recent_papers_query.count()
    
    if not recent_papers:
        # Return empty response if no recent papers
        return schemas.HotTopicsResponse(
            hot_topics=[],
            analysis_period_days=days,
            total_papers_analyzed=0,
            generated_at=get_utc_now()
        )
    
    # Convert papers to analysis format
    papers_data = []
    for paper in recent_papers:
        # Get paper keywords
        paper_keywords = (
            db.query(models.Keyword.name)
            .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
            .filter(models.PaperKeyword.paper_id == paper.id)
            .all()
        )
        
        paper_data = {
            'id': paper.id,
            'title': paper.title,
            'authors': paper.authors,
            'published_at': paper.published_at.isoformat(),
            'summary': paper.summary,
            'keywords': [kw.name for kw in paper_keywords],
            'arxiv_id': paper.arxiv_id
        }
        papers_data.append(paper_data)
    
    try:
        # Get AI service and analyze hot topics with timeout
        ai_service = get_ai_service()
        hot_topics_ai = await asyncio.wait_for(
            ai_service.analyze_hot_topics(papers_data, language),
            timeout=settings.hot_topics_timeout
        )
        
        # Convert AI results to response format
        hot_topics_response = []
        for topic_ai in hot_topics_ai[:max_topics]:
            # Convert recent papers to response format
            recent_papers_response = []
            for paper_data in topic_ai.recent_papers:
                arxiv_url = f"https://arxiv.org/abs/{paper_data.get('arxiv_id', '')}"
                paper_response = schemas.HotTopicPaper(
                    id=paper_data.get('id', 0),
                    title=paper_data.get('title', ''),
                    authors=paper_data.get('authors', []),
                    published_at=datetime.fromisoformat(paper_data.get('published_at', get_utc_now().isoformat())),
                    arxiv_url=arxiv_url,
                    summary=paper_data.get('summary', '')
                )
                recent_papers_response.append(paper_response)
            
            hot_topic_response = schemas.HotTopic(
                topic=topic_ai.topic,
                paper_count=topic_ai.paper_count,
                recent_papers=recent_papers_response,
                summary=topic_ai.summary,
                keywords=topic_ai.keywords,
                trend_score=topic_ai.trend_score
            )
            hot_topics_response.append(hot_topic_response)
        
        response = schemas.HotTopicsResponse(
            hot_topics=hot_topics_response,
            analysis_period_days=days,
            total_papers_analyzed=total_papers_analyzed,
            generated_at=get_utc_now()
        )
        
        logging.info(f"Generated hot topics summary with {len(hot_topics_response)} topics in {time.time() - start_time:.2f} seconds.")
        return response
        
    except asyncio.TimeoutError:
        logging.error(f"Hot topics analysis timed out after {settings.hot_topics_timeout} seconds")
        # Return fallback response with keyword-based analysis
        return await get_fallback_hot_topics(db, days, max_topics, total_papers_analyzed)
    except Exception as e:
        logging.error(f"Failed to generate hot topics summary: {e}")
        
        # Return fallback response with keyword-based analysis
        return await get_fallback_hot_topics(db, days, max_topics, total_papers_analyzed)

async def get_fallback_hot_topics(
    db: Session, 
    days: int, 
    max_topics: int, 
    total_papers_analyzed: int
) -> schemas.HotTopicsResponse:
    """Fallback hot topics analysis using keyword frequency"""
    logging.info("Using fallback keyword-based hot topics analysis...")
    
    cutoff_date = get_time_ago(days=days)
    
    # Get trending keywords for the period
    trending_keywords = (
        db.query(
            models.Keyword.name,
            func.count(models.PaperKeyword.paper_id).label('paper_count')
        )
        .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
        .join(models.Paper, models.PaperKeyword.paper_id == models.Paper.id)
        .filter(models.Paper.published_at >= cutoff_date)
        .group_by(models.Keyword.name)
        .having(func.count(models.PaperKeyword.paper_id) >= settings.hot_topics_min_papers)
        .order_by(func.count(models.PaperKeyword.paper_id).desc())
        .limit(max_topics)
        .all()
    )
    
    hot_topics_response = []
    
    for i, (keyword_name, paper_count) in enumerate(trending_keywords):
        # Get recent papers for this keyword
        recent_papers_query = (
            db.query(models.Paper)
            .join(models.PaperKeyword, models.Paper.id == models.PaperKeyword.paper_id)
            .join(models.Keyword, models.PaperKeyword.keyword_id == models.Keyword.id)
            .filter(
                models.Keyword.name == keyword_name,
                models.Paper.published_at >= cutoff_date
            )
            .order_by(models.Paper.published_at.desc())
            .limit(5)
        ).all()
        
        recent_papers_response = []
        for paper in recent_papers_query:
            arxiv_url = f"https://arxiv.org/abs/{paper.arxiv_id}"
            paper_response = schemas.HotTopicPaper(
                id=paper.id,
                title=paper.title,
                authors=paper.authors,
                published_at=paper.published_at,
                arxiv_url=arxiv_url,
                summary=paper.summary
            )
            recent_papers_response.append(paper_response)
        
        # Calculate trend score based on ranking
        trend_score = max(10, 100 - i * 10)
        
        hot_topic = schemas.HotTopic(
            topic=keyword_name,
            paper_count=paper_count,
            recent_papers=recent_papers_response,
            summary=f"Research area focusing on {keyword_name} with {paper_count} recent papers",
            keywords=[keyword_name],
            trend_score=trend_score
        )
        hot_topics_response.append(hot_topic)
    
    return schemas.HotTopicsResponse(
        hot_topics=hot_topics_response,
        analysis_period_days=days,
        total_papers_analyzed=total_papers_analyzed,
        generated_at=get_utc_now()
    )

# Helper functions for cache management
def get_current_week_period():
    """Get current week period (Monday to Sunday)"""
    now = get_utc_now()
    # Get Monday of current week
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return week_start, week_end

def create_keywords_hash(keywords: list[str]) -> str:
    """Create hash from sorted keywords for caching"""
    sorted_keywords = sorted([kw.lower().strip() for kw in keywords])
    keywords_str = "|".join(sorted_keywords)
    return hashlib.sha256(keywords_str.encode()).hexdigest()

# New Weekly Trend Analysis Functions with Cache
async def get_latest_weekly_trend_overview(
    db: Session, 
    language: str = "auto"
) -> schemas.WeeklyTrendResponse | None:
    """Get latest cached weekly trend overview"""
    week_start, week_end = get_current_week_period()
    
    cached_result = (
        db.query(models.WeeklyTrendCache)
        .filter(
            models.WeeklyTrendCache.analysis_period_start == week_start,
            models.WeeklyTrendCache.analysis_period_end == week_end,
            models.WeeklyTrendCache.language == language
        )
        .order_by(models.WeeklyTrendCache.created_at.desc())
        .first()
    )
    
    if cached_result:
        start_date = week_start.strftime("%Y-%m-%d")
        end_date = week_end.strftime("%Y-%m-%d")
        
        # Get papers for the same period to include in response
        # Limit to same 100 papers used for AI analysis to maintain consistency
        recent_papers_query = (
            db.query(models.Paper)
            .filter(
                models.Paper.published_at >= week_start,
                models.Paper.published_at < week_end + timedelta(days=1)
            )
            .order_by(models.Paper.published_at.desc())
            .limit(100)  # Same limit as AI analysis
        )
        recent_papers = recent_papers_query.all()
        
        # Convert papers to PaperResponse format
        paper_responses = []
        for paper in recent_papers:
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                title=paper.title,
                authors=paper.authors,
                summary=paper.summary,
                published_at=paper.published_at,
                arxiv_id=paper.arxiv_id,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[pk.keyword.name for pk in paper.keywords] if paper.keywords else []
            ))
        
        return schemas.WeeklyTrendResponse(
            trend_overview=cached_result.trend_overview,
            analysis_period=f"{start_date} to {end_date}",
            total_papers_analyzed=cached_result.total_papers_analyzed,
            generated_at=cached_result.created_at,
            papers=paper_responses
        )
    
    return None

async def get_weekly_trend_overview(
    db: Session, 
    language: str = "auto",
    system_prompt: Optional[str] = None,
    force_regenerate: bool = False
) -> schemas.WeeklyTrendResponse:
    """Generate weekly trend overview text with cache"""
    start_time = time.time()
    logging.info(f"Generating weekly trend overview in {language}...")
    
    # Get current week period
    week_start, week_end = get_current_week_period()
    start_date = week_start.strftime("%Y-%m-%d")
    end_date = week_end.strftime("%Y-%m-%d")
    
    # Check cache first (unless force regenerate is requested)
    if not force_regenerate:
        cached_result = await get_latest_weekly_trend_overview(db, language)
        if cached_result:
            logging.info(f"Returning cached weekly trend overview from {cached_result.generated_at}")
            return cached_result
    else:
        logging.info("Force regeneration requested - skipping cache")
    
    # Get papers from current week
    recent_papers_query = (
        db.query(models.Paper)
        .filter(models.Paper.published_at >= week_start)
        .filter(models.Paper.published_at <= week_end)
        .order_by(models.Paper.published_at.desc())
        .limit(100)  # Limit for AI processing
    )
    
    recent_papers = recent_papers_query.all()
    total_papers_analyzed = recent_papers_query.count()
    
    if not recent_papers:
        return schemas.WeeklyTrendResponse(
            trend_overview="No papers found for the past week.",
            analysis_period=f"{start_date} to {end_date}",
            total_papers_analyzed=0,
            generated_at=get_utc_now()
        )
    
    # Convert papers to analysis format
    papers_data = []
    for paper in recent_papers:
        paper_keywords = (
            db.query(models.Keyword.name)
            .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
            .filter(models.PaperKeyword.paper_id == paper.id)
            .all()
        )
        
        paper_data = {
            'id': paper.id,
            'title': paper.title,
            'authors': paper.authors,
            'published_at': paper.published_at.isoformat(),
            'summary': paper.summary,
            'keywords': [kw.name for kw in paper_keywords],
            'arxiv_id': paper.arxiv_id
        }
        papers_data.append(paper_data)
    
    try:
        # Get AI service and generate overview with timeout
        ai_service = get_ai_service()
        trend_overview = await asyncio.wait_for(
            ai_service.generate_weekly_trend_overview(papers_data, language, system_prompt),
            timeout=settings.gemini_timeout
        )
        
        # Cache the result
        cache_entry = models.WeeklyTrendCache(
            analysis_period_start=week_start,
            analysis_period_end=week_end,
            language=language,
            trend_overview=trend_overview,
            total_papers_analyzed=total_papers_analyzed
        )
        db.add(cache_entry)
        db.commit()
        
        # Convert papers to PaperResponse format
        paper_responses = []
        for paper in recent_papers:
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                title=paper.title,
                authors=paper.authors,
                summary=paper.summary,
                published_at=paper.published_at,
                arxiv_id=paper.arxiv_id,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[pk.keyword.name for pk in paper.keywords] if paper.keywords else []
            ))
        
        response = schemas.WeeklyTrendResponse(
            trend_overview=trend_overview,
            analysis_period=f"{start_date} to {end_date}",
            total_papers_analyzed=total_papers_analyzed,
            generated_at=get_utc_now(),
            papers=paper_responses
        )
        
        logging.info(f"Generated and cached weekly trend overview in {time.time() - start_time:.2f} seconds.")
        return response
        
    except Exception as e:
        logging.error(f"Failed to generate weekly trend overview: {e}")
        
        # Fallback overview
        fallback_overview = f"This week ({start_date} to {end_date}) saw {total_papers_analyzed} new research papers across various domains including machine learning, AI applications, and emerging technologies. The research landscape continues to evolve with contributions spanning theoretical advances and practical applications."
        
        # Convert papers to PaperResponse format for fallback
        paper_responses = []
        for paper in recent_papers:
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                title=paper.title,
                authors=paper.authors,
                summary=paper.summary,
                published_at=paper.published_at,
                arxiv_id=paper.arxiv_id,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[pk.keyword.name for pk in paper.keywords] if paper.keywords else []
            ))
        
        return schemas.WeeklyTrendResponse(
            trend_overview=fallback_overview,
            analysis_period=f"{start_date} to {end_date}",
            total_papers_analyzed=total_papers_analyzed,
            generated_at=get_utc_now(),
            papers=paper_responses
        )

async def get_topic_keywords(
    db: Session,
    language: str = "auto",
    max_keywords: int = 30,
    system_prompt: Optional[str] = None,
    force_regenerate: bool = False
) -> schemas.TopicKeywordsResponse:
    """Extract topic keywords from recent papers"""
    start_time = time.time()
    logging.info(f"Extracting topic keywords (max: {max_keywords}) in {language}...")
    
    # Get papers from the last 7 days
    cutoff_date = get_time_ago(days=7)
    start_date = cutoff_date.strftime("%Y-%m-%d")
    end_date = get_utc_now().strftime("%Y-%m-%d")
    
    recent_papers_query = (
        db.query(models.Paper)
        .filter(models.Paper.published_at >= cutoff_date)
        .order_by(models.Paper.published_at.desc())
        .limit(200)  # More papers for keyword extraction
    )
    
    recent_papers = recent_papers_query.all()
    total_papers_analyzed = recent_papers_query.count()
    
    if not recent_papers:
        return schemas.TopicKeywordsResponse(
            keywords=[],
            analysis_period=f"{start_date} to {end_date}",
            total_papers_analyzed=0,
            generated_at=get_utc_now()
        )
    
    # Convert papers to analysis format
    papers_data = []
    for paper in recent_papers:
        paper_keywords = (
            db.query(models.Keyword.name)
            .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
            .filter(models.PaperKeyword.paper_id == paper.id)
            .all()
        )
        
        paper_data = {
            'id': paper.id,
            'title': paper.title,
            'authors': paper.authors,
            'published_at': paper.published_at.isoformat(),
            'summary': paper.summary,
            'keywords': [kw.name for kw in paper_keywords],
            'arxiv_id': paper.arxiv_id
        }
        papers_data.append(paper_data)
    
    try:
        # Get AI service and extract keywords with timeout
        ai_service = get_ai_service()
        keywords_ai = await asyncio.wait_for(
            ai_service.extract_topic_keywords(papers_data, language, max_keywords, system_prompt),
            timeout=settings.gemini_timeout
        )
        
        # Convert AI results to response format
        keywords_response = []
        for kw_data in keywords_ai[:max_keywords]:
            keyword_response = schemas.TopicKeyword(
                keyword=kw_data.get('keyword', ''),
                paper_count=kw_data.get('paper_count', 0),
                relevance_score=kw_data.get('relevance_score', 0.0)
            )
            keywords_response.append(keyword_response)
        
        response = schemas.TopicKeywordsResponse(
            keywords=keywords_response,
            analysis_period=f"{start_date} to {end_date}",
            total_papers_analyzed=total_papers_analyzed,
            generated_at=get_utc_now()
        )
        
        logging.info(f"Extracted {len(keywords_response)} topic keywords in {time.time() - start_time:.2f} seconds.")
        return response
        
    except Exception as e:
        logging.error(f"Failed to extract topic keywords: {e}")
        
        # Fallback: use database keywords frequency
        return await get_fallback_topic_keywords(db, cutoff_date, max_keywords, total_papers_analyzed)

async def get_fallback_topic_keywords(
    db: Session,
    cutoff_date: datetime,
    max_keywords: int,
    total_papers_analyzed: int
) -> schemas.TopicKeywordsResponse:
    """Fallback topic keywords using database frequency analysis"""
    logging.info("Using fallback keyword frequency analysis...")
    
    start_date = cutoff_date.strftime("%Y-%m-%d")
    end_date = get_utc_now().strftime("%Y-%m-%d")
    
    # Get trending keywords for the period
    trending_keywords = (
        db.query(
            models.Keyword.name,
            func.count(models.PaperKeyword.paper_id).label('paper_count')
        )
        .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
        .join(models.Paper, models.PaperKeyword.paper_id == models.Paper.id)
        .filter(models.Paper.published_at >= cutoff_date)
        .group_by(models.Keyword.name)
        .having(func.count(models.PaperKeyword.paper_id) >= 1)
        .order_by(func.count(models.PaperKeyword.paper_id).desc())
        .limit(max_keywords)
        .all()
    )
    
    keywords_response = []
    for i, (keyword_name, paper_count) in enumerate(trending_keywords):
        # Calculate relevance score based on frequency and ranking
        relevance_score = max(10.0, 100.0 - (i * 3.0))
        
        keyword_response = schemas.TopicKeyword(
            keyword=keyword_name,
            paper_count=paper_count,
            relevance_score=relevance_score
        )
        keywords_response.append(keyword_response)
    
    return schemas.TopicKeywordsResponse(
        keywords=keywords_response,
        analysis_period=f"{start_date} to {end_date}",
        total_papers_analyzed=total_papers_analyzed,
        generated_at=get_utc_now()
    )

async def get_topic_summary(
    db: Session,
    keywords: list[str],
    language: str = "auto",
    system_prompt: Optional[str] = None,
    force_regenerate: bool = False
) -> schemas.TopicSummaryResponse:
    """Generate summary for selected topic keywords"""
    start_time = time.time()
    logging.info(f"Generating topic summary for keywords: {keywords} in {language}...")
    
    if not keywords:
        return schemas.TopicSummaryResponse(
            topic_name="No Topic Selected",
            summary="No keywords were selected for analysis.",
            keywords=[],
            related_paper_count=0,
            key_findings=[],
            generated_at=get_utc_now()
        )
    
    # Get recent papers related to the selected keywords
    cutoff_date = get_time_ago(days=7)
    
    # Find papers containing any of the keywords
    related_papers_query = (
        db.query(models.Paper)
        .join(models.PaperKeyword, models.Paper.id == models.PaperKeyword.paper_id)
        .join(models.Keyword, models.PaperKeyword.keyword_id == models.Keyword.id)
        .filter(
            models.Keyword.name.in_(keywords),
            models.Paper.published_at >= cutoff_date
        )
        .distinct()
        .order_by(models.Paper.published_at.desc())
        .limit(50)
    )
    
    related_papers = related_papers_query.all()
    related_paper_count = related_papers_query.count()
    
    if not related_papers:
        topic_name = " & ".join(keywords) if len(keywords) > 1 else keywords[0]
        return schemas.TopicSummaryResponse(
            topic_name=topic_name,
            summary=f"No recent papers found for the selected topic: {topic_name}.",
            keywords=keywords,
            related_paper_count=0,
            key_findings=[],
            generated_at=get_utc_now()
        )
    
    # Convert papers to analysis format
    papers_data = []
    for paper in related_papers:
        paper_keywords = (
            db.query(models.Keyword.name)
            .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
            .filter(models.PaperKeyword.paper_id == paper.id)
            .all()
        )
        
        paper_data = {
            'id': paper.id,
            'title': paper.title,
            'authors': paper.authors,
            'published_at': paper.published_at.isoformat(),
            'summary': paper.summary,
            'keywords': [kw.name for kw in paper_keywords],
            'arxiv_id': paper.arxiv_id
        }
        papers_data.append(paper_data)
    
    try:
        # Get AI service and generate topic summary with timeout
        ai_service = get_ai_service()
        summary_ai = await asyncio.wait_for(
            ai_service.generate_topic_summary(keywords, papers_data, language, system_prompt),
            timeout=settings.gemini_timeout
        )
        
        # Convert papers to response format
        paper_responses = []
        for paper in related_papers[:20]:  # Limit to first 20 papers for UI
            # Get keywords for this paper
            paper_keywords = (
                db.query(models.Keyword.name)
                .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
                .filter(models.PaperKeyword.paper_id == paper.id)
                .all()
            )
            
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                arxiv_id=paper.arxiv_id,
                title=paper.title,
                summary=paper.summary,
                published_at=paper.published_at,
                authors=paper.authors,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[kw.name for kw in paper_keywords]
            ))

        response = schemas.TopicSummaryResponse(
            topic_name=summary_ai.get('topic_name', ' & '.join(keywords)),
            summary=summary_ai.get('summary', ''),
            keywords=keywords,
            related_paper_count=related_paper_count,
            key_findings=summary_ai.get('key_findings', []),
            generated_at=get_utc_now(),
            papers=paper_responses
        )
        
        logging.info(f"Generated topic summary for {len(keywords)} keywords in {time.time() - start_time:.2f} seconds.")
        return response
        
    except Exception as e:
        logging.error(f"Failed to generate topic summary: {e}")
        
        # Fallback summary
        topic_name = " & ".join(keywords) if len(keywords) > 1 else keywords[0]
        fallback_summary = f"Research in {topic_name} shows active development with {related_paper_count} related papers in the past week. This area encompasses various methodologies and applications in current academic research."
        
        # Convert papers to response format for fallback
        paper_responses = []
        for paper in related_papers[:20]:  # Limit to first 20 papers for UI
            # Get keywords for this paper
            paper_keywords = (
                db.query(models.Keyword.name)
                .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
                .filter(models.PaperKeyword.paper_id == paper.id)
                .all()
            )
            
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                arxiv_id=paper.arxiv_id,
                title=paper.title,
                summary=paper.summary,
                published_at=paper.published_at,
                authors=paper.authors,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[kw.name for kw in paper_keywords]
            ))

        return schemas.TopicSummaryResponse(
            topic_name=topic_name,
            summary=fallback_summary,
            keywords=keywords,
            related_paper_count=related_paper_count,
            key_findings=[
                f"Active research in {topic_name}",
                f"{related_paper_count} papers identified in this area",
                "Diverse methodological approaches observed"
            ],
            generated_at=get_utc_now(),
            papers=paper_responses
        )

async def fetch_papers_from_arxiv(
    db: Session,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> schemas.PaperFetchResponse:
    """Fetch papers from arXiv using the existing script"""
    start_time = time.time()
    logging.info(f"Starting paper fetch from arXiv...")
    
    try:
        # Get script path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        script_path = os.path.join(backend_dir, 'scripts', 'fetch_papers.py')
        
        # Get papers count before fetch
        papers_before = db.query(models.Paper).count()
        
        # Build command
        cmd = ['python', script_path]
        
        if start_date:
            cmd.extend(['--start-date', start_date])
        if end_date:
            cmd.extend(['--end-date', end_date])
        
        # Execute script in background
        logging.info(f"Executing: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=backend_dir,
            timeout=3600  # 1 hour timeout
        )
        
        if result.returncode != 0:
            error_msg = f"Paper fetch script failed with return code {result.returncode}: {result.stderr}"
            logging.error(error_msg)
            return schemas.PaperFetchResponse(
                status="error",
                message=error_msg,
                total_fetched=0,
                processing_time=time.time() - start_time
            )
        
        # Get papers count after fetch
        papers_after = db.query(models.Paper).count()
        total_fetched = papers_after - papers_before
        
        processing_time = time.time() - start_time
        
        success_msg = f"Successfully fetched {total_fetched} new papers in {processing_time:.2f} seconds"
        logging.info(success_msg)
        
        return schemas.PaperFetchResponse(
            status="success",
            message=success_msg,
            total_fetched=total_fetched,
            processing_time=processing_time
        )
        
    except subprocess.TimeoutExpired:
        error_msg = "Paper fetch operation timed out after 1 hour"
        logging.error(error_msg)
        return schemas.PaperFetchResponse(
            status="error",
            message=error_msg,
            total_fetched=0,
            processing_time=time.time() - start_time
        )
    except Exception as e:
        error_msg = f"Failed to fetch papers: {str(e)}"
        logging.error(error_msg)
        return schemas.PaperFetchResponse(
            status="error",
            message=error_msg,
            total_fetched=0,
            processing_time=time.time() - start_time
        )

# Trend Summary Functions
async def create_trend_summary(
    db: Session,
    request: schemas.TrendSummaryRequest
) -> schemas.TrendSummaryResponse:
    """Create a new trend summary analysis"""
    start_time = time.time()
    logging.info(f"Creating trend summary for period {request.period_start} to {request.period_end}...")
    
    try:
        # Parse dates
        period_start = datetime.strptime(request.period_start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        period_end = datetime.strptime(request.period_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        
        # Get papers within the specified period
        papers_query = (
            db.query(models.Paper)
            .filter(
                models.Paper.published_at >= period_start,
                models.Paper.published_at <= period_end
            )
            .order_by(models.Paper.published_at.desc())
            .limit(request.paper_count)
        )
        
        papers = papers_query.all()
        actual_paper_count = len(papers)
        
        if not papers:
            return schemas.TrendSummaryResponse(
                id=0,
                title=request.title,
                period_start=period_start,
                period_end=period_end,
                paper_count=0,
                summary="指定期間内に論文が見つかりませんでした。",
                key_insights=["データが不十分です"],
                top_keywords=[],
                language=request.language,
                created_at=get_utc_now()
            )
        
        # Convert papers to analysis format
        papers_data = []
        for paper in papers:
            paper_keywords = (
                db.query(models.Keyword.name)
                .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
                .filter(models.PaperKeyword.paper_id == paper.id)
                .all()
            )
            
            paper_data = {
                'id': paper.id,
                'title': paper.title,
                'authors': paper.authors,
                'published_at': paper.published_at.isoformat(),
                'summary': paper.summary,
                'keywords': [kw.name for kw in paper_keywords],
                'arxiv_id': paper.arxiv_id
            }
            papers_data.append(paper_data)
        
        # Get AI service with custom provider and model if specified
        if request.ai_provider and request.ai_model:
            from .ai_service import AIServiceFactory
            ai_service = AIServiceFactory.create_service(request.ai_provider, request.ai_model)
        else:
            ai_service = get_ai_service()
        
        # Enhanced prompt for comprehensive trend analysis with Gemini 2.5 thinking
        system_prompt = f"""
        あなたは学術論文の研究トレンドを分析する専門家です。以下の{len(papers_data)}件の学術論文（{request.period_start} から {request.period_end} の期間）を詳細に分析し、包括的な研究トレンドの要約を{request.language}で生成してください。

        **重要な指示:**
        1. **できるだけ多くの論文を言及**: 提供された論文のうち、少なくとも15-20件以上の論文を具体的に言及してください
        2. **[Paper:N]形式の使用**: 特定の論文に言及する際は、必ず[Paper:N]の形式（Nは論文番号）を使用してください
        3. **思考プロセス**: まず論文全体を俯瞰し、主要なテーマやパターンを特定してから詳細な分析を行ってください
        4. **詳細な分析**: 1000-1500文字程度の包括的な分析を行ってください

        **分析項目（各項目で複数の論文を言及）:**
        
        **1. 主要な研究テーマとその傾向**
        - 最も頻繁に現れる研究テーマを特定
        - 各テーマに関連する具体的な論文を[Paper:N]形式で言及
        - テーマ間の関連性や発展傾向を分析

        **2. 新しい技術や手法の動向**
        - 革新的な技術やアプローチを提案する論文を特定
        - 既存技術の改良や新しい応用を示す論文を言及
        - 技術の発展方向性を分析

        **3. 注目すべき発見や進歩**
        - 重要な発見や画期的な結果を報告する論文を特定
        - 性能向上やブレークスルーを示す論文を言及
        - 学術的・実用的インパクトを評価

        **4. 将来的な研究方向性**
        - 新しい研究方向を示唆する論文を特定
        - 今後の発展が期待される分野を分析
        - 残された課題や研究ギャップを指摘

        **フォーマット要件:**
        - Markdownフォーマット（**太字**、*斜体*、リストなど）を使用
        - JSON形式は使わず、構造化された文章で回答
        - 各セクションで具体的な論文を複数言及
        - 論文の内容を正確に反映した分析

        **品質基準:**
        - 論文の多様性を反映した包括的な分析
        - 具体的な論文への言及を通じた根拠のある主張
        - 研究分野の現状と将来性の的確な評価
        - 読者にとって有益で洞察に富む内容

        提供される論文数が多いので、思考プロセスを活用して体系的に分析してください。
        """
        
        summary_result = await asyncio.wait_for(
            ai_service.generate_weekly_trend_overview(papers_data, request.language, system_prompt),
            timeout=settings.gemini_timeout
        )
        
        # Clean up the AI response - remove any JSON formatting if present
        import re
        import json
        
        cleaned_summary = summary_result.strip()
        
        # Try to extract JSON if present and get the summary field
        json_match = re.search(r'\{.*\}', cleaned_summary, re.DOTALL)
        if json_match:
            try:
                json_data = json.loads(json_match.group())
                if isinstance(json_data, dict) and 'summary' in json_data:
                    cleaned_summary = json_data['summary']
                    # Also extract AI-generated insights if available
                    if 'key_insights' in json_data and isinstance(json_data['key_insights'], list):
                        ai_insights = json_data['key_insights'][:3]  # Take first 3
                    else:
                        ai_insights = []
                else:
                    ai_insights = []
            except json.JSONDecodeError:
                ai_insights = []
        else:
            ai_insights = []
        
        # Remove any remaining JSON formatting markers
        cleaned_summary = re.sub(r'^```json\s*', '', cleaned_summary)
        cleaned_summary = re.sub(r'\s*```$', '', cleaned_summary)
        cleaned_summary = re.sub(r'^\{.*?\}\s*', '', cleaned_summary, flags=re.DOTALL)
        cleaned_summary = cleaned_summary.strip()
        
        # Calculate top keywords from the papers
        keyword_counts = {}
        for paper in papers:
            paper_keywords = (
                db.query(models.Keyword.name)
                .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
                .filter(models.PaperKeyword.paper_id == paper.id)
                .all()
            )
            for kw in paper_keywords:
                keyword_counts[kw.name] = keyword_counts.get(kw.name, 0) + 1
        
        # Get top 10 keywords
        top_keywords = [
            {"keyword": kw, "count": count}
            for kw, count in sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        # Generate key insights based on analysis - combine AI insights with data insights
        key_insights = []
        if ai_insights:
            key_insights.extend(ai_insights)
        
        # Add data-driven insights
        data_insights = [
            f"分析期間内に{actual_paper_count}本の論文を調査",
            f"最も頻出するキーワード: {top_keywords[0]['keyword'] if top_keywords else 'データなし'}",
        ]
        
        # Add research activity insight only if we have enough papers
        if actual_paper_count >= 10:
            data_insights.append("研究活動の活発な分野での新しい進展を確認")
        
        key_insights.extend(data_insights)
        
        # Limit to maximum 5 insights
        key_insights = key_insights[:5]
        
        # Convert papers to response format for paper references
        paper_responses = []
        for i, paper in enumerate(papers):  # Use all papers from analysis
            paper_keywords = (
                db.query(models.Keyword.name)
                .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
                .filter(models.PaperKeyword.paper_id == paper.id)
                .all()
            )
            
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                title=paper.title,
                authors=paper.authors,
                summary=paper.summary,
                published_at=paper.published_at,
                arxiv_id=paper.arxiv_id,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[kw.name for kw in paper_keywords]
            ))

        # Create database entry
        trend_summary = models.TrendSummary(
            title=request.title,
            period_start=period_start,
            period_end=period_end,
            paper_count=actual_paper_count,
            summary=cleaned_summary[:5000],  # Use cleaned summary, increased limit for comprehensive analysis
            key_insights=key_insights,
            top_keywords=top_keywords,
            language=request.language
        )
        
        db.add(trend_summary)
        db.commit()
        db.refresh(trend_summary)
        
        logging.info(f"Created trend summary with ID {trend_summary.id} in {time.time() - start_time:.2f} seconds.")
        
        return schemas.TrendSummaryResponse(
            id=trend_summary.id,
            title=trend_summary.title,
            period_start=trend_summary.period_start,
            period_end=trend_summary.period_end,
            paper_count=trend_summary.paper_count,
            summary=cleaned_summary,  # Return cleaned summary
            key_insights=trend_summary.key_insights,
            top_keywords=trend_summary.top_keywords,
            language=trend_summary.language,
            created_at=trend_summary.created_at,
            papers=paper_responses  # Include papers for reference
        )
        
    except Exception as e:
        logging.error(f"Failed to create trend summary: {e}")
        db.rollback()
        
        # Return fallback response
        return schemas.TrendSummaryResponse(
            id=0,
            title=request.title,
            period_start=period_start,
            period_end=period_end,
            paper_count=0,
            summary=f"要約の生成中にエラーが発生しました: {str(e)}",
            key_insights=["エラーが発生しました"],
            top_keywords=[],
            language=request.language,
            created_at=get_utc_now()
        )

def get_trend_summaries(
    db: Session,
    skip: int = 0,
    limit: int = 20
) -> schemas.TrendSummaryListResponse:
    """Get list of trend summaries"""
    
    # Get total count
    total_count = db.query(models.TrendSummary).count()
    
    # Get summaries with pagination
    summaries = (
        db.query(models.TrendSummary)
        .order_by(models.TrendSummary.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    # Convert to response format
    summary_responses = []
    for summary in summaries:
        # Fetch papers from the same period to include in response
        papers = (
            db.query(models.Paper)
            .filter(
                models.Paper.published_at >= summary.period_start,
                models.Paper.published_at <= summary.period_end
            )
            .order_by(models.Paper.published_at.desc())
            .limit(summary.paper_count)  # Use the original paper count limit
            .all()
        )
        
        # Convert papers to response format
        paper_responses = []
        for paper in papers:  # Use all papers from query
            paper_keywords = (
                db.query(models.Keyword.name)
                .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
                .filter(models.PaperKeyword.paper_id == paper.id)
                .all()
            )
            
            paper_responses.append(schemas.PaperResponse(
                id=paper.id,
                title=paper.title,
                authors=paper.authors,
                summary=paper.summary,
                published_at=paper.published_at,
                arxiv_id=paper.arxiv_id,
                arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
                keywords=[kw.name for kw in paper_keywords]
            ))
        
        summary_response = schemas.TrendSummaryResponse(
            id=summary.id,
            title=summary.title,
            period_start=summary.period_start,
            period_end=summary.period_end,
            paper_count=summary.paper_count,
            summary=summary.summary,
            key_insights=summary.key_insights,
            top_keywords=summary.top_keywords,
            language=summary.language,
            created_at=summary.created_at,
            papers=paper_responses  # Include papers
        )
        summary_responses.append(summary_response)
    
    return schemas.TrendSummaryListResponse(
        summaries=summary_responses,
        total_count=total_count
    )

def get_trend_summary_by_id(
    db: Session,
    summary_id: int
) -> Optional[schemas.TrendSummaryResponse]:
    """Get a specific trend summary by ID"""
    
    summary = db.query(models.TrendSummary).filter(models.TrendSummary.id == summary_id).first()
    
    if not summary:
        return None
    
    # Get papers from the same period for reference
    papers = (
        db.query(models.Paper)
        .filter(
            models.Paper.published_at >= summary.period_start,
            models.Paper.published_at <= summary.period_end
        )
        .order_by(models.Paper.published_at.desc())
        .limit(50)  # Match AI processing limit
        .all()
    )
    
    # Convert papers to response format
    paper_responses = []
    for paper in papers:
        paper_keywords = (
            db.query(models.Keyword.name)
            .join(models.PaperKeyword, models.Keyword.id == models.PaperKeyword.keyword_id)
            .filter(models.PaperKeyword.paper_id == paper.id)
            .all()
        )
        
        paper_responses.append(schemas.PaperResponse(
            id=paper.id,
            title=paper.title,
            authors=paper.authors,
            summary=paper.summary,
            published_at=paper.published_at,
            arxiv_id=paper.arxiv_id,
            arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
            keywords=[kw.name for kw in paper_keywords]
        ))
    
    return schemas.TrendSummaryResponse(
        id=summary.id,
        title=summary.title,
        period_start=summary.period_start,
        period_end=summary.period_end,
        paper_count=summary.paper_count,
        summary=summary.summary,
        key_insights=summary.key_insights,
        top_keywords=summary.top_keywords,
        language=summary.language,
        created_at=summary.created_at,
        papers=paper_responses  # Include papers for reference
    )

def get_latest_trend_summary(db: Session, language: str = None) -> schemas.TrendSummaryResponse | None:
    """Get the most recent trend summary, optionally filtered by language"""
    query = db.query(models.TrendSummary)
    
    # 言語が指定された場合、言語でフィルタリング
    if language:
        query = query.filter(models.TrendSummary.language == language)
    
    summary = query.order_by(models.TrendSummary.created_at.desc()).first()
    
    if not summary:
        return None
    
    return get_trend_summary_by_id(db=db, summary_id=summary.id)

def delete_trend_summary(db: Session, summary_id: int) -> bool:
    """Delete a trend summary by ID"""
    summary = db.query(models.TrendSummary).filter(models.TrendSummary.id == summary_id).first()
    
    if not summary:
        return False
    
    try:
        db.delete(summary)
        db.commit()
        logging.info(f"Deleted trend summary with ID {summary_id}")
        return True
    except Exception as e:
        logging.error(f"Failed to delete trend summary {summary_id}: {e}")
        db.rollback()
        raise e

# Paper Summary Functions
async def generate_paper_summary(
    db: Session,
    paper_id: int,
    language: str = "ja"
) -> schemas.PaperSummaryResponse:
    """Generate summary for a specific paper"""
    start_time = time.time()
    logging.info(f"Generating summary for paper ID {paper_id} in {language}...")
    
    # Check if summary already exists
    existing_summary = db.query(models.PaperSummary).filter(
        models.PaperSummary.paper_id == paper_id,
        models.PaperSummary.language == language
    ).first()
    
    if existing_summary:
        logging.info(f"Found existing summary for paper {paper_id}")
        # Return existing summary with paper details
        paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
        if not paper:
            raise Exception("論文が見つかりません")
        
        paper_response = schemas.PaperResponse(
            id=paper.id,
            title=paper.title,
            authors=paper.authors,
            summary=paper.summary,
            published_at=paper.published_at,
            arxiv_id=paper.arxiv_id,
            arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
            keywords=[]
        )
        
        return schemas.PaperSummaryResponse(
            id=existing_summary.id,
            paper_id=existing_summary.paper_id,
            summary=existing_summary.summary,
            language=existing_summary.language,
            created_at=existing_summary.created_at,
            paper=paper_response
        )
    
    # Get paper details
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise Exception("論文が見つかりません")
    
    try:
        # Get AI service
        ai_service = get_ai_service()
        
        # Fetch PDF and extract text
        pdf_text = await ai_service.fetch_arxiv_pdf(paper.arxiv_id)
        
        # Generate summary using AI
        summary_text = await asyncio.wait_for(
            ai_service.generate_paper_summary(pdf_text, language),
            timeout=settings.gemini_timeout
        )
        
        # Save summary to database
        paper_summary = models.PaperSummary(
            paper_id=paper_id,
            summary=summary_text,
            language=language
        )
        
        db.add(paper_summary)
        db.commit()
        db.refresh(paper_summary)
        
        # Prepare paper response
        paper_response = schemas.PaperResponse(
            id=paper.id,
            title=paper.title,
            authors=paper.authors,
            summary=paper.summary,
            published_at=paper.published_at,
            arxiv_id=paper.arxiv_id,
            arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
            keywords=[]
        )
        
        logging.info(f"Generated and saved summary for paper {paper_id} in {time.time() - start_time:.2f} seconds.")
        
        return schemas.PaperSummaryResponse(
            id=paper_summary.id,
            paper_id=paper_summary.paper_id,
            summary=paper_summary.summary,
            language=paper_summary.language,
            created_at=paper_summary.created_at,
            paper=paper_response
        )
        
    except Exception as e:
        logging.error(f"Failed to generate paper summary for {paper_id}: {e}")
        db.rollback()
        raise Exception(f"論文要約の生成に失敗しました: {str(e)}")

def get_paper_summary(
    db: Session,
    paper_id: int
) -> Optional[schemas.PaperSummaryResponse]:
    """Get existing summary for a specific paper"""
    
    paper_summary = db.query(models.PaperSummary).filter(
        models.PaperSummary.paper_id == paper_id
    ).first()
    
    if not paper_summary:
        return None
    
    # Get paper details
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        return None
    
    paper_response = schemas.PaperResponse(
        id=paper.id,
        title=paper.title,
        authors=paper.authors,
        summary=paper.summary,
        published_at=paper.published_at,
        arxiv_id=paper.arxiv_id,
        arxiv_url=f"https://arxiv.org/abs/{paper.arxiv_id}",
        keywords=[]
    )
    
    return schemas.PaperSummaryResponse(
        id=paper_summary.id,
        paper_id=paper_summary.paper_id,
        summary=paper_summary.summary,
        language=paper_summary.language,
        created_at=paper_summary.created_at,
        paper=paper_response
    )


# X (Twitter) Post Generation Functions
async def generate_x_post_text(
    db: Session,
    paper_id: int,
    language: str = "ja",
    custom_prompt: Optional[str] = None,
    ai_provider: Optional[str] = None,
    ai_model: Optional[str] = None
) -> schemas.XPostResponse:
    """Generate X (Twitter) post text from paper summary"""
    start_time = time.time()
    logging.info(f"Generating X post text for paper ID {paper_id} in {language}...")
    
    # Get paper details
    paper = db.query(models.Paper).filter(models.Paper.id == paper_id).first()
    if not paper:
        raise Exception("論文が見つかりません")
    
    # Get existing summary or generate one
    paper_summary = db.query(models.PaperSummary).filter(
        models.PaperSummary.paper_id == paper_id,
        models.PaperSummary.language == language
    ).first()
    
    summary_text = ""
    if paper_summary:
        summary_text = paper_summary.summary
    else:
        # Generate summary first
        summary_response = await generate_paper_summary(db, paper_id, language)
        summary_text = summary_response.summary
    
    try:
        # Get AI service with custom provider and model if specified
        if ai_provider and ai_model:
            from .ai_service import AIServiceFactory
            ai_service = AIServiceFactory.create_service(ai_provider, ai_model)
        else:
            ai_service = get_ai_service()
        
        # Create prompt for X post generation
        if custom_prompt:
            system_prompt = custom_prompt
        elif language == "ja":
            system_prompt = """
あなたは学術論文の魅力を伝える専門家です。
以下の論文要約から、X (Twitter) 投稿用の魅力的なテキストを生成してください。

要件:
1. 280文字以内（日本語）※絶対に超えないでください
2. 論文の興味深い点、意義、インパクトを簡潔に表現
3. 一般の人にもわかりやすく
4. 適切なハッシュタグを2-3個含める (#AI #機械学習 #論文 など)
5. 論文の革新性や面白さを簡潔に伝える
6. 感情を込めた魅力的で簡潔な文章

直接的で要点を絞ったX投稿のテキストのみを出力してください。説明文や前置きは不要です。
"""
        else:
            system_prompt = """
You are an expert at communicating the appeal of academic papers.
Please generate engaging text for X (Twitter) posts based on the following paper summary.

Requirements:
1. Within 280 characters (English) - MUST NOT exceed this limit
2. Emphasize key points, significance, and impact concisely
3. Make it accessible to general audience
4. Include 2-3 relevant hashtags (#AI #MachineLearning #Research etc.)
5. Convey innovation and excitement concisely
6. Write with emotion and appeal

Output only the X post text directly. No explanations or preamble needed.
"""
        
        user_prompt = f"""
論文タイトル: {paper.title}
著者: {', '.join(paper.authors)}
要約: {summary_text}

上記の論文要約から、魅力的なX (Twitter) 投稿テキストを生成してください。
"""
        
        # Generate X post text using the existing generate_summary method
        combined_prompt = f"{system_prompt}\n\n{user_prompt}"
        post_text = await ai_service.generate_summary(
            text=combined_prompt,
            language=language
        )
        
        # Clean up the generated text
        post_text = post_text.strip()
        
        # Ensure it's within character limits
        if language == "ja":
            if len(post_text) > 280:
                post_text = post_text[:277] + "..."
        else:
            if len(post_text) > 280:
                post_text = post_text[:277] + "..."
        
        # Generate X post URL
        arxiv_url = f"https://arxiv.org/abs/{paper.arxiv_id}"
        
        # URL encode the text for Twitter
        import urllib.parse
        encoded_text = urllib.parse.quote(post_text)
        encoded_url = urllib.parse.quote(arxiv_url)
        
        tweet_url = f"https://twitter.com/intent/tweet?text={encoded_text}&url={encoded_url}"
        
        processing_time = time.time() - start_time
        logging.info(f"Generated X post text in {processing_time:.2f} seconds")
        
        return schemas.XPostResponse(
            tweet_text=post_text,
            tweet_url=tweet_url,
            paper_title=paper.title,
            paper_url=arxiv_url,
            generated_at=get_utc_now()
        )
        
    except Exception as e:
        logging.error(f"Failed to generate X post text: {e}")
        raise Exception(f"X投稿テキストの生成に失敗しました: {str(e)}")
