import { PaperFetchRequest, PaperFetchResponse, LatestPaperInfo } from '../types';

export class PaperFetchService {
  /**
   * Fetch new papers from arXiv
   */
  static async fetchPapers(request: PaperFetchRequest): Promise<PaperFetchResponse> {
    const response = await fetch('/api/v1/papers/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get latest paper date and total count
   */
  static async getLatestPaperInfo(): Promise<LatestPaperInfo> {
    const response = await fetch('/api/v1/papers/latest-date');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Format relative time
   */
  static getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}時間前`;
    } else if (diffInDays < 30) {
      return `${Math.floor(diffInDays)}日前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  }

  /**
   * Format processing time
   */
  static formatProcessingTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}秒`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}分${remainingSeconds.toFixed(0)}秒`;
    }
  }
}