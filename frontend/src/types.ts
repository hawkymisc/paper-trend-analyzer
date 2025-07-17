export interface DashboardSummary {
  total_papers: number;
  total_keywords: number;
  latest_paper_date: string | null;
  recent_papers_24h: number;
  recent_papers_7d: number;
  recent_papers_30d: number;
}

export interface WordData {
  text: string;
  value: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface TrendResult {
  keyword: string;
  data: TrendDataPoint[];
}

export interface Paper {
  id: number;
  arxiv_id: string;
  title: string;
  summary: string;
  published_at: string;
  authors: string[];
  arxiv_url: string;
}

export interface PaperSearchResponse {
  papers: Paper[];
  total_count: number;
}

export interface WeeklyKeywordRank {
  keyword: string;
  rank: number;
  count: number;
}

export interface WeeklyRanking {
  week: string; // Format: YYYY-MM-DD (Monday of the week)
  rankings: WeeklyKeywordRank[];
}

// Reading List Types
export interface ReadingListItem {
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
}

export interface ReadingListStats {
  total: number;
  unread: number;
  reading: number;
  completed: number;
  highPriority: number;
}

export interface ReadingListFilters {
  status: 'all' | 'unread' | 'reading' | 'completed';
  priority: 'all' | 'low' | 'medium' | 'high';
  tags: string[];
  search: string;
  sortBy: 'addedAt' | 'publishedAt' | 'title' | 'priority';
  sortOrder: 'asc' | 'desc';
}

export interface ReadingList {
  items: ReadingListItem[];
  lastUpdated: string;
  version: string;
  settings?: {
    defaultSort: string;
    defaultFilter: string;
    itemsPerPage: number;
  };
}

// Recent Trend Analysis Types
export interface RecentTrendRequest {
  language?: string;
  system_prompt?: string;
  force_regenerate?: boolean;
}

export interface RecentTrendResponse {
  trend_overview: string;
  analysis_period: string;
  total_papers_analyzed: number;
  generated_at: string;
  papers?: Paper[];
}

// Topic Keywords Types
export interface TopicKeyword {
  keyword: string;
  paper_count: number;
  relevance_score: number;
}

export interface TopicKeywordsRequest {
  language?: string;
  max_keywords?: number;
  system_prompt?: string;
  force_regenerate?: boolean;
}

export interface TopicKeywordsResponse {
  keywords: TopicKeyword[];
  analysis_period: string;
  total_papers_analyzed: number;
  generated_at: string;
}

// Topic Summary Types
export interface TopicSummaryRequest {
  keywords: string[];
  language?: string;
  system_prompt?: string;
  force_regenerate?: boolean;
}

export interface TopicSummaryResponse {
  topic_name: string;
  summary: string;
  keywords: string[];
  related_paper_count: number;
  key_findings: string[];
  generated_at: string;
  papers?: Paper[];
}

// Legacy Hot Topics Types (for backward compatibility)
export interface HotTopicPaper {
  id: number;
  title: string;
  authors: string[];
  published_at: string;
  arxiv_url: string;
  summary: string;
}

export interface HotTopic {
  topic: string;
  paper_count: number;
  recent_papers: HotTopicPaper[];
  summary: string;
  keywords: string[];
  trend_score: number;
}

export interface HotTopicsRequest {
  language?: string;
  days?: number;
  max_topics?: number;
}

export interface HotTopicsResponse {
  hot_topics: HotTopic[];
  analysis_period_days: number;
  total_papers_analyzed: number;
  generated_at: string;
}

export interface HotTopicsFilters {
  language: string;
  days: number;
  maxTopics: number;
  sortBy: 'trend_score' | 'paper_count' | 'topic';
  sortOrder: 'asc' | 'desc';
}

// Paper Fetching Types
export interface PaperFetchRequest {
  start_date?: string; // YYYY-MM-DD format
  end_date?: string;   // YYYY-MM-DD format
}

export interface PaperFetchResponse {
  status: string;
  message: string;
  total_fetched: number;
  processing_time: number;
}

export interface LatestPaperInfo {
  latest_date: string | null;
  total_papers: number;
}
