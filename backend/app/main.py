from fastapi import FastAPI, Depends, HTTPException, Query, Body
from typing import Optional
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

# ルートエンドポイント - セキュリティ上の理由により最小限の情報のみ提供
@app.get("/")
def read_root():
    """
    API ルートエンドポイント
    セキュリティ上の理由により、システム情報は最小限に制限されています。
    """
    return {
        "service": "paper-trend-analyzer",
        "status": "running",
        "api_version": "v1",
        "endpoints": "/docs"
    }

@app.get("/api/v1/trends", response_model=list[schemas.TrendResult])
def get_trends(
    keywords: list[str] = Query(..., description="分析したいキーワードのリスト"),
    start_date: str | None = Query(None, description="開始日 (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="終了日 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    if not keywords:
        raise HTTPException(status_code=400, detail="キーワードは少なくとも1つ指定してください。")

    # 日付文字列をdatetimeオブジェクトに変換
    start_datetime = None
    end_datetime = None
    
    try:
        if start_date:
            # ISO 8601形式 (YYYY-MM-DDTHH:MM:SSZ) または YYYY-MM-DD形式をサポート
            if 'T' in start_date:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            else:
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if end_date:
            if 'T' in end_date:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            else:
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="日付フォーマットが正しくありません。YYYY-MM-DD または YYYY-MM-DDTHH:MM:SSZ形式で入力してください。")

    if start_datetime and end_datetime and start_datetime > end_datetime:
        raise HTTPException(status_code=400, detail="開始日は終了日より前に設定してください。")

    return services.get_trends_data(db, keywords, start_datetime, end_datetime)

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
    start_date: str | None = Query(None, description="開始日 (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="終了日 (YYYY-MM-DD)"),
    sort_by: str = Query("date", regex="^(date|relevance)$", description="並び順 (date: 新しい順, relevance: 関連度順)"),
    db: Session = Depends(get_db)
):
    # 日付文字列をdatetimeオブジェクトに変換
    start_datetime = None
    end_datetime = None
    
    try:
        if start_date:
            # ISO 8601形式 (YYYY-MM-DDTHH:MM:SSZ) または YYYY-MM-DD形式をサポート
            if 'T' in start_date:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            else:
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if end_date:
            if 'T' in end_date:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            else:
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="日付フォーマットが正しくありません。YYYY-MM-DD または YYYY-MM-DDTHH:MM:SSZ形式で入力してください。")

    if start_datetime and end_datetime and start_datetime > end_datetime:
        raise HTTPException(status_code=400, detail="開始日は終了日より前に設定してください。")

    return services.search_papers(db, query, skip, limit, start_datetime, end_datetime, sort_by)

@app.get("/api/v1/keywords/word-cloud", response_model=list[schemas.WordData])
def get_word_cloud(db: Session = Depends(get_db)):
    return services.get_word_cloud_data(db)

@app.post("/api/v1/keywords/word-cloud", response_model=list[schemas.WordData])
def get_word_cloud_with_dictionary(
    dictionary: list[schemas.DictionaryKeyword] = Body(...),
    db: Session = Depends(get_db)
):
    return services.get_word_cloud_data_with_dictionary(db, dictionary)

@app.post("/api/v1/keywords/suggestions", response_model=list[str])
def get_keyword_suggestions(
    dictionary: list[schemas.DictionaryKeyword] = Body(...),
    query: str = Query("", description="検索クエリ")
):
    return services.get_keyword_suggestions(dictionary, query)

@app.get("/api/v1/keywords/stats")
def get_keyword_stats(db: Session = Depends(get_db)):
    """キーワード統計情報"""
    total_keywords = db.query(func.count(models.Keyword.id)).scalar()
    total_associations = db.query(func.count(models.PaperKeyword.paper_id)).scalar()
    
    return {
        "total_keywords": total_keywords,
        "total_associations": total_associations
    }

@app.post("/api/v1/hot-topics/summary", response_model=schemas.HotTopicsResponse)
async def get_hot_topics_summary(
    request: schemas.HotTopicsRequest,
    db: Session = Depends(get_db)
):
    """Generate hot topics summary using AI analysis"""
    try:
        # Validate parameters
        days = min(max(request.days or 30, 1), 90)  # 1-90 days
        max_topics = min(max(request.max_topics or 10, 1), 20)  # 1-20 topics
        language = request.language or "auto"
        
        # Call service function
        response = await services.get_hot_topics_summary(
            db=db,
            language=language,
            days=days,
            max_topics=max_topics
        )
        
        return response
        
    except Exception as e:
        logging.error(f"Hot topics summary failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate hot topics summary: {str(e)}"
        )

@app.get("/api/v1/hot-topics/summary", response_model=schemas.HotTopicsResponse)
async def get_hot_topics_summary_get(
    language: str = Query("auto", description="Summary language (auto, en, ja, zh, ko, de)"),
    days: int = Query(30, ge=1, le=90, description="Analysis period in days"),
    max_topics: int = Query(10, ge=1, le=20, description="Maximum number of topics"),
    db: Session = Depends(get_db)
):
    """Generate hot topics summary using AI analysis (GET version)"""
    try:
        # Call service function
        response = await services.get_hot_topics_summary(
            db=db,
            language=language,
            days=days,
            max_topics=max_topics
        )
        
        return response
        
    except Exception as e:
        logging.error(f"Hot topics summary failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate hot topics summary: {str(e)}"
        )

# New Weekly Trend Analysis Endpoints
@app.get("/api/v1/weekly-trend/latest", response_model=schemas.WeeklyTrendResponse)
async def get_latest_weekly_trend_overview_endpoint(
    language: str = Query("auto", description="Summary language (auto, en, ja, zh, ko, de)"),
    db: Session = Depends(get_db)
):
    """Get latest cached weekly trend overview"""
    try:
        response = await services.get_latest_weekly_trend_overview(
            db=db,
            language=language
        )
        if response:
            return response
        else:
            raise HTTPException(
                status_code=404,
                detail="No weekly trend analysis found for this week. Please generate a new analysis."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Latest weekly trend overview failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get latest weekly trend overview: {str(e)}"
        )

@app.post("/api/v1/weekly-trend/generate", response_model=schemas.WeeklyTrendResponse)
async def generate_weekly_trend_overview_endpoint(
    request: schemas.WeeklyTrendRequest = Body(default=schemas.WeeklyTrendRequest()),
    db: Session = Depends(get_db)
):
    """Generate new weekly trend overview (AI analysis)"""
    try:
        response = await services.get_weekly_trend_overview(
            db=db,
            language=request.language,
            system_prompt=request.system_prompt,
            force_regenerate=request.force_regenerate
        )
        return response
        
    except Exception as e:
        logging.error(f"Weekly trend overview generation failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate weekly trend overview: {str(e)}"
        )

@app.post("/api/v1/topic-keywords", response_model=schemas.TopicKeywordsResponse)
async def get_topic_keywords_endpoint(
    request: schemas.TopicKeywordsRequest = Body(default=schemas.TopicKeywordsRequest()),
    db: Session = Depends(get_db)
):
    """Extract topic keywords from recent papers"""
    try:
        response = await services.get_topic_keywords(
            db=db,
            language=request.language,
            max_keywords=request.max_keywords,
            system_prompt=request.system_prompt,
            force_regenerate=request.force_regenerate
        )
        return response
        
    except Exception as e:
        logging.error(f"Topic keywords extraction failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to extract topic keywords: {str(e)}"
        )

@app.post("/api/v1/topic-summary", response_model=schemas.TopicSummaryResponse)
async def get_topic_summary_endpoint(
    request: schemas.TopicSummaryRequest,
    db: Session = Depends(get_db)
):
    """Generate summary for selected topic keywords"""
    try:
        # Validate parameters
        keywords = request.keywords or []
        language = request.language or "auto"
        
        if not keywords:
            raise HTTPException(
                status_code=400,
                detail="At least one keyword must be provided"
            )
        
        if len(keywords) > 10:
            raise HTTPException(
                status_code=400,
                detail="Maximum 10 keywords allowed"
            )
        
        response = await services.get_topic_summary(
            db=db,
            keywords=keywords,
            language=language,
            system_prompt=request.system_prompt,
            force_regenerate=request.force_regenerate
        )
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Topic summary failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate topic summary: {str(e)}"
        )

@app.post("/api/v1/papers/fetch", response_model=schemas.PaperFetchResponse)
async def fetch_papers_endpoint(
    request: schemas.PaperFetchRequest = Body(default=schemas.PaperFetchRequest()),
    db: Session = Depends(get_db)
):
    """Fetch new papers from arXiv"""
    try:
        response = await services.fetch_papers_from_arxiv(
            db=db,
            start_date=request.start_date,
            end_date=request.end_date
        )
        return response
        
    except Exception as e:
        logging.error(f"Failed to fetch papers: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch papers: {str(e)}"
        )

@app.get("/api/v1/papers/latest-date")
async def get_latest_paper_date(db: Session = Depends(get_db)):
    """Get the latest paper date in the database"""
    try:
        latest_paper = db.query(models.Paper).order_by(models.Paper.published_at.desc()).first()
        if latest_paper:
            return {
                "latest_date": latest_paper.published_at.isoformat(),
                "total_papers": db.query(models.Paper).count()
            }
        else:
            return {
                "latest_date": None,
                "total_papers": 0
            }
    except Exception as e:
        logging.error(f"Failed to get latest paper date: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get latest paper date: {str(e)}"
        )

# Trend Summary Endpoints
@app.post("/api/v1/trend-summary", response_model=schemas.TrendSummaryResponse)
async def create_trend_summary_endpoint(
    request: schemas.TrendSummaryRequest,
    db: Session = Depends(get_db)
):
    """Create a new trend summary analysis"""
    try:
        response = await services.create_trend_summary(db=db, request=request)
        return response
    except Exception as e:
        logging.error(f"Trend summary creation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"トレンド要約の作成に失敗しました: {str(e)}"
        )

@app.get("/api/v1/trend-summaries", response_model=schemas.TrendSummaryListResponse)
def get_trend_summaries_endpoint(
    skip: int = Query(0, ge=0, description="スキップする件数"),
    limit: int = Query(20, ge=1, le=100, description="取得する最大件数"),
    db: Session = Depends(get_db)
):
    """Get list of trend summaries with pagination"""
    try:
        response = services.get_trend_summaries(db=db, skip=skip, limit=limit)
        return response
    except Exception as e:
        logging.error(f"Failed to get trend summaries: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"トレンド要約一覧の取得に失敗しました: {str(e)}"
        )

@app.get("/api/v1/trend-summary/latest", response_model=schemas.TrendSummaryResponse)
def get_latest_trend_summary_endpoint(
    language: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get the most recent trend summary, optionally filtered by language"""
    try:
        response = services.get_latest_trend_summary(db=db, language=language)
        if not response:
            if language:
                raise HTTPException(
                    status_code=404,
                    detail=f"{language}言語のトレンド要約が見つかりません"
                )
            else:
                raise HTTPException(
                    status_code=404,
                    detail="トレンド要約が見つかりません"
                )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get latest trend summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"最新のトレンド要約の取得に失敗しました: {str(e)}"
        )

@app.get("/api/v1/trend-summary/{summary_id}", response_model=schemas.TrendSummaryResponse)
def get_trend_summary_endpoint(
    summary_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific trend summary by ID"""
    try:
        response = services.get_trend_summary_by_id(db=db, summary_id=summary_id)
        if not response:
            raise HTTPException(
                status_code=404,
                detail="指定されたトレンド要約が見つかりません"
            )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get trend summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"トレンド要約の取得に失敗しました: {str(e)}"
        )

@app.delete("/api/v1/trend-summary/{summary_id}")
def delete_trend_summary_endpoint(
    summary_id: int,
    db: Session = Depends(get_db)
):
    """Delete a specific trend summary by ID"""
    try:
        success = services.delete_trend_summary(db=db, summary_id=summary_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail="指定されたトレンド要約が見つかりません"
            )
        return {"message": "トレンド要約が正常に削除されました"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete trend summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"トレンド要約の削除に失敗しました: {str(e)}"
        )

# Paper Summary Endpoints
@app.post("/api/v1/papers/{paper_id}/summary", response_model=schemas.PaperSummaryResponse)
async def generate_paper_summary_endpoint(
    paper_id: int,
    request: schemas.PaperSummaryRequest = Body(...),
    db: Session = Depends(get_db)
):
    """Generate summary for a specific paper"""
    try:
        response = await services.generate_paper_summary(
            db=db, 
            paper_id=paper_id, 
            language=request.language
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to generate paper summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"論文要約の生成に失敗しました: {str(e)}"
        )

@app.get("/api/v1/papers/{paper_id}/summary", response_model=schemas.PaperSummaryResponse)
def get_paper_summary_endpoint(
    paper_id: int,
    db: Session = Depends(get_db)
):
    """Get existing summary for a specific paper"""
    try:
        response = services.get_paper_summary(db=db, paper_id=paper_id)
        if not response:
            raise HTTPException(
                status_code=404,
                detail="この論文の要約が見つかりません"
            )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get paper summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"論文要約の取得に失敗しました: {str(e)}"
        )
