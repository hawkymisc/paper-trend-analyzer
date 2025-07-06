
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base, UTCDateTime

class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    arxiv_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False, index=True)
    authors = Column(JSON)
    summary = Column(Text, nullable=False)
    published_at = Column(UTCDateTime, nullable=False, index=True)
    created_at = Column(UTCDateTime, server_default=func.now())
    updated_at = Column(UTCDateTime, server_default=func.now(), onupdate=func.now())

    keywords = relationship("PaperKeyword", back_populates="paper")

    __table_args__ = (
        Index('idx_paper_published_title', 'published_at', 'title'),
        Index('idx_paper_published_summary', 'published_at', 'summary'),
    )

class Keyword(Base):
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    papers = relationship("PaperKeyword", back_populates="keyword")

class PaperKeyword(Base):
    __tablename__ = "paper_keywords"

    paper_id = Column(Integer, ForeignKey("papers.id"), primary_key=True)
    keyword_id = Column(Integer, ForeignKey("keywords.id"), primary_key=True)

    paper = relationship("Paper", back_populates="keywords")
    keyword = relationship("Keyword", back_populates="papers")

class WeeklyTrendCache(Base):
    __tablename__ = "weekly_trend_cache"

    id = Column(Integer, primary_key=True, index=True)
    analysis_period_start = Column(UTCDateTime, nullable=False, index=True)
    analysis_period_end = Column(UTCDateTime, nullable=False, index=True)
    language = Column(String(10), nullable=False, index=True)
    trend_overview = Column(Text, nullable=False)
    total_papers_analyzed = Column(Integer, nullable=False)
    created_at = Column(UTCDateTime, server_default=func.now())
    updated_at = Column(UTCDateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_weekly_trend_period_lang', 'analysis_period_start', 'analysis_period_end', 'language'),
    )

class TopicKeywordsCache(Base):
    __tablename__ = "topic_keywords_cache"

    id = Column(Integer, primary_key=True, index=True)
    analysis_period_start = Column(UTCDateTime, nullable=False, index=True)
    analysis_period_end = Column(UTCDateTime, nullable=False, index=True)
    language = Column(String(10), nullable=False, index=True)
    keywords_data = Column(JSON, nullable=False)  # Array of {keyword, paper_count, relevance_score}
    total_papers_analyzed = Column(Integer, nullable=False)
    created_at = Column(UTCDateTime, server_default=func.now())
    updated_at = Column(UTCDateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_topic_keywords_period_lang', 'analysis_period_start', 'analysis_period_end', 'language'),
    )

class TopicSummaryCache(Base):
    __tablename__ = "topic_summary_cache"

    id = Column(Integer, primary_key=True, index=True)
    keywords_hash = Column(String(64), nullable=False, index=True)  # Hash of sorted keywords
    language = Column(String(10), nullable=False, index=True)
    analysis_period_start = Column(UTCDateTime, nullable=False)
    analysis_period_end = Column(UTCDateTime, nullable=False)
    topic_name = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    keywords = Column(JSON, nullable=False)  # Array of selected keywords
    related_paper_count = Column(Integer, nullable=False)
    key_findings = Column(JSON, nullable=False)  # Array of key findings
    created_at = Column(UTCDateTime, server_default=func.now())
    updated_at = Column(UTCDateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_topic_summary_hash_lang', 'keywords_hash', 'language'),
    )
