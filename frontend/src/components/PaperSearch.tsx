import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Card, ListGroup, Pagination, Spinner, Alert } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PaperSearchResponse, Paper } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import ReadingListButton from './ReadingListButton';

const PaperSearch: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<number>>(new Set());
  
  // キーワード候補機能
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [suggestionLoading, setSuggestionLoading] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const papersPerPage = 20; // Show more papers per page since abstracts are longer

  // URLパラメータから初期値を設定
  useEffect(() => {
    const queryParam = searchParams.get('query');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    if (queryParam) {
      setQuery(queryParam);
    }
    if (startDateParam) {
      setStartDate(startDateParam);
    }
    if (endDateParam) {
      setEndDate(endDateParam);
    }
    
    // パラメータがある場合は自動的に検索実行
    if (queryParam) {
      // 少し遅延させてstateが更新されるのを待つ
      setTimeout(() => {
        handleSearchWithParams(queryParam, startDateParam, endDateParam);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // キーワード候補を取得
  const fetchSuggestions = async (searchQuery: string) => {
    if (!searchQuery.trim() || !settings.customKeywords.length) {
      setSuggestions([]);
      return;
    }

    setSuggestionLoading(true);
    try {
      const response = await fetch('/api/v1/keywords/suggestions?query=' + encodeURIComponent(searchQuery), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings.customKeywords)
      });

      if (response.ok) {
        const suggestions: string[] = await response.json();
        setSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  // 検索入力の変更をハンドル
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      fetchSuggestions(value);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // 候補をクリックした時の処理
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    // 自動的に検索実行
    setTimeout(() => {
      handleSearchWithParams(suggestion, startDate, endDate);
    }, 100);
  };

  // パラメータ付きでの検索実行
  const handleSearchWithParams = async (queryText: string, startDateParam: string | null, endDateParam: string | null, page: number = 1) => {
    if (queryText.trim() === '') {
      setError(t('paperSearch.searchPlaceholder'));
      return;
    }
    setLoading(true);
    setError(null);
    setCurrentPage(page);

    const skip = (page - 1) * papersPerPage;
    const limit = papersPerPage;

    try {
      const params = new URLSearchParams();
      params.append('query', queryText);
      params.append('skip', skip.toString());
      params.append('limit', limit.toString());
      params.append('sort_by', sortBy);
      if (startDateParam) params.append('start_date', startDateParam);
      if (endDateParam) params.append('end_date', endDateParam);

      const response = await fetch(`/api/v1/papers/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: PaperSearchResponse = await response.json();
      setSearchResults(data.papers);
      setTotalCount(data.total_count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (page: number = 1) => {
    // 新しい検索時は折りたたみ状態をリセット
    setExpandedAbstracts(new Set());
    await handleSearchWithParams(query, startDate || null, endDate || null, page);
  };

  // Abstract の展開/折りたたみを切り替える
  const toggleAbstractExpanded = (paperId: number) => {
    setExpandedAbstracts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paperId)) {
        newSet.delete(paperId);
      } else {
        newSet.add(paperId);
      }
      return newSet;
    });
  };

  // Abstract を切り詰めるヘルパー関数
  const getTruncatedAbstract = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength);
  };

  const totalPages = Math.ceil(totalCount / papersPerPage);

  return (
    <div>
      <h1>{t('paperSearch.title')}</h1>

      {/* ダッシュボードからの遷移の場合はメッセージを表示 */}
      {searchParams.get('query') && (
        <Alert variant="info" className="mb-4">
          <strong>{t('common.dashboardSearch')}:</strong> {t('common.keywords')}「{searchParams.get('query')}」
          {searchParams.get('startDate') && searchParams.get('endDate') && (
            <span> ({t('common.period')}: {searchParams.get('startDate')} - {searchParams.get('endDate')})</span>
          )}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <Card.Title>{t('paperSearch.title')}</Card.Title>
          <Form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
            <Form.Group className="mb-3">
              <Form.Label>{t('common.keywords')}</Form.Label>
              <div className="position-relative">
                <Form.Control
                  ref={searchInputRef}
                  type="text"
                  placeholder={t('paperSearch.searchPlaceholder')}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => {
                    if (query.trim() && suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <Card className="position-absolute w-100 mt-1" style={{ zIndex: 1000 }}>
                    <ListGroup variant="flush">
                      {suggestionLoading ? (
                        <ListGroup.Item className="text-center">
                          <Spinner animation="border" size="sm" className="me-2" />
                          {t('common.loading')}
                        </ListGroup.Item>
                      ) : (
                        suggestions.map((suggestion, index) => (
                          <ListGroup.Item
                            key={index}
                            action
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="py-2"
                            style={{ cursor: 'pointer' }}
                          >
                            <i className="bi bi-search me-2 text-muted"></i>
                            {suggestion}
                          </ListGroup.Item>
                        ))
                      )}
                    </ListGroup>
                  </Card>
                )}
              </div>
              {settings.customKeywords.length > 0 && (
                <Form.Text className="text-muted">
                  <i className="bi bi-lightbulb me-1"></i>
                  {t('paperSearch.keywordSuggestionsHint')}
                </Form.Text>
              )}
            </Form.Group>
            
            <div className="row mb-3">
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>{t('paperSearch.startDate')}</Form.Label>
                  <Form.Control
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>{t('paperSearch.endDate')}</Form.Label>
                  <Form.Control
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group>
                  <Form.Label>{t('paperSearch.sortOrder')}</Form.Label>
                  <Form.Control
                    as="select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="date">{t('paperSearch.sortByDate')}</option>
                    <option value="relevance">{t('paperSearch.sortByRelevance')}</option>
                  </Form.Control>
                </Form.Group>
              </div>
            </div>
            
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : t('paperSearch.searchButton')}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {searchResults.length > 0 && (
        <Card>
          <Card.Body>
            <Card.Title>
              {t('paperSearch.title')} 
              <span className="badge bg-primary ms-2">{t('paperSearch.resultsCount', { count: totalCount.toLocaleString() })}</span>
            </Card.Title>
            <ListGroup variant="flush">
              {searchResults.map((paper) => (
                <ListGroup.Item key={paper.id} className="py-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h5 className="mb-2 flex-grow-1 me-3">
                      <a 
                        href={paper.arxiv_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: '#0d6efd' }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {paper.title}
                      </a>
                    </h5>
                    <ReadingListButton 
                      paper={paper}
                      size="sm"
                      variant="compact"
                    />
                  </div>
                  
                  <div>
                    <div className="mb-2">
                      <div className="row">
                        <div className="col-md-8">
                          <small className="text-muted">
                            <strong>{t('common.authors')}:</strong> {paper.authors.join(', ')}
                          </small>
                        </div>
                        <div className="col-md-4 text-md-end">
                          <small className="text-muted">
                            <strong>{t('common.published')}:</strong> {new Date(paper.published_at).toLocaleDateString()}
                          </small>
                        </div>
                      </div>
                      <div className="mt-1">
                        <small className="text-muted">
                          <strong>{t('common.arxivId')}:</strong> 
                          <a 
                            href={paper.arxiv_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ms-1 text-decoration-none"
                          >
                            {paper.arxiv_id}
                          </a>
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h6 className="mb-2 text-secondary">{t('common.abstract')}</h6>
                    <div>
                      <p 
                        style={{ 
                          textAlign: 'justify', 
                          lineHeight: '1.6',
                          marginBottom: '8px',
                          fontSize: '0.95rem'
                        }}
                      >
                        {expandedAbstracts.has(paper.id) 
                          ? paper.summary 
                          : getTruncatedAbstract(paper.summary)
                        }
                        {paper.summary.length > 200 && !expandedAbstracts.has(paper.id) && (
                          <span>...</span>
                        )}
                      </p>
                      
                      {paper.summary.length > 200 && (
                        <button
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                          onClick={() => toggleAbstractExpanded(paper.id)}
                          style={{ 
                            fontSize: '0.85rem',
                            color: '#6c757d',
                            border: 'none',
                            background: 'none'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#007bff'}
                          onMouseOut={(e) => e.currentTarget.style.color = '#6c757d'}
                        >
                          {expandedAbstracts.has(paper.id) 
                            ? `▲ ${t('paperSearch.hideAbstract')}` 
                            : `▼ ${t('paperSearch.showAbstract')}`
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {totalPages > 1 && (
              <Pagination className="mt-3">
                {[...Array(totalPages)].map((_, index) => (
                  <Pagination.Item
                    key={index + 1}
                    active={index + 1 === currentPage}
                    onClick={() => handleSearch(index + 1)}
                  >
                    {index + 1}
                  </Pagination.Item>
                ))}
              </Pagination>
            )}
          </Card.Body>
        </Card>
      )}

      {searchResults.length === 0 && !loading && query.trim() !== '' && !error && (
        <p>{t('paperSearch.noResults')}</p>
      )}
    </div>
  );
};

export default PaperSearch;