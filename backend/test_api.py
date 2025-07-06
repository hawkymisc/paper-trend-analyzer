import pytest
import random
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timedelta, timezone
import factory
import factory.fuzzy

from app.main import app
from app.database import Base, get_db
from app.models import Paper, Keyword, PaperKeyword
from app import services

# テスト用データベースの設定
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(autouse=True)
def clear_cache():
    services.cache.clear()

@pytest.fixture(scope="function")
def session():
    # Create a new in-memory engine for each test
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Set the session for all factories
    PaperFactory._meta.sqlalchemy_session = db
    KeywordFactory._meta.sqlalchemy_session = db
    PaperKeywordFactory._meta.sqlalchemy_session = db
    
    try:
        yield db
    finally:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        db.close()

@pytest.fixture(scope="function")
def client(session):
    def override_get_db():
        yield session
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# Factory Boyの設定
class PaperFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = Paper
        sqlalchemy_session_persistence = "commit"

    arxiv_id = factory.Sequence(lambda n: f"arxiv_id_{n}")
    title = factory.fuzzy.FuzzyText(length=50)
    authors = factory.List([factory.fuzzy.FuzzyText(length=10) for _ in range(2)])
    summary = factory.fuzzy.FuzzyText(length=200)
    published_at = factory.fuzzy.FuzzyDateTime(datetime(2023, 1, 1, tzinfo=timezone.utc))

class KeywordFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = Keyword
        sqlalchemy_session_persistence = "commit"

    name = factory.Sequence(lambda n: f"keyword_{n}")

class PaperKeywordFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = PaperKeyword
        sqlalchemy_session_persistence = "commit"

    paper = factory.SubFactory(PaperFactory)
    keyword = factory.SubFactory(KeywordFactory)

# テストデータ生成ヘルパー
def create_test_data(session, num_papers=10, num_keywords=5):
    papers = PaperFactory.create_batch(num_papers)
    keywords = KeywordFactory.create_batch(num_keywords)

    # 論文とキーワードを関連付ける
    for paper in papers:
        num_paper_keywords = random.randint(1, num_keywords)
        selected_keywords = random.sample(keywords, num_paper_keywords)
        for keyword in selected_keywords:
            PaperKeywordFactory(paper=paper, keyword=keyword)
    session.commit()
    return papers, keywords

# テストケース

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Paper Trend Analyzer API"}

def test_get_dashboard_summary_with_data(client, session):
    # 過去24時間以内の論文を3つ作成
    PaperFactory.create_batch(3, published_at=datetime.now(timezone.utc) - timedelta(hours=1))
    # 過去7日以内の論文を2つ作成 (24時間以内と重複しないように)
    PaperFactory.create_batch(2, published_at=datetime.now(timezone.utc) - timedelta(days=2))
    # 過去30日以内の論文を1つ作成 (7日以内と重複しないように)
    PaperFactory.create_batch(1, published_at=datetime.now(timezone.utc) - timedelta(days=10))
    session.commit()

    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_papers"] == 6
    assert data["recent_papers_24h"] == 3
    assert data["recent_papers_7d"] == 5 # 3 (24h) + 2 (7d)
    assert data["recent_papers_30d"] == 6 # 3 (24h) + 2 (7d) + 1 (30d)

def test_get_dashboard_summary_empty_db(client):
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_papers"] == 0
    assert data["recent_papers_24h"] == 0
    assert data["recent_papers_7d"] == 0
    assert data["recent_papers_30d"] == 0

def test_get_trends_single_keyword(client, session):
    keyword_llm = KeywordFactory(name="LLM")
    paper1 = PaperFactory(published_at=datetime(2023, 1, 1, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper1, keyword=keyword_llm)
    paper2 = PaperFactory(published_at=datetime(2023, 2, 1, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper2, keyword=keyword_llm)
    paper3 = PaperFactory(published_at=datetime(2023, 1, 15, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper3, keyword=keyword_llm)
    session.commit()

    response = client.get("/api/v1/trends?keywords=LLM")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["keyword"] == "LLM"
    assert len(data[0]["data"]) == 2
    # sort data by date before asserting
    sorted_data = sorted(data[0]["data"], key=lambda x: x["date"])
    assert sorted_data[0]["date"] == "2023-01"
    assert sorted_data[0]["count"] == 2
    assert sorted_data[1]["date"] == "2023-02"
    assert sorted_data[1]["count"] == 1

def test_get_trends_multiple_keywords(client, session):
    keyword_llm = KeywordFactory(name="LLM")
    keyword_ai = KeywordFactory(name="AI")

    paper1 = PaperFactory(published_at=datetime(2023, 1, 1, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper1, keyword=keyword_llm)
    paper2 = PaperFactory(published_at=datetime(2023, 1, 15, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper2, keyword=keyword_ai)
    paper3 = PaperFactory(published_at=datetime(2023, 2, 1, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper3, keyword=keyword_llm)
    PaperKeywordFactory(paper=paper3, keyword=keyword_ai)
    session.commit()

    response = client.get("/api/v1/trends?keywords=LLM&keywords=AI")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # sort data by keyword before asserting
    sorted_data = sorted(data, key=lambda x: x["keyword"])
    assert sorted_data[0]["keyword"] == "AI"
    assert sorted_data[1]["keyword"] == "LLM"

def test_get_trends_date_range(client, session):
    keyword_paper = KeywordFactory(name="Paper")
    paper1 = PaperFactory(published_at=datetime(2023, 1, 1, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper1, keyword=keyword_paper)
    paper2 = PaperFactory(published_at=datetime(2023, 1, 15, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper2, keyword=keyword_paper)
    paper3 = PaperFactory(published_at=datetime(2023, 2, 1, tzinfo=timezone.utc))
    PaperKeywordFactory(paper=paper3, keyword=keyword_paper)
    session.commit()

    response = client.get("/api/v1/trends?keywords=Paper&start_date=2023-01-01T00:00:00Z&end_date=2023-01-31T23:59:59Z")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["keyword"] == "Paper"
    assert len(data[0]["data"]) == 1
    assert data[0]["data"][0]["date"] == "2023-01"
    assert data[0]["data"][0]["count"] == 2

def test_get_trends_no_keywords(client):
    response = client.get("/api/v1/trends")
    assert response.status_code == 422 # FastAPIのデフォルトは422

def test_get_trends_empty_keywords(client):
    response = client.get("/api/v1/trends", params={"keywords": []})
    assert response.status_code == 422

def test_get_trends_invalid_date_range(client):
    response = client.get("/api/v1/trends?keywords=test&start_date=2023-01-31T00:00:00Z&end_date=2023-01-01T00:00:00Z")
    assert response.status_code == 400
    assert response.json()["detail"] == "開始日は終了日より前に設定してください。"

def test_get_trends_invalid_date_format(client):
    response = client.get("/api/v1/trends?keywords=test&start_date=invalid-date")
    assert response.status_code == 400
    assert "日付フォーマットが正しくありません" in response.json()["detail"]

def test_get_trending_keywords_with_data(client, session):
    # テストデータを生成
    # 過去90日以内の論文 (recent)
    paper_recent_1 = PaperFactory(published_at=datetime.now(timezone.utc) - timedelta(days=5))
    paper_recent_2 = PaperFactory(published_at=datetime.now(timezone.utc) - timedelta(days=10))
    paper_recent_3 = PaperFactory(published_at=datetime.now(timezone.utc) - timedelta(days=15))

    # 過去90日〜180日以内の論文 (previous)
    paper_prev_1 = PaperFactory(published_at=datetime.now(timezone.utc) - timedelta(days=100))
    paper_prev_2 = PaperFactory(published_at=datetime.now(timezone.utc) - timedelta(days=120))

    keyword_llm = KeywordFactory(name="LLM")
    keyword_ai = KeywordFactory(name="AI")
    keyword_ml = KeywordFactory(name="ML")

    # LLM: recent=3, prev=0
    PaperKeywordFactory(paper=paper_recent_1, keyword=keyword_llm)
    PaperKeywordFactory(paper=paper_recent_2, keyword=keyword_llm)
    PaperKeywordFactory(paper=paper_recent_3, keyword=keyword_llm)

    # AI: recent=2, prev=2
    PaperKeywordFactory(paper=paper_recent_1, keyword=keyword_ai)
    PaperKeywordFactory(paper=paper_recent_2, keyword=keyword_ai)
    PaperKeywordFactory(paper=paper_prev_1, keyword=keyword_ai)
    PaperKeywordFactory(paper=paper_prev_2, keyword=keyword_ai)

    # ML: recent=0, prev=1 (最低頻度フィルターで除外されるはず)
    PaperKeywordFactory(paper=paper_prev_1, keyword=keyword_ml)

    session.commit()

    response = client.get("/api/v1/dashboard/trending-keywords")
    assert response.status_code == 200
    data = response.json()
    assert "trending_keywords" in data
    
    trending_keywords = data["trending_keywords"]
    assert len(trending_keywords) == 2 # LLMとAIが含まれる

    # Convert list to dict for easy lookup
    trends_dict = {k["name"]: k for k in trending_keywords}

    # LLMキーワードの検証
    assert "LLM" in trends_dict
    llm_trend = trends_dict["LLM"]
    assert llm_trend["recent_count"] == 3
    assert llm_trend["previous_count"] == 0
    assert llm_trend["growth_count"] == 3
    assert llm_trend["growth_rate_percent"] == 300.0

    # AIキーワードの検証
    assert "AI" in trends_dict
    ai_trend = trends_dict["AI"]
    assert ai_trend["recent_count"] == 2
    assert ai_trend["previous_count"] == 2
    assert ai_trend["growth_count"] == 0
    assert ai_trend["growth_rate_percent"] == 0.0

def test_get_trending_keywords_empty_db(client):
    response = client.get("/api/v1/dashboard/trending-keywords")
    assert response.status_code == 200
    data = response.json()
    assert "trending_keywords" in data
    assert len(data["trending_keywords"]) == 0

def test_cors_headers(client):
    response = client.get("/api/v1/dashboard/summary", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "*"
    assert response.headers.get("Access-Control-Allow-Credentials") == "true"

def test_404_not_found(client):
    response = client.get("/nonexistent-path")
    assert response.status_code == 404

def test_405_method_not_allowed(client):
    response = client.post("/")
    assert response.status_code == 405

def test_dashboard_endpoints_no_504_with_large_data(client, session):
    # 大量のテストデータを生成
    num_papers = 2000 # 負荷を軽減するため件数を減らす
    num_keywords = 50
    create_test_data(session, num_papers=num_papers, num_keywords=num_keywords)

    # ダッシュボードサマリーのテスト
    response_summary = client.get("/api/v1/dashboard/summary")
    assert response_summary.status_code == 200, f"Summary failed with {response_summary.status_code}: {response_summary.text}"
    assert "total_papers" in response_summary.json()

    # トレンドキーワードのテスト
    response_trending = client.get("/api/v1/dashboard/trending-keywords")
    assert response_trending.status_code == 200, f"Trending keywords failed with {response_trending.status_code}: {response_trending.text}"
    assert "trending_keywords" in response_trending.json()

    # トレンド分析のテスト (ランダムなキーワードで)
    keywords_for_test = [f"keyword_{i}" for i in range(3)]
    response_trends = client.get(f"/api/v1/trends?{'&'.join([f'keywords={k}' for k in keywords_for_test])}")
    assert response_trends.status_code == 200, f"Trends failed with {response_trends.status_code}: {response_trends.text}"
    assert isinstance(response_trends.json(), list)