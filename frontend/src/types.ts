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
