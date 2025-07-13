"""
Test cases for paper summary functionality
"""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db
from app import models
from test_api import client, session, PaperFactory, KeywordFactory, PaperKeywordFactory


def test_generate_paper_summary_success(client, session):
    """Test successful paper summary generation"""
    paper = PaperFactory(arxiv_id="2301.12345")
    session.commit()
    
    # Mock AI service methods
    with patch('app.services.get_ai_service') as mock_ai_service:
        mock_service = AsyncMock()
        mock_service.fetch_arxiv_pdf.return_value = "Sample PDF content"
        mock_service.generate_paper_summary.return_value = "This is a test summary"
        mock_ai_service.return_value = mock_service
        
        response = client.post(f"/api/v1/papers/{paper.id}/summary", json={
            "paper_id": paper.id,
            "language": "ja"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["paper_id"] == paper.id
        assert data["summary"] == "This is a test summary"
        assert data["language"] == "ja"
        assert "created_at" in data


def test_get_existing_paper_summary(client, session):
    """Test retrieving existing paper summary"""
    paper = PaperFactory()
    session.commit()
    
    # Create summary in database
    summary = models.PaperSummary(
        paper_id=paper.id,
        summary="Existing summary",
        language="ja"
    )
    session.add(summary)
    session.commit()
    session.refresh(summary)
    
    response = client.get(f"/api/v1/papers/{paper.id}/summary")
    
    assert response.status_code == 200
    data = response.json()
    assert data["paper_id"] == paper.id
    assert data["summary"] == "Existing summary"
    assert data["language"] == "ja"


def test_get_paper_summary_not_found(client, session):
    """Test retrieving summary for non-existent paper"""
    response = client.get("/api/v1/papers/99999/summary")
    
    assert response.status_code == 404
    assert "要約が見つかりません" in response.json()["detail"]


def test_generate_paper_summary_paper_not_found(client, session):
    """Test generating summary for non-existent paper"""
    response = client.post("/api/v1/papers/99999/summary", json={
        "paper_id": 99999,
        "language": "ja"
    })
    
    assert response.status_code == 500
    assert "論文が見つかりません" in response.json()["detail"]


def test_generate_paper_summary_duplicate_returns_existing(client, session):
    """Test that generating summary for paper with existing summary returns existing"""
    paper = PaperFactory()
    session.commit()
    
    # Create existing summary
    existing_summary = models.PaperSummary(
        paper_id=paper.id,
        summary="Existing summary",
        language="ja"
    )
    session.add(existing_summary)
    session.commit()
    
    # Try to generate new summary
    response = client.post(f"/api/v1/papers/{paper.id}/summary", json={
        "paper_id": paper.id,
        "language": "ja"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == "Existing summary"
    assert data["paper_id"] == paper.id


def test_generate_paper_summary_ai_error(client, session):
    """Test handling of AI service errors"""
    paper = PaperFactory(arxiv_id="2301.12345")
    session.commit()
    
    # Mock AI service to raise error
    with patch('app.services.get_ai_service') as mock_ai_service:
        mock_service = AsyncMock()
        mock_service.fetch_arxiv_pdf.side_effect = Exception("PDF fetch failed")
        mock_ai_service.return_value = mock_service
        
        response = client.post(f"/api/v1/papers/{paper.id}/summary", json={
            "paper_id": paper.id,
            "language": "ja"
        })
        
        assert response.status_code == 500
        assert "論文要約の生成に失敗しました" in response.json()["detail"]


def test_paper_summary_database_operations(session):
    """Test database operations for paper summaries"""
    paper = PaperFactory()
    session.commit()
    
    # Create summary
    summary = models.PaperSummary(
        paper_id=paper.id,
        summary="Test summary content",
        language="ja"
    )
    session.add(summary)
    session.commit()
    session.refresh(summary)
    
    # Verify summary was created
    assert summary.id is not None
    assert summary.paper_id == paper.id
    assert summary.summary == "Test summary content"
    assert summary.language == "ja"
    assert summary.created_at is not None
    
    # Test relationship
    assert summary.paper.id == paper.id
    assert paper.paper_summary[0].id == summary.id
    
    # Test unique constraint
    duplicate_summary = models.PaperSummary(
        paper_id=paper.id,
        summary="Another summary",
        language="ja"
    )
    session.add(duplicate_summary)
    
    with pytest.raises(Exception):  # Should raise integrity error
        session.commit()