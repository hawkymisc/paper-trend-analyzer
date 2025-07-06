import { Paper, ReadingListItem, ReadingList, ReadingListStats } from '../types';

class ReadingListService {
  private static readonly STORAGE_KEY = 'paper-trend-analyzer-reading-list';
  private static readonly VERSION = '1.0';

  // Core CRUD operations
  static getReadingList(): ReadingList {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return this.createEmptyReadingList();
      }

      const parsed = JSON.parse(data);
      
      // Version migration logic
      if (parsed.version !== this.VERSION) {
        return this.migrateData(parsed);
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load reading list:', error);
      return this.createEmptyReadingList();
    }
  }

  static saveReadingList(readingList: ReadingList): void {
    try {
      readingList.lastUpdated = new Date().toISOString();
      readingList.version = this.VERSION;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(readingList));
    } catch (error) {
      console.error('Failed to save reading list:', error);
      throw new Error('Failed to save reading list to storage');
    }
  }

  static addToReadingList(paper: Paper, options?: Partial<ReadingListItem>): ReadingListItem {
    const readingList = this.getReadingList();
    
    // Check for duplicates
    const existingIndex = readingList.items.findIndex(item => item.paperId === paper.id);
    if (existingIndex !== -1) {
      throw new Error('Paper already exists in reading list');
    }

    const newItem: ReadingListItem = {
      id: this.generateUniqueId(),
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
    
    // Emit event for UI updates
    this.emitReadingListEvent('itemAdded', newItem);
    
    return newItem;
  }

  static removeFromReadingList(itemId: number): void {
    const readingList = this.getReadingList();
    const itemIndex = readingList.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found in reading list');
    }

    const removedItem = readingList.items[itemIndex];
    readingList.items.splice(itemIndex, 1);
    this.saveReadingList(readingList);
    
    this.emitReadingListEvent('itemRemoved', removedItem);
  }

  static updateReadingListItem(itemId: number, updates: Partial<ReadingListItem>): ReadingListItem {
    const readingList = this.getReadingList();
    const itemIndex = readingList.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found in reading list');
    }

    const updatedItem = { ...readingList.items[itemIndex], ...updates };
    readingList.items[itemIndex] = updatedItem;
    this.saveReadingList(readingList);
    
    this.emitReadingListEvent('itemUpdated', updatedItem);
    
    return updatedItem;
  }

  // Utility methods
  static isInReadingList(paperId: number): boolean {
    const readingList = this.getReadingList();
    return readingList.items.some(item => item.paperId === paperId);
  }

  static getReadingListItem(paperId: number): ReadingListItem | null {
    const readingList = this.getReadingList();
    return readingList.items.find(item => item.paperId === paperId) || null;
  }

  static getStats(): ReadingListStats {
    const readingList = this.getReadingList();
    return {
      total: readingList.items.length,
      unread: readingList.items.filter(item => item.readStatus === 'unread').length,
      reading: readingList.items.filter(item => item.readStatus === 'reading').length,
      completed: readingList.items.filter(item => item.readStatus === 'completed').length,
      highPriority: readingList.items.filter(item => item.priority === 'high').length,
    };
  }

  // Bulk operations
  static bulkUpdateStatus(itemIds: number[], status: ReadingListItem['readStatus']): void {
    const readingList = this.getReadingList();
    
    itemIds.forEach(itemId => {
      const itemIndex = readingList.items.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        readingList.items[itemIndex].readStatus = status;
      }
    });

    this.saveReadingList(readingList);
    this.emitReadingListEvent('bulkUpdate', { itemIds, updates: { readStatus: status } });
  }

  static bulkRemove(itemIds: number[]): void {
    const readingList = this.getReadingList();
    readingList.items = readingList.items.filter(item => !itemIds.includes(item.id));
    this.saveReadingList(readingList);
    this.emitReadingListEvent('bulkRemove', { itemIds });
  }

  // Import/Export functionality
  static exportReadingList(): Blob {
    const readingList = this.getReadingList();
    const exportData = {
      ...readingList,
      exportedAt: new Date().toISOString(),
      exportVersion: this.VERSION
    };

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
  }

  static async importReadingList(file: File, strategy: 'replace' | 'merge' = 'merge'): Promise<void> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import file format');
      }

      const currentList = this.getReadingList();
      
      if (strategy === 'replace') {
        this.saveReadingList(importData);
      } else {
        // Merge strategy: add items that don't exist
        const existingPaperIds = new Set(currentList.items.map(item => item.paperId));
        const newItems = importData.items.filter(
          (item: ReadingListItem) => !existingPaperIds.has(item.paperId)
        );

        currentList.items.push(...newItems);
        this.saveReadingList(currentList);
      }

      this.emitReadingListEvent('imported', { strategy, itemCount: importData.items.length });
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to import reading list');
    }
  }

  // Private helper methods
  private static createEmptyReadingList(): ReadingList {
    return {
      items: [],
      lastUpdated: new Date().toISOString(),
      version: this.VERSION,
      settings: {
        defaultSort: 'addedAt',
        defaultFilter: 'all',
        itemsPerPage: 20
      }
    };
  }

  private static generateUniqueId(): number {
    return Date.now() + Math.random();
  }

  private static emitReadingListEvent(type: string, data: any): void {
    window.dispatchEvent(new CustomEvent('readingListUpdate', {
      detail: { type, data }
    }));
  }

  private static validateImportData(data: any): boolean {
    return (
      data &&
      Array.isArray(data.items) &&
      data.items.every((item: any) =>
        typeof item.paperId === 'number' &&
        typeof item.title === 'string' &&
        Array.isArray(item.authors)
      )
    );
  }

  private static migrateData(oldData: any): ReadingList {
    // Handle data migration from older versions
    // For now, just return empty list for simplicity
    console.warn('Data migration needed, creating fresh reading list');
    return this.createEmptyReadingList();
  }
}

export default ReadingListService;