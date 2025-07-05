import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

interface Paper {
  id: number;
  title: string;
  authors: string[];
  arxiv_id: string;
}

interface MarkdownRendererProps {
  content: string;
  enableMarkdown?: boolean;
  enableCodeHighlighting?: boolean;
  papers?: Paper[];
  className?: string;
}

// interface PaperReference {
//   paperNum: number;
//   paper: Paper | null;
// }

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  enableMarkdown = true,
  enableCodeHighlighting = true,
  papers = [],
  className = ''
}) => {
  const [processedContent, setProcessedContent] = useState(content);
  const [paperReferences, setPaperReferences] = useState<Map<number, Paper>>(new Map());
  const [hoveredPaper, setHoveredPaper] = useState<Paper | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!papers || papers.length === 0) {
      setProcessedContent(content);
      return;
    }

    // Extract paper references from content (e.g., "Paper 1", "Paper 5")
    const paperRegex = /\b[Pp]aper\s+(\d+)\b/g;
    const references = new Map<number, Paper>();
    let match;

    while ((match = paperRegex.exec(content)) !== null) {
      const paperNum = parseInt(match[1]);
      if (paperNum > 0 && paperNum <= papers.length) {
        references.set(paperNum, papers[paperNum - 1]); // 0-indexed array
      }
    }

    setPaperReferences(references);

    // Replace paper references with clickable links
    let processed = content;
    references.forEach((paper, paperNum) => {
      const paperRegexGlobal = new RegExp(`\\b([Pp]aper\\s+${paperNum})\\b`, 'g');
      processed = processed.replace(
        paperRegexGlobal,
        `[$1](#paper-${paperNum})`
      );
    });

    setProcessedContent(processed);
  }, [content, papers]);

  const handlePaperClick = (paperNum: number) => {
    const paper = paperReferences.get(paperNum);
    if (paper) {
      const arxivUrl = `https://arxiv.org/abs/${paper.arxiv_id}`;
      window.open(arxivUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePaperHover = (event: React.MouseEvent, paperNum: number) => {
    const paper = paperReferences.get(paperNum);
    if (paper) {
      setHoveredPaper(paper);
      setTooltipPosition({
        x: event.clientX,
        y: event.clientY
      });
    }
  };

  const handlePaperLeave = () => {
    setHoveredPaper(null);
  };

  const customComponents = {
    a: ({ href, children, ...props }: any) => {
      // Check if this is a paper reference link
      const paperMatch = href?.match(/^#paper-(\d+)$/);
      if (paperMatch) {
        const paperNum = parseInt(paperMatch[1]);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const paper = paperReferences.get(paperNum);
        
        return (
          <span
            className="paper-reference"
            onClick={() => handlePaperClick(paperNum)}
            onMouseEnter={(e) => handlePaperHover(e, paperNum)}
            onMouseLeave={handlePaperLeave}
            style={{
              color: '#0066cc',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: '500'
            }}
            {...props}
          >
            {children}
          </span>
        );
      }

      // Regular external link
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match && enableCodeHighlighting ? (
        <pre className={className}>
          <code {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  // Custom CSS for dark/light theme compatibility
  const markdownStyles = `
    .markdown-content {
      line-height: 1.6;
      color: var(--bs-body-color);
    }
    
    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3,
    .markdown-content h4,
    .markdown-content h5,
    .markdown-content h6 {
      color: var(--bs-body-color);
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    
    .markdown-content h1 { font-size: 1.75rem; }
    .markdown-content h2 { font-size: 1.5rem; }
    .markdown-content h3 { font-size: 1.25rem; }
    .markdown-content h4 { font-size: 1.1rem; }
    
    .markdown-content ul,
    .markdown-content ol {
      padding-left: 1.5rem;
      margin-bottom: 1rem;
    }
    
    .markdown-content li {
      margin-bottom: 0.25rem;
    }
    
    .markdown-content blockquote {
      border-left: 4px solid #0d6efd;
      padding-left: 1rem;
      margin: 1rem 0;
      font-style: italic;
      background-color: rgba(13, 110, 253, 0.1);
      padding: 0.75rem 1rem;
      border-radius: 0.25rem;
    }
    
    .markdown-content pre {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 0.375rem;
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    .markdown-content code {
      background-color: #f8f9fa;
      color: #d63384;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
    }
    
    .markdown-content pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    
    .markdown-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
    }
    
    .markdown-content th,
    .markdown-content td {
      border: 1px solid #dee2e6;
      padding: 0.5rem;
      text-align: left;
    }
    
    .markdown-content th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    
    .paper-reference:hover {
      background-color: rgba(0, 102, 204, 0.1);
      border-radius: 0.25rem;
      padding: 0.1rem 0.2rem;
    }
    
    .paper-tooltip {
      position: fixed;
      background: #ffffff;
      border: 1px solid #dee2e6;
      border-radius: 0.5rem;
      padding: 0.75rem;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-width: 300px;
      pointer-events: none;
    }
    
    .paper-tooltip-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: #212529;
      font-size: 0.9rem;
      line-height: 1.3;
    }
    
    .paper-tooltip-authors {
      font-size: 0.8rem;
      color: #6c757d;
      margin-bottom: 0.25rem;
    }
    
    .paper-tooltip-arxiv {
      font-size: 0.75rem;
      color: #0d6efd;
      font-family: monospace;
    }

    /* Dark theme adjustments */
    [data-bs-theme="dark"] .markdown-content {
      color: #dee2e6;
    }
    
    [data-bs-theme="dark"] .markdown-content h1,
    [data-bs-theme="dark"] .markdown-content h2,
    [data-bs-theme="dark"] .markdown-content h3,
    [data-bs-theme="dark"] .markdown-content h4,
    [data-bs-theme="dark"] .markdown-content h5,
    [data-bs-theme="dark"] .markdown-content h6 {
      color: #dee2e6;
    }
    
    [data-bs-theme="dark"] .markdown-content blockquote {
      background-color: rgba(13, 110, 253, 0.15);
      border-left-color: #0d6efd;
    }
    
    [data-bs-theme="dark"] .markdown-content pre {
      background-color: #495057;
      border-color: #6c757d;
      color: #dee2e6;
    }
    
    [data-bs-theme="dark"] .markdown-content code {
      background-color: #495057;
      color: #f783ac;
    }
    
    [data-bs-theme="dark"] .markdown-content pre code {
      background-color: transparent;
      color: inherit;
    }
    
    [data-bs-theme="dark"] .markdown-content th,
    [data-bs-theme="dark"] .markdown-content td {
      border-color: #6c757d;
    }
    
    [data-bs-theme="dark"] .markdown-content th {
      background-color: #495057;
      color: #dee2e6;
    }
    
    [data-bs-theme="dark"] .markdown-content td {
      color: #dee2e6;
    }
    
    [data-bs-theme="dark"] .paper-reference:hover {
      background-color: rgba(13, 110, 253, 0.2);
    }
    
    [data-bs-theme="dark"] .paper-tooltip {
      background: #343a40;
      border-color: #6c757d;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.3);
    }
    
    [data-bs-theme="dark"] .paper-tooltip-title {
      color: #dee2e6;
    }
    
    [data-bs-theme="dark"] .paper-tooltip-authors {
      color: #adb5bd;
    }
    
    [data-bs-theme="dark"] .paper-tooltip-arxiv {
      color: #6ea8fe;
    }
  `;

  if (!enableMarkdown) {
    return (
      <div className={`${className}`} style={{ whiteSpace: 'pre-wrap' }}>
        {content}
      </div>
    );
  }

  return (
    <>
      <style>{markdownStyles}</style>
      <div className={`markdown-content ${className}`}>
        <ReactMarkdown
          components={customComponents}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={enableCodeHighlighting ? [rehypeHighlight] : []}
        >
          {processedContent}
        </ReactMarkdown>
        
        {/* Paper Reference Tooltip */}
        {hoveredPaper && (
          <div
            className="paper-tooltip"
            style={{
              left: `${tooltipPosition.x + 10}px`,
              top: `${tooltipPosition.y - 10}px`,
            }}
          >
            <div className="paper-tooltip-title">
              {hoveredPaper.title}
            </div>
            <div className="paper-tooltip-authors">
              {hoveredPaper.authors.join(', ')}
            </div>
            <div className="paper-tooltip-arxiv">
              arXiv:{hoveredPaper.arxiv_id}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MarkdownRenderer;