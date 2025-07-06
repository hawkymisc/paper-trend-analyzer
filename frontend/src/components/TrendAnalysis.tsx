import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { TrendResult, TrendDataPoint } from '../types';

const TrendAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [trendData, setTrendData] = useState<TrendResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
  }, []);

  const handleAddKeyword = () => {
    if (newKeyword.trim() !== '' && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter(keyword => keyword !== keywordToRemove));
  };

  const handleAnalyze = async () => {
    if (keywords.length === 0) {
      setError(t('trendAnalysis.addKeywordError'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      keywords.forEach(kw => params.append('keywords', kw));
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/v1/trends?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: TrendResult[] = await response.json();

      // Fill in missing dates with count 0 for each keyword
      const allDates = new Set<string>();
      data.forEach(trend => trend.data.forEach(dp => allDates.add(dp.date)));
      const sortedDates = Array.from(allDates).sort();

      const filledData = data.map(trend => {
        const dataMap = new Map<string, number>();
        trend.data.forEach(dp => dataMap.set(dp.date, dp.count));
        const filledTrendData: TrendDataPoint[] = sortedDates.map(date => ({
          date,
          count: dataMap.get(date) || 0,
        }));
        return { ...trend, data: filledTrendData };
      });

      setTrendData(filledData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const formatDataForChart = (data: TrendResult[]) => {
    if (!data || data.length === 0) {
      return [];
    }

    const formattedDataMap = new Map<string, any>();
    const keywords = data.map(d => d.keyword);

    data.forEach(trend => {
      trend.data.forEach(dp => {
        if (!formattedDataMap.has(dp.date)) {
          const initialPoint: any = { date: dp.date };
          keywords.forEach(kw => {
            initialPoint[kw] = 0;
          });
          formattedDataMap.set(dp.date, initialPoint);
        }
        formattedDataMap.get(dp.date)[trend.keyword] = dp.count;
      });
    });

    return Array.from(formattedDataMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const chartData = formatDataForChart(trendData);

  return (
    <div>
      <h1>{t('trendAnalysis.title')}</h1>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title>{t('trendAnalysis.keywordSelection')}</Card.Title>
          <Form>
            <Form.Group as={Row} className="mb-3">
              <Form.Label column sm="2">{t('trendAnalysis.keywords')}</Form.Label>
              <Col sm="8">
                <Form.Control
                  type="text"
                  placeholder={t('trendAnalysis.addKeywordPlaceholder')}
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                />
              </Col>
              <Col sm="2">
                <Button onClick={handleAddKeyword}>{t('trendAnalysis.add')}</Button>
              </Col>
            </Form.Group>
            <div className="mb-3">
              {keywords.map((keyword, index) => (
                <Button
                  key={index}
                  variant="outline-primary"
                  className="me-2 mb-2"
                  onClick={() => handleRemoveKeyword(keyword)}
                >
                  {keyword} &times;
                </Button>
              ))}
            </div>

            <Row className="mb-3">
              <Form.Group as={Col} md="6" controlId="startDate">
                <Form.Label>{t('trendAnalysis.startDate')}</Form.Label>
                <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Form.Group>
              <Form.Group as={Col} md="6" controlId="endDate">
                <Form.Label>{t('trendAnalysis.endDate')}</Form.Label>
                <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Form.Group>
            </Row>

            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : t('trendAnalysis.analyzeTrend')}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Body>
          <Card.Title>{t('trendAnalysis.paperCountTrend')}</Card.Title>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{
                  top: 5, right: 30, left: 20, bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {keywords.map((keyword, index) => (
                  <Line
                    key={keyword}
                    type="linear"
                    dataKey={keyword}
                    name={keyword}
                    stroke={colors[index % colors.length]}
                    activeDot={{ r: 8 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p>{t('trendAnalysis.selectKeywordsMessage')}</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default TrendAnalysis;