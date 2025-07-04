from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from datetime import datetime, timedelta, timezone

from . import models, schemas
import logging
import time
import re
import requests
import xml.etree.ElementTree as ET
from collections import Counter

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
