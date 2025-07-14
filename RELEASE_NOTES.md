# Release Notes - Paper Trend Analyzer

## Version 2.3.0 - Language-Specific Trend Analysis & UI Improvements
**Release Date**: January 15, 2025

### 🚀 New Features

#### 🌐 Language-Specific Latest Summaries API
- **Enhanced API Endpoint**: `/api/v1/trend-summary/latest` now supports optional `language` parameter
- **Intelligent Language Filtering**: Retrieve the most recent summary for a specific language
- **Examples**:
  - `GET /api/v1/trend-summary/latest?language=ja` - Get latest Japanese summary
  - `GET /api/v1/trend-summary/latest?language=auto` - Get latest Auto Detect summary
  - `GET /api/v1/trend-summary/latest` - Get latest summary (any language)

### 🐛 Bug Fixes

#### Critical User Experience Issues
- **Fixed**: Language-specific summaries not being displayed when newer Auto Detect summaries exist
- **Fixed**: Confusing "summary not found" messages for users accessing existing Japanese content
- **Fixed**: Duplicate API calls causing unnecessary server load and UI flickering
- **Fixed**: Race conditions in React state management causing unstable UI behavior

#### Specific Technical Fixes
- **API Logic**: Backend now properly filters summaries by language instead of returning only the newest regardless of language
- **State Management**: Consolidated multiple related React states into unified atomic updates
- **Performance**: Reduced API calls from multiple redundant requests to single optimized requests per page load

### ⚡ Performance Improvements

#### Frontend Optimizations
- **Eliminated Duplicate useEffect Hooks**: Removed redundant `loadLatestTrendSummary` function and conflicting useEffect
- **Atomic State Updates**: Implemented unified state objects to prevent race conditions
- **Reduced API Calls**: Optimized from multiple calls per component mount to single targeted request

#### Backend Optimizations
- **Language-Aware Queries**: Database queries now efficiently filter by language when specified
- **Maintained Backward Compatibility**: Existing API calls without language parameter continue to work
- **Improved Error Messages**: Language-specific error messages for better user feedback

### 🔧 Technical Improvements

#### React Component Architecture
- **State Consolidation**: Combined `weeklyOverview`, `isCheckingExistingSummary`, and `initialCheckCompleted` into unified `summaryState`
- **Type Safety**: Enhanced TypeScript interfaces for better development experience
- **Predictable UI**: Eliminated flickering between loading, not found, and found states

#### API Architecture
- **Optional Parameters**: `language` parameter is optional, ensuring backward compatibility
- **Error Handling**: Improved error messages with language context
- **Documentation**: Updated API documentation with examples and use cases

### 📋 Migration Notes

#### For Developers
- **No Breaking Changes**: All existing API calls continue to work without modification
- **Enhanced Functionality**: Frontend automatically uses language-specific API calls for better user experience
- **Updated Dependencies**: No new dependencies added, only optimized existing code

#### For Users
- **Seamless Upgrade**: No user action required
- **Improved Experience**: Language-specific summaries now display correctly
- **Better Performance**: Faster page loads and more responsive UI

### 🧪 Testing & Quality

#### Test Coverage
- **API Testing**: New test cases for language parameter functionality
- **Integration Testing**: Verified backward compatibility with existing API consumers
- **Performance Testing**: Confirmed reduction in duplicate API calls

#### Code Quality
- **TypeScript**: Enhanced type safety throughout the application
- **Error Handling**: Comprehensive error handling for edge cases
- **Documentation**: Updated both user and developer documentation

### 🔍 Known Issues
- None identified in this release

### 🚀 What's Next?
- Phase 2 features: User authentication and preferences
- Enhanced multi-language support
- Additional visualization improvements

---

## Version 2.2.0 - AI-Powered Paper Summarization
**Release Date**: January 13, 2025

### 🚀 New Features
- **🤖 Paper Summary Generation**: AI-powered comprehensive paper summaries using Gemini API
- **📄 Enhanced Paper Display**: Interactive summary buttons for analyzed papers
- **⚙️ Analysis Configuration**: Improved paper count consistency and validation

### 🐛 Bug Fixes
- Fixed paper count display inconsistencies
- Improved AI processing limit explanations

### 🧪 Testing
- Comprehensive test suite for paper summary functionality

---

## Version 2.1.0 - Interactive Paper References & Customization
**Release Date**: Previous Release

### 🚀 New Features
- **Enhanced Paper References**: Superscript notation with interactive tooltips
- **Custom Keyword Dictionary**: User-defined terminology weighting
- **Markdown Style Customization**: Personalized typography options
- **Multi-language Updates**: Comprehensive localization improvements

---

## 日本語版リリースノート

### Version 2.3.0 - 言語固有トレンド分析 & UI改善
**リリース日**: 2025年1月15日

#### 🚀 新機能

##### 🌐 言語固有最新要約API
- **強化されたAPIエンドポイント**: `/api/v1/trend-summary/latest` がオプションの `language` パラメータをサポート
- **インテリジェントな言語フィルタリング**: 特定言語の最新要約を取得
- **使用例**:
  - `GET /api/v1/trend-summary/latest?language=ja` - 最新の日本語要約を取得
  - `GET /api/v1/trend-summary/latest?language=auto` - 最新のAuto Detect要約を取得
  - `GET /api/v1/trend-summary/latest` - 最新要約を取得（任意の言語）

#### 🐛 バグ修正

##### 重要なユーザーエクスペリエンス問題
- **修正**: より新しいAuto Detect要約が存在する場合に言語固有要約が表示されない問題
- **修正**: 既存の日本語コンテンツにアクセスするユーザーに対する混乱を招く「要約が見つかりません」メッセージ
- **修正**: 不要なサーバー負荷とUIちらつきを引き起こす重複API呼び出し
- **修正**: 不安定なUI動作を引き起こすReact状態管理の競合状態

##### 具体的な技術修正
- **APIロジック**: バックエンドが言語に関係なく最新のもののみを返すのではなく、言語別に要約を適切にフィルタリング
- **状態管理**: 複数の関連React状態を統合アトミック更新に統合
- **パフォーマンス**: ページロードあたりの複数の冗長リクエストから単一の最適化されたリクエストに削減

#### ⚡ パフォーマンス改善

##### フロントエンド最適化
- **重複useEffectフックの削除**: 冗長な `loadLatestTrendSummary` 関数と競合するuseEffectを削除
- **アトミック状態更新**: 競合状態を防ぐ統合状態オブジェクトを実装
- **API呼び出し削減**: コンポーネントマウントあたりの複数呼び出しから単一のターゲット指定リクエストに最適化

##### バックエンド最適化
- **言語対応クエリ**: 指定時に言語によってデータベースクエリを効率的にフィルタリング
- **後方互換性維持**: 言語パラメータなしの既存API呼び出しは引き続き動作
- **改善されたエラーメッセージ**: より良いユーザーフィードバックのための言語固有エラーメッセージ

#### 🔧 技術改善

##### React コンポーネントアーキテクチャ
- **状態統合**: `weeklyOverview`、`isCheckingExistingSummary`、`initialCheckCompleted` を統合 `summaryState` に結合
- **型安全性**: より良い開発体験のためのTypeScriptインターフェース強化
- **予測可能なUI**: 読み込み、見つからない、見つかった状態間のちらつきを解消

##### API アーキテクチャ
- **オプションパラメータ**: `language` パラメータはオプションで、後方互換性を確保
- **エラーハンドリング**: 言語コンテキスト付きの改善されたエラーメッセージ
- **ドキュメント**: 例と使用例でAPIドキュメントを更新

---

*完全なバージョン履歴については、gitコミットログと以前のリリースドキュメントを参照してください。*