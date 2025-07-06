from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class PaperBase(BaseModel):
    title: str
    summary: str
    published_at: datetime

class Paper(PaperBase):
    id: int
    arxiv_id: str
    authors: list

    model_config = {'from_attributes': True}

class DashboardSummary(BaseModel):
    total_papers: int
    total_keywords: int
    latest_paper_date: datetime | None
    recent_papers_24h: int
    recent_papers_7d: int
    recent_papers_30d: int

class TrendDataPoint(BaseModel):
    date: str
    count: int

class TrendResult(BaseModel):
    keyword: str
    data: list[TrendDataPoint]

    model_config = {'from_attributes': True}

class TrendingKeyword(BaseModel):
    name: str
    recent_count: int
    previous_count: int
    growth_count: int
    growth_rate_percent: float

    model_config = {'from_attributes': True}

class DashboardTrendingKeywords(BaseModel):
    trending_keywords: list[TrendingKeyword]

    model_config = {'from_attributes': True}

class PaperSearchResult(Paper):
    arxiv_url: str

    model_config = {'from_attributes': True}

class PaperSearchResponse(BaseModel):
    papers: list[PaperSearchResult]
    total_count: int

class PaperResponse(BaseModel):
    id: int
    title: str
    authors: List[str]
    summary: str
    published_at: datetime
    arxiv_id: str
    arxiv_url: str
    keywords: List[str] = []

    model_config = {'from_attributes': True}

class WordData(BaseModel):
    text: str
    value: int

class WeeklyKeywordRank(BaseModel):
    keyword: str
    rank: int
    count: int

class WeeklyRanking(BaseModel):
    week: str  # Format: YYYY-MM-DD (Monday of the week)
    rankings: list[WeeklyKeywordRank]

# Weekly Trend Analysis Schemas
class WeeklyTrendRequest(BaseModel):
    language: Optional[str] = "auto"
    system_prompt: Optional[str] = None
    force_regenerate: Optional[bool] = False
    
class WeeklyTrendResponse(BaseModel):
    trend_overview: str
    analysis_period: str  # e.g., "2025-06-23 to 2025-06-30"
    total_papers_analyzed: int
    generated_at: datetime
    papers: Optional[List['PaperResponse']] = None  # Papers used in the analysis

# Topic Keywords Schemas
class TopicKeyword(BaseModel):
    keyword: str
    paper_count: int
    relevance_score: float

class TopicKeywordsRequest(BaseModel):
    language: Optional[str] = "auto"
    max_keywords: Optional[int] = 30
    system_prompt: Optional[str] = None
    force_regenerate: Optional[bool] = False

class TopicKeywordsResponse(BaseModel):
    keywords: List[TopicKeyword]
    analysis_period: str
    total_papers_analyzed: int
    generated_at: datetime

# Topic Summary Schemas
class TopicSummaryRequest(BaseModel):
    keywords: List[str]  # Selected keywords
    language: Optional[str] = "auto"
    system_prompt: Optional[str] = None
    force_regenerate: Optional[bool] = False

class TopicSummaryResponse(BaseModel):
    topic_name: str  # Combined topic name from keywords
    summary: str
    keywords: List[str]
    related_paper_count: int
    key_findings: List[str]
    generated_at: datetime

# Legacy Hot Topics Schemas (for backward compatibility)
class HotTopicPaper(BaseModel):
    id: int
    title: str
    authors: List[str]
    published_at: datetime
    arxiv_url: str
    summary: str

class HotTopic(BaseModel):
    topic: str
    paper_count: int
    recent_papers: List[HotTopicPaper]
    summary: str
    keywords: List[str]
    trend_score: float

class HotTopicsRequest(BaseModel):
    language: Optional[str] = "auto"
    days: Optional[int] = 30
    max_topics: Optional[int] = 10

class HotTopicsResponse(BaseModel):
    hot_topics: List[HotTopic]
    analysis_period_days: int
    total_papers_analyzed: int
    generated_at: datetime

# Paper Fetching Schemas
class PaperFetchRequest(BaseModel):
    start_date: Optional[str] = None  # YYYY-MM-DD format
    end_date: Optional[str] = None    # YYYY-MM-DD format
    
class PaperFetchResponse(BaseModel):
    status: str
    message: str
    total_fetched: int
    processing_time: float

class LatestPaperInfo(BaseModel):
    latest_date: Optional[str] = None  # YYYY-MM-DD format
    total_papers: int

class DictionaryKeyword(BaseModel):
    id: str
    keyword: str
    importance: str  # 'high', 'medium', 'low'
    category: str
    created_at: str
