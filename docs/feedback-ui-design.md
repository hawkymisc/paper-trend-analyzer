# User Feedback UI Design
## 成功/エラーフィードバック UI設計

## Overview / 概要

「あとで読む」機能における成功/エラーフィードバックの具体的な画面実装を定義します。ユーザーアクションに対する即座の視覚的フィードバックにより、優れたUXを提供します。

## Feedback Types / フィードバック種類

### 1. Toast Notifications / トースト通知 (推奨)

#### 実装方法
```bash
npm install react-toastify
```

```typescript
// Toast notification setup
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Success toast
const showSuccessToast = (action: 'added' | 'removed') => {
  toast.success(t(`readingList.toast.${action}Success`), {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};

// Error toast
const showErrorToast = (message: string) => {
  toast.error(message, {
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  });
};
```

#### 視覚的デザイン
```css
/* Custom toast styles */
.Toastify__toast--success {
  background: linear-gradient(135deg, #198754 0%, #20c997 100%);
  border-left: 4px solid #198754;
}

.Toastify__toast--error {
  background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
  border-left: 4px solid #dc3545;
}

.Toastify__toast {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-family: inherit;
}

.Toastify__progress-bar {
  background: rgba(255,255,255,0.7);
}
```

#### Toast メッセージ例
```json
// 日本語
{
  "readingList": {
    "toast": {
      "addedSuccess": "📖 「{{title}}」をあとで読むリストに追加しました",
      "removedSuccess": "🗑️ 「{{title}}」をリストから削除しました",
      "duplicateError": "⚠️ この論文は既にリストに追加されています",
      "storageError": "❌ 保存中にエラーが発生しました。もう一度お試しください。",
      "networkError": "🌐 ネットワークエラーが発生しました"
    }
  }
}

// English
{
  "readingList": {
    "toast": {
      "addedSuccess": "📖 Added \"{{title}}\" to reading list",
      "removedSuccess": "🗑️ Removed \"{{title}}\" from reading list",
      "duplicateError": "⚠️ This paper is already in your reading list",
      "storageError": "❌ Failed to save. Please try again.",
      "networkError": "🌐 Network error occurred"
    }
  }
}
```

### 2. Button State Feedback / ボタン状態フィードバック

#### ローディング状態
```typescript
const ReadingListButton: React.FC<ReadingListButtonProps> = ({ paper }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setFeedback(null);
    
    try {
      if (isInList) {
        await removeFromReadingList(item.id);
        setFeedback({ type: 'success', message: t('readingList.removed') });
        toast.success(t('readingList.toast.removedSuccess', { title: paper.title }));
      } else {
        await addToReadingList(paper);
        setFeedback({ type: 'success', message: t('readingList.added') });
        toast.success(t('readingList.toast.addedSuccess', { title: paper.title }));
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
      toast.error(error.message);
    } finally {
      setIsLoading(false);
      // Clear feedback after delay
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  return (
    <div className="position-relative">
      <Button
        variant={isInList ? 'success' : 'outline-primary'}
        onClick={handleClick}
        disabled={isLoading}
        className={`reading-list-button ${feedback?.type === 'success' ? 'btn-success-pulse' : ''}`}
      >
        {isLoading ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            {t('common.loading')}
          </>
        ) : (
          <>
            <i className={`bi ${isInList ? 'bi-bookmark-fill' : 'bi-bookmark'} me-1`} />
            {isInList ? t('readingList.saved') : t('readingList.save')}
          </>
        )}
      </Button>
      
      {/* Inline feedback (optional, in addition to toast) */}
      {feedback && (
        <div className={`feedback-tooltip ${feedback.type}`}>
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle' : 'bi-x-circle'}`} />
          {feedback.message}
        </div>
      )}
    </div>
  );
};
```

#### ボタンアニメーション CSS
```css
/* Button feedback animations */
.reading-list-button {
  transition: all 0.3s ease;
  position: relative;
}

.btn-success-pulse {
  animation: successPulse 0.6s ease-out;
}

@keyframes successPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(25, 135, 84, 0.7);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(25, 135, 84, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(25, 135, 84, 0);
  }
}

/* Feedback tooltip */
.feedback-tooltip {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  white-space: nowrap;
  z-index: 1000;
  animation: fadeInOut 2s ease-in-out;
}

.feedback-tooltip.success {
  background-color: #198754;
  color: white;
}

.feedback-tooltip.error {
  background-color: #dc3545;
  color: white;
}

.feedback-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border: 5px solid transparent;
  border-top-color: inherit;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; transform: translateX(-50%) translateY(5px); }
  15%, 85% { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

### 3. Inline Status Messages / インライン状態メッセージ

#### 検索結果での実装
```typescript
const PaperSearchResultItem: React.FC<{ paper: Paper }> = ({ paper }) => {
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  
  const handleReadingListAction = (action: 'added' | 'removed') => {
    setActionFeedback(t(`readingList.inline.${action}`));
    
    // Clear feedback after delay
    setTimeout(() => setActionFeedback(null), 3000);
    
    // Also show toast
    toast.success(t(`readingList.toast.${action}Success`, { title: paper.title }));
  };

  return (
    <ListGroup.Item className="paper-search-item">
      <div className="d-flex justify-content-between align-items-start">
        <div className="flex-grow-1">
          <h5>{paper.title}</h5>
          <p className="text-muted">{paper.authors.join(', ')}</p>
        </div>
        
        <div className="d-flex flex-column align-items-end">
          <ReadingListButton 
            paper={paper} 
            onSuccess={handleReadingListAction}
          />
          
          {/* Inline feedback message */}
          {actionFeedback && (
            <div className="mt-2">
              <small className="text-success d-flex align-items-center">
                <i className="bi bi-check-circle me-1" />
                {actionFeedback}
              </small>
            </div>
          )}
        </div>
      </div>
    </ListGroup.Item>
  );
};
```

### 4. Global Notification Bar / グローバル通知バー

#### 重要なエラー用の実装
```typescript
// Global notification context
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationBar: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <Alert
          key={notification.id}
          variant={notification.type}
          dismissible
          onClose={() => removeNotification(notification.id)}
          className="notification-alert"
        >
          <div className="d-flex align-items-center">
            <i className={`bi ${getIconForType(notification.type)} me-2`} />
            <div>
              <strong>{notification.title}</strong>
              {notification.message && <div>{notification.message}</div>}
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
};
```

### 5. Modal Dialogs / モーダルダイアログ

#### 確認が必要なアクション用
```typescript
const ConfirmationModal: React.FC<{
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ show, title, message, onConfirm, onCancel }) => {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('common.confirm')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Usage in reading list
const handleBulkDelete = () => {
  setShowConfirmModal(true);
};

const confirmBulkDelete = async () => {
  try {
    await bulkRemove(selectedItems);
    toast.success(t('readingList.toast.bulkDeleteSuccess', { count: selectedItems.length }));
    setSelectedItems(new Set());
  } catch (error) {
    toast.error(t('readingList.toast.bulkDeleteError'));
  } finally {
    setShowConfirmModal(false);
  }
};
```

## Visual Examples / 視覚的な例

### Success Toast Example / 成功トースト例
```
┌─────────────────────────────────────┐
│  ✅ Added "Attention Is All You     │
│     Need" to reading list           │
│  ████████████████████████░░░░       │  ← Progress bar
└─────────────────────────────────────┘
```

### Button Loading State / ボタンローディング状態
```
Before:  [📖 あとで読む]
During:  [🔄 Loading...]  ← Spinner animation
After:   [✅ 保存済み]    ← Success state with pulse animation
```

### Inline Feedback / インラインフィードバック
```
┌─────────────────────────────────────────────┐
│  Attention Is All You Need                  │
│  Vaswani, A. et al.                        │
│                                [📖 保存済み] │
│                                ✅ 追加しました │  ← Inline success message
└─────────────────────────────────────────────┘
```

## Implementation Priority / 実装優先度

### Phase 1: Essential Feedback (必須)
1. **Toast Notifications** - メインのフィードバック方法
2. **Button Loading States** - ローディング表示
3. **Basic Error Handling** - エラーメッセージ表示

### Phase 2: Enhanced Feedback (拡張)
1. **Button Animation** - 成功時のアニメーション
2. **Inline Messages** - 追加的なフィードバック
3. **Confirmation Modals** - 重要なアクション確認

### Phase 3: Advanced Features (高度)
1. **Global Notification Bar** - システム全体の通知
2. **Undo Functionality** - 操作の取り消し
3. **Batch Operation Feedback** - 一括操作のフィードバック

## Recommended Implementation / 推奨実装

### Main App Setup / メインアプリ設定
```typescript
// App.tsx
import { ToastContainer } from 'react-toastify';

function App() {
  return (
    <ReadingListProvider>
      <Router>
        {/* Existing app content */}
        
        {/* Toast container for notifications */}
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </Router>
    </ReadingListProvider>
  );
}
```

### Translation Keys / 翻訳キー
```json
{
  "readingList": {
    "toast": {
      "addedSuccess": "📖 Added \"{{title}}\" to reading list",
      "removedSuccess": "🗑️ Removed \"{{title}}\" from reading list", 
      "duplicateError": "⚠️ This paper is already in your reading list",
      "storageError": "❌ Failed to save. Please try again.",
      "bulkDeleteSuccess": "🗑️ Removed {{count}} papers from reading list"
    },
    "inline": {
      "added": "Added to list",
      "removed": "Removed from list"
    },
    "modal": {
      "confirmDelete": "Delete from reading list?",
      "confirmDeleteMessage": "This action cannot be undone.",
      "confirmBulkDelete": "Delete {{count}} papers?",
      "confirmBulkDeleteMessage": "This will remove all selected papers from your reading list."
    }
  }
}
```

この実装により、ユーザーは：
- **即座の視覚的確認** - アクションが成功したことを明確に理解
- **エラー状況の理解** - 問題が発生した場合の適切な情報提供
- **操作の継続性** - フィードバック中も他の操作を継続可能
- **アクセシブルな体験** - 視覚的・聴覚的フィードバックの両方

を得ることができます。