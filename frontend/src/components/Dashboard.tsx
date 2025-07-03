import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import WordCloud from 'wordcloud';
import { DashboardSummary, WordData } from '../types';

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const wordCloudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Summary Data
        const summaryResponse = await fetch('/api/v1/dashboard/summary');
        if (!summaryResponse.ok) {
          throw new Error(`HTTP error! status: ${summaryResponse.status}`);
        }
        const summaryData: DashboardSummary = await summaryResponse.json();
        setSummary(summaryData);

        // Fetch Trending Keywords for Word Cloud
        const keywordsResponse = await fetch('/api/v1/keywords/word-cloud');
        if (!keywordsResponse.ok) {
          throw new Error(`HTTP error! status: ${keywordsResponse.status}`);
        }
        const keywordsData: WordData[] = await keywordsResponse.json();
        setTrendingKeywords(Array.isArray(keywordsData) ? keywordsData : []);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (wordCloudRef.current && trendingKeywords.length > 0) {
      WordCloud(wordCloudRef.current, {
        list: trendingKeywords.map(word => [word.text, word.value]),
        gridSize: 18, // size of the grid in pixels
        weightFactor: 10, // number to multiply for size of each word in the cloud
        fontFamily: 'Finger Paint, cursive, sans-serif', // font to use
        color: 'random-dark', // color of the words
        backgroundColor: '#fff', // color of the background
        rotateRatio: 0.5, // probability for the word to be rotated. 1 means all words are rotated
        minRotation: -60, // minimum rotation angle
        maxRotation: 60, // maximum rotation angle
        drawOutOfBound: false, // if set to true, words will be drawn out of bound
        shrinkToFit: true, // if set to true, will try to fit all words into the given size
      });
    }
  }, [trendingKeywords]);

  if (loading) {
    return <Spinner animation="border" role="status"><span className="visually-hidden">Loading...</span></Spinner>;
  }

  if (error) {
    return <Alert variant="danger">Error: {error}</Alert>;
  }

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Summary Information */}
      <h2 className="mt-4">Summary Information</h2>
      {summary && (
        <Row>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Total Papers</Card.Title>
                <Card.Text>{summary.total_papers}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Papers Last 24h</Card.Title>
                <Card.Text>{summary.recent_papers_24h}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Papers Last 7d</Card.Title>
                <Card.Text>{summary.recent_papers_7d}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Papers Last 30d</Card.Title>
                <Card.Text>{summary.recent_papers_30d}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Total Keywords</Card.Title>
                <Card.Text>{summary.total_keywords}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Latest Paper Date</Card.Title>
                <Card.Text>{summary.latest_paper_date ? new Date(summary.latest_paper_date).toLocaleDateString() : 'N/A'}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Trending Keywords (Word Cloud) */}
      <h2 className="mt-4">Trending Keywords (Word Cloud)</h2>
      {trendingKeywords.length > 0 ? (
        <div ref={wordCloudRef} style={{ height: '400px', width: '100%', border: '1px solid #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
      ) : (
        <p>No trending keywords available.</p>
      )}

      {/* Paper Count Trend Graph - To be implemented */}
      <h2 className="mt-4">Paper Count Trend Graph</h2>
      <p>This section will display the trend of paper counts over time for selected keywords.</p>
    </div>
  );
};

export default Dashboard;