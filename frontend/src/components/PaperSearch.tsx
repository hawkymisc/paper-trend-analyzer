import React, { useState } from 'react';
import { Form, Button, Card, ListGroup, Pagination, Spinner, Alert } from 'react-bootstrap';
import { PaperSearchResponse, Paper } from '../types';

const PaperSearch: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const papersPerPage = 10; // Adjust as needed

  const handleSearch = async (page: number = 1) => {
    if (query.trim() === '') {
      setError('Please enter a search query.');
      return;
    }
    setLoading(true);
    setError(null);
    setCurrentPage(page);

    const skip = (page - 1) * papersPerPage;
    const limit = papersPerPage;

    try {
      const response = await fetch(`/api/v1/papers/search?query=${encodeURIComponent(query)}&skip=${skip}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: PaperSearchResponse = await response.json();
      setSearchResults(data.papers);
      setTotalCount(data.total_count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / papersPerPage);

  return (
    <div>
      <h1>Paper Search</h1>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title>Search Papers</Card.Title>
          <Form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
            <Form.Group className="mb-3">
              <Form.Control
                type="text"
                placeholder="Enter keywords to search for papers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Form.Group>
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Search'}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {searchResults.length > 0 && (
        <Card>
          <Card.Body>
            <Card.Title>Search Results ({totalCount} papers found)</Card.Title>
            <ListGroup variant="flush">
              {searchResults.map((paper) => (
                <ListGroup.Item key={paper.id}>
                  <h5><a href={paper.arxiv_url} target="_blank" rel="noopener noreferrer">{paper.title}</a></h5>
                  <p><strong>Authors:</strong> {paper.authors.join(', ')}</p>
                  <p><strong>Published:</strong> {new Date(paper.published_at).toLocaleDateString()}</p>
                  <p>{paper.summary.substring(0, 200)}...</p>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {totalPages > 1 && (
              <Pagination className="mt-3">
                {[...Array(totalPages)].map((_, index) => (
                  <Pagination.Item
                    key={index + 1}
                    active={index + 1 === currentPage}
                    onClick={() => handleSearch(index + 1)}
                  >
                    {index + 1}
                  </Pagination.Item>
                ))}
              </Pagination>
            )}
          </Card.Body>
        </Card>
      )}

      {searchResults.length === 0 && !loading && query.trim() !== '' && !error && (
        <p>No papers found for your query.</p>
      )}
    </div>
  );
};

export default PaperSearch;