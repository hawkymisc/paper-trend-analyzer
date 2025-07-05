# Reading List Feature Specification
## 「あとで読む」機能仕様書

## Overview / 概要

This document outlines the specification for a Reading List feature (「あとで読む」) that allows users to save papers for later reading. This feature enhances user experience by providing a personal paper collection system.

本文書では、ユーザーが論文を後で読むために保存できるリーディングリスト機能（「あとで読む」）の仕様を説明します。この機能により、個人的な論文コレクションシステムを提供し、ユーザーエクスペリエンスを向上させます。

## Feature Description / 機能説明

### Core Functionality / 主要機能

1. **Add to Reading List / リストに追加**: 検索結果から「あとで読む」ボタンで論文を追加
2. **Reading List View / リスト表示**: 保存された論文の一覧表示
3. **Remove from List / リストから削除**: 不要になった論文の削除
4. **Organize and Manage / 整理・管理**: 論文の並び替えやフィルタリング
5. **Persistence / 永続化**: ブラウザ間でのデータ保持

### User Journey / ユーザージャーニー

1. **Discovery / 発見**: ユーザーが論文検索で興味深い論文を発見
2. **Save / 保存**: 「あとで読む」ボタンをクリックして保存
3. **Access / アクセス**: メニューから「あとで読む」リストにアクセス
4. **Review / 確認**: 保存された論文一覧を閲覧
5. **Read / 読む**: 論文リンクから実際の論文にアクセス
6. **Manage / 管理**: 読み終わった論文の削除や整理

## Technical Specification / 技術仕様

### 1. User Management Strategy / ユーザー管理戦略

現在のシステムはユーザー認証機能がないため、以下の3つのアプローチを検討：

#### Option A: Browser-based Storage (推奨 - Phase 1)
- **Implementation**: localStorage / sessionStorage
- **Pros**: 実装が簡単、即座に利用可能、認証不要
- **Cons**: ブラウザ間でのデータ共有不可、データ消失リスク
- **Use Case**: シンプルな個人利用、プロトタイプ

#### Option B: Session-based Storage (Phase 2)
- **Implementation**: セッションID + データベース
- **Pros**: サーバー側でデータ管理、ある程度の永続性
- **Cons**: セッション期限切れでデータ消失
- **Use Case**: 一時的なユーザー識別が必要な場合

#### Option C: Full User Authentication (Phase 3)
- **Implementation**: ユーザー登録・ログイン機能
- **Pros**: 完全なデータ永続性、デバイス間同期
- **Cons**: 実装複雑度が高い、ユーザー登録の障壁
- **Use Case**: 本格的なパーソナル機能

### 2. Database Schema / データベース設計

#### Phase 1: Browser Storage Schema
```typescript
// localStorage structure
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
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  readStatus?: 'unread' | 'reading' | 'completed';
}

interface ReadingList {
  items: ReadingListItem[];
  lastUpdated: string;
  version: string;
}
```

#### Phase 2/3: Database Schema
```sql
-- User table (Phase 3 only)
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    session_id TEXT UNIQUE, -- Phase 2
    email TEXT UNIQUE,      -- Phase 3
    username TEXT UNIQUE,   -- Phase 3
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reading list table
CREATE TABLE reading_list_items (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,           -- NULL for Phase 1
    session_id TEXT,           -- Phase 2
    paper_id INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    read_status TEXT DEFAULT 'unread', -- 'unread', 'reading', 'completed'
    position INTEGER DEFAULT 0, -- for custom ordering
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    
    -- Ensure uniqueness per user/session
    UNIQUE(user_id, paper_id),
    UNIQUE(session_id, paper_id)
);

-- Tags for organizing papers
CREATE TABLE reading_list_tags (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    session_id TEXT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#007bff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Many-to-many relationship for paper tags
CREATE TABLE reading_list_item_tags (
    item_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (item_id, tag_id),
    FOREIGN KEY (item_id) REFERENCES reading_list_items(id),
    FOREIGN KEY (tag_id) REFERENCES reading_list_tags(id)
);
```

### 3. API Design / API設計

#### Phase 1: Local Storage (No API needed)
フロントエンドのみで実装、APIは不要

#### Phase 2/3: Server-side API
```python
# Reading List endpoints
GET    /api/v1/reading-list              # Get user's reading list
POST   /api/v1/reading-list              # Add paper to reading list
DELETE /api/v1/reading-list/{item_id}    # Remove paper from reading list
PUT    /api/v1/reading-list/{item_id}    # Update reading list item
POST   /api/v1/reading-list/bulk         # Bulk operations

# Tag management
GET    /api/v1/reading-list/tags         # Get user's tags
POST   /api/v1/reading-list/tags         # Create new tag
PUT    /api/v1/reading-list/tags/{tag_id} # Update tag
DELETE /api/v1/reading-list/tags/{tag_id} # Delete tag

# Import/Export
GET    /api/v1/reading-list/export       # Export reading list
POST   /api/v1/reading-list/import       # Import reading list
```

#### API Request/Response Examples

**Add to Reading List**:
```http
POST /api/v1/reading-list
Content-Type: application/json

{
  "paper_id": 123,
  "notes": "Interesting paper on transformers",
  "priority": "high",
  "tags": ["transformer", "attention"]
}
```

**Response**:
```json
{
  "id": 456,
  "paper_id": 123,
  "added_at": "2023-11-08T10:30:00Z",
  "notes": "Interesting paper on transformers",
  "priority": "high",
  "read_status": "unread",
  "tags": ["transformer", "attention"],
  "paper": {
    "id": 123,
    "title": "Attention Is All You Need",
    "authors": ["Vaswani, A."],
    "arxiv_id": "1706.03762",
    "arxiv_url": "https://arxiv.org/abs/1706.03762"
  }
}
```

**Get Reading List**:
```http
GET /api/v1/reading-list?status=unread&sort=added_at&order=desc&limit=20&offset=0
```

```json
{
  "items": [
    {
      "id": 456,
      "paper_id": 123,
      "added_at": "2023-11-08T10:30:00Z",
      "notes": "Interesting paper on transformers",
      "priority": "high",
      "read_status": "unread",
      "tags": ["transformer", "attention"],
      "paper": {
        "id": 123,
        "title": "Attention Is All You Need",
        "authors": ["Vaswani, A."],
        "summary": "We propose a new simple network architecture...",
        "published_at": "2017-06-12T00:00:00Z",
        "arxiv_id": "1706.03762",
        "arxiv_url": "https://arxiv.org/abs/1706.03762"
      }
    }
  ],
  "total_count": 15,
  "unread_count": 12,
  "reading_count": 2,
  "completed_count": 1
}
```

### 4. Frontend Implementation / フロントエンド実装

#### New Components / 新しいコンポーネント

1. **ReadingListButton** - 「あとで読む」ボタン
2. **ReadingList** - リーディングリスト表示ページ
3. **ReadingListItem** - リスト内の論文項目
4. **ReadingListFilters** - フィルタリング・並び替え
5. **ReadingListStats** - 統計情報表示

#### Component Specifications

**ReadingListButton Component**:
```tsx
interface ReadingListButtonProps {
  paper: Paper;
  isInList?: boolean;
  onAdd?: (paper: Paper) => void;
  onRemove?: (paperId: number) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon';
}

const ReadingListButton: React.FC<ReadingListButtonProps> = ({ 
  paper, 
  isInList = false,
  onAdd,
  onRemove,
  size = 'md',
  variant = 'button'
}) => {
  const { t } = useTranslation();
  
  const handleClick = () => {
    if (isInList) {
      onRemove?.(paper.id);
    } else {
      onAdd?.(paper);
    }
  };

  return (
    <Button
      variant={isInList ? "success" : "outline-primary"}
      size={size}
      onClick={handleClick}
      className="d-flex align-items-center"
    >
      <i className={`bi ${isInList ? 'bi-bookmark-fill' : 'bi-bookmark'} me-1`}></i>
      {variant === 'button' && (
        isInList ? t('readingList.removeFromList') : t('readingList.addToList')
      )}
    </Button>
  );
};
```

**ReadingList Component**:
```tsx
const ReadingList: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    tags: [],
    sortBy: 'added_at',
    sortOrder: 'desc'
  });

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t('readingList.title')}</h1>
        <ReadingListStats items={items} />
      </div>
      
      <ReadingListFilters 
        filters={filters} 
        onFiltersChange={setFilters}
      />
      
      <div className="reading-list-items">
        {filteredItems.map(item => (
          <ReadingListItem 
            key={item.id} 
            item={item} 
            onUpdate={handleUpdateItem}
            onRemove={handleRemoveItem}
          />
        ))}
      </div>
      
      {items.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-bookmark display-1 text-muted"></i>
          <h3 className="mt-3">{t('readingList.empty.title')}</h3>
          <p className="text-muted">{t('readingList.empty.description')}</p>
        </div>
      )}
    </div>
  );
};
```

#### Service Layer / サービス層

**ReadingListService** (localStorage implementation):
```typescript
class ReadingListService {
  private static STORAGE_KEY = 'paper-trend-analyzer-reading-list';
  
  static getReadingList(): ReadingList {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : { items: [], lastUpdated: new Date().toISOString(), version: '1.0' };
  }
  
  static saveReadingList(readingList: ReadingList): void {
    readingList.lastUpdated = new Date().toISOString();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(readingList));
  }
  
  static addToReadingList(paper: Paper, options?: Partial<ReadingListItem>): ReadingListItem {
    const readingList = this.getReadingList();
    
    // Check if already exists
    const existingIndex = readingList.items.findIndex(item => item.paperId === paper.id);
    if (existingIndex !== -1) {
      throw new Error('Paper already in reading list');
    }
    
    const newItem: ReadingListItem = {
      id: Date.now(),
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
    return newItem;
  }
  
  static removeFromReadingList(itemId: number): void {
    const readingList = this.getReadingList();
    readingList.items = readingList.items.filter(item => item.id !== itemId);
    this.saveReadingList(readingList);
  }
  
  static updateReadingListItem(itemId: number, updates: Partial<ReadingListItem>): ReadingListItem {
    const readingList = this.getReadingList();
    const itemIndex = readingList.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }
    
    readingList.items[itemIndex] = { ...readingList.items[itemIndex], ...updates };
    this.saveReadingList(readingList);
    return readingList.items[itemIndex];
  }
  
  static isInReadingList(paperId: number): boolean {
    const readingList = this.getReadingList();
    return readingList.items.some(item => item.paperId === paperId);
  }
  
  static getStats() {
    const readingList = this.getReadingList();
    return {
      total: readingList.items.length,
      unread: readingList.items.filter(item => item.readStatus === 'unread').length,
      reading: readingList.items.filter(item => item.readStatus === 'reading').length,
      completed: readingList.items.filter(item => item.readStatus === 'completed').length
    };
  }
}
```

### 5. UI/UX Design / UI/UX設計

#### Button Placement / ボタン配置
- **Paper Search Results**: 各論文項目の右上または下部にボタン配置
- **Dashboard Word Cloud**: キーワードクリックで表示される論文にもボタン配置
- **Trend Analysis**: 該当する論文があれば同様にボタン配置

#### Visual Feedback / 視覚的フィードバック
- **Loading State**: ボタンクリック時のローディング表示
- **Success Feedback**: 追加/削除成功時のトースト通知
- **State Indication**: 既にリストにある論文の視覚的表示

#### Reading List Page Layout / リーディングリストページレイアウト
```
┌─────────────────────────────────────────────────────┐
│ [あとで読む] [Stats: 12 unread, 3 reading, 5 done] │
├─────────────────────────────────────────────────────┤
│ [Filters] [Sort] [View: List/Grid] [Search]         │
├─────────────────────────────────────────────────────┤
│ ┌─ Paper 1 ─────────────────────────────────────┐   │
│ │ Title                               [Actions] │   │
│ │ Authors | Date | Status | Priority           │   │
│ │ Abstract preview...                          │   │
│ │ [Tags] [Notes]                               │   │
│ └─────────────────────────────────────────────────┘   │
│ ┌─ Paper 2 ─────────────────────────────────────┐   │
│ │ ...                                          │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 6. Internationalization / 国際化対応

#### Translation Keys / 翻訳キー
```json
{
  "readingList": {
    "title": "Reading List / あとで読む",
    "addToList": "Add to Reading List / あとで読むに追加",
    "removeFromList": "Remove from List / リストから削除",
    "inList": "In Reading List / リスト追加済み",
    "empty": {
      "title": "No papers saved / 保存された論文がありません",
      "description": "Add papers from search results / 検索結果から論文を追加してください"
    },
    "stats": {
      "total": "Total / 合計",
      "unread": "Unread / 未読",
      "reading": "Reading / 読書中", 
      "completed": "Completed / 完了"
    },
    "filters": {
      "all": "All / すべて",
      "unread": "Unread / 未読",
      "reading": "Reading / 読書中",
      "completed": "Completed / 完了",
      "priority": "Priority / 優先度",
      "sortBy": "Sort by / 並び順",
      "addedDate": "Added Date / 追加日",
      "publishDate": "Publish Date / 公開日",
      "title": "Title / タイトル"
    },
    "actions": {
      "markAsRead": "Mark as Read / 既読にする",
      "markAsReading": "Mark as Reading / 読書中にする",
      "markAsUnread": "Mark as Unread / 未読にする",
      "addNote": "Add Note / ノート追加",
      "addTag": "Add Tag / タグ追加",
      "remove": "Remove / 削除"
    }
  }
}
```

### 7. Performance Considerations / パフォーマンス考慮事項

#### Storage Optimization / ストレージ最適化
- **Data Compression**: 大きなabstractは要約または省略
- **Cleanup**: 古いデータの自動削除オプション
- **Sync**: サーバー実装時の効率的な同期メカニズム

#### UI Performance / UI パフォーマンス
- **Virtual Scrolling**: 大量の論文リスト処理
- **Lazy Loading**: 論文詳細の遅延読み込み
- **Debounced Search**: 検索・フィルタリングの最適化

### 8. Migration Strategy / 移行戦略

#### Phase 1 to Phase 2 Migration
```typescript
// Data migration from localStorage to server
const migrateReadingList = async () => {
  const localData = ReadingListService.getReadingList();
  
  if (localData.items.length > 0) {
    try {
      await api.post('/api/v1/reading-list/import', {
        items: localData.items,
        merge_strategy: 'skip_duplicates'
      });
      
      // Backup local data before clearing
      localStorage.setItem('reading-list-backup', JSON.stringify(localData));
      localStorage.removeItem(ReadingListService.STORAGE_KEY);
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }
};
```

## Implementation Phases / 実装フェーズ

### Phase 1: Basic Local Storage Implementation (MVP)
**Target: 2-3 days development**

**Features**:
- ✅ Add/Remove buttons in search results
- ✅ Basic reading list page
- ✅ localStorage persistence
- ✅ Multi-language support
- ✅ Basic filtering (status, sort)

**Components**:
- ReadingListButton
- ReadingList (basic version)
- ReadingListItem (basic version)
- ReadingListService (localStorage)

### Phase 2: Enhanced Features
**Target: 1-2 weeks development**

**Features**:
- ✅ Advanced filtering and search
- ✅ Priority and status management
- ✅ Notes and tags system
- ✅ Import/Export functionality
- ✅ Better UI/UX with animations
- ✅ Statistics and analytics

### Phase 3: Server-side Implementation
**Target: 2-3 weeks development**

**Features**:
- ✅ User session management
- ✅ Server-side API
- ✅ Data synchronization
- ✅ Backup and restore
- ✅ Advanced analytics
- ✅ Collaboration features (optional)

### Phase 4: Advanced Features
**Target: Future enhancement**

**Features**:
- ✅ AI-powered recommendations
- ✅ Reading progress tracking
- ✅ Integration with external services
- ✅ Mobile app support
- ✅ Team collaboration

## Quality Assurance / 品質保証

### Testing Strategy / テスト戦略

1. **Unit Tests**:
   - ReadingListService methods
   - Component rendering and interactions
   - Data validation and error handling

2. **Integration Tests**:
   - Complete user workflows
   - API integration (Phase 2+)
   - Data migration scenarios

3. **E2E Tests**:
   - Add paper to reading list
   - View and manage reading list
   - Filter and search functionality

### Performance Metrics / パフォーマンス指標

- **Load Time**: Reading list page loading < 1 second
- **Storage Usage**: Efficient localStorage usage
- **UI Responsiveness**: Smooth interactions and animations
- **Error Rate**: < 1% for normal operations

## Success Metrics / 成功指標

### User Engagement / ユーザーエンゲージメント
- Reading list adoption rate (% of users who use the feature)
- Average papers saved per user
- Reading list retention (papers that stay in list vs removed)
- Feature usage frequency

### Technical Performance / 技術パフォーマンス
- Feature load time and responsiveness
- Data consistency and reliability
- Error rates and user feedback
- Storage efficiency and scalability

## Future Enhancements / 将来の拡張

1. **Smart Organization / スマート整理**:
   - AI-powered automatic categorization
   - Duplicate detection and merging
   - Related papers suggestions

2. **Reading Analytics / 読書分析**:
   - Reading time tracking
   - Progress visualization
   - Personal research insights

3. **Collaboration / コラボレーション**:
   - Shared reading lists
   - Team recommendations
   - Discussion and annotations

4. **Integration / 統合**:
   - Reference manager integration (Zotero, Mendeley)
   - Note-taking app connections
   - Calendar integration for reading schedules

## Conclusion / 結論

The Reading List feature will significantly enhance the Paper Trend Analyzer by providing users with a personal paper management system. The phased implementation approach allows for gradual feature rollout while maintaining system stability and user experience.

リーディングリスト機能は、ユーザーに個人的な論文管理システムを提供することで、Paper Trend Analyzerを大幅に強化します。段階的な実装アプローチにより、システムの安定性とユーザーエクスペリエンスを維持しながら、機能を段階的にロールアウトできます。

The feature starts with a simple localStorage-based implementation for immediate user value, with clear migration paths to more sophisticated server-based solutions as the application grows.

この機能は、即座にユーザー価値を提供するシンプルなlocalStorageベースの実装から始まり、アプリケーションの成長に合わせて、より洗練されたサーバーベースのソリューションへの明確な移行パスを持っています。