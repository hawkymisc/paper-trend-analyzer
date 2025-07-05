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
    gemini_model: str = Field(default="gemini-1.5-pro")
    gemini_max_tokens: int = Field(default=8192)
    gemini_temperature: float = Field(default=0.7)
    gemini_thinking_budget: Optional[int] = Field(default=20000, description="Thinking budget for Gemini API (tokens)")
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
    hot_topics_max_topics: int = Field(default=10, description="Maximum number of hot topics to return")
    hot_topics_timeout: int = Field(default=180, description="Timeout for hot topics analysis (seconds)")
    
    # Summary settings
    summary_max_length: int = Field(default=500, description="Maximum length for summaries")
    summary_language: str = Field(default="auto", description="Summary language (auto, en, ja, zh, ko, de)")
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }


# Global settings instance
settings = Settings()