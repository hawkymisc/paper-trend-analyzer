import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { DashboardSummary, WeeklyRanking } from '../types';

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [weeklyRankings, setWeeklyRankings] = useState<WeeklyRanking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // バンプチャート用のデータ変換
  const transformBumpChartData = (weeklyRankings: WeeklyRanking[]) => {
    if (weeklyRankings.length === 0) return [];

    // 全週を通じて登場するキーワードを集める
    const allKeywords = new Set<string>();
    weeklyRankings.forEach(week => {
      week.rankings.forEach(rank => {
        allKeywords.add(rank.keyword);
      });
    });

    // 最新週でトップ20のキーワードのみ表示
    const latestWeek = weeklyRankings[weeklyRankings.length - 1];
    const top20Keywords = latestWeek?.rankings.slice(0, 20).map(r => r.keyword) || [];

    // 週ごとのデータを作成
    return weeklyRankings.map(week => {
      const weekData: any = { 
        week: formatWeekDate(week.week),
        weekRaw: week.week 
      };
      
      // 各キーワードのランクを設定（ランク外は21位として表示）
      top20Keywords.forEach(keyword => {
        const ranking = week.rankings.find(r => r.keyword === keyword);
        weekData[keyword] = ranking ? ranking.rank : 21;
      });
      
      return weekData;
    });
  };

  // 週の日付をフォーマット (YYYY-MM-DD -> MM/DD)
  const formatWeekDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // カラーパレット（20キーワード用）
  const getKeywordColor = (index: number) => {
    const colors = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
      '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
      '#c49c94', '#f7b6d3', '#c7c7c7', '#dbdb8d', '#9edae5'
    ];
    return colors[index % colors.length];
  };

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

        // Fetch Weekly Rankings Data
        const rankingsResponse = await fetch('/api/v1/keywords/weekly-rankings');
        if (!rankingsResponse.ok) {
          throw new Error(`HTTP error! status: ${rankingsResponse.status}`);
        }
        const rankingsData: WeeklyRanking[] = await rankingsResponse.json();
        setWeeklyRankings(Array.isArray(rankingsData) ? rankingsData : []);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);


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

      {/* Weekly Rankings Bump Chart */}
      <h2 className="mt-4">Keyword Rankings Progression (Last 4 Weeks, Top 20)</h2>
      {weeklyRankings.length > 0 ? (
        <Card className="mb-4">
          <Card.Body>
            <div className="row">
              {/* Keywords List on the Left */}
              <div className="col-md-3">
                <h6 className="text-secondary mb-3">トップ20キーワード</h6>
                {weeklyRankings.length > 0 && (
                  <div>
                    {weeklyRankings[weeklyRankings.length - 1]?.rankings.slice(0, 20).map((rank, index) => (
                      <div key={rank.keyword} className="mb-2 d-flex align-items-center">
                        <div
                          style={{
                            width: '16px',
                            height: '3px',
                            backgroundColor: getKeywordColor(index),
                            marginRight: '8px',
                            borderRadius: '2px'
                          }}
                        />
                        <small style={{ fontSize: '11px' }}>
                          <span 
                            style={{ 
                              color: getKeywordColor(index),
                              fontWeight: 'bold',
                              minWidth: '25px',
                              display: 'inline-block'
                            }}
                          >
                            #{rank.rank}
                          </span>
                          <span style={{ marginLeft: '4px' }}>{rank.keyword}</span>
                          <br/>
                          <span className="text-muted" style={{ marginLeft: '29px' }}>
                            ({rank.count}件)
                          </span>
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Bump Chart on the Right */}
              <div className="col-md-9">
                <div style={{ height: '500px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={transformBumpChartData(weeklyRankings)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="week" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        domain={[1, 21]}
                        reversed={true}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value === 21 ? '21+' : value.toString()}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          value === 21 ? '21位以下' : `${value}位`, 
                          name
                        ]}
                        labelFormatter={(label) => `週: ${label}`}
                      />
                      {weeklyRankings.length > 0 && 
                        weeklyRankings[weeklyRankings.length - 1]?.rankings.slice(0, 20).map((rank, index) => (
                          <Line
                            key={rank.keyword}
                            type="linear"
                            dataKey={rank.keyword}
                            stroke={getKeywordColor(index)}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls={false}
                          />
                        ))
                      }
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <p>Loading rankings data...</p>
      )}
    </div>
  );
};

export default Dashboard;