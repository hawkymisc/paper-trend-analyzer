import React, { useState, useMemo } from 'react';
import { Card, Form, Button, Badge, Alert, Spinner, Pagination } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { ReadingListFilters } from '../types';
import { useReadingList } from '../contexts/ReadingListContext';
import ReadingListItemComponent from './ReadingListItem';

const ReadingList: React.FC = () => {
  const { t } = useTranslation();
  const { items, stats, isLoading, error } = useReadingList();
  const [filters, setFilters] = useState<ReadingListFilters>({
    status: 'all',
    priority: 'all',
    tags: [],
    search: '',
    sortBy: 'addedAt',
    sortOrder: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.readStatus === filters.status);
    }
    
    if (filters.priority !== 'all') {
      filtered = filtered.filter(item => item.priority === filters.priority);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.authors.some(author => author.toLowerCase().includes(searchLower)) ||
        item.notes?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.tags.length > 0) {
      filtered = filtered.filter(item =>
        item.tags?.some(tag => filters.tags.includes(tag))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'addedAt':
          comparison = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          break;
        case 'publishedAt':
          comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [items, filters]);

  // Pagination
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelectionChange = (itemId: number, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map(item => item.id)));
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-2">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>{t('common.error')}</Alert.Heading>
        <p>{error}</p>
      </Alert>
    );
  }

  return (
    <div className="reading-list">
      {/* Header with stats */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>{t('readingList.title')}</h1>
          <p className="text-muted mb-0">
            {t('readingList.stats.summary', { total: stats.total, unread: stats.unread })}
          </p>
        </div>
        
        <div className="d-flex gap-2">
          <Badge bg="secondary">{t('readingList.stats.total')}: {stats.total}</Badge>
          <Badge bg="primary">{t('readingList.stats.unread')}: {stats.unread}</Badge>
          <Badge bg="warning" text="dark">{t('readingList.stats.reading')}: {stats.reading}</Badge>
          <Badge bg="success">{t('readingList.stats.completed')}: {stats.completed}</Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <div className="row g-3">
            <div className="col-md-4">
              <Form.Group>
                <Form.Label>{t('common.search')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('paperSearch.searchPlaceholder')}
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </Form.Group>
            </div>
            
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>{t('common.status')}</Form.Label>
                <Form.Select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                >
                  <option value="all">{t('readingList.filters.all')}</option>
                  <option value="unread">{t('readingList.filters.unread')}</option>
                  <option value="reading">{t('readingList.filters.reading')}</option>
                  <option value="completed">{t('readingList.filters.completed')}</option>
                </Form.Select>
              </Form.Group>
            </div>
            
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>{t('common.priority')}</Form.Label>
                <Form.Select
                  value={filters.priority}
                  onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value as any }))}
                >
                  <option value="all">{t('readingList.filters.all')}</option>
                  <option value="low">{t('readingList.priority.low')}</option>
                  <option value="medium">{t('readingList.priority.medium')}</option>
                  <option value="high">{t('readingList.priority.high')}</option>
                </Form.Select>
              </Form.Group>
            </div>
            
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>{t('common.sortBy')}</Form.Label>
                <Form.Select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                >
                  <option value="addedAt">{t('readingList.filters.addedDate')}</option>
                  <option value="publishedAt">{t('readingList.filters.publishDate')}</option>
                  <option value="title">{t('readingList.filters.title')}</option>
                  <option value="priority">{t('readingList.filters.priority')}</option>
                </Form.Select>
              </Form.Group>
            </div>
            
            <div className="col-md-2">
              <Form.Group>
                <Form.Label>{t('common.sortOrder')}</Form.Label>
                <Form.Select
                  value={filters.sortOrder}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value as any }))}
                >
                  <option value="desc">{t('common.descending')}</option>
                  <option value="asc">{t('common.ascending')}</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Bulk actions */}
      {selectedItems.size > 0 && (
        <Card className="mb-3 border-primary">
          <Card.Body className="py-2">
            <div className="d-flex justify-content-between align-items-center">
              <span>
{t('common.itemsSelected', { count: selectedItems.size })}
              </span>
              <div className="btn-group">
                <Button size="sm" variant="outline-success">
                  {t('readingList.actions.markAsRead')}
                </Button>
                <Button size="sm" variant="outline-danger">
                  {t('common.remove')}
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Content */}
      {filteredItems.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            {items.length === 0 ? (
              <>
                <i className="bi bi-bookmark display-1 text-muted"></i>
                <h3 className="mt-3">{t('readingList.empty.title')}</h3>
                <p className="text-muted">{t('readingList.empty.description')}</p>
              </>
            ) : (
              <>
                <i className="bi bi-search display-1 text-muted"></i>
                <h3 className="mt-3">{t('common.noMatchingPapers')}</h3>
                <p className="text-muted">{t('common.adjustSearchCriteria')}</p>
                <Button 
                  variant="outline-primary" 
                  onClick={() => setFilters({
                    status: 'all',
                    priority: 'all',
                    tags: [],
                    search: '',
                    sortBy: 'addedAt',
                    sortOrder: 'desc'
                  })}
                >
                  {t('common.clearFilters')}
                </Button>
              </>
            )}
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Select all checkbox */}
          <div className="mb-3">
            <Form.Check
              type="checkbox"
              label={t('common.selectAllOnPage', { count: paginatedItems.length })}
              checked={selectedItems.size === paginatedItems.length && paginatedItems.length > 0}
              onChange={handleSelectAll}
            />
          </div>

          {/* Items list */}
          <div className="reading-list-items">
            {paginatedItems.map(item => (
              <ReadingListItemComponent
                key={item.id}
                item={item}
                isSelected={selectedItems.has(item.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <Pagination>
                <Pagination.First 
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                />
                <Pagination.Prev 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                />
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <Pagination.Item
                      key={pageNum}
                      active={pageNum === currentPage}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}
                
                <Pagination.Next 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                />
                <Pagination.Last 
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
            </div>
          )}
          
          <div className="text-center text-muted mt-3">
            <small>
{t('common.showingResults', { 
                start: (currentPage - 1) * itemsPerPage + 1,
                end: Math.min(currentPage * itemsPerPage, filteredItems.length),
                total: filteredItems.length
              })}
            </small>
          </div>
        </>
      )}
    </div>
  );
};

export default ReadingList;