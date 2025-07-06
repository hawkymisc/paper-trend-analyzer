import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WeeklyTrendService } from '../services/WeeklyTrendService';
import { useSettings } from '../contexts/SettingsContext';
import MarkdownRenderer from './MarkdownRenderer';
import { 
  WeeklyTrendResponse, 
  TopicKeywordsResponse, 
  TopicSummaryResponse, 
  TopicKeyword 
} from '../types';

const WeeklyTrendAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
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
  const handleGenerateOverview = async (forceRegenerate: boolean = false) => {
    try {
      setIsLoadingOverview(true);
      setError(null);
      
      const response = await WeeklyTrendService.generateWeeklyTrendOverview({
        language: language,
        system_prompt: settings.systemPrompt,
        force_regenerate: forceRegenerate
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
  const handleExtractKeywords = async (forceRegenerate: boolean = false) => {
    try {
      setIsLoadingKeywords(true);
      setError(null);
      
      const response = await WeeklyTrendService.getTopicKeywords({
        language: language,
        max_keywords: maxKeywords,
        system_prompt: settings.systemPrompt,
        force_regenerate: forceRegenerate
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
  const handleGenerateSummary = async (forceRegenerate: boolean = false) => {
    if (selectedKeywords.length === 0) {
      setError(t('common.selectKeyword'));
      return;
    }

    try {
      setIsLoadingSummary(true);
      setError(null);
      
      const response = await WeeklyTrendService.getTopicSummary({
        keywords: selectedKeywords,
        language: language,
        system_prompt: settings.systemPrompt,
        force_regenerate: forceRegenerate
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
          setError(t('common.maxKeywordsSelected'));
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
            {t('weeklyTrends.title')}
          </h2>

          {/* Language and Settings */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-4">
                  <label htmlFor="language-select" className="form-label">{t('weeklyTrends.analysisLanguage')}</label>
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
                  <label htmlFor="max-keywords" className="form-label">{t('weeklyTrends.maxKeywords')}</label>
                  <select
                    id="max-keywords"
                    className="form-select"
                    value={maxKeywords}
                    onChange={(e) => setMaxKeywords(parseInt(e.target.value))}
                    disabled={isLoadingKeywords}
                  >
                    <option value={10}>10 {t('common.keywords')}</option>
                    <option value={20}>20 {t('common.keywords')}</option>
                    <option value={30}>30 {t('common.keywords')}</option>
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
                    {t('common.clear')}
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
                {t('weeklyTrends.step1')}
              </h5>
              <button
                type="button"
                className={`btn btn-sm ${weeklyOverview ? 'btn-outline-secondary' : 'btn-primary'}`}
                onClick={() => handleGenerateOverview(weeklyOverview ? true : false)}
                disabled={isLoadingOverview}
              >
                {isLoadingOverview ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    {weeklyOverview ? t('weeklyTrends.regenerating') : t('weeklyTrends.analyzing')}
                  </>
                ) : (
                  <>
                    <i className={`${weeklyOverview ? 'bi bi-arrow-clockwise' : 'bi bi-play-fill'} me-1`}></i>
                    {weeklyOverview ? t('weeklyTrends.regenerateOverview') : t('weeklyTrends.analyzeThisWeek')}
                  </>
                )}
              </button>
            </div>
            <div className="card-body">
              {weeklyOverview ? (
                <div>
                  <div className="mb-3">
                    <small className="text-muted">
                      {t('weeklyTrends.analysisPeriod')}: {weeklyOverview.analysis_period} | 
                      {t('weeklyTrends.papersAnalyzed')}: {weeklyOverview.total_papers_analyzed} | 
                      {t('weeklyTrends.generated')}: {WeeklyTrendService.getRelativeTime(weeklyOverview.generated_at)}
                    </small>
                  </div>
                  <MarkdownRenderer
                    content={weeklyOverview.trend_overview}
                    enableMarkdown={settings.enableMarkdownRendering}
                    papers={weeklyOverview.papers || []}
                    className="overview-text"
                    markdownStyles={settings.markdownStyles}
                  />
                  
                  {/* Papers used in analysis */}
                  {weeklyOverview.papers && weeklyOverview.papers.length > 0 && (
                    <div className="mt-4">
                      <details className="mb-3">
                        <summary className="btn btn-outline-info btn-sm mb-3" style={{ cursor: 'pointer' }}>
                          <i className="bi bi-list-ul me-1"></i>
                          {t('weeklyTrends.viewAnalyzedPapers')} ({weeklyOverview.papers.length})
                        </summary>
                        <div className="analyzed-papers-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {weeklyOverview.papers.map((paper, index) => (
                            <div key={paper.id} className="card mb-2">
                              <div className="card-body py-2">
                                <h6 className="card-title mb-1" style={{ fontSize: '0.9rem' }}>
                                  <a 
                                    href={paper.arxiv_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-decoration-none"
                                  >
                                    {index + 1}. {paper.title}
                                  </a>
                                </h6>
                                <div className="d-flex justify-content-between align-items-center">
                                  <small className="text-muted">
                                    {paper.authors.slice(0, 3).join(', ')}
                                    {paper.authors.length > 3 && ' et al.'}
                                  </small>
                                  <small className="text-muted">
                                    {new Date(paper.published_at).toLocaleDateString()}
                                  </small>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  <div className="mt-3">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleExtractKeywords()}
                      disabled={isLoadingKeywords}
                    >
                      {isLoadingKeywords ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          {t('weeklyTrends.extracting')}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-right me-1"></i>
                          {t('weeklyTrends.nextExtractKeywords')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted mb-0">{t('weeklyTrends.clickToAnalyze')}</p>
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
                  {t('weeklyTrends.step2')} ({selectedKeywords.length}/10)
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <small className="text-muted">
                    {t('weeklyTrends.analysisPeriod')}: {topicKeywords.analysis_period} | 
                    {t('weeklyTrends.papersAnalyzed')}: {topicKeywords.total_papers_analyzed} | 
                    {t('weeklyTrends.keywordsFound')}: {topicKeywords.keywords.length}
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
                                {keyword.paper_count} {t('common.papers')}
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
                      <h6>{t('weeklyTrends.selectedKeywords')}:</h6>
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
                      onClick={() => handleGenerateSummary()}
                      disabled={isLoadingSummary}
                    >
                      {isLoadingSummary ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          {t('weeklyTrends.generating')}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-right me-1"></i>
                          {t('weeklyTrends.generateTopicSummary')}
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
                  {t('weeklyTrends.step3')} - {topicSummary.topic_name}
                </h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <small className="text-muted">
                    {t('weeklyTrends.relatedPapers')}: {topicSummary.related_paper_count} | 
                    {t('weeklyTrends.generated')}: {WeeklyTrendService.getRelativeTime(topicSummary.generated_at)}
                  </small>
                </div>
                
                <MarkdownRenderer
                  content={topicSummary.summary}
                  enableMarkdown={settings.enableMarkdownRendering}
                  papers={topicSummary.papers || []}
                  className="summary-text mb-4"
                  markdownStyles={settings.markdownStyles}
                />

                {topicSummary.key_findings.length > 0 && (
                  <div>
                    <h6>{t('weeklyTrends.keyFindings')}:</h6>
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
                  <h6>{t('weeklyTrends.selectedKeywords')}:</h6>
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