# Reading List Feature - Detailed Design Document
## 「あとで読む」機能 - 詳細設計書

## Table of Contents / 目次

1. [Architecture Overview / アーキテクチャ概要](#architecture-overview)
2. [Component Design / コンポーネント設計](#component-design)
3. [Data Management / データ管理](#data-management)
4. [UI/UX Design / UI/UX設計](#uiux-design)
5. [Integration Points / 統合ポイント](#integration-points)
6. [Implementation Plan / 実装計画](#implementation-plan)
7. [Testing Strategy / テスト戦略](#testing-strategy)

## Architecture Overview / アーキテクチャ概要

### System Integration / システム統合

```
┌─────────────────────────────────────────────────────────────┐
│                    Paper Trend Analyzer                    │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Dashboard     │  │  Paper Search   │  │ Trend Anal. │ │
│  │                 │  │                 │  │             │ │
│  │  [Word Cloud]   │  │ [Search Results]│  │ [Charts]    │ │
│  │      ↓          │  │      ↓          │  │     ↓       │ │
│  │ [Read Later]    │  │ [Read Later]    │  │ [Read Later]│ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│           ↓                    ↓                    ↓       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Reading List Service                      │ │
│  │                                                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │ Local Store │  │   Context   │  │   Components    │ │ │
│  │  │(localStorage)│  │ (React)     │  │ (UI Elements)   │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│           ↓                                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Reading List Page                        │ │
│  │                                                         │ │
│  │  [Filters] [Sort] [Search] [Stats]                     │ │
│  │  [Paper List Items with Actions]                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Architecture Principles / 核心アーキテクチャ原則

1. **Single Responsibility**: 各コンポーネントは明確な責任を持つ
2. **Loose Coupling**: 既存システムとの疎結合
3. **High Cohesion**: 関連機能の密結合
4. **Extensibility**: 将来の拡張に対応
5. **Performance**: 効率的なデータ管理とUI更新

## Component Design / コンポーネント設計

### Component Hierarchy / コンポーネント階層

```
ReadingListProvider (Context)
├── App.tsx
│   ├── Navigation
│   │   └── ReadingListMenuItem
│   ├── PaperSearch
│   │   └── PaperSearchResults
│   │       └── ReadingListButton
│   ├── Dashboard
│   │   └── WordCloudPapers
│   │       └── ReadingListButton
│   └── ReadingList (New Page)
│       ├── ReadingListHeader
│       │   ├── ReadingListStats
│       │   └── ReadingListActions
│       ├── ReadingListFilters
│       ├── ReadingListContent
│       │   ├── ReadingListItem (multiple)
│       │   │   ├── ReadingListItemContent
│       │   │   ├── ReadingListItemActions
│       │   │   └── ReadingListItemNotes
│       │   └── ReadingListEmptyState
│       └── ReadingListPagination
```

### Component Specifications / コンポーネント仕様

#### 1. ReadingListProvider (Context Provider)

```typescript
// Context for global reading list state management
interface ReadingListContextType {
  // State
  items: ReadingListItem[];
  isLoading: boolean;
  error: string | null;
  
  // Stats
  stats: ReadingListStats;
  
  // Actions
  addToReadingList: (paper: Paper, options?: Partial<ReadingListItem>) => Promise<void>;
  removeFromReadingList: (itemId: number) => Promise<void>;
  updateReadingListItem: (itemId: number, updates: Partial<ReadingListItem>) => Promise<void>;
  isInReadingList: (paperId: number) => boolean;
  getReadingListItem: (paperId: number) => ReadingListItem | null;
  
  // Bulk operations
  markAsRead: (itemIds: number[]) => Promise<void>;
  removeMultiple: (itemIds: number[]) => Promise<void>;
  
  // Utility
  refreshReadingList: () => Promise<void>;
  exportReadingList: () => Promise<Blob>;
  importReadingList: (file: File) => Promise<void>;
}

const ReadingListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const loadReadingList = async () => {
      try {
        setIsLoading(true);
        const data = ReadingListService.getReadingList();
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reading list');
      } finally {
        setIsLoading(false);
      }
    };

    loadReadingList();
  }, []);

  // Computed stats
  const stats = useMemo(() => ({
    total: items.length,
    unread: items.filter(item => item.readStatus === 'unread').length,
    reading: items.filter(item => item.readStatus === 'reading').length,
    completed: items.filter(item => item.readStatus === 'completed').length,
    highPriority: items.filter(item => item.priority === 'high').length,
  }), [items]);

  const addToReadingList = useCallback(async (paper: Paper, options?: Partial<ReadingListItem>) => {
    try {
      setIsLoading(true);
      const newItem = ReadingListService.addToReadingList(paper, options);
      setItems(prev => [newItem, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to reading list');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ... other methods

  return (
    <ReadingListContext.Provider value={{
      items,
      isLoading,
      error,
      stats,
      addToReadingList,
      removeFromReadingList,
      updateReadingListItem,
      isInReadingList,
      // ... other methods
    }}>
      {children}
    </ReadingListContext.Provider>
  );
};
```

#### 2. ReadingListButton Component

```typescript
interface ReadingListButtonProps {
  paper: Paper;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon' | 'compact';
  showText?: boolean;
  className?: string;
  onSuccess?: (action: 'added' | 'removed') => void;
  onError?: (error: string) => void;
}

const ReadingListButton: React.FC<ReadingListButtonProps> = ({
  paper,
  size = 'md',
  variant = 'button',
  showText = true,
  className = '',
  onSuccess,
  onError
}) => {
  const { t } = useTranslation();
  const { addToReadingList, removeFromReadingList, isInReadingList } = useReadingList();
  const [isLoading, setIsLoading] = useState(false);

  const isInList = isInReadingList(paper.id);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setIsLoading(true);
      
      if (isInList) {
        const item = getReadingListItem(paper.id);
        if (item) {
          await removeFromReadingList(item.id);
          onSuccess?.('removed');
        }
      } else {
        await addToReadingList(paper);
        onSuccess?.('added');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    const iconClass = isInList ? 'bi-bookmark-fill' : 'bi-bookmark';
    const textKey = isInList ? 'readingList.removeFromList' : 'readingList.addToList';

    switch (variant) {
      case 'icon':
        return <i className={`bi ${iconClass}`} />;
      case 'compact':
        return (
          <>
            <i className={`bi ${iconClass} me-1`} />
            {isInList ? t('readingList.saved') : t('readingList.save')}
          </>
        );
      default:
        return (
          <>
            <i className={`bi ${iconClass} me-1`} />
            {showText && t(textKey)}
          </>
        );
    }
  };

  return (
    <Button
      variant={isInList ? 'success' : 'outline-primary'}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
      className={`reading-list-button ${className}`}
      title={t(isInList ? 'readingList.removeFromList' : 'readingList.addToList')}
    >
      {isLoading ? (
        <Spinner animation="border" size="sm" />
      ) : (
        getButtonContent()
      )}
    </Button>
  );
};
```

#### 3. ReadingList Main Component

```typescript
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

  if (isLoading) {
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
      <ReadingListHeader 
        stats={stats}
        selectedItems={selectedItems}
        onClearSelection={() => setSelectedItems(new Set())}
      />
      
      <ReadingListFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalItems={filteredItems.length}
      />

      {filteredItems.length === 0 ? (
        <ReadingListEmptyState hasFilters={Object.values(filters).some(Boolean)} />
      ) : (
        <>
          <ReadingListContent
            items={paginatedItems}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
          />
          
          {totalPages > 1 && (
            <ReadingListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}
    </div>
  );
};
```

#### 4. ReadingListItem Component

```typescript
interface ReadingListItemProps {
  item: ReadingListItem;
  isSelected: boolean;
  onSelectionChange: (itemId: number, selected: boolean) => void;
}

const ReadingListItem: React.FC<ReadingListItemProps> = ({
  item,
  isSelected,
  onSelectionChange
}) => {
  const { t } = useTranslation();
  const { updateReadingListItem, removeFromReadingList } = useReadingList();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(item.notes || '');

  const handleStatusChange = async (newStatus: ReadingListItem['readStatus']) => {
    try {
      await updateReadingListItem(item.id, { readStatus: newStatus });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handlePriorityChange = async (newPriority: ReadingListItem['priority']) => {
    try {
      await updateReadingListItem(item.id, { priority: newPriority });
    } catch (error) {
      console.error('Failed to update priority:', error);
    }
  };

  const handleNotesUpdate = async () => {
    try {
      await updateReadingListItem(item.id, { notes });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  const handleRemove = async () => {
    if (confirm(t('readingList.confirmRemove'))) {
      try {
        await removeFromReadingList(item.id);
      } catch (error) {
        console.error('Failed to remove item:', error);
      }
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'reading': return 'primary';
      case 'unread': return 'outline-secondary';
      default: return 'outline-secondary';
    }
  };

  return (
    <Card className={`reading-list-item mb-3 ${isSelected ? 'border-primary' : ''}`}>
      <Card.Body>
        <div className="row">
          <div className="col-auto">
            <Form.Check
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelectionChange(item.id, e.target.checked)}
            />
          </div>
          
          <div className="col">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <h5 className="mb-1">
                <a
                  href={item.arxivUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                >
                  {item.title}
                </a>
              </h5>
              
              <div className="d-flex gap-2">
                <Badge bg={getPriorityBadgeVariant(item.priority)}>
                  {t(`readingList.priority.${item.priority}`)}
                </Badge>
                <Badge bg={getStatusBadgeVariant(item.readStatus)}>
                  {t(`readingList.status.${item.readStatus}`)}
                </Badge>
              </div>
            </div>

            <div className="text-muted mb-2">
              <small>
                <strong>{t('common.authors')}:</strong> {item.authors.join(', ')}
                <span className="mx-2">•</span>
                <strong>{t('common.published')}:</strong> {new Date(item.publishedAt).toLocaleDateString()}
                <span className="mx-2">•</span>
                <strong>{t('readingList.addedAt')}:</strong> {new Date(item.addedAt).toLocaleDateString()}
              </small>
            </div>

            {isExpanded && (
              <div className="mb-3">
                <p className="text-justify">{item.summary}</p>
              </div>
            )}

            {item.notes && !isEditing && (
              <div className="mb-2">
                <strong>{t('readingList.notes')}:</strong>
                <p className="mt-1 p-2 bg-light rounded small">{item.notes}</p>
              </div>
            )}

            {isEditing && (
              <div className="mb-3">
                <Form.Group>
                  <Form.Label>{t('readingList.notes')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('readingList.notesPlaceholder')}
                  />
                </Form.Group>
                <div className="mt-2">
                  <Button size="sm" variant="primary" onClick={handleNotesUpdate}>
                    {t('common.save')}
                  </Button>
                  <Button size="sm" variant="secondary" className="ms-2" onClick={() => setIsEditing(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center">
              <div className="btn-group" role="group">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                  {isExpanded ? t('readingList.hideAbstract') : t('readingList.showAbstract')}
                </Button>
                
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <i className="bi bi-pencil" />
                  {t('readingList.editNotes')}
                </Button>
              </div>

              <div className="btn-group" role="group">
                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-primary">
                    <i className="bi bi-check-circle" />
                    {t('readingList.status')}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handleStatusChange('unread')}>
                      {t('readingList.status.unread')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleStatusChange('reading')}>
                      {t('readingList.status.reading')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleStatusChange('completed')}>
                      {t('readingList.status.completed')}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-warning">
                    <i className="bi bi-flag" />
                    {t('readingList.priority')}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handlePriorityChange('low')}>
                      {t('readingList.priority.low')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handlePriorityChange('medium')}>
                      {t('readingList.priority.medium')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handlePriorityChange('high')}>
                      {t('readingList.priority.high')}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={handleRemove}
                >
                  <i className="bi bi-trash" />
                  {t('common.remove')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};
```

## Data Management / データ管理

### Type Definitions / 型定義

```typescript
// Extended types for reading list functionality
interface ReadingListItem {
  id: number;
  paperId: number;
  arxivId: string;
  title: string;
  authors: string[];
  summary: string;
  publishedAt: string;
  arxivUrl: string;
  addedAt: string;
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  readStatus: 'unread' | 'reading' | 'completed';
  tags?: string[];
  position?: number; // for custom ordering
}

interface ReadingListStats {
  total: number;
  unread: number;
  reading: number;
  completed: number;
  highPriority: number;
}

interface ReadingListFilters {
  status: 'all' | 'unread' | 'reading' | 'completed';
  priority: 'all' | 'low' | 'medium' | 'high';
  tags: string[];
  search: string;
  sortBy: 'addedAt' | 'publishedAt' | 'title' | 'priority';
  sortOrder: 'asc' | 'desc';
}

interface ReadingList {
  items: ReadingListItem[];
  lastUpdated: string;
  version: string;
  settings?: {
    defaultSort: string;
    defaultFilter: string;
    itemsPerPage: number;
  };
}
```

### Service Layer Design / サービス層設計

```typescript
class ReadingListService {
  private static readonly STORAGE_KEY = 'paper-trend-analyzer-reading-list';
  private static readonly VERSION = '1.0';

  // Core CRUD operations
  static getReadingList(): ReadingList {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return this.createEmptyReadingList();
      }

      const parsed = JSON.parse(data);
      
      // Version migration logic
      if (parsed.version !== this.VERSION) {
        return this.migrateData(parsed);
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load reading list:', error);
      return this.createEmptyReadingList();
    }
  }

  static saveReadingList(readingList: ReadingList): void {
    try {
      readingList.lastUpdated = new Date().toISOString();
      readingList.version = this.VERSION;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(readingList));
    } catch (error) {
      console.error('Failed to save reading list:', error);
      throw new Error('Failed to save reading list to storage');
    }
  }

  static addToReadingList(paper: Paper, options?: Partial<ReadingListItem>): ReadingListItem {
    const readingList = this.getReadingList();
    
    // Check for duplicates
    const existingIndex = readingList.items.findIndex(item => item.paperId === paper.id);
    if (existingIndex !== -1) {
      throw new Error('Paper already exists in reading list');
    }

    const newItem: ReadingListItem = {
      id: this.generateUniqueId(),
      paperId: paper.id,
      arxivId: paper.arxiv_id,
      title: paper.title,
      authors: paper.authors,
      summary: paper.summary,
      publishedAt: paper.published_at,
      arxivUrl: paper.arxiv_url,
      addedAt: new Date().toISOString(),
      readStatus: 'unread',
      priority: 'medium',
      ...options
    };

    readingList.items.unshift(newItem);
    this.saveReadingList(readingList);
    
    // Emit event for UI updates
    this.emitReadingListEvent('itemAdded', newItem);
    
    return newItem;
  }

  static removeFromReadingList(itemId: number): void {
    const readingList = this.getReadingList();
    const itemIndex = readingList.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found in reading list');
    }

    const removedItem = readingList.items[itemIndex];
    readingList.items.splice(itemIndex, 1);
    this.saveReadingList(readingList);
    
    this.emitReadingListEvent('itemRemoved', removedItem);
  }

  static updateReadingListItem(itemId: number, updates: Partial<ReadingListItem>): ReadingListItem {
    const readingList = this.getReadingList();
    const itemIndex = readingList.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found in reading list');
    }

    const updatedItem = { ...readingList.items[itemIndex], ...updates };
    readingList.items[itemIndex] = updatedItem;
    this.saveReadingList(readingList);
    
    this.emitReadingListEvent('itemUpdated', updatedItem);
    
    return updatedItem;
  }

  // Utility methods
  static isInReadingList(paperId: number): boolean {
    const readingList = this.getReadingList();
    return readingList.items.some(item => item.paperId === paperId);
  }

  static getReadingListItem(paperId: number): ReadingListItem | null {
    const readingList = this.getReadingList();
    return readingList.items.find(item => item.paperId === paperId) || null;
  }

  static getStats(): ReadingListStats {
    const readingList = this.getReadingList();
    return {
      total: readingList.items.length,
      unread: readingList.items.filter(item => item.readStatus === 'unread').length,
      reading: readingList.items.filter(item => item.readStatus === 'reading').length,
      completed: readingList.items.filter(item => item.readStatus === 'completed').length,
      highPriority: readingList.items.filter(item => item.priority === 'high').length,
    };
  }

  // Bulk operations
  static bulkUpdateStatus(itemIds: number[], status: ReadingListItem['readStatus']): void {
    const readingList = this.getReadingList();
    
    itemIds.forEach(itemId => {
      const itemIndex = readingList.items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        readingList.items[itemIndex].readStatus = status;
      }
    });

    this.saveReadingList(readingList);
    this.emitReadingListEvent('bulkUpdate', { itemIds, updates: { readStatus: status } });
  }

  static bulkRemove(itemIds: number[]): void {
    const readingList = this.getReadingList();
    readingList.items = readingList.items.filter(item => !itemIds.includes(item.id));
    this.saveReadingList(readingList);
    this.emitReadingListEvent('bulkRemove', { itemIds });
  }

  // Import/Export functionality
  static exportReadingList(): Blob {
    const readingList = this.getReadingList();
    const exportData = {
      ...readingList,
      exportedAt: new Date().toISOString(),
      exportVersion: this.VERSION
    };

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
  }

  static async importReadingList(file: File, strategy: 'replace' | 'merge' = 'merge'): Promise<void> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import file format');
      }

      const currentList = this.getReadingList();
      
      if (strategy === 'replace') {
        this.saveReadingList(importData);
      } else {
        // Merge strategy: add items that don't exist
        const existingPaperIds = new Set(currentList.items.map(item => item.paperId));
        const newItems = importData.items.filter(
          (item: ReadingListItem) => !existingPaperIds.has(item.paperId)
        );

        currentList.items.push(...newItems);
        this.saveReadingList(currentList);
      }

      this.emitReadingListEvent('imported', { strategy, itemCount: importData.items.length });
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to import reading list');
    }
  }

  // Private helper methods
  private static createEmptyReadingList(): ReadingList {
    return {
      items: [],
      lastUpdated: new Date().toISOString(),
      version: this.VERSION,
      settings: {
        defaultSort: 'addedAt',
        defaultFilter: 'all',
        itemsPerPage: 20
      }
    };
  }

  private static generateUniqueId(): number {
    return Date.now() + Math.random();
  }

  private static emitReadingListEvent(type: string, data: any): void {
    window.dispatchEvent(new CustomEvent('readingListUpdate', {
      detail: { type, data }
    }));
  }

  private static validateImportData(data: any): boolean {
    return (
      data &&
      Array.isArray(data.items) &&
      data.items.every((item: any) =>
        typeof item.paperId === 'number' &&
        typeof item.title === 'string' &&
        Array.isArray(item.authors)
      )
    );
  }

  private static migrateData(oldData: any): ReadingList {
    // Handle data migration from older versions
    // For now, just return empty list for simplicity
    console.warn('Data migration needed, creating fresh reading list');
    return this.createEmptyReadingList();
  }
}
```

## UI/UX Design / UI/UX設計

### Visual Design Specifications / 視覚的設計仕様

#### Color Scheme / カラースキーム
```css
.reading-list {
  --rl-primary: #0d6efd;
  --rl-success: #198754;
  --rl-warning: #ffc107;
  --rl-danger: #dc3545;
  --rl-secondary: #6c757d;
  --rl-light: #f8f9fa;
  --rl-dark: #212529;
  
  /* Status colors */
  --rl-unread: #6c757d;
  --rl-reading: #0d6efd;
  --rl-completed: #198754;
  
  /* Priority colors */
  --rl-priority-low: #6c757d;
  --rl-priority-medium: #ffc107;
  --rl-priority-high: #dc3545;
}
```

#### Button States / ボタンステート
```css
.reading-list-button {
  transition: all 0.2s ease-in-out;
  position: relative;
}

.reading-list-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.reading-list-button.btn-success {
  background-color: var(--rl-success);
  border-color: var(--rl-success);
}

.reading-list-button.btn-success:hover {
  background-color: #157347;
  border-color: #146c43;
}

.reading-list-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
```

#### Animation Specifications / アニメーション仕様
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.reading-list-item {
  animation: slideIn 0.3s ease-out;
}

.reading-list-item.removing {
  animation: fadeOut 0.2s ease-in;
}

.reading-list-stats {
  transition: all 0.3s ease-in-out;
}
```

### Responsive Design / レスポンシブデザイン

#### Mobile Layout / モバイルレイアウト
```css
@media (max-width: 768px) {
  .reading-list-item .btn-group {
    flex-direction: column;
    width: 100%;
  }
  
  .reading-list-item .btn-group .btn {
    margin-bottom: 0.25rem;
    border-radius: 0.375rem !important;
  }
  
  .reading-list-filters {
    flex-direction: column;
  }
  
  .reading-list-filters .form-control,
  .reading-list-filters .form-select {
    margin-bottom: 0.5rem;
  }
}

@media (max-width: 576px) {
  .reading-list-button {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }
  
  .reading-list-item h5 {
    font-size: 1rem;
  }
  
  .reading-list-stats .col {
    text-align: center;
    margin-bottom: 0.5rem;
  }
}
```

### Accessibility / アクセシビリティ

#### ARIA Labels and Roles / ARIAラベルとロール
```tsx
// Reading list button accessibility
<Button
  variant={isInList ? 'success' : 'outline-primary'}
  onClick={handleClick}
  aria-label={t(isInList ? 'readingList.removeFromList' : 'readingList.addToList')}
  aria-pressed={isInList}
  role="button"
>
  {/* Button content */}
</Button>

// Reading list item accessibility
<Card
  className="reading-list-item"
  role="article"
  aria-labelledby={`paper-title-${item.id}`}
  aria-describedby={`paper-meta-${item.id}`}
>
  <Card.Body>
    <h5 id={`paper-title-${item.id}`}>{item.title}</h5>
    <div id={`paper-meta-${item.id}`} className="sr-only">
      {t('readingList.ariaDescription', {
        authors: item.authors.join(', '),
        status: t(`readingList.status.${item.readStatus}`),
        priority: t(`readingList.priority.${item.priority}`)
      })}
    </div>
  </Card.Body>
</Card>
```

#### Keyboard Navigation / キーボードナビゲーション
```tsx
const ReadingListItem: React.FC<ReadingListItemProps> = ({ item }) => {
  const itemRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        // Toggle selection or open paper
        break;
      case 'Delete':
        e.preventDefault();
        handleRemove();
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Focus next item
        break;
      case 'ArrowUp':
        e.preventDefault();
        // Focus previous item
        break;
    }
  };

  return (
    <div
      ref={itemRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="reading-list-item"
      role="listitem"
    >
      {/* Item content */}
    </div>
  );
};
```

## Integration Points / 統合ポイント

### Navigation Integration / ナビゲーション統合

#### App.tsx Updates
```tsx
// Add reading list route and navigation
import ReadingList from './components/ReadingList';

function App() {
  const { t } = useTranslation();
  const { stats } = useReadingList();

  return (
    <Router>
      <ReadingListProvider>
        <Navbar bg="light" expand="lg">
          <Container>
            <Navbar.Brand as={Link} to="/">{t('appName')}</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/">{t('navigation.dashboard')}</Nav.Link>
                <Nav.Link as={Link} to="/trend-analysis">Trend Analysis</Nav.Link>
                <Nav.Link as={Link} to="/paper-search">{t('navigation.paperSearch')}</Nav.Link>
                <Nav.Link as={Link} to="/reading-list">
                  {t('navigation.readingList')}
                  {stats.total > 0 && (
                    <Badge bg="primary" className="ms-1">{stats.total}</Badge>
                  )}
                </Nav.Link>
              </Nav>
              <Nav className="ms-auto">
                <LanguageSwitcher />
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
        
        <Container className="mt-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trend-analysis" element={<TrendAnalysis />} />
            <Route path="/paper-search" element={<PaperSearch />} />
            <Route path="/reading-list" element={<ReadingList />} />
          </Routes>
        </Container>
      </ReadingListProvider>
    </Router>
  );
}
```

### PaperSearch Integration / 論文検索統合

```tsx
// Update PaperSearch component to include reading list buttons
const PaperSearchResults: React.FC<{ papers: Paper[] }> = ({ papers }) => {
  return (
    <ListGroup variant="flush">
      {papers.map((paper) => (
        <ListGroup.Item key={paper.id} className="py-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <h5 className="mb-2">
              <a href={paper.arxiv_url} target="_blank" rel="noopener noreferrer">
                {paper.title}
              </a>
            </h5>
            <ReadingListButton 
              paper={paper}
              size="sm"
              onSuccess={(action) => {
                // Show toast notification
                toast.success(t(`readingList.${action}Success`));
              }}
              onError={(error) => {
                toast.error(error);
              }}
            />
          </div>
          
          {/* Rest of paper display */}
          <div className="mb-2">
            <div className="row">
              <div className="col-md-8">
                <small className="text-muted">
                  <strong>Authors:</strong> {paper.authors.join(', ')}
                </small>
              </div>
              <div className="col-md-4 text-md-end">
                <small className="text-muted">
                  <strong>Published:</strong> {new Date(paper.published_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          </div>
          
          {/* Abstract section */}
          <div>
            <h6 className="mb-2 text-secondary">Abstract</h6>
            <p>{paper.summary}</p>
          </div>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};
```

### Dashboard Integration / ダッシュボード統合

```tsx
// Add reading list quick access to dashboard
const Dashboard: React.FC = () => {
  const { stats } = useReadingList();
  
  return (
    <div>
      {/* Existing dashboard content */}
      
      {/* Reading List Quick Access */}
      {stats.total > 0 && (
        <Card className="mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <Card.Title>{t('readingList.quickAccess')}</Card.Title>
                <small className="text-muted">
                  {t('readingList.stats.summary', {
                    total: stats.total,
                    unread: stats.unread
                  })}
                </small>
              </div>
              <Button as={Link} to="/reading-list" variant="outline-primary">
                {t('readingList.viewAll')}
                <i className="bi bi-arrow-right ms-1" />
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
      
      {/* Existing content continues */}
    </div>
  );
};
```

## Implementation Plan / 実装計画

### Phase 1: Core Implementation (Days 1-3)

#### Day 1: Foundation
- [ ] Create type definitions in `types.ts`
- [ ] Implement `ReadingListService` with localStorage
- [ ] Create `ReadingListProvider` context
- [ ] Add translation keys to all language files

#### Day 2: Core Components
- [ ] Implement `ReadingListButton` component
- [ ] Create basic `ReadingList` page component
- [ ] Implement `ReadingListItem` component
- [ ] Add routing for reading list page

#### Day 3: Integration & Polish
- [ ] Integrate buttons into `PaperSearch`
- [ ] Add navigation menu item
- [ ] Implement basic filtering and sorting
- [ ] Add error handling and loading states

### Phase 2: Enhanced Features (Days 4-7)

#### Day 4-5: Advanced UI
- [ ] Implement `ReadingListFilters` component
- [ ] Add `ReadingListStats` component
- [ ] Create `ReadingListEmptyState`
- [ ] Add pagination support

#### Day 6-7: Advanced Features
- [ ] Implement notes and priority system
- [ ] Add bulk operations (select multiple)
- [ ] Create import/export functionality
- [ ] Add dashboard integration

### Phase 3: Polish & Testing (Days 8-10)

#### Day 8: Styling & Animation
- [ ] Add custom CSS and animations
- [ ] Implement responsive design
- [ ] Add accessibility improvements
- [ ] Polish visual design

#### Day 9: Testing
- [ ] Write unit tests for service layer
- [ ] Add component tests
- [ ] Test integration with existing features
- [ ] Browser compatibility testing

#### Day 10: Documentation & Deployment
- [ ] Update user documentation
- [ ] Create API documentation (for future server implementation)
- [ ] Performance testing and optimization
- [ ] Final bug fixes and polish

## Testing Strategy / テスト戦略

### Unit Tests / 単体テスト

```typescript
// ReadingListService.test.ts
describe('ReadingListService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('addToReadingList', () => {
    it('should add paper to reading list', () => {
      const paper: Paper = {
        id: 1,
        title: 'Test Paper',
        authors: ['Author 1'],
        // ... other properties
      };

      const item = ReadingListService.addToReadingList(paper);
      
      expect(item.paperId).toBe(paper.id);
      expect(item.title).toBe(paper.title);
      expect(item.readStatus).toBe('unread');
    });

    it('should throw error for duplicate papers', () => {
      const paper: Paper = { /* paper data */ };
      
      ReadingListService.addToReadingList(paper);
      
      expect(() => {
        ReadingListService.addToReadingList(paper);
      }).toThrow('Paper already exists in reading list');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Add test items with different statuses
      const stats = ReadingListService.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.unread).toBe(2);
      expect(stats.completed).toBe(1);
    });
  });
});
```

### Component Tests / コンポーネントテスト

```typescript
// ReadingListButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadingListButton } from '../ReadingListButton';

const mockPaper: Paper = {
  id: 1,
  title: 'Test Paper',
  authors: ['Test Author'],
  // ... other properties
};

describe('ReadingListButton', () => {
  it('should show "Add to Reading List" when not in list', () => {
    render(<ReadingListButton paper={mockPaper} />);
    
    expect(screen.getByText(/add to reading list/i)).toBeInTheDocument();
  });

  it('should show "Remove from List" when in list', () => {
    // Mock isInReadingList to return true
    render(<ReadingListButton paper={mockPaper} isInList={true} />);
    
    expect(screen.getByText(/remove from list/i)).toBeInTheDocument();
  });

  it('should call onAdd when clicked and not in list', () => {
    const onAdd = jest.fn();
    render(<ReadingListButton paper={mockPaper} onAdd={onAdd} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(onAdd).toHaveBeenCalledWith(mockPaper);
  });
});
```

### Integration Tests / 統合テスト

```typescript
// ReadingList.integration.test.tsx
describe('Reading List Integration', () => {
  it('should add paper from search and show in reading list', async () => {
    render(
      <ReadingListProvider>
        <Router>
          <Routes>
            <Route path="/search" element={<PaperSearch />} />
            <Route path="/reading-list" element={<ReadingList />} />
          </Routes>
        </Router>
      </ReadingListProvider>
    );

    // Navigate to search page
    // Search for papers
    // Click "Add to Reading List" button
    // Navigate to reading list page
    // Verify paper appears in list

    expect(screen.getByText('Test Paper')).toBeInTheDocument();
  });

  it('should maintain reading list state across page navigation', () => {
    // Test that reading list persists when navigating between pages
  });
});
```

### E2E Tests / E2Eテスト

```typescript
// reading-list.e2e.ts
describe('Reading List E2E', () => {
  it('should complete full reading list workflow', () => {
    cy.visit('/paper-search');
    
    // Search for papers
    cy.get('[data-testid="search-input"]').type('transformer');
    cy.get('[data-testid="search-button"]').click();
    
    // Add paper to reading list
    cy.get('[data-testid="reading-list-button"]').first().click();
    cy.get('[data-testid="toast"]').should('contain', 'Added to reading list');
    
    // Navigate to reading list
    cy.get('[data-testid="nav-reading-list"]').click();
    
    // Verify paper is in list
    cy.get('[data-testid="reading-list-item"]').should('have.length.at.least', 1);
    
    // Update status
    cy.get('[data-testid="status-dropdown"]').first().click();
    cy.get('[data-testid="status-reading"]').click();
    
    // Verify status updated
    cy.get('[data-testid="status-badge"]').should('contain', 'Reading');
  });
});
```

## Performance Considerations / パフォーマンス考慮事項

### Memory Management / メモリ管理

```typescript
// Implement cleanup in components
const ReadingList: React.FC = () => {
  useEffect(() => {
    // Cleanup function to prevent memory leaks
    return () => {
      // Clear any timeouts, intervals, or subscriptions
    };
  }, []);
};

// Use React.memo for expensive components
const ReadingListItem = React.memo<ReadingListItemProps>(({ item }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return prevProps.item.id === nextProps.item.id &&
         prevProps.item.readStatus === nextProps.item.readStatus;
});
```

### Storage Optimization / ストレージ最適化

```typescript
class ReadingListService {
  // Compress data before storing
  static saveReadingList(readingList: ReadingList): void {
    const compressedData = this.compressReadingList(readingList);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(compressedData));
  }

  private static compressReadingList(readingList: ReadingList): ReadingList {
    return {
      ...readingList,
      items: readingList.items.map(item => ({
        ...item,
        // Remove or compress large fields
        summary: item.summary.length > 500 
          ? item.summary.substring(0, 500) + '...' 
          : item.summary
      }))
    };
  }

  // Implement storage quota management
  static cleanupOldItems(): void {
    const readingList = this.getReadingList();
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6); // Keep 6 months

    readingList.items = readingList.items.filter(item => 
      new Date(item.addedAt) > cutoffDate || item.readStatus !== 'completed'
    );

    this.saveReadingList(readingList);
  }
}
```

### Virtual Scrolling / 仮想スクロール

```typescript
// For large lists, implement virtual scrolling
import { FixedSizeList as List } from 'react-window';

const VirtualizedReadingList: React.FC<{ items: ReadingListItem[] }> = ({ items }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ReadingListItem item={items[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={items.length}
      itemSize={200}
      itemData={items}
    >
      {Row}
    </List>
  );
};
```

## Conclusion / まとめ

この詳細設計書は、「あとで読む」機能の完全な実装ガイドを提供します。段階的なアプローチにより、まずMVPを迅速に実装し、その後ユーザーフィードバックに基づいて機能を拡張できます。

主要な設計決定：
- **localStorage基盤**: 認証不要で即座に利用開始
- **React Context**: グローバルステート管理
- **コンポーネント分離**: 再利用可能で保守しやすい設計
- **多言語対応**: 既存のi18nシステム活用
- **アクセシビリティ**: WCAG準拠の設計
- **パフォーマンス**: 効率的なデータ管理とUI更新

この設計により、ユーザーは論文研究をより効率的に管理でき、Paper Trend Analyzerの価値を大幅に向上させることができます。