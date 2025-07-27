import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { Paper } from '../types';

interface PaperReferenceProps {
  paperId: string;
  children: React.ReactNode;
  papers: Paper[];
  className?: string;
}

const PaperReference: React.FC<PaperReferenceProps> = ({ 
  paperId, 
  children, 
  papers, 
  className = '' 
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  // Find the paper by ID (convert to number for comparison)
  const paperIndex = parseInt(paperId) - 1; // Paper N means index N-1
  const paper = papers[paperIndex];

  if (!paper) {
    // If paper not found, return children as-is
    return <span className={className}>{children}</span>;
  }

  // Truncate abstract to ~100 characters
  const truncatedAbstract = paper.summary.length > 100 
    ? paper.summary.substring(0, 100) + '...'
    : paper.summary;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Open paper in new tab
    const arxivUrl = `https://arxiv.org/abs/${paper.arxiv_id}`;
    window.open(arxivUrl, '_blank', 'noopener,noreferrer');
  };

  const tooltip = (
    <Tooltip id={`paper-tooltip-${paperId}`} style={{ maxWidth: '400px' }}>
      <div>
        <div className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>
          {paper.title}
        </div>
        <div className="text-muted" style={{ fontSize: '0.8rem' }}>
          {truncatedAbstract}
        </div>
        <div className="mt-1" style={{ fontSize: '0.75rem', color: '#6c757d' }}>
          Authors: {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 && ' et al.'}
        </div>
        <div className="mt-1" style={{ fontSize: '0.75rem', color: '#0d6efd' }}>
          {t('paperReference.openInArxiv')}
        </div>
      </div>
    </Tooltip>
  );

  return (
    <OverlayTrigger
      placement="top"
      delay={{ show: 250, hide: 150 }}
      overlay={tooltip}
    >
      <span
        className={`paper-reference ${className}`}
        onClick={handleClick}
        style={{
          color: '#0d6efd',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontWeight: '500'
        }}
        onMouseOver={(e) => {
          (e.target as HTMLElement).style.backgroundColor = settings.uiTheme === 'dark' 
            ? 'rgba(13, 110, 253, 0.4)' 
            : 'rgba(13, 110, 253, 0.15)';
          (e.target as HTMLElement).style.color = settings.uiTheme === 'dark' ? '#ffffff' : '#000000';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLElement).style.backgroundColor = 'transparent';
          (e.target as HTMLElement).style.color = '#0d6efd';
        }}
      >
        {children}
      </span>
    </OverlayTrigger>
  );
};

export default PaperReference;