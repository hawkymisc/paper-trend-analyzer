import React, { useState } from 'react';
import { Card, Form, Button, Badge, Dropdown } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ReadingListItem } from '../types';
import { useReadingList } from '../contexts/ReadingListContext';
import { useSettings } from '../contexts/SettingsContext';

interface ReadingListItemProps {
  item: ReadingListItem;
  isSelected: boolean;
  onSelectionChange: (itemId: number, selected: boolean) => void;
}

const ReadingListItemComponent: React.FC<ReadingListItemProps> = ({
  item,
  isSelected,
  onSelectionChange
}) => {
  const { t } = useTranslation();
  const { updateReadingListItem, removeFromReadingList } = useReadingList();
  const { settings } = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(item.notes || '');

  const handleStatusChange = async (newStatus: ReadingListItem['readStatus']) => {
    try {
      await updateReadingListItem(item.id, { readStatus: newStatus });
      toast.success(t('common.markedAs', { status: newStatus }));
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handlePriorityChange = async (newPriority: ReadingListItem['priority']) => {
    try {
      await updateReadingListItem(item.id, { priority: newPriority });
      toast.success(t('common.prioritySetTo', { priority: newPriority }));
    } catch (error) {
      console.error('Failed to update priority:', error);
      toast.error('Failed to update priority');
    }
  };

  const handleNotesUpdate = async () => {
    try {
      await updateReadingListItem(item.id, { notes });
      setIsEditing(false);
      toast.success(t('common.notesUpdated'));
    } catch (error) {
      console.error('Failed to update notes:', error);
      toast.error(t('common.failedToUpdate'));
    }
  };

  const handleRemove = async () => {
    if (window.confirm(t('readingList.confirmRemove'))) {
      try {
        await removeFromReadingList(item.id);
        toast.success(t('readingList.toast.removedSuccess', { title: item.title }));
      } catch (error) {
        console.error('Failed to remove item:', error);
        toast.error(t('common.failedToRemove'));
      }
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'reading': return 'primary';
      case 'unread': return 'outline-secondary';
      default: return 'outline-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'bi-check-circle';
      case 'reading': return 'bi-play-circle';
      case 'unread': return 'bi-circle';
      default: return 'bi-circle';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return 'bi-flag-fill';
      case 'medium': return 'bi-flag';
      case 'low': return 'bi-flag';
      default: return 'bi-flag';
    }
  };

  // Removed unused truncateText function

  return (
    <Card className={`reading-list-item mb-3 ${isSelected ? 'border-primary' : ''}`}>
      <Card.Body>
        <div className="row">
          <div className="col-auto">
            <Form.Check
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelectionChange(item.id, e.target.checked)}
            />
          </div>
          
          <div className="col">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <h5 className="mb-1">
                <a
                  href={item.arxivUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                >
                  {item.title}
                </a>
              </h5>
              
              <div className="d-flex gap-2">
                <Badge bg={getPriorityBadgeVariant(item.priority)}>
                  {t(`readingList.priority.${item.priority}`)}
                </Badge>
                <Badge bg={getStatusBadgeVariant(item.readStatus)}>
                  {t(`readingList.status.${item.readStatus}`)}
                </Badge>
              </div>
            </div>

            <div className="text-muted mb-2">
              <small>
                <strong>{t('common.authors')}:</strong> {item.authors.join(', ')}
                <span className="mx-2">•</span>
                <strong>{t('common.published')}:</strong> {new Date(item.publishedAt).toLocaleDateString()}
                <span className="mx-2">•</span>
                <strong>{t('readingList.addedAt')}:</strong> {new Date(item.addedAt).toLocaleDateString()}
              </small>
            </div>

            {isExpanded && (
              <div className="mb-3">
                <h6 className="text-secondary">{t('common.abstract')}</h6>
                <p className="text-justify">{item.summary}</p>
              </div>
            )}

            {item.notes && !isEditing && (
              <div className="mb-2">
                <strong>{t('readingList.notes')}:</strong>
                <p className={`mt-1 p-2 ${settings.uiTheme === 'dark' ? 'bg-dark text-light' : 'bg-light'} rounded small`}>{item.notes}</p>
              </div>
            )}

            {isEditing && (
              <div className="mb-3">
                <Form.Group>
                  <Form.Label>{t('readingList.notes')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('readingList.notesPlaceholder')}
                  />
                </Form.Group>
                <div className="mt-2">
                  <Button size="sm" variant="primary" onClick={handleNotesUpdate}>
                    {t('common.save')}
                  </Button>
                  <Button size="sm" variant="secondary" className="ms-2" onClick={() => setIsEditing(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center">
              <div className="btn-group" role="group">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                  {isExpanded ? t('readingList.hideAbstract') : t('readingList.showAbstract')}
                </Button>
                
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <i className="bi bi-pencil" />
                  {t('readingList.editNotes')}
                </Button>
              </div>

              <div className="btn-group" role="group">
                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-primary">
                    <i className={`bi ${getStatusIcon(item.readStatus)}`} />
                    {t(`readingList.status.${item.readStatus}`)}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handleStatusChange('unread')}>
                      <i className="bi bi-circle me-2" />
                      {t('readingList.status.unread')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleStatusChange('reading')}>
                      <i className="bi bi-play-circle me-2" />
                      {t('readingList.status.reading')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleStatusChange('completed')}>
                      <i className="bi bi-check-circle me-2" />
                      {t('readingList.status.completed')}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-warning">
                    <i className={`bi ${getPriorityIcon(item.priority)}`} />
                    {t(`readingList.priority.${item.priority}`)}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handlePriorityChange('low')}>
                      <Badge bg="secondary" className="me-2">●</Badge>
                      {t('readingList.priority.low')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handlePriorityChange('medium')}>
                      <Badge bg="warning" className="me-2">●</Badge>
                      {t('readingList.priority.medium')}
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handlePriorityChange('high')}>
                      <Badge bg="danger" className="me-2">●</Badge>
                      {t('readingList.priority.high')}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={handleRemove}
                >
                  <i className="bi bi-trash" />
                  {t('common.remove')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ReadingListItemComponent;