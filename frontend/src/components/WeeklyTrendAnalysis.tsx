import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner, Modal, Badge } from 'react-bootstrap';
import { WeeklyTrendService } from '../services/WeeklyTrendService';
import { useSettings } from '../contexts/SettingsContext';
import MarkdownRenderer from './MarkdownRenderer';
import { 
  WeeklyTrendResponse, 
  TopicKeywordsResponse, 
  TopicSummaryResponse, 
  TopicKeyword 
} from '../types';

interface PaperSummary {
  id: number;
  paper_id: number;
  summary: string;
  language: string;
  created_at: string;
}

const WeeklyTrendAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyTrendResponse | null>(null);
  const [topicKeywords, setTopicKeywords] = useState<TopicKeywordsResponse | null>(null);
  const [topicSummaryResponse, setTopicSummaryResponse] = useState<TopicSummaryResponse | null>(null);
  
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [language, setLanguage] = useState('auto');
  const [maxKeywords] = useState(30);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state for configuration
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    period_start: '',
    period_end: '',
    paper_count: 50,
    title: ''
  });

  // Paper summary modal state
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [paperSummary, setPaperSummary] = useState<PaperSummary | null>(null);
  const [isLoadingPaperSummary, setIsLoadingPaperSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Initialize default date range (last 7 days)
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    setConfigForm(prev => ({
      ...prev,
      period_start: sevenDaysAgo.toISOString().split('T')[0],
      period_end: today.toISOString().split('T')[0],
      title: `週次トレンド分析 (${sevenDaysAgo.toISOString().split('T')[0]} - ${today.toISOString().split('T')[0]})`
    }));
  }, []);

  // Supported languages
  const supportedLanguages = WeeklyTrendService.getSupportedLanguages();

  // Load latest trend summary on mount
  const loadLatestTrendSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/trend-summary/latest');
      
      if (response.ok) {
        const summaryData = await response.json();
        
        // Convert to WeeklyTrendResponse format for compatibility
        const weeklyResponse: WeeklyTrendResponse = {
          trend_overview: summaryData.summary,
          analysis_period: `${summaryData.period_start.split('T')[0]} to ${summaryData.period_end.split('T')[0]}`,
          total_papers_analyzed: summaryData.paper_count,
          generated_at: summaryData.created_at,
          papers: summaryData.papers || []
        };
        
        setWeeklyOverview(weeklyResponse);
        
        // Store generated data for keyword display
        if (summaryData.top_keywords && summaryData.top_keywords.length > 0) {
          const keywordsResponse: TopicKeywordsResponse = {
            keywords: summaryData.top_keywords.map((kw: any) => ({
              keyword: kw.keyword,
              paper_count: kw.count,
              relevance_score: Math.max(10, 100 - (summaryData.top_keywords.indexOf(kw) * 10))
            })),
            analysis_period: `${summaryData.period_start.split('T')[0]} to ${summaryData.period_end.split('T')[0]}`,
            total_papers_analyzed: summaryData.paper_count,
            generated_at: summaryData.created_at
          };
          setTopicKeywords(keywordsResponse);
        }
      }
    } catch (error) {
      console.error('Error loading latest trend summary:', error);
      // Don't set error for initial load failure - it's expected if no data exists
    }
  }, []);

  // Generate Weekly Overview with custom configuration
  const handleGenerateOverview = async () => {
    if (!configForm.title || !configForm.period_start || !configForm.period_end) {
      setError('すべての必須フィールドを入力してください');
      return;
    }

    try {
      setIsLoadingOverview(true);
      setError(null);
      setShowConfigModal(false);
      
      // Use the same API as TrendSummary for consistency
      const response = await fetch('/api/v1/trend-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: configForm.title,
          period_start: configForm.period_start,
          period_end: configForm.period_end,
          paper_count: configForm.paper_count,
          language: language
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to generate overview');
      }

      const summaryData = await response.json();
      
      // Convert to WeeklyTrendResponse format for compatibility
      const weeklyResponse: WeeklyTrendResponse = {
        trend_overview: summaryData.summary,
        analysis_period: `${configForm.period_start} to ${configForm.period_end}`,
        total_papers_analyzed: summaryData.paper_count,
        generated_at: summaryData.created_at,
        papers: summaryData.papers || [] // Include papers for reference
      };
      
      setWeeklyOverview(weeklyResponse);
      
      // Store generated data for keyword display
      if (summaryData.top_keywords && summaryData.top_keywords.length > 0) {
        const keywordsResponse: TopicKeywordsResponse = {
          keywords: summaryData.top_keywords.map((kw: any) => ({
            keyword: kw.keyword,
            paper_count: kw.count,
            relevance_score: Math.max(10, 100 - (summaryData.top_keywords.indexOf(kw) * 10)) // Generate relevance score
          })),
          analysis_period: `${configForm.period_start} to ${configForm.period_end}`,
          total_papers_analyzed: summaryData.paper_count,
          generated_at: summaryData.created_at
        };
        setTopicKeywords(keywordsResponse);
      }
      
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
      setTopicSummaryResponse(null); // Reset topic summary
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
      
      setTopicSummaryResponse(response);
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

  // Paper summary functions
  const handleGeneratePaperSummary = async (paper: any) => {
    setSelectedPaper(paper);
    setIsLoadingPaperSummary(true);
    setSummaryError(null);
    setShowSummaryModal(true);
    
    try {
      const response = await fetch(`/api/v1/papers/${paper.id}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paper_id: paper.id,
          language: 'ja'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to generate summary');
      }

      const summaryData = await response.json();
      setPaperSummary(summaryData);
    } catch (error) {
      console.error('Error generating paper summary:', error);
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsLoadingPaperSummary(false);
    }
  };

  const handleShowExistingSummary = async (paper: any) => {
    setSelectedPaper(paper);
    setIsLoadingPaperSummary(true);
    setSummaryError(null);
    setShowSummaryModal(true);
    
    try {
      const response = await fetch(`/api/v1/papers/${paper.id}/summary`);

      if (!response.ok) {
        throw new Error('要約が見つかりません');
      }

      const summaryData = await response.json();
      setPaperSummary(summaryData);
    } catch (error) {
      console.error('Error fetching paper summary:', error);
      setSummaryError(error instanceof Error ? error.message : 'Failed to fetch summary');
    } finally {
      setIsLoadingPaperSummary(false);
    }
  };

  const handleCloseSummaryModal = () => {
    setShowSummaryModal(false);
    setSelectedPaper(null);
    setPaperSummary(null);
    setSummaryError(null);
  };


  // Auto-load latest trend summary on mount
  useEffect(() => {
    loadLatestTrendSummary();
  }, [loadLatestTrendSummary]);

  return (
    <Container className="mt-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <i className="bi bi-graph-up me-2"></i>
              {t('weeklyTrends.title')}
            </h2>
            <Button variant="primary" onClick={() => setShowConfigModal(true)}>
              新しい分析を作成
            </Button>
          </div>


          {/* Error Alert */}
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}

          {/* Step 1: Trend Overview */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-calendar-week me-2"></i>
                トレンド概要
              </h5>
              <Button
                variant={weeklyOverview ? 'outline-secondary' : 'primary'}
                size="sm"
                onClick={() => setShowConfigModal(true)}
                disabled={isLoadingOverview}
              >
                {isLoadingOverview ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {weeklyOverview ? '再生成中...' : '分析中...'}
                  </>
                ) : (
                  <>
                    <i className={`${weeklyOverview ? 'bi bi-arrow-clockwise' : 'bi bi-play-fill'} me-1`}></i>
                    {weeklyOverview ? '新しい分析を作成' : '分析を開始'}
                  </>
                )}
              </Button>
            </Card.Header>
            <Card.Body>
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
                  
                  {/* Display top keywords if available */}
                  {topicKeywords && topicKeywords.keywords.length > 0 && (
                    <div className="mt-4">
                      <h6>頻出キーワード</h6>
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        {topicKeywords.keywords.slice(0, 10).map((keyword, index) => (
                          <Badge 
                            key={index} 
                            bg="secondary"
                            title={`出現回数: ${keyword.paper_count}`}
                          >
                            {keyword.keyword} ({keyword.paper_count})
                          </Badge>
                        ))}
                      </div>
                      <small className="text-muted">
                        キーワードをクリックして詳細分析に進むには、下のキーワード選択セクションを使用してください。
                      </small>
                    </div>
                  )}
                  
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
                                  <div>
                                    <small className="text-muted">
                                      {paper.authors.slice(0, 3).join(', ')}
                                      {paper.authors.length > 3 && ' et al.'}
                                    </small>
                                    <br />
                                    <small className="text-muted">
                                      {new Date(paper.published_at).toLocaleDateString()}
                                    </small>
                                  </div>
                                  <div className="d-flex gap-1">
                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      onClick={() => handleGeneratePaperSummary(paper)}
                                      style={{ fontSize: '0.75rem' }}
                                    >
                                      <i className="bi bi-file-text me-1"></i>
                                      この論文を要約
                                    </Button>
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      onClick={() => handleShowExistingSummary(paper)}
                                      style={{ fontSize: '0.75rem' }}
                                    >
                                      <i className="bi bi-eye me-1"></i>
                                      要約を表示
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted mb-0">{t('weeklyTrends.clickToAnalyze')}</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Step 2: Interactive Keyword Selection */}
          {topicKeywords && (
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-tags me-2"></i>
                  キーワードを選択して詳細分析 ({selectedKeywords.length}/10)
                </h5>
              </Card.Header>
              <Card.Body>
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
                    <Button
                      variant="success"
                      onClick={() => handleGenerateSummary()}
                      disabled={isLoadingSummary}
                    >
                      {isLoadingSummary ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          要約生成中...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-right me-1"></i>
                          トピック要約を生成
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Step 3: Detailed Topic Analysis */}
          {topicSummaryResponse && (
            <Card>
              <Card.Header>
                <h5 className="mb-0">
                  <i className="bi bi-file-text me-2"></i>
                  詳細分析結果 - {topicSummaryResponse.topic_name}
                </h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <small className="text-muted">
                    {t('weeklyTrends.relatedPapers')}: {topicSummaryResponse.related_paper_count} | 
                    {t('weeklyTrends.generated')}: {WeeklyTrendService.getRelativeTime(topicSummaryResponse.generated_at)}
                  </small>
                </div>
                
                <MarkdownRenderer
                  content={topicSummaryResponse.summary}
                  enableMarkdown={settings.enableMarkdownRendering}
                  papers={topicSummaryResponse.papers || []}
                  className="summary-text mb-4"
                  markdownStyles={settings.markdownStyles}
                />

                {topicSummaryResponse.key_findings.length > 0 && (
                  <div>
                    <h6>{t('weeklyTrends.keyFindings')}:</h6>
                    <ul className="list-group list-group-flush">
                      {topicSummaryResponse.key_findings.map((finding, index) => (
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
                    {topicSummaryResponse.keywords.map(keyword => (
                      <Badge key={keyword} bg="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Paper Summary Modal */}
      <Modal show={showSummaryModal} onHide={handleCloseSummaryModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedPaper ? selectedPaper.title : '論文要約'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isLoadingPaperSummary ? (
            <div className="text-center py-4">
              <Spinner animation="border" className="me-2" />
              要約を生成中...
            </div>
          ) : summaryError ? (
            <Alert variant="danger">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {summaryError}
            </Alert>
          ) : paperSummary ? (
            <div>
              <div className="mb-3">
                <h6>論文情報</h6>
                <p className="mb-1">
                  <strong>タイトル:</strong> {selectedPaper?.title}
                </p>
                <p className="mb-1">
                  <strong>著者:</strong> {selectedPaper?.authors?.join(', ')}
                </p>
                <p className="mb-1">
                  <strong>公開日:</strong> {selectedPaper ? new Date(selectedPaper.published_at).toLocaleDateString() : ''}
                </p>
                <p className="mb-1">
                  <strong>arXiv URL:</strong>{' '}
                  <a href={selectedPaper?.arxiv_url} target="_blank" rel="noopener noreferrer">
                    {selectedPaper?.arxiv_url}
                  </a>
                </p>
                <small className="text-muted">
                  要約生成日時: {new Date(paperSummary.created_at).toLocaleString()}
                </small>
              </div>
              <hr />
              <h6>要約</h6>
              <div style={{ whiteSpace: 'pre-wrap' }} className="paper-summary-content">
                {paperSummary.summary}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted">要約がありません</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseSummaryModal}>
            閉じる
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Configuration Modal */}
      <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>新しい週次トレンド分析を作成</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>タイトル</Form.Label>
              <Form.Control
                type="text"
                value={configForm.title}
                onChange={(e) => setConfigForm({ ...configForm, title: e.target.value })}
                placeholder="例: 2024年1月のAI研究トレンド"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>開始日</Form.Label>
                  <Form.Control
                    type="date"
                    value={configForm.period_start}
                    onChange={(e) => setConfigForm({ ...configForm, period_start: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>終了日</Form.Label>
                  <Form.Control
                    type="date"
                    value={configForm.period_end}
                    onChange={(e) => setConfigForm({ ...configForm, period_end: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>論文数（最大）</Form.Label>
              <Form.Control
                type="number"
                min="10"
                max="50"
                value={configForm.paper_count}
                onChange={(e) => setConfigForm({ ...configForm, paper_count: parseInt(e.target.value) || 50 })}
              />
              <Form.Text className="text-muted">
                デフォルト: 直近7日間の最新50件（AI処理とコンテキスト長の制限により最大50件まで）
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>言語</Form.Label>
              <Form.Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerateOverview}
            disabled={isLoadingOverview}
          >
            {isLoadingOverview ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                分析中...
              </>
            ) : (
              '分析を開始'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

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
        .paper-summary-content {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 0.375rem;
          border-left: 4px solid #0d6efd;
          line-height: 1.6;
        }
      `}</style>
    </Container>
  );
};

export default WeeklyTrendAnalysis;