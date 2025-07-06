import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Paper } from '../types';
import { useReadingList } from '../contexts/ReadingListContext';

interface ReadingListButtonProps {
  paper: Paper;
  size?: 'sm' | 'lg';
  variant?: 'button' | 'icon' | 'compact';
  showText?: boolean;
  className?: string;
  onSuccess?: (action: 'added' | 'removed') => void;
  onError?: (error: string) => void;
}

const ReadingListButton: React.FC<ReadingListButtonProps> = ({
  paper,
  size = 'sm',
  variant = 'button',
  showText = true,
  className = '',
  onSuccess,
  onError
}) => {
  const { t } = useTranslation();
  const { addToReadingList, removeFromReadingList, isInReadingList, getReadingListItem } = useReadingList();
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const isInList = isInReadingList(paper.id);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setIsLoading(true);
      setFeedback(null);
      
      if (isInList) {
        const item = getReadingListItem(paper.id);
        if (item) {
          await removeFromReadingList(item.id);
          setFeedback({ type: 'success', message: t('readingList.removed') });
          toast.success(t('readingList.toast.removedSuccess', { title: paper.title }));
          onSuccess?.('removed');
        }
      } else {
        await addToReadingList(paper);
        setFeedback({ type: 'success', message: t('readingList.added') });
        toast.success(t('readingList.toast.addedSuccess', { title: paper.title }));
        onSuccess?.('added');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      setFeedback({ type: 'error', message });
      toast.error(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
      // Clear feedback after delay
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const getButtonContent = () => {
    const iconClass = isInList ? 'bi-bookmark-fill' : 'bi-bookmark';
    const textKey = isInList ? 'readingList.removeFromList' : 'readingList.addToList';

    if (isLoading) {
      return (
        <>
          <Spinner animation="border" size="sm" className="me-1" />
          {showText && t('common.loading')}
        </>
      );
    }

    switch (variant) {
      case 'icon':
        return <i className={`bi ${iconClass}`} />;
      case 'compact':
        return (
          <>
            <i className={`bi ${iconClass} me-1`} />
            {isInList ? t('readingList.saved') : t('readingList.save')}
          </>
        );
      default:
        return (
          <>
            <i className={`bi ${iconClass} me-1`} />
            {showText && t(textKey)}
          </>
        );
    }
  };

  const getButtonVariant = () => {
    if (feedback?.type === 'success') {
      return 'success';
    }
    return isInList ? 'success' : 'outline-primary';
  };

  const getButtonClassName = () => {
    const baseClass = `reading-list-button ${feedback?.type === 'success' ? 'btn-success-pulse' : ''} ${className}`;
    
    // Add high contrast class for better accessibility
    if (isInList) {
      return `${baseClass} btn-reading-list-saved`;
    } else {
      return `${baseClass} btn-reading-list-add`;
    }
  };

  return (
    <div className="position-relative">
      <Button
        variant={getButtonVariant()}
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={getButtonClassName()}
        title={t(isInList ? 'readingList.removeFromList' : 'readingList.addToList')}
      >
        {getButtonContent()}
      </Button>
      
      {/* Inline feedback tooltip (optional, in addition to toast) */}
      {feedback && variant === 'button' && (
        <div className={`feedback-tooltip ${feedback.type}`}>
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle' : 'bi-x-circle'}`} />
          {feedback.message}
        </div>
      )}
    </div>
  );
};

export default ReadingListButton;