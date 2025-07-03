import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import WordCloud from 'wordcloud';
import { DashboardSummary, WordData, TrendResult } from '../types';

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<WordData[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const wordCloudRef = useRef<HTMLDivElement>(null);

  // Transform trend data for Recharts
  const transformTrendData = (trendsData: TrendResult[]) => {
    const dateMap: { [key: string]: any } = {};
    
    trendsData.forEach(trend => {
      trend.data.forEach(point => {
        // Format date as YYYY-M-D (remove leading zeros from month and day)
        const date = new Date(point.date);
        const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        if (!dateMap[formattedDate]) {
          dateMap[formattedDate] = { date: formattedDate };
        }
        dateMap[formattedDate][trend.keyword] = point.count;
      });
    });
    
    return Object.values(dateMap).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Color palette for trend lines
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

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

        // Fetch Trend Data for Top Keywords (for the trend graph) - Last 8 weeks
        const topKeywords = ['LLM', 'Fine-tuning', 'AI', 'Multimodal', 'Attention'];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - (8 * 7)); // Last 8 weeks

        const params = new URLSearchParams();
        topKeywords.forEach(kw => params.append('keywords', kw));
        params.append('start_date', startDate.toISOString().split('T')[0]);
        params.append('end_date', endDate.toISOString().split('T')[0]);

        const trendsResponse = await fetch(`/api/v1/trends?${params.toString()}`);
        if (trendsResponse.ok) {
          const trendsData: TrendResult[] = await trendsResponse.json();
          
          // Transform data for Recharts
          const transformedData = transformTrendData(trendsData);
          setTrendData(transformedData);
        }

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
      // Clear previous content
      wordCloudRef.current.innerHTML = '';
      
      const wordList = trendingKeywords.map(word => [word.text, word.value]);
      
      try {
        WordCloud(wordCloudRef.current, {
          list: wordList as any,
          gridSize: 16,
          weightFactor: 4,
          fontFamily: 'Arial, sans-serif',
          color: 'random-dark',
          backgroundColor: 'transparent',
          rotateRatio: 0.3,
          minRotation: -45,
          maxRotation: 45,
          drawOutOfBound: false,
          shrinkToFit: true,
        });
      } catch (error) {
        console.error('WordCloud rendering error:', error);
      }
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
      <h2 className="mt-4">Trending Keywords (Word Cloud, Last 8 Weeks)</h2>
      {trendingKeywords.length > 0 ? (
        <Card className="mb-4">
          <Card.Body>
            <div 
              ref={wordCloudRef} 
              style={{ 
                height: '400px', 
                width: '100%',
                position: 'relative',
                backgroundColor: '#fff'
              }} 
            />
          </Card.Body>
        </Card>
      ) : (
        <p>No trending keywords available.</p>
      )}

      {/* Paper Count Trend Graph */}
      <h2 className="mt-4">Paper Count Trend Graph (Weekly, Last 8 Weeks)</h2>
      {trendData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            {['LLM', 'Fine-tuning', 'AI', 'Multimodal', 'Attention'].map((keyword, index) => (
              <Line 
                key={keyword}
                type="linear" 
                dataKey={keyword} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p>Loading trend data...</p>
      )}
    </div>
  );
};

export default Dashboard;