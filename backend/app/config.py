"""
Application configuration settings
"""
from typing import Optional, Literal
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Database settings
    database_url: str = Field(default="postgresql://username:password@localhost/paper_analyzer")
    
    # AI Service Configuration
    ai_provider: Literal["gemini", "openai", "anthropic"] = Field(default="gemini")
    
    # Gemini API settings
    gemini_api_key: Optional[str] = Field(default=None)
    gemini_model: str = Field(default="gemini-2.5-pro")
    gemini_max_tokens: int = Field(default=100000)
    gemini_temperature: float = Field(default=0.7)
    gemini_thinking_budget: Optional[int] = Field(default=50000, description="Thinking budget for Gemini API (tokens) - increased for comprehensive analysis")
    gemini_timeout: int = Field(default=120, description="Request timeout for Gemini API (seconds)")
    
    # OpenAI API settings
    openai_api_key: Optional[str] = Field(default=None)
    openai_model: str = Field(default="gpt-4")
    openai_max_tokens: int = Field(default=4096)
    openai_temperature: float = Field(default=0.7)
    
    # Anthropic API settings
    anthropic_api_key: Optional[str] = Field(default=None)
    anthropic_model: str = Field(default="claude-3-sonnet-20240229")
    anthropic_max_tokens: int = Field(default=4096)
    anthropic_temperature: float = Field(default=0.7)
    
    # Hot topics analysis settings
    hot_topics_analysis_days: int = Field(default=30, description="Days to analyze for hot topics")
    hot_topics_min_papers: int = Field(default=5, description="Minimum papers required for a topic to be considered hot")
    hot_topics_max_topics: int = Field(default=20, description="Maximum number of hot topics to return")
    hot_topics_timeout: int = Field(default=180, description="Timeout for hot topics analysis (seconds)")
    
    # Summary settings
    summary_max_length: int = Field(default=500, description="Maximum length for summaries")
    summary_language: str = Field(default="auto", description="Summary language (auto, en, ja, zh, ko, de)")
    
    # Paper Analysis Limits (新しく追加)
    topic_analysis_max_papers: int = Field(default=500, description="Maximum papers for topic analysis")
    trend_summary_max_papers: int = Field(default=500, description="Maximum papers for trend summary")
    default_analysis_max_papers: int = Field(default=1000, description="Maximum papers for general analysis")
    hot_topics_max_papers: int = Field(default=500, description="Maximum papers for hot topics analysis")
    
    # Maximum allowed values to prevent resource exhaustion
    max_topic_analysis_papers: int = Field(default=2000, description="Hard limit for topic analysis papers")
    max_trend_summary_papers: int = Field(default=2000, description="Hard limit for trend summary papers")
    max_analysis_papers: int = Field(default=5000, description="Hard limit for general analysis papers")
    max_hot_topics_papers: int = Field(default=2000, description="Hard limit for hot topics analysis papers")
    
    def get_topic_analysis_limit(self) -> int:
        """Get validated topic analysis paper limit"""
        return min(self.topic_analysis_max_papers, self.max_topic_analysis_papers)
    
    def get_trend_summary_limit(self) -> int:
        """Get validated trend summary paper limit"""
        return min(self.trend_summary_max_papers, self.max_trend_summary_papers)
    
    def get_default_analysis_limit(self) -> int:
        """Get validated default analysis paper limit"""
        return min(self.default_analysis_max_papers, self.max_analysis_papers)
    
    def get_hot_topics_limit(self) -> int:
        """Get validated hot topics analysis paper limit"""
        return min(self.hot_topics_max_papers, self.max_hot_topics_papers)
    
    # AI Analysis Settings
    ai_related_papers_display_limit: int = Field(default=5, description="Number of related papers to display")
    ai_overview_analysis_papers: int = Field(default=30, description="Papers for overview analysis")
    ai_topic_analysis_papers: int = Field(default=20, description="Papers for topic analysis")
    ai_max_keywords_default: int = Field(default=30, description="Default maximum keywords for AI analysis")
    ai_pdf_max_pages: int = Field(default=10, description="Maximum PDF pages to process")
    ai_text_max_characters: int = Field(default=15000, description="Maximum text characters for AI processing")
    ai_summary_char_limit: int = Field(default=500, description="Character limit for summaries")
    
    # Services Settings
    trending_keywords_limit: int = Field(default=10, description="Trending keywords limit")
    recent_analysis_weeks: int = Field(default=8, description="Recent analysis period in weeks")
    comparison_weeks: int = Field(default=16, description="Comparison period in weeks")
    cache_ttl_seconds: int = Field(default=300, description="Cache TTL in seconds")
    keyword_fetch_limit: int = Field(default=200, description="Keyword fetch limit")
    word_cloud_items_limit: int = Field(default=100, description="Word cloud items limit")
    latest_papers_fetch_limit: int = Field(default=5000, description="Latest papers fetch limit")
    
    # API Limits
    paper_search_default_limit: int = Field(default=100, description="Default paper search limit")
    paper_search_max_limit: int = Field(default=200, description="Maximum paper search limit")
    topic_summary_max_keywords: int = Field(default=10, description="Maximum keywords for topic summary")
    trend_summary_default_limit: int = Field(default=20, description="Default trend summary limit")
    trend_summary_max_limit: int = Field(default=100, description="Maximum trend summary limit")
    
    # Quality Thresholds
    keyword_min_occurrence_threshold: int = Field(default=5, description="Minimum keyword occurrence threshold")
    keyword_min_length: int = Field(default=3, description="Minimum keyword length")
    importance_weight_high: float = Field(default=2.0, description="High importance weight")
    importance_weight_medium: float = Field(default=1.5, description="Medium importance weight")
    importance_weight_low: float = Field(default=1.2, description="Low importance weight")
    
    # Display & UI Limits
    suggestions_limit: int = Field(default=10, description="Suggestions limit")
    ui_papers_display_limit: int = Field(default=20, description="UI papers display limit")
    key_insights_limit: int = Field(default=3, description="Key insights limit")
    summary_max_length: int = Field(default=5000, description="Summary maximum length")
    
    # Fetch Script Settings
    fetch_default_days: int = Field(default=30, description="Default fetch period in days")
    arxiv_max_results: int = Field(default=1000, description="Maximum arXiv results")
    arxiv_api_delay_seconds: int = Field(default=3, description="Delay between arXiv API calls")
    script_execution_timeout: int = Field(default=3600, description="Script execution timeout in seconds")
    
    # Log Settings
    log_max_bytes: int = Field(default=5*1024*1024, description="Log file maximum size in bytes")
    log_backup_count: int = Field(default=5, description="Log backup files count")
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }


# Global settings instance
settings = Settings()