from pydantic import BaseModel
from datetime import datetime

class PaperBase(BaseModel):
    title: str
    summary: str
    published_at: datetime

class Paper(PaperBase):
    id: int
    arxiv_id: str
    authors: list

    class Config:
        orm_mode = True

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

    class Config:
        from_attributes = True

class TrendingKeyword(BaseModel):
    name: str
    recent_count: int
    previous_count: int
    growth_count: int
    growth_rate_percent: float

    class Config:
        from_attributes = True

class DashboardTrendingKeywords(BaseModel):
    trending_keywords: list[TrendingKeyword]

    class Config:
        from_attributes = True

class PaperSearchResult(Paper):
    arxiv_url: str

    class Config:
        orm_mode = True

class PaperSearchResponse(BaseModel):
    papers: list[PaperSearchResult]
    total_count: int

class WordData(BaseModel):
    text: str
    value: int
