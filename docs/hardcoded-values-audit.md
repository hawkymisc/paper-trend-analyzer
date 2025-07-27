# バックエンド ハードコード値監査レポート

## 監査概要

Paper Trend Analyzerバックエンドの全モジュールを対象に、設定分離すべきハードコード値を系統的に調査しました。

## 調査対象モジュール

1. ✅ `app/ai_service.py` - AI関連サービス
2. ✅ `app/config.py` - 設定管理（既に適切）
3. ✅ `app/database.py` - データベース（問題なし）
4. ✅ `app/main.py` - APIエンドポイント
5. ✅ `app/models.py` - データモデル（問題なし）
6. ✅ `app/schemas.py` - データスキーマ
7. ✅ `app/services.py` - ビジネスロジック
8. ✅ `scripts/fetch_papers.py` - 論文取得スクリプト

## 発見された設定分離候補

### 🔴 高優先度（性能・機能に直接影響）

#### AI Analysis Limits
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `ai_service.py:282,332` | `[:5]` | 表示関連論文数 | `AI_RELATED_PAPERS_DISPLAY_LIMIT` |
| `ai_service.py:350` | `[:30]` | 概要分析用論文数 | `AI_OVERVIEW_ANALYSIS_PAPERS` |
| `ai_service.py:467` | `[:20]` | トピック分析用論文数 | `AI_TOPIC_ANALYSIS_PAPERS` |
| `ai_service.py:675` | `10` | PDF読み込みページ数 | `AI_PDF_MAX_PAGES` |
| `ai_service.py:683` | `15000` | テキスト文字数制限 | `AI_TEXT_MAX_CHARACTERS` |

#### Services Limits
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `services.py:22` | `10` | トレンドキーワード制限 | `TRENDING_KEYWORDS_LIMIT` |
| `services.py:23-24` | `8*7, 16*7` | 分析期間（週） | `RECENT_ANALYSIS_WEEKS, COMPARISON_WEEKS` |
| `services.py:28` | `300` | キャッシュTTL（秒） | `CACHE_TTL_SECONDS` |
| `services.py:254` | `200` | キーワード取得数 | `KEYWORD_FETCH_LIMIT` |
| `services.py:284` | `100` | ワードクラウド制限 | `WORD_CLOUD_ITEMS_LIMIT` |
| `services.py:990` | `5000` | 最新論文取得数 | `LATEST_PAPERS_FETCH_LIMIT` |

#### API Endpoint Limits
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `main.py:120` | `100, 200` | 論文検索limit/max | `PAPER_SEARCH_DEFAULT_LIMIT, PAPER_SEARCH_MAX_LIMIT` |
| `main.py:187-188` | `30, 90, 20, 50` | Hot topics制限 | `HOT_TOPICS_DEFAULT_DAYS, HOT_TOPICS_MAX_DAYS, etc.` |
| `main.py:325` | `10` | トピック要約最大キーワード | `TOPIC_SUMMARY_MAX_KEYWORDS` |
| `main.py:412` | `20, 100` | トレンド要約limit/max | `TREND_SUMMARY_DEFAULT_LIMIT, TREND_SUMMARY_MAX_LIMIT` |

### 🟡 中優先度（品質・UXに影響）

#### AI Defaults
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `ai_service.py:61,397` | `30` | 最大キーワード数 | `AI_MAX_KEYWORDS_DEFAULT` |
| `ai_service.py:249` | `500` | 要約文字数制限 | `AI_SUMMARY_CHAR_LIMIT` |
| `schemas.py:104` | `100` | キーワード要求デフォルト | `SCHEMA_MAX_KEYWORDS_DEFAULT` |
| `schemas.py:149-150` | `30, 20` | Hot topicsデフォルト | `SCHEMA_HOT_TOPICS_DAYS, SCHEMA_HOT_TOPICS_MAX` |

#### Services Quality Thresholds
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `services.py:715` | `5` | キーワード出現閾値 | `KEYWORD_MIN_OCCURRENCE_THRESHOLD` |
| `services.py:717` | `3` | キーワード最小長 | `KEYWORD_MIN_LENGTH` |
| `services.py:272-276` | `2.0, 1.5, 1.2` | 重み付け係数 | `IMPORTANCE_WEIGHT_HIGH, MEDIUM, LOW` |

#### Display & UI Limits
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `services.py:310` | `10` | 提案数制限 | `SUGGESTIONS_LIMIT` |
| `services.py:1643,1685` | `20` | UI表示用論文数 | `UI_PAPERS_DISPLAY_LIMIT` |
| `services.py:1937` | `3` | キーインサイト数 | `KEY_INSIGHTS_LIMIT` |
| `services.py:2018` | `5000` | 要約文字数制限 | `SUMMARY_MAX_LENGTH` |

### 🟢 低優先度（運用・メンテナンス）

#### Fetch Script Settings
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `fetch_papers.py:29` | `5MB, 5files` | ログローテーション | `LOG_MAX_BYTES, LOG_BACKUP_COUNT` |
| `fetch_papers.py:39` | `30` | デフォルト取得期間 | `FETCH_DEFAULT_DAYS` |
| `fetch_papers.py:40` | `1000` | arXiv最大結果数 | `ARXIV_MAX_RESULTS` |
| `fetch_papers.py:90` | `3` | API呼び出し間隔（秒） | `ARXIV_API_DELAY_SECONDS` |

#### Timeouts & Technical
| 箇所 | 現在値 | 説明 | 推奨設定名 |
|------|--------|------|------------|
| `services.py:1752` | `3600` | スクリプト実行タイムアウト | `SCRIPT_EXECUTION_TIMEOUT` |
| `fetch_papers.py:49` | retry設定 | リトライパラメータ | `ARXIV_RETRY_*` |

## 推奨実装順序

### Phase 1: 高影響度設定（即時）
1. AI分析の論文数制限
2. Services主要制限値
3. API endpoint制限値

### Phase 2: UX改善設定（中期）
1. AI品質パラメータ
2. 表示・UI制限値
3. デフォルト値の最適化

### Phase 3: 運用設定（長期）
1. ログ・監視設定
2. スクリプト設定
3. タイムアウト設定

## 実装提案

### 1. 設定グループの追加
`app/config.py`に以下のセクションを追加：

```python
class Settings(BaseSettings):
    # 既存設定...
    
    # AI Analysis Settings
    ai_related_papers_display_limit: int = Field(default=5)
    ai_overview_analysis_papers: int = Field(default=30)
    ai_topic_analysis_papers: int = Field(default=20)
    ai_max_keywords_default: int = Field(default=30)
    ai_pdf_max_pages: int = Field(default=10)
    ai_text_max_characters: int = Field(default=15000)
    ai_summary_char_limit: int = Field(default=500)
    
    # Services Settings
    trending_keywords_limit: int = Field(default=10)
    recent_analysis_weeks: int = Field(default=8)
    comparison_weeks: int = Field(default=16)
    cache_ttl_seconds: int = Field(default=300)
    keyword_fetch_limit: int = Field(default=200)
    word_cloud_items_limit: int = Field(default=100)
    
    # API Limits
    paper_search_default_limit: int = Field(default=100)
    paper_search_max_limit: int = Field(default=200)
    topic_summary_max_keywords: int = Field(default=10)
    
    # Quality Thresholds
    keyword_min_occurrence_threshold: int = Field(default=5)
    keyword_min_length: int = Field(default=3)
    importance_weight_high: float = Field(default=2.0)
    importance_weight_medium: float = Field(default=1.5)
    importance_weight_low: float = Field(default=1.2)
```

### 2. 段階的移行
1. **Week 1**: 高優先度の設定分離
2. **Week 2**: 各モジュールでの設定利用への変更
3. **Week 3**: テスト・検証・調整
4. **Week 4**: 中・低優先度設定の実装

### 3. 検証方法
- 設定確認API (`/api/v1/config/all-limits`) の追加
- 設定変更時の影響テスト
- パフォーマンス監視

## 期待される効果

### 即時効果
- **柔軟性向上**: 環境に応じた最適化が可能
- **デバッグ改善**: 制限値が明確に把握可能
- **保守性向上**: ハードコード値の削除

### 長期効果
- **スケーラビリティ**: 負荷に応じた動的調整
- **運用効率**: 設定変更による迅速な対応
- **品質安定**: 一貫した制限値管理

## リスク評価

### 低リスク
- ログ・監視設定の変更
- 表示制限値の調整

### 中リスク
- AI分析パラメータの変更
- キャッシュ設定の変更

### 高リスク
- API制限値の大幅変更
- データベース関連制限の変更

## 結論

**69個のハードコード値**を特定し、優先度別に分類しました。高優先度の**25個**を即座に設定分離することで、論文分析機能の柔軟性と保守性が大幅に向上します。

特に、AI分析関連の制限値とServices主要制限値の設定分離は、システムの性能調整と運用効率に直接影響するため、優先的な実装を推奨します。