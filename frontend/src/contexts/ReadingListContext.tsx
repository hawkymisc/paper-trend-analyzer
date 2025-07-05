import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Paper, ReadingListItem, ReadingListStats } from '../types';
import ReadingListService from '../services/ReadingListService';

interface ReadingListContextType {
  // State
  items: ReadingListItem[];
  isLoading: boolean;
  error: string | null;
  
  // Stats
  stats: ReadingListStats;
  
  // Actions
  addToReadingList: (paper: Paper, options?: Partial<ReadingListItem>) => Promise<void>;
  removeFromReadingList: (itemId: number) => Promise<void>;
  updateReadingListItem: (itemId: number, updates: Partial<ReadingListItem>) => Promise<void>;
  isInReadingList: (paperId: number) => boolean;
  getReadingListItem: (paperId: number) => ReadingListItem | null;
  
  // Bulk operations
  markAsRead: (itemIds: number[]) => Promise<void>;
  removeMultiple: (itemIds: number[]) => Promise<void>;
  
  // Utility
  refreshReadingList: () => Promise<void>;
  exportReadingList: () => Promise<Blob>;
  importReadingList: (file: File) => Promise<void>;
}

const ReadingListContext = createContext<ReadingListContextType | undefined>(undefined);

interface ReadingListProviderProps {
  children: ReactNode;
}

export const ReadingListProvider: React.FC<ReadingListProviderProps> = ({ children }) => {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const loadReadingList = async () => {
      try {
        setIsLoading(true);
        const data = ReadingListService.getReadingList();
        setItems(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reading list');
      } finally {
        setIsLoading(false);
      }
    };

    loadReadingList();
  }, []);

  // Listen for external updates (e.g., from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'paper-trend-analyzer-reading-list') {
        const data = ReadingListService.getReadingList();
        setItems(data.items);
      }
    };

    const handleReadingListUpdate = (e: CustomEvent) => {
      // Refresh items when service emits events
      const data = ReadingListService.getReadingList();
      setItems(data.items);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('readingListUpdate', handleReadingListUpdate as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('readingListUpdate', handleReadingListUpdate as EventListener);
    };
  }, []);

  // Computed stats
  const stats = useMemo((): ReadingListStats => ({
    total: items.length,
    unread: items.filter(item => item.readStatus === 'unread').length,
    reading: items.filter(item => item.readStatus === 'reading').length,
    completed: items.filter(item => item.readStatus === 'completed').length,
    highPriority: items.filter(item => item.priority === 'high').length,
  }), [items]);

  const addToReadingList = useCallback(async (paper: Paper, options?: Partial<ReadingListItem>) => {
    try {
      setIsLoading(true);
      setError(null);
      const newItem = ReadingListService.addToReadingList(paper, options);
      setItems(prev => [newItem, ...prev]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to reading list';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeFromReadingList = useCallback(async (itemId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      ReadingListService.removeFromReadingList(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from reading list';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateReadingListItem = useCallback(async (itemId: number, updates: Partial<ReadingListItem>) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedItem = ReadingListService.updateReadingListItem(itemId, updates);
      setItems(prev => prev.map(item => item.id === itemId ? updatedItem : item));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update reading list item';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isInReadingList = useCallback((paperId: number): boolean => {
    return items.some(item => item.paperId === paperId);
  }, [items]);

  const getReadingListItem = useCallback((paperId: number): ReadingListItem | null => {
    return items.find(item => item.paperId === paperId) || null;
  }, [items]);

  const markAsRead = useCallback(async (itemIds: number[]) => {
    try {
      setIsLoading(true);
      setError(null);
      ReadingListService.bulkUpdateStatus(itemIds, 'completed');
      setItems(prev => prev.map(item => 
        itemIds.includes(item.id) ? { ...item, readStatus: 'completed' as const } : item
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as read';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeMultiple = useCallback(async (itemIds: number[]) => {
    try {
      setIsLoading(true);
      setError(null);
      ReadingListService.bulkRemove(itemIds);
      setItems(prev => prev.filter(item => !itemIds.includes(item.id)));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove multiple items';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshReadingList = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = ReadingListService.getReadingList();
      setItems(data.items);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh reading list';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportReadingList = useCallback(async (): Promise<Blob> => {
    try {
      return ReadingListService.exportReadingList();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export reading list';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const importReadingList = useCallback(async (file: File) => {
    try {
      setIsLoading(true);
      setError(null);
      await ReadingListService.importReadingList(file, 'merge');
      const data = ReadingListService.getReadingList();
      setItems(data.items);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import reading list';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: ReadingListContextType = {
    items,
    isLoading,
    error,
    stats,
    addToReadingList,
    removeFromReadingList,
    updateReadingListItem,
    isInReadingList,
    getReadingListItem,
    markAsRead,
    removeMultiple,
    refreshReadingList,
    exportReadingList,
    importReadingList,
  };

  return (
    <ReadingListContext.Provider value={value}>
      {children}
    </ReadingListContext.Provider>
  );
};

// Custom hook to use the reading list context
export const useReadingList = (): ReadingListContextType => {
  const context = useContext(ReadingListContext);
  if (context === undefined) {
    throw new Error('useReadingList must be used within a ReadingListProvider');
  }
  return context;
};

export default ReadingListContext;