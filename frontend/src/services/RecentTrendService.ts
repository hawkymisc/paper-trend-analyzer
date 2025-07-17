/**
 * Recent Trend Analysis API Service
 */
import { 
  RecentTrendRequest, 
  RecentTrendResponse, 
  TopicKeywordsRequest, 
  TopicKeywordsResponse,
  TopicSummaryRequest,
  TopicSummaryResponse 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export class RecentTrendService {
  /**
   * Get latest cached recent trend overview
   */
  static async getLatestRecentTrendOverview(request: RecentTrendRequest = {}): Promise<RecentTrendResponse | null> {
    try {
      const queryParams = new URLSearchParams();
      
      if (request.language) queryParams.append('language', request.language);

      const url = `${API_BASE_URL}/api/v1/weekly-trend/latest${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 404) {
        // No cached result found
        return null;
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch latest recent trend overview: ${response.status} ${errorData}`);
      }

      const data: RecentTrendResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching latest recent trend overview:', error);
      throw error;
    }
  }

  /**
   * Generate new recent trend overview (AI analysis)
   */
  static async generateRecentTrendOverview(request: RecentTrendRequest = {}): Promise<RecentTrendResponse> {
    try {
      const url = `${API_BASE_URL}/api/v1/weekly-trend/generate`;
      
      
      // Set timeout based on analysis complexity
      const timeoutMs = 180000; // 3 minutes for AI analysis
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch recent trend overview: ${response.status} ${errorData}`);
      }

      const data: RecentTrendResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Recent trend overview analysis timed out. Please try again.');
      }
      console.error('Error fetching recent trend overview:', error);
      throw error;
    }
  }

  /**
   * Get topic keywords for the current week
   */
  static async getTopicKeywords(request: TopicKeywordsRequest = {}): Promise<TopicKeywordsResponse> {
    try {
      const url = `${API_BASE_URL}/api/v1/topic-keywords`;
      
      // Set timeout for keyword extraction
      const timeoutMs = 120000; // 2 minutes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch topic keywords: ${response.status} ${errorData}`);
      }

      const data: TopicKeywordsResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Topic keywords extraction timed out. Please try again.');
      }
      console.error('Error fetching topic keywords:', error);
      throw error;
    }
  }

  /**
   * Get summary for selected topic keywords
   */
  static async getTopicSummary(request: TopicSummaryRequest): Promise<TopicSummaryResponse> {
    try {
      if (!request.keywords || request.keywords.length === 0) {
        throw new Error('At least one keyword must be selected');
      }

      if (request.keywords.length > 10) {
        throw new Error('Maximum 10 keywords allowed');
      }

      const url = `${API_BASE_URL}/api/v1/topic-summary`;
      
      // Set timeout based on number of keywords
      const baseTimeout = 90000; // 1.5 minutes base
      const timeoutMs = Math.min(baseTimeout + (request.keywords.length * 10000), 300000); // Max 5 minutes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch topic summary: ${response.status} ${errorData}`);
      }

      const data: TopicSummaryResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Topic summary generation timed out. Please try again with fewer keywords.');
      }
      console.error('Error fetching topic summary:', error);
      throw error;
    }
  }

  /**
   * Get available languages for analysis
   */
  static getSupportedLanguages(): Array<{code: string, name: string}> {
    return [
      { code: 'auto', name: 'Auto Detect' },
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'zh', name: '中文' },
      { code: 'ko', name: '한국어' },
      { code: 'de', name: 'Deutsch' },
    ];
  }

  /**
   * Format relevance score for display
   */
  static formatRelevanceScore(score: number): string {
    return Math.round(score).toString();
  }

  /**
   * Get relevance score color class
   */
  static getRelevanceScoreColor(score: number): string {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-info';
    if (score >= 50) return 'text-warning';
    return 'text-muted';
  }

  /**
   * Get relevance score icon
   */
  static getRelevanceScoreIcon(score: number): string {
    if (score >= 90) return 'bi-star-fill';
    if (score >= 70) return 'bi-star-half';
    if (score >= 50) return 'bi-star';
    return 'bi-dash-circle';
  }

  /**
   * Sort keywords by different criteria
   */
  static sortKeywords(
    keywords: TopicKeywordsResponse['keywords'], 
    sortBy: 'relevance_score' | 'paper_count' | 'keyword', 
    order: 'asc' | 'desc' = 'desc'
  ): TopicKeywordsResponse['keywords'] {
    const multiplier = order === 'desc' ? -1 : 1;
    
    return [...keywords].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'relevance_score':
          compareValue = a.relevance_score - b.relevance_score;
          break;
        case 'paper_count':
          compareValue = a.paper_count - b.paper_count;
          break;
        case 'keyword':
          compareValue = a.keyword.localeCompare(b.keyword);
          break;
        default:
          return 0;
      }
      
      return compareValue * multiplier;
    });
  }

  /**
   * Filter keywords by search term
   */
  static filterKeywords(
    keywords: TopicKeywordsResponse['keywords'], 
    searchTerm: string
  ): TopicKeywordsResponse['keywords'] {
    if (!searchTerm.trim()) return keywords;
    
    const term = searchTerm.toLowerCase();
    return keywords.filter(keyword => 
      keyword.keyword.toLowerCase().includes(term)
    );
  }

  /**
   * Get relative time string
   */
  static getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
}