"""
Test cases for analysis limits configuration and enforcement.
This prevents regression issues with hardcoded limits.
"""

import pytest
import os
from unittest.mock import patch
from app.config import Settings

def test_default_analysis_limits():
    """Test that default limits are reasonable"""
    settings = Settings()
    
    # Test default values
    assert settings.topic_analysis_max_papers == 500
    assert settings.trend_summary_max_papers == 500
    assert settings.default_analysis_max_papers == 1000
    assert settings.hot_topics_max_papers == 500
    
    # Test maximum limits
    assert settings.max_topic_analysis_papers == 2000
    assert settings.max_trend_summary_papers == 2000
    assert settings.max_analysis_papers == 5000
    assert settings.max_hot_topics_papers == 2000

def test_limit_validation():
    """Test that limits are properly validated (not exceeding maximum)"""
    settings = Settings()
    
    # Test validation methods
    assert settings.get_topic_analysis_limit() <= settings.max_topic_analysis_papers
    assert settings.get_trend_summary_limit() <= settings.max_trend_summary_papers
    assert settings.get_default_analysis_limit() <= settings.max_analysis_papers
    assert settings.get_hot_topics_limit() <= settings.max_hot_topics_papers

def test_environment_variable_override():
    """Test that environment variables properly override defaults"""
    test_values = {
        "TOPIC_ANALYSIS_MAX_PAPERS": "300",
        "TREND_SUMMARY_MAX_PAPERS": "400",
        "DEFAULT_ANALYSIS_MAX_PAPERS": "800",
        "HOT_TOPICS_MAX_PAPERS": "350"
    }
    
    with patch.dict(os.environ, test_values):
        settings = Settings()
        assert settings.topic_analysis_max_papers == 300
        assert settings.trend_summary_max_papers == 400
        assert settings.default_analysis_max_papers == 800
        assert settings.hot_topics_max_papers == 350

def test_excessive_limit_capping():
    """Test that excessively high environment values are capped at maximum limits"""
    excessive_values = {
        "TOPIC_ANALYSIS_MAX_PAPERS": "10000",  # > 2000 max
        "TREND_SUMMARY_MAX_PAPERS": "15000",   # > 2000 max
        "DEFAULT_ANALYSIS_MAX_PAPERS": "20000", # > 5000 max
        "HOT_TOPICS_MAX_PAPERS": "8000"       # > 2000 max
    }
    
    with patch.dict(os.environ, excessive_values):
        settings = Settings()
        
        # Values should be capped at maximum limits
        assert settings.get_topic_analysis_limit() == 2000
        assert settings.get_trend_summary_limit() == 2000
        assert settings.get_default_analysis_limit() == 5000
        assert settings.get_hot_topics_limit() == 2000

def test_no_hardcoded_50_limit():
    """Test that no function returns a hardcoded limit of 50"""
    settings = Settings()
    
    # All limits should be significantly higher than 50
    assert settings.get_topic_analysis_limit() > 50
    assert settings.get_trend_summary_limit() > 50
    assert settings.get_default_analysis_limit() > 50
    assert settings.get_hot_topics_limit() > 50
    
    # Minimum reasonable limits
    assert settings.get_topic_analysis_limit() >= 300
    assert settings.get_trend_summary_limit() >= 300
    assert settings.get_default_analysis_limit() >= 500
    assert settings.get_hot_topics_limit() >= 300

if __name__ == "__main__":
    pytest.main([__file__])