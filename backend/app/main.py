from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp
from asyncio import TimeoutError, wait_for
from sqlalchemy import func
from collections import defaultdict
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import logging
import time

from . import models, schemas, services
from .database import engine, get_db

# データベースとテーブルを作成
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # すべてのオリジンを許可 (開発用)
    allow_credentials=True,
    allow_methods=["*"],  # すべてのHTTPメソッドを許可
    allow_headers=["*"],  # すべてのHTTPヘッダーを許可
)

@app.get("/api/v1/trends", response_model=list[schemas.TrendResult])
def get_trends(
    keywords: list[str] = Query(..., description="分析したいキーワードのリスト"),
    start_date: datetime | None = Query(None, description="開始日 (YYYY-MM-DD)"),
    end_date: datetime | None = Query(None, description="終了日 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    if not keywords:
        raise HTTPException(status_code=400, detail="キーワードは少なくとも1つ指定してください。")

    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="開始日は終了日より前に設定してください。")

    return services.get_trends_data(db, keywords, start_date, end_date)

@app.get("/api/v1/dashboard/trending-keywords", response_model=schemas.DashboardTrendingKeywords)
def get_trending_keywords(db: Session = Depends(get_db)):
    trending_keywords = services.get_trending_keywords_data(db)
    return {"trending_keywords": trending_keywords}

@app.get("/api/v1/dashboard/summary", response_model=schemas.DashboardSummary)
def get_summary(db: Session = Depends(get_db)):
    summary_data = services.get_summary_data(db)
    return summary_data

@app.get("/api/v1/papers/search", response_model=schemas.PaperSearchResponse)
def search_papers(
    query: str = Query(..., min_length=1, description="検索キーワード"),
    skip: int = Query(0, ge=0, description="スキップする件数"),
    limit: int = Query(100, ge=1, le=200, description="取得する最大件数"),
    db: Session = Depends(get_db)
):
    return services.search_papers(db, query, skip, limit)

@app.get("/api/v1/keywords/word-cloud", response_model=list[schemas.WordData])
def get_word_cloud(db: Session = Depends(get_db)):
    return services.get_word_cloud_data(db)
