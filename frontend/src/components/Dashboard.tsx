import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Spinner, Alert, OverlayTrigger, Tooltip as BootstrapTooltip } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { DashboardSummary, WordData, TrendResult } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<WordData[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 8週間前の日付を計算
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (8 * 7)); // 8 weeks ago
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  // キーワードクリック時にPaper Searchに遷移
  const handleKeywordClick = (keyword: string) => {
    const { startDate, endDate } = getDateRange();
    // URLパラメータとしてクエリ情報を渡す
    const searchParams = new URLSearchParams({
      query: keyword,
      startDate,
      endDate
    });
    navigate(`/paper-search?${searchParams.toString()}`);
  };

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

  // 文字サイズを計算するヘルパー関数（複数のアプローチを組み合わせ）
  const calculateFontSize = (value: number, maxValue: number, minValue: number, index: number) => {
    // 方法1: 対数スケール
    const logValue = Math.log10(value + 1);
    const logMax = Math.log10(maxValue + 1);
    const logMin = Math.log10(minValue + 1);
    const logNormalized = logMax > logMin ? (logValue - logMin) / (logMax - logMin) : 0.5;
    
    // 方法2: 平方根スケール（より緩やかな変化）
    const sqrtNormalized = Math.sqrt(value / maxValue);
    
    // 方法3: 線形スケール
    const linearNormalized = (value - minValue) / (maxValue - minValue);
    
    // 複数スケールの重み付き平均（対数重視）
    const combined = (logNormalized * 0.6) + (sqrtNormalized * 0.3) + (linearNormalized * 0.1);
    
    // より大きな範囲でフォントサイズを設定
    const baseSize = 16;
    const maxSize = 48;
    const fontSize = baseSize + (combined * (maxSize - baseSize));
    
    // 上位キーワードにボーナス
    const positionBonus = index < 5 ? 1.2 : index < 10 ? 1.1 : 1.0;
    
    return Math.max(14, Math.min(maxSize, fontSize * positionBonus));
  };

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
              style={{ 
                height: '400px', 
                width: '100%',
                padding: '20px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                overflow: 'hidden',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }} 
            >
              {trendingKeywords.slice(0, 30).map((keyword, index) => {
                const maxValue = Math.max(...trendingKeywords.map(k => k.value));
                const minValue = Math.min(...trendingKeywords.map(k => k.value));
                const fontSize = calculateFontSize(keyword.value, maxValue, minValue, index);
                
                // ランクに基づく色の濃淡
                const hue = (index * 47) % 360; // より分散した色相
                const saturation = Math.max(40, 90 - (index * 2)); // 上位ほど鮮やか
                const lightness = Math.max(25, 55 - (index * 1)); // 上位ほど濃い
                
                const { startDate, endDate } = getDateRange();
                
                const tooltipContent = (
                  <div style={{ textAlign: 'left' }}>
                    <strong>{keyword.text}</strong><br/>
                    <small>期間: 直近8週間 ({startDate} ~ {endDate})</small><br/>
                    <small>論文数: {keyword.value.toLocaleString()}件</small><br/>
                    <small>ランク: #{index + 1}</small><br/>
                    <em style={{ color: '#007bff' }}>クリックして論文検索</em>
                  </div>
                );
                
                return (
                  <OverlayTrigger
                    key={keyword.text}
                    placement="top"
                    delay={{ show: 300, hide: 150 }}
                    overlay={
                      <BootstrapTooltip id={`tooltip-${keyword.text}`}>
                        {tooltipContent}
                      </BootstrapTooltip>
                    }
                  >
                    <span
                      style={{
                        fontSize: `${fontSize}px`,
                        color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                        fontWeight: index < 10 ? '900' : index < 20 ? 'bold' : '600',
                        cursor: 'pointer',
                        userSelect: 'none',
                        lineHeight: '1.0',
                        textAlign: 'center',
                        margin: '3px 6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'all 0.3s ease',
                        textShadow: index < 5 ? '1px 1px 2px rgba(0,0,0,0.3)' : 'none',
                        display: 'inline-block',
                        border: '2px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.15) rotate(1deg)';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
                        e.currentTarget.style.border = '2px solid #007bff';
                        e.currentTarget.style.color = '#007bff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.border = '2px solid transparent';
                        e.currentTarget.style.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                      }}
                      onClick={() => handleKeywordClick(keyword.text)}
                    >
                      {keyword.text}
                    </span>
                  </OverlayTrigger>
                );
              })}
            </div>
            
            {/* Statistics */}
            <div className="mt-3" style={{ fontSize: '12px', color: '#666' }}>
              <strong>Top Keywords ({trendingKeywords.length} total):</strong><br/>
              {trendingKeywords.slice(0, 8).map((k, i) => {
                const maxValue = Math.max(...trendingKeywords.map(kw => kw.value));
                const minValue = Math.min(...trendingKeywords.map(kw => kw.value));
                const fontSize = Math.round(calculateFontSize(k.value, maxValue, minValue, i));
                return `${k.text}(${k.value}→${fontSize}px)`;
              }).join(', ')}
              {trendingKeywords.length > 8 && '...'}
              <br/>
              <small>Range: {Math.min(...trendingKeywords.map(k => k.value))} - {Math.max(...trendingKeywords.map(k => k.value))} papers</small>
            </div>
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