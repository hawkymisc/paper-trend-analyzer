/**
 * Hot Topics API Service
 */
import { HotTopicsRequest, HotTopicsResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export class HotTopicsService {
  /**
   * Get hot topics summary
   */
  static async getHotTopicsSummary(params: HotTopicsRequest = {}): Promise<HotTopicsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.language) queryParams.append('language', params.language);
      if (params.days) queryParams.append('days', params.days.toString());
      if (params.max_topics) queryParams.append('max_topics', params.max_topics.toString());

      const url = `${API_BASE_URL}/api/v1/hot-topics/summary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      // Set timeout based on complexity (thinking budget consideration)
      const timeoutMs = HotTopicsService.calculateTimeout(params);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch hot topics: ${response.status} ${errorData}`);
      }

      const data: HotTopicsResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Hot topics analysis timed out. Please try with fewer topics or a shorter time period.');
      }
      console.error('Error fetching hot topics:', error);
      throw error;
    }
  }

  /**
   * Calculate timeout based on request complexity
   */
  private static calculateTimeout(params: HotTopicsRequest): number {
    // Base timeout
    let timeoutMs = 120000; // 2 minutes
    
    // Increase timeout based on analysis period
    const days = params.days || 30;
    if (days > 60) timeoutMs += 60000; // +1 minute for long periods
    if (days > 90) timeoutMs += 60000; // +1 more minute for very long periods
    
    // Increase timeout based on number of topics
    const maxTopics = params.max_topics || 10;
    if (maxTopics > 15) timeoutMs += 30000; // +30 seconds for many topics
    
    // Maximum timeout of 5 minutes
    return Math.min(timeoutMs, 300000);
  }

  /**
   * Get hot topics summary using POST method
   */
  static async getHotTopicsSummaryPost(request: HotTopicsRequest): Promise<HotTopicsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/hot-topics/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch hot topics: ${response.status} ${errorData}`);
      }

      const data: HotTopicsResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching hot topics:', error);
      throw error;
    }
  }

  /**
   * Get available languages for hot topics analysis
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
   * Validate hot topics request parameters
   */
  static validateRequest(request: HotTopicsRequest): string[] {
    const errors: string[] = [];

    if (request.days !== undefined) {
      if (request.days < 1 || request.days > 90) {
        errors.push('Days must be between 1 and 90');
      }
    }

    if (request.max_topics !== undefined) {
      if (request.max_topics < 1 || request.max_topics > 20) {
        errors.push('Max topics must be between 1 and 20');
      }
    }

    if (request.language !== undefined) {
      const supportedLanguages = this.getSupportedLanguages().map(lang => lang.code);
      if (!supportedLanguages.includes(request.language)) {
        errors.push(`Language must be one of: ${supportedLanguages.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Format trend score for display
   */
  static formatTrendScore(score: number): string {
    return Math.round(score).toString();
  }

  /**
   * Get trend score color class
   */
  static getTrendScoreColor(score: number): string {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    if (score >= 40) return 'text-info';
    return 'text-muted';
  }

  /**
   * Get trend score icon
   */
  static getTrendScoreIcon(score: number): string {
    if (score >= 80) return 'bi-fire';
    if (score >= 60) return 'bi-arrow-up';
    if (score >= 40) return 'bi-dash';
    return 'bi-arrow-down';
  }

  /**
   * Sort hot topics by different criteria
   */
  static sortHotTopics(
    topics: HotTopicsResponse['hot_topics'], 
    sortBy: 'trend_score' | 'paper_count' | 'topic', 
    order: 'asc' | 'desc' = 'desc'
  ): HotTopicsResponse['hot_topics'] {
    const multiplier = order === 'desc' ? -1 : 1;
    
    return [...topics].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'trend_score':
          compareValue = a.trend_score - b.trend_score;
          break;
        case 'paper_count':
          compareValue = a.paper_count - b.paper_count;
          break;
        case 'topic':
          compareValue = a.topic.localeCompare(b.topic);
          break;
        default:
          return 0;
      }
      
      return compareValue * multiplier;
    });
  }

  /**
   * Filter topics by keyword
   */
  static filterTopics(
    topics: HotTopicsResponse['hot_topics'], 
    searchTerm: string
  ): HotTopicsResponse['hot_topics'] {
    if (!searchTerm.trim()) return topics;
    
    const term = searchTerm.toLowerCase();
    return topics.filter(topic => 
      topic.topic.toLowerCase().includes(term) ||
      topic.summary.toLowerCase().includes(term) ||
      topic.keywords.some(keyword => keyword.toLowerCase().includes(term))
    );
  }

  /**
   * Get default request parameters
   */
  static getDefaultRequest(): HotTopicsRequest {
    return {
      language: 'auto',
      days: 30,
      max_topics: 10,
    };
  }

  /**
   * Format analysis period for display
   */
  static formatAnalysisPeriod(days: number): string {
    if (days === 1) return '1 day';
    if (days === 7) return '1 week';
    if (days === 30) return '1 month';
    if (days === 90) return '3 months';
    return `${days} days`;
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