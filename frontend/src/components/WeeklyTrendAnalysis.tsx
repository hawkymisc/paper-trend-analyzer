import React, { useState, useEffect, useCallback } from 'react';
import { WeeklyTrendService } from '../services/WeeklyTrendService';
import { 
  WeeklyTrendResponse, 
  TopicKeywordsResponse, 
  TopicSummaryResponse, 
  TopicKeyword 
} from '../types';

const WeeklyTrendAnalysis: React.FC = () => {
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyTrendResponse | null>(null);
  const [topicKeywords, setTopicKeywords] = useState<TopicKeywordsResponse | null>(null);
  const [topicSummary, setTopicSummary] = useState<TopicSummaryResponse | null>(null);
  
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState('auto');
  const [maxKeywords, setMaxKeywords] = useState(30);
  const [error, setError] = useState<string | null>(null);

  // Supported languages
  const supportedLanguages = WeeklyTrendService.getSupportedLanguages();

  // Load cached overview on mount
  const loadCachedOverview = useCallback(async () => {
    try {
      const response = await WeeklyTrendService.getLatestWeeklyTrendOverview({
        language: language
      });
      
      if (response) {
        setWeeklyOverview(response);
      }
    } catch (error) {
      console.error('Error loading cached overview:', error);
      // Don't set error for cache miss - it's expected
    }
  }, [language]);

  // Step 1: Generate Weekly Overview (AI Analysis)
  const handleGenerateOverview = async () => {
    try {
      setIsLoadingOverview(true);
      setError(null);
      
      const response = await WeeklyTrendService.generateWeeklyTrendOverview({
        language: language
      });
      
      setWeeklyOverview(response);
    } catch (error) {
      console.error('Error generating weekly overview:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate weekly overview');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  // Step 2: Extract Topic Keywords
  const handleExtractKeywords = async () => {
    try {
      setIsLoadingKeywords(true);
      setError(null);
      
      const response = await WeeklyTrendService.getTopicKeywords({
        language: language,
        max_keywords: maxKeywords
      });
      
      setTopicKeywords(response);
      setSelectedKeywords([]); // Reset selected keywords
      setTopicSummary(null); // Reset topic summary
    } catch (error) {
      console.error('Error extracting keywords:', error);
      setError(error instanceof Error ? error.message : 'Failed to extract topic keywords');
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  // Step 3: Generate Topic Summary
  const handleGenerateSummary = async () => {
    if (selectedKeywords.length === 0) {
      setError('Please select at least one keyword');
      return;
    }

    try {
      setIsLoadingSummary(true);
      setError(null);
      
      const response = await WeeklyTrendService.getTopicSummary({
        keywords: selectedKeywords,
        language: language
      });
      
      setTopicSummary(response);
    } catch (error) {
      console.error('Error generating topic summary:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate topic summary');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Handle keyword selection
  const handleKeywordToggle = (keyword: string) => {
    setSelectedKeywords(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword);
      } else {
        if (prev.length >= 10) {
          setError('Maximum 10 keywords can be selected');
          return prev;
        }
        return [...prev, keyword];
      }
    });
    setError(null);
  };

  // Clear all selections
  const handleClearSelections = () => {
    setSelectedKeywords([]);
    setTopicSummary(null);
    setError(null);
  };

  // Auto-load cached overview on mount
  useEffect(() => {
    loadCachedOverview();
  }, [loadCachedOverview]);

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h2 className="mb-4">
            <i className="bi bi-graph-up me-2"></i>
            Weekly Trend Analysis
          </h2>

          {/* Language and Settings */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-4">
                  <label htmlFor="language-select" className="form-label">Analysis Language</label>
                  <select
                    id="language-select"
                    className="form-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isLoadingOverview || isLoadingKeywords || isLoadingSummary}
                  >
                    {supportedLanguages.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label htmlFor="max-keywords" className="form-label">Max Keywords</label>
                  <select
                    id="max-keywords"
                    className="form-select"
                    value={maxKeywords}
                    onChange={(e) => setMaxKeywords(parseInt(e.target.value))}
                    disabled={isLoadingKeywords}
                  >
                    <option value={10}>10 keywords</option>
                    <option value={20}>20 keywords</option>
                    <option value={30}>30 keywords</option>
                  </select>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary me-2"
                    onClick={handleClearSelections}
                    disabled={selectedKeywords.length === 0}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </div>
          )}

          {/* Step 1: Weekly Overview */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-calendar-week me-2"></i>
                Step 1: Weekly Research Trends Overview
              </h5>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleGenerateOverview}
                disabled={isLoadingOverview}
              >
                {isLoadingOverview ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill me-1"></i>
                    Analyze This Week
                  </>
                )}
              </button>
            </div>
            <div className="card-body">
              {weeklyOverview ? (
                <div>
                  <div className="mb-3">
                    <small className="text-muted">
                      Analysis Period: {weeklyOverview.analysis_period} | 
                      Papers Analyzed: {weeklyOverview.total_papers_analyzed} | 
                      Generated: {WeeklyTrendService.getRelativeTime(weeklyOverview.generated_at)}
                    </small>
                  </div>
                  <div className="overview-text" style={{ lineHeight: '1.6', fontSize: '1.05rem' }}>
                    {weeklyOverview.trend_overview}
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleExtractKeywords}
                      disabled={isLoadingKeywords}
                    >
                      {isLoadingKeywords ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Extracting...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-right me-1"></i>
                          Next: Extract Topic Keywords
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted mb-0">Click "Analyze This Week" to generate an overview of recent research trends.</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Topic Keywords */}
          {topicKeywords && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-tags me-2"></i>
                  Step 2: Select Topic Keywords ({selectedKeywords.length}/10)
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <small className="text-muted">
                    Analysis Period: {topicKeywords.analysis_period} | 
                    Papers Analyzed: {topicKeywords.total_papers_analyzed} | 
                    Keywords Found: {topicKeywords.keywords.length}
                  </small>
                </div>
                
                <div className="row">
                  {topicKeywords.keywords.map((keyword: TopicKeyword, index: number) => (
                    <div key={index} className="col-md-6 col-lg-4 mb-3">
                      <div 
                        className={`card h-100 keyword-card ${selectedKeywords.includes(keyword.keyword) ? 'border-primary bg-light' : ''}`}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => handleKeywordToggle(keyword.keyword)}
                      >
                        <div className="card-body d-flex align-items-center">
                          <div className="form-check me-3">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={selectedKeywords.includes(keyword.keyword)}
                              onChange={() => {}} // Handled by card click
                              style={{ pointerEvents: 'none' }}
                            />
                          </div>
                          <div className="flex-grow-1">
                            <h6 className="card-title mb-1" style={{ fontSize: '0.95rem' }}>
                              {keyword.keyword}
                            </h6>
                            <div className="d-flex justify-content-between align-items-center">
                              <small className="text-muted">
                                {keyword.paper_count} papers
                              </small>
                              <span className={`badge ${WeeklyTrendService.getRelevanceScoreColor(keyword.relevance_score).replace('text-', 'bg-')}`}>
                                <i className={`${WeeklyTrendService.getRelevanceScoreIcon(keyword.relevance_score)} me-1`}></i>
                                {WeeklyTrendService.formatRelevanceScore(keyword.relevance_score)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedKeywords.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-3">
                      <h6>Selected Keywords:</h6>
                      <div className="d-flex flex-wrap gap-2">
                        {selectedKeywords.map(keyword => (
                          <span key={keyword} className="badge bg-primary">
                            {keyword}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-2"
                              style={{ fontSize: '0.6rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleKeywordToggle(keyword);
                              }}
                            ></button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleGenerateSummary}
                      disabled={isLoadingSummary}
                    >
                      {isLoadingSummary ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-right me-1"></i>
                          Generate Topic Summary
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Topic Summary */}
          {topicSummary && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-file-text me-2"></i>
                  Step 3: Topic Summary - {topicSummary.topic_name}
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <small className="text-muted">
                    Related Papers: {topicSummary.related_paper_count} | 
                    Generated: {WeeklyTrendService.getRelativeTime(topicSummary.generated_at)}
                  </small>
                </div>
                
                <div className="summary-text mb-4" style={{ lineHeight: '1.6', fontSize: '1.05rem' }}>
                  {topicSummary.summary}
                </div>

                {topicSummary.key_findings.length > 0 && (
                  <div>
                    <h6>Key Findings:</h6>
                    <ul className="list-group list-group-flush">
                      {topicSummary.key_findings.map((finding, index) => (
                        <li key={index} className="list-group-item px-0">
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4">
                  <h6>Selected Keywords:</h6>
                  <div className="d-flex flex-wrap gap-2">
                    {topicSummary.keywords.map(keyword => (
                      <span key={keyword} className="badge bg-secondary">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .keyword-card:hover {
          box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.15) !important;
          transform: translateY(-2px);
        }
        .overview-text {
          white-space: pre-wrap;
        }
        .summary-text {
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
};

export default WeeklyTrendAnalysis;