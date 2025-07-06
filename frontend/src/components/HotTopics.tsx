import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Spinner, Alert, Row, Col, Form, Badge, Accordion, Modal } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import MarkdownRenderer from './MarkdownRenderer';
import { HotTopicsResponse, HotTopicsRequest, HotTopic, HotTopicsFilters } from '../types';
import { HotTopicsService } from '../services/HotTopicsService';

const HotTopics: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [hotTopics, setHotTopics] = useState<HotTopicsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<HotTopic | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [filters, setFilters] = useState<HotTopicsFilters>({
    language: 'auto',
    days: 30,
    maxTopics: 10,
    sortBy: 'trend_score',
    sortOrder: 'desc',
  });

  const fetchHotTopics = async (requestParams?: HotTopicsRequest) => {
    try {
      setLoading(true);
      setError(null);
      
      const request: HotTopicsRequest = requestParams || {
        language: filters.language,
        days: filters.days,
        max_topics: filters.maxTopics,
      };

      const validationErrors = HotTopicsService.validateRequest(request);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      const response = await HotTopicsService.getHotTopicsSummary(request);
      setHotTopics(response);
      
    } catch (err) {
      console.error('Failed to fetch hot topics:', err);
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltersChange = (newFilters: Partial<HotTopicsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const applyFilters = () => {
    fetchHotTopics();
    setShowFilters(false);
  };

  const sortedTopics = hotTopics ? 
    HotTopicsService.sortHotTopics(hotTopics.hot_topics, filters.sortBy, filters.sortOrder) :
    [];

  const showTopicDetail = (topic: HotTopic) => {
    setSelectedTopic(topic);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>{t('hotTopics.title')}</h1>
          {hotTopics && (
            <p className="text-muted mb-0">
              {t('hotTopics.subtitle', {
                period: HotTopicsService.formatAnalysisPeriod(hotTopics.analysis_period_days),
                papers: hotTopics.total_papers_analyzed,
                generated: HotTopicsService.getRelativeTime(hotTopics.generated_at),
              })}
            </p>
          )}
        </div>
        
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <i className="bi bi-sliders me-1" />
            {t('common.filters')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchHotTopics()}
            disabled={loading}
          >
            {loading ? (
              <Spinner animation="border" size="sm" className="me-1" />
            ) : (
              <i className="bi bi-arrow-clockwise me-1" />
            )}
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-4">
          <Card.Body>
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>{t('hotTopics.filters.language')}</Form.Label>
                  <Form.Select
                    value={filters.language}
                    onChange={(e) => handleFiltersChange({ language: e.target.value })}
                  >
                    {HotTopicsService.getSupportedLanguages().map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>{t('hotTopics.filters.period')}</Form.Label>
                  <Form.Select
                    value={filters.days}
                    onChange={(e) => handleFiltersChange({ days: parseInt(e.target.value) })}
                  >
                    <option value={7}>1 {t('hotTopics.filters.week')}</option>
                    <option value={14}>2 {t('hotTopics.filters.weeks')}</option>
                    <option value={30}>1 {t('hotTopics.filters.month')}</option>
                    <option value={60}>2 {t('hotTopics.filters.months')}</option>
                    <option value={90}>3 {t('hotTopics.filters.months')}</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>{t('hotTopics.filters.maxTopics')}</Form.Label>
                  <Form.Select
                    value={filters.maxTopics}
                    onChange={(e) => handleFiltersChange({ maxTopics: parseInt(e.target.value) })}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>{t('hotTopics.filters.sortBy')}</Form.Label>
                  <Form.Select
                    value={filters.sortBy}
                    onChange={(e) => handleFiltersChange({ sortBy: e.target.value as any })}
                  >
                    <option value="trend_score">{t('hotTopics.filters.trendScore')}</option>
                    <option value="paper_count">{t('hotTopics.filters.paperCount')}</option>
                    <option value="topic">{t('hotTopics.filters.topic')}</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>{t('hotTopics.filters.order')}</Form.Label>
                  <Form.Select
                    value={filters.sortOrder}
                    onChange={(e) => handleFiltersChange({ sortOrder: e.target.value as any })}
                  >
                    <option value="desc">{t('hotTopics.filters.descending')}</option>
                    <option value="asc">{t('hotTopics.filters.ascending')}</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={1} className="d-flex align-items-end">
                <Button variant="primary" size="sm" onClick={applyFilters}>
                  {t('common.apply')}
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>{t('common.error')}</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" size="sm" onClick={() => fetchHotTopics()}>
            {t('common.retry')}
          </Button>
        </Alert>
      )}

      {/* Loading Display */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">{t('hotTopics.generating')}</p>
        </div>
      )}

      {/* Hot Topics Display */}
      {hotTopics && !loading && (
        <div>
          {sortedTopics.length === 0 ? (
            <Card>
              <Card.Body className="text-center py-5">
                <i className="bi bi-search display-1 text-muted"></i>
                <h3 className="mt-3">{t('hotTopics.noTopics.title')}</h3>
                <p className="text-muted">{t('hotTopics.noTopics.description')}</p>
              </Card.Body>
            </Card>
          ) : (
            <Row>
              {sortedTopics.map((topic, index) => (
                <Col key={index} lg={6} className="mb-4">
                  <Card className="h-100 hot-topic-card">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <h5 className="card-title mb-0">{topic.topic}</h5>
                        <div className="text-end">
                          <Badge 
                            bg="primary" 
                            className={`trend-score ${HotTopicsService.getTrendScoreColor(topic.trend_score)}`}
                          >
                            <i className={`bi ${HotTopicsService.getTrendScoreIcon(topic.trend_score)} me-1`} />
                            {HotTopicsService.formatTrendScore(topic.trend_score)}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-muted small">
                        {t('hotTopics.paperCount', { count: topic.paper_count })}
                      </p>

                      <MarkdownRenderer
                        content={topic.summary}
                        enableMarkdown={settings.enableMarkdownRendering}
                        className="card-text"
                        markdownStyles={settings.markdownStyles}
                      />

                      <div className="mb-3">
                        {topic.keywords.slice(0, 3).map((keyword, kidx) => (
                          <Badge key={kidx} bg="secondary" className="me-1 mb-1">
                            {keyword}
                          </Badge>
                        ))}
                        {topic.keywords.length > 3 && (
                          <Badge bg="light" text="dark" className="me-1 mb-1">
                            +{topic.keywords.length - 3}
                          </Badge>
                        )}
                      </div>

                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          {t('hotTopics.recentPapers', { count: topic.recent_papers.length })}
                        </small>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => showTopicDetail(topic)}
                        >
                          {t('hotTopics.viewDetails')}
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      )}

      {/* Topic Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{selectedTopic?.topic}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTopic && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Badge 
                    bg="primary" 
                    className={`me-2 ${HotTopicsService.getTrendScoreColor(selectedTopic.trend_score)}`}
                  >
                    <i className={`bi ${HotTopicsService.getTrendScoreIcon(selectedTopic.trend_score)} me-1`} />
                    {t('hotTopics.trendScore')}: {HotTopicsService.formatTrendScore(selectedTopic.trend_score)}
                  </Badge>
                  <Badge bg="info">
                    {t('hotTopics.paperCount', { count: selectedTopic.paper_count })}
                  </Badge>
                </div>
              </div>

              <div className="mb-4">
                <h6>{t('hotTopics.summary')}</h6>
                <MarkdownRenderer
                  content={selectedTopic.summary}
                  enableMarkdown={settings.enableMarkdownRendering}
                  markdownStyles={settings.markdownStyles}
                />
              </div>

              <div className="mb-4">
                <h6>{t('hotTopics.keywords')}</h6>
                <div>
                  {selectedTopic.keywords.map((keyword, index) => (
                    <Badge key={index} bg="secondary" className="me-1 mb-1">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h6>{t('hotTopics.recentPapers', { count: selectedTopic.recent_papers.length })}</h6>
                <Accordion>
                  {selectedTopic.recent_papers.map((paper, index) => (
                    <Accordion.Item key={index} eventKey={index.toString()}>
                      <Accordion.Header>
                        <div>
                          <div className="fw-bold">{paper.title}</div>
                          <small className="text-muted">
                            {paper.authors.join(', ')} • {formatDate(paper.published_at)}
                          </small>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        <p>{paper.summary}</p>
                        <div className="d-flex justify-content-end">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            href={paper.arxiv_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <i className="bi bi-box-arrow-up-right me-1" />
                            {t('paperSearch.viewOnArxiv')}
                          </Button>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            {t('common.close')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default HotTopics;