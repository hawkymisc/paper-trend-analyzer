
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
