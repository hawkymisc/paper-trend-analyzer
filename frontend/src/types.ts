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
