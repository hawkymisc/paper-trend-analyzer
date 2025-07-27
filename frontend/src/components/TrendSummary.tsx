import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Alert, Spinner, Modal } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import MarkdownRenderer from './MarkdownRenderer';
import ReadingListButton from './ReadingListButton';

interface PaperReference {
  id: number;
  title: string;
  authors: string[];
  summary: string;
  published_at: string;
  arxiv_id: string;
  arxiv_url: string;
  keywords: string[];
}

interface TrendSummaryData {
  id: number;
  title: string;
  period_start: string;
  period_end: string;
  paper_count: number;
  summary: string;
  key_insights: string[];
  top_keywords: Array<{ keyword: string; count: number }>;
  language: string;
  created_at: string;
  papers?: PaperReference[];
}

interface TrendSummaryListResponse {
  summaries: TrendSummaryData[];
  total_count: number;
}

const TrendSummary: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [summaries, setSummaries] = useState<TrendSummaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<TrendSummaryData | null>(null);
  const [summaryToDelete, setSummaryToDelete] = useState<TrendSummaryData | null>(null);
  const [summaryToEdit, setSummaryToEdit] = useState<TrendSummaryData | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingTitle, setUpdatingTitle] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Paper summary states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isLoadingExistingSummary, setIsLoadingExistingSummary] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<PaperReference | null>(null);
  const [showPaperSummaryModal, setShowPaperSummaryModal] = useState(false);
  const [paperSummary, setPaperSummary] = useState<string>('');
  
  // X post generation states
  const [isGeneratingXPost, setIsGeneratingXPost] = useState(false);
  const [xPostUrl, setXPostUrl] = useState<string | null>(null);

  // Form state for creating new summary
  const [formData, setFormData] = useState({
    title: '',
    period_start: '',
    period_end: '',
    paper_count: 100,
    language: 'ja'
  });

  // Default to last 7 days
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    setFormData(prev => ({
      ...prev,
      period_start: sevenDaysAgo.toISOString().split('T')[0],
      period_end: today.toISOString().split('T')[0],
      title: `${t('trendSummary.weeklyAnalysis')} (${sevenDaysAgo.toISOString().split('T')[0]} - ${today.toISOString().split('T')[0]})`
    }));
  }, [t]);

  const fetchSummaries = async (page: number = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const skip = (page - 1) * itemsPerPage;
      const response = await fetch(`/api/v1/trend-summaries?skip=${skip}&limit=${itemsPerPage}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch summaries: ${response.statusText}`);
      }
      
      const data: TrendSummaryListResponse = await response.json();
      setSummaries(data.summaries);
      setTotalCount(data.total_count);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, []);

  const handleCreateSummary = async () => {
    if (!formData.title || !formData.period_start || !formData.period_end) {
      setError(t('trendSummary.allFieldsRequired'));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/trend-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ai_provider: settings.aiProvider,
          ai_model: settings.aiProvider === 'gemini' ? settings.geminiModel :
                   settings.aiProvider === 'openai' ? settings.openaiModel :
                   settings.anthropicModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to create summary');
      }

      await response.json();
      
      // Refresh the list
      await fetchSummaries(currentPage);
      
      // Close modal and reset form
      setShowCreateModal(false);
      setFormData(prev => ({
        ...prev,
        title: '',
      }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  const handleSummaryClick = (summary: TrendSummaryData) => {
    setSelectedSummary(summary);
    setShowDetailModal(true);
  };

  const handleDeleteClick = (summary: TrendSummaryData, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering summary click
    setSummaryToDelete(summary);
    setShowDeleteModal(true);
  };

  const handleEditTitleClick = (summary: TrendSummaryData, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering summary click
    setSummaryToEdit(summary);
    setEditingTitle(summary.title);
    setShowEditTitleModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!summaryToDelete) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/trend-summary/${summaryToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to delete summary');
      }

      // Refresh the list
      await fetchSummaries(currentPage);
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setSummaryToDelete(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateTitle = async () => {
    if (!summaryToEdit || !editingTitle.trim()) return;

    setUpdatingTitle(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/trend-summary/${summaryToEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingTitle.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to update title');
      }

      // Refresh the list
      await fetchSummaries(currentPage);
      
      // Close modal and reset state
      setShowEditTitleModal(false);
      setSummaryToEdit(null);
      setEditingTitle('');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUpdatingTitle(false);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Paper summary functions
  const handleGeneratePaperSummary = async (paper: PaperReference) => {
    setSelectedPaper(paper);
    setIsGeneratingSummary(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/papers/${paper.id}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paper_id: paper.id, language: 'ja' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to generate paper summary');
      }

      const data = await response.json();
      setPaperSummary(data.summary);
      setShowPaperSummaryModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleShowExistingSummary = async (paper: PaperReference) => {
    setSelectedPaper(paper);
    setIsLoadingExistingSummary(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/papers/${paper.id}/summary`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError(t('settings.twitterPost.summaryNotFound'));
        } else {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || 'Failed to load paper summary');
        }
        return;
      }

      const data = await response.json();
      setPaperSummary(data.summary);
      setShowPaperSummaryModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingExistingSummary(false);
    }
  };

  const handleGenerateXPost = async (paper: PaperReference) => {
    setIsGeneratingXPost(true);
    setError(null);

    // ユーザーイベント内で空のポップアップを作成（ポップアップブロッカーを回避）
    const newWindow = window.open('', '_blank');
    
    // テンプレートリテラルの外で翻訳を取得
    const preparingTitle = t('settings.twitterPost.preparing');
    const generatingText = t('settings.twitterPost.generating');
    
    // ローディング表示をポップアップに追加
    if (newWindow && !newWindow.closed) {
      newWindow.document.write(`
        <html>
          <head><title>${preparingTitle}</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>${preparingTitle}</h2>
            <p>${generatingText}</p>
            <div style="margin: 20px 0;">
              <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #1da1f2; border-radius: 50%; border-top: 2px solid transparent; animation: spin 1s linear infinite;"></div>
            </div>
            <style>
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </body>
        </html>
      `);
    }
    
    try {
      const response = await fetch(`/api/v1/papers/${paper.id}/x-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          paper_id: paper.id, 
          language: 'ja',
          custom_prompt: settings.twitterPostPrompt,
          ai_provider: settings.aiProvider,
          ai_model: settings.aiProvider === 'gemini' ? settings.geminiModel :
                   settings.aiProvider === 'openai' ? settings.openaiModel :
                   settings.anthropicModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to generate X post');
      }

      const data = await response.json();
      
      // 既に開いたポップアップにTwitterのURLを設定
      console.log('X投稿URL:', data.tweet_url);
      
      if (newWindow && !newWindow.closed) {
        newWindow.location.href = data.tweet_url;
        console.log('Twitter投稿画面を開きました');
        setXPostUrl(null);
      } else {
        // ポップアップがブロックされた場合
        console.warn('ポップアップがブロックされました');
        setXPostUrl(data.tweet_url);
        setError(t('settings.twitterPost.popupBlocked'));
      }
      
    } catch (err) {
      // エラーが発生した場合、空のポップアップを閉じる
      if (newWindow && !newWindow.closed) {
        newWindow.close();
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGeneratingXPost(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>{t('trendSummary.title')}</h2>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              {t('trendSummary.createNew')}
            </Button>
          </div>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <div className="text-center p-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">{t('trendSummary.loading')}</span>
              </Spinner>
            </div>
          ) : (
            <>
              {summaries.length === 0 ? (
                <Alert variant="info">
                  {t('trendSummary.noSummaries')}
                </Alert>
              ) : (
                <>
                  <div className="mb-3">
                    <small className="text-muted">
                      全 {totalCount} 件中 {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} - {Math.min(currentPage * itemsPerPage, totalCount)} 件を表示
                    </small>
                  </div>

                  <div className="list-group">
                    {summaries.map((summary) => (
                      <div 
                        key={summary.id} 
                        className="list-group-item list-group-item-action"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSummaryClick(summary)}
                      >
                        <div className="d-flex w-100 justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h5 className="mb-1">{summary.title}</h5>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <small className="text-muted">
                              {formatDate(summary.created_at)}
                            </small>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={(e) => handleEditTitleClick(summary, e)}
                              title="タイトルを編集"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={(e) => handleDeleteClick(summary, e)}
                              title="削除"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                        <div className="d-flex gap-4 mb-2">
                          <small className="text-muted">
                            <i className="bi bi-calendar-range me-1"></i>
                            期間: {formatDate(summary.period_start)} - {formatDate(summary.period_end)}
                          </small>
                          <small className="text-muted">
                            <i className="bi bi-file-text me-1"></i>
                            論文数: {summary.paper_count}件
                          </small>
                          <small className="text-muted">
                            <i className="bi bi-globe me-1"></i>
                            言語: {summary.language}
                          </small>
                        </div>
                        {summary.top_keywords.length > 0 && (
                          <div className="d-flex flex-wrap gap-1">
                            {summary.top_keywords.slice(0, 5).map((keyword, index) => (
                              <span key={index} className={`badge ${settings.uiTheme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
                                {keyword.keyword}
                              </span>
                            ))}
                            {summary.top_keywords.length > 5 && (
                              <span className={`badge ${settings.uiTheme === 'dark' ? 'bg-dark text-muted' : 'bg-light text-muted'}`}>
                                +{summary.top_keywords.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="d-flex justify-content-center mt-4">
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => fetchSummaries(currentPage - 1)}
                        >
                          前へ
                        </Button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = Math.max(1, Math.min(totalPages - 4, Math.max(1, currentPage - 2))) + i;
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "primary" : "outline-secondary"}
                              size="sm"
                              onClick={() => fetchSummaries(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                        
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => fetchSummaries(currentPage + 1)}
                        >
                          次へ
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Col>
      </Row>

      {/* Create Summary Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>新しいトレンド要約を作成</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>タイトル</Form.Label>
              <Form.Control
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例: 2024年1月のAI研究トレンド"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>開始日</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>終了日</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>論文数（最大）</Form.Label>
              <Form.Control
                type="number"
                min="10"
                max="500"
                value={formData.paper_count}
                onChange={(e) => setFormData({ ...formData, paper_count: parseInt(e.target.value) || 100 })}
              />
              <Form.Text className="text-muted">
                デフォルト: 直近7日間の最新100件
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>言語</Form.Label>
              <Form.Select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="ko">한국어</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateSummary}
            disabled={creating}
          >
            {creating ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                作成中...
              </>
            ) : (
              '要約を作成'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Detail Summary Modal */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)} 
        size="xl"
        scrollable={true}
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedSummary?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSummary && (
            <>
              {/* Summary metadata */}
              <div className={`mb-4 p-3 ${settings.uiTheme === 'dark' ? 'bg-dark' : 'bg-light'} rounded`}>
                <div className="row">
                  <div className="col-md-4">
                    <small className="text-muted d-block">
                      <i className="bi bi-calendar-range me-1"></i>
                      分析期間
                    </small>
                    <strong>
                      {formatDate(selectedSummary.period_start)} - {formatDate(selectedSummary.period_end)}
                    </strong>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted d-block">
                      <i className="bi bi-file-text me-1"></i>
                      論文数
                    </small>
                    <strong>{selectedSummary.paper_count}件</strong>
                  </div>
                  <div className="col-md-2">
                    <small className="text-muted d-block">
                      <i className="bi bi-globe me-1"></i>
                      言語
                    </small>
                    <strong>{selectedSummary.language}</strong>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted d-block">
                      <i className="bi bi-clock me-1"></i>
                      作成日
                    </small>
                    <strong>{formatDate(selectedSummary.created_at)}</strong>
                  </div>
                </div>
              </div>

              {/* Summary content */}
              <div className="mb-4">
                <h5 className="mb-3">
                  <i className="bi bi-file-text me-2"></i>
                  要約
                </h5>
                <MarkdownRenderer
                  content={selectedSummary.summary}
                  enableMarkdown={settings.enableMarkdownRendering}
                  papers={selectedSummary.papers || []}
                  markdownStyles={settings.markdownStyles}
                />
              </div>
              
              {/* Key insights */}
              <div className="mb-4">
                <h5 className="mb-3">
                  <i className="bi bi-lightbulb me-2"></i>
                  主要な洞察
                </h5>
                <ul className="list-group list-group-flush">
                  {selectedSummary.key_insights.map((insight, index) => (
                    <li key={index} className="list-group-item px-0">
                      <i className="bi bi-check-circle-fill text-success me-2"></i>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top keywords */}
              {selectedSummary.top_keywords.length > 0 && (
                <div className="mb-4">
                  <h5 className="mb-3">
                    <i className="bi bi-tags me-2"></i>
                    頻出キーワード
                  </h5>
                  <div className="d-flex flex-wrap gap-2">
                    {selectedSummary.top_keywords.map((keyword, index) => (
                      <span 
                        key={index} 
                        className="badge bg-primary"
                        title={`出現回数: ${keyword.count}`}
                      >
                        {keyword.keyword} ({keyword.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Papers used in analysis */}
              {selectedSummary.papers && selectedSummary.papers.length > 0 && (
                <div>
                  <h5 className="mb-3">
                    <i className="bi bi-list-ul me-2"></i>
                    分析対象論文 ({selectedSummary.papers.length}件)
                  </h5>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {selectedSummary.papers.map((paper, index) => (
                      <div key={paper.id} className="card mb-3">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="card-title mb-0 flex-grow-1">
                              <a 
                                href={paper.arxiv_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-decoration-none"
                              >
                                <i className="bi bi-box-arrow-up-right me-1"></i>
                                {index + 1}. {paper.title}
                              </a>
                            </h6>
                            <ReadingListButton 
                              paper={paper}
                              size="sm"
                              variant="compact"
                            />
                          </div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <p className="card-text mb-1">
                                <small className="text-muted">
                                  <strong>著者:</strong> {paper.authors.slice(0, 5).join(', ')}
                                  {paper.authors.length > 5 && ' et al.'}
                                </small>
                              </p>
                              <p className="card-text mb-0">
                                <small className="text-muted">
                                  <strong>発表日:</strong> {new Date(paper.published_at).toLocaleDateString('ja-JP')}
                                </small>
                              </p>
                            </div>
                            <div className="d-flex gap-1">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleGeneratePaperSummary(paper)}
                                disabled={isGeneratingSummary && selectedPaper?.id === paper.id}
                                style={{ fontSize: '0.75rem' }}
                              >
                                {isGeneratingSummary && selectedPaper?.id === paper.id ? (
                                  <>
                                    <Spinner animation="border" size="sm" className="me-1" />
                                    生成中...
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-file-text me-1"></i>
                                    この論文を要約
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleShowExistingSummary(paper)}
                                disabled={isLoadingExistingSummary && selectedPaper?.id === paper.id}
                                style={{ fontSize: '0.75rem' }}
                              >
                                {isLoadingExistingSummary && selectedPaper?.id === paper.id ? (
                                  <>
                                    <Spinner animation="border" size="sm" className="me-1" />
                                    読み込み中...
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-eye me-1"></i>
                                    要約を表示
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="card-text">
                            <small className="text-muted">
                              {paper.summary.length > 200 
                                ? `${paper.summary.substring(0, 200)}...` 
                                : paper.summary
                              }
                            </small>
                          </p>
                          {paper.keywords && paper.keywords.length > 0 && (
                            <div className="d-flex flex-wrap gap-1 mt-2">
                              {paper.keywords.map((keyword, keywordIndex) => (
                                <span key={keywordIndex} className={`badge ${settings.uiTheme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            閉じる
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Title Modal */}
      <Modal 
        show={showEditTitleModal} 
        onHide={() => setShowEditTitleModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-pencil me-2"></i>
            タイトルを編集
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>新しいタイトル</Form.Label>
              <Form.Control
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="トレンド要約のタイトルを入力してください"
                maxLength={200}
              />
              <Form.Text className="text-muted">
                最大200文字まで入力できます
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowEditTitleModal(false)}
            disabled={updatingTitle}
          >
            キャンセル
          </Button>
          <Button 
            variant="primary" 
            onClick={handleUpdateTitle}
            disabled={updatingTitle || !editingTitle.trim()}
          >
            {updatingTitle ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                更新中...
              </>
            ) : (
              <>
                <i className="bi bi-check me-1"></i>
                更新
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        show={showDeleteModal} 
        onHide={() => setShowDeleteModal(false)}
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title>削除確認</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <i className="bi bi-exclamation-triangle text-warning mb-3" style={{ fontSize: '3rem' }}></i>
            <p className="mb-3">
              以下のトレンド要約を削除しますか？
            </p>
            <div className={`p-2 ${settings.uiTheme === 'dark' ? 'bg-dark' : 'bg-light'} rounded mb-3`}>
              <strong>{summaryToDelete?.title}</strong>
              <br />
              <small className="text-muted">
                作成日: {summaryToDelete && formatDate(summaryToDelete.created_at)}
              </small>
            </div>
            <p className="text-danger small mb-0">
              <i className="bi bi-exclamation-circle me-1"></i>
              この操作は取り消すことができません。
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowDeleteModal(false)}
            disabled={deleting}
          >
            キャンセル
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                削除中...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-1"></i>
                削除
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Paper Summary Modal */}
      <Modal 
        show={showPaperSummaryModal} 
        onHide={() => setShowPaperSummaryModal(false)} 
        size="lg"
        scrollable={true}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-file-text me-2"></i>
            論文要約
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPaper && (
            <>
              <div className={`mb-3 p-3 ${settings.uiTheme === 'dark' ? 'bg-dark' : 'bg-light'} rounded`}>
                <h6 className="mb-2">
                  <a 
                    href={selectedPaper.arxiv_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-decoration-none"
                  >
                    <i className="bi bi-box-arrow-up-right me-1"></i>
                    {selectedPaper.title}
                  </a>
                </h6>
                <div className="row">
                  <div className="col-md-8">
                    <small className="text-muted">
                      <strong>著者:</strong> {selectedPaper.authors.slice(0, 5).join(', ')}
                      {selectedPaper.authors.length > 5 && ' et al.'}
                    </small>
                  </div>
                  <div className="col-md-4 text-end">
                    <small className="text-muted">
                      <strong>発表日:</strong> {new Date(selectedPaper.published_at).toLocaleDateString('ja-JP')}
                    </small>
                  </div>
                </div>
              </div>
              
              <div className="mb-3">
                <h6 className="mb-2">
                  <i className="bi bi-cpu me-2"></i>
                  AI生成要約
                </h6>
                <MarkdownRenderer 
                  content={paperSummary}
                  enableMarkdown={settings.enableMarkdownRendering}
                  papers={[]}
                  markdownStyles={settings.markdownStyles}
                />
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex justify-content-between align-items-center w-100">
            <div className="d-flex gap-2">
              {selectedPaper && (
                <Button
                  variant="outline-primary"
                  onClick={() => handleGenerateXPost(selectedPaper)}
                  disabled={isGeneratingXPost}
                >
                  {isGeneratingXPost ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      {t('settings.twitterPost.generatingButton')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-twitter me-2"></i>
                      {t('trendSummary.postToX')}
                    </>
                  )}
                </Button>
              )}
              {xPostUrl && (
                <Button
                  variant="success"
                  size="sm"
                  href={xPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-box-arrow-up-right me-1"></i>
                  {t('trendSummary.openTwitter')}
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={() => setShowPaperSummaryModal(false)}>
              閉じる
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TrendSummary;