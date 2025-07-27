import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Spinner, Alert, OverlayTrigger, Tooltip as BootstrapTooltip, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardSummary, WordData, LatestPaperInfo } from '../types';
import { PaperFetchService } from '../services/PaperFetchService';
import { useSettings } from '../contexts/SettingsContext';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trendingKeywords, setTrendingKeywords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wordCloudStartIndex, setWordCloudStartIndex] = useState<number>(0);
  const [latestPaperInfo, setLatestPaperInfo] = useState<LatestPaperInfo | null>(null);
  const [isFetchingPapers, setIsFetchingPapers] = useState<boolean>(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  // 16週間前の日付を計算
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (16 * 7)); // 16 weeks ago
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };


  // キーワードデータ取得を別関数に分離
  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    try {
      let keywordsResponse;
      
      // カスタム辞書がある場合は辞書対応エンドポイントを使用
      if (settings.customKeywords.length > 0) {
        keywordsResponse = await fetch('/api/v1/keywords/word-cloud', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings.customKeywords)
        });
      } else {
        // 辞書がない場合は通常のエンドポイント
        keywordsResponse = await fetch('/api/v1/keywords/word-cloud');
      }
      
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
  }, [settings.customKeywords]);

  // 最新論文情報を取得
  const fetchLatestPaperInfo = useCallback(async () => {
    try {
      const info = await PaperFetchService.getLatestPaperInfo();
      setLatestPaperInfo(info);
    } catch (e: any) {
      console.error('Failed to fetch latest paper info:', e);
    }
  }, []);

  // 論文を取得
  const handleFetchPapers = async () => {
    setIsFetchingPapers(true);
    setFetchMessage(null);
    
    try {
      // 最新の論文の日付から今日までの期間で取得
      const startDate = latestPaperInfo?.latest_date ? 
        new Date(latestPaperInfo.latest_date).toISOString().split('T')[0] : 
        undefined;
      
      const response = await PaperFetchService.fetchPapers({
        start_date: startDate,
        end_date: new Date().toISOString().split('T')[0]
      });
      
      if (response.status === 'success') {
        setFetchMessage(
          `✅ ${response.total_fetched}件の新しい論文を取得しました (処理時間: ${PaperFetchService.formatProcessingTime(response.processing_time)})`
        );
        // 情報を更新
        await fetchLatestPaperInfo();
        // サマリーも更新
        fetchData();
      } else {
        setFetchMessage(`❌ 論文取得に失敗しました: ${response.message}`);
      }
    } catch (e: any) {
      setFetchMessage(`❌ エラーが発生しました: ${e.message}`);
    } finally {
      setIsFetchingPapers(false);
    }
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


  // データ取得関数
  const fetchData = useCallback(async () => {
    try {
      // Fetch Summary Data
      const summaryResponse = await fetch('/api/v1/dashboard/summary');
      if (!summaryResponse.ok) {
        throw new Error(`HTTP error! status: ${summaryResponse.status}`);
      }
      const summaryData: DashboardSummary = await summaryResponse.json();
      setSummary(summaryData);

      // Fetch Trending Keywords for Word Cloud
      await fetchKeywords();

      // Fetch Latest Paper Info
      await fetchLatestPaperInfo();

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchKeywords, fetchLatestPaperInfo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    return <Spinner animation="border" role="status"><span className="visually-hidden">{t('common.loading')}</span></Spinner>;
  }

  if (error) {
    return <Alert variant="danger">{t('common.error')}: {error}</Alert>;
  }

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>

      {/* Summary Information */}
      <h2 className="mt-4">{t('dashboard.summaryTitle')}</h2>
      {summary && (
        <Row>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('dashboard.summary.totalPapers')}</Card.Title>
                <Card.Text>{summary.total_papers}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('dashboard.summary.papers24h')}</Card.Title>
                <Card.Text>{summary.recent_papers_24h}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('dashboard.summary.papers7d')}</Card.Title>
                <Card.Text>{summary.recent_papers_7d}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('dashboard.summary.papers30d')}</Card.Title>
                <Card.Text>{summary.recent_papers_30d}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('dashboard.summary.totalKeywords')}</Card.Title>
                <Card.Text>{summary.total_keywords}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('dashboard.summary.latestPaperDate')}</Card.Title>
                <Card.Text>{summary.latest_paper_date ? new Date(summary.latest_paper_date).toLocaleDateString() : t('common.notAvailable')}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Paper Fetch Section */}
      <Row className="mt-4 mb-4">
        <Col md={6}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>
                <i className="bi bi-download me-2"></i>
                {t('dashboard.paperFetch.title')}
              </Card.Title>
              <Card.Text>
                {latestPaperInfo ? (
                  <>
                    {t('dashboard.paperFetch.latestPaper')}: {latestPaperInfo.latest_date ? 
                      PaperFetchService.getRelativeTime(latestPaperInfo.latest_date) : 
                      t('dashboard.paperFetch.noData')
                    }
                    <br />
                    {t('dashboard.paperFetch.totalPapers')}: {latestPaperInfo.total_papers.toLocaleString()}件
                  </>
                ) : (
                  t('dashboard.paperFetch.loadingInfo')
                )}
              </Card.Text>
              <Button 
                variant="primary" 
                onClick={handleFetchPapers}
                disabled={isFetchingPapers}
                size="sm"
              >
                {isFetchingPapers ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {t('dashboard.paperFetch.fetching')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    {t('dashboard.paperFetch.fetchNew')}
                  </>
                )}
              </Button>
            </Card.Body>
          </Card>
        </Col>
        {fetchMessage && (
          <Col md={6}>
            <Alert variant={fetchMessage.includes('✅') ? 'success' : 'danger'} className="mb-3">
              {fetchMessage}
            </Alert>
          </Col>
        )}
      </Row>

      {/* Trending Keywords (Word Cloud) */}
      <h2 className="mt-4 mb-3">{t('dashboard.keywordsTitle')}</h2>
      {trendingKeywords.length > 0 ? (
        <Card className="mb-4">
          <Card.Body>
            {/* スクロールボタン */}
            {trendingKeywords.length > 20 && (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    console.log('Previous button clicked, current index:', wordCloudStartIndex);
                    setWordCloudStartIndex(Math.max(0, wordCloudStartIndex - 10));
                  }}
                  disabled={wordCloudStartIndex === 0}
                >
                  {t('dashboard.wordCloud.previous10')}
                </button>
                <span className="text-muted small">
                  {t('dashboard.wordCloud.showing', {
                    start: wordCloudStartIndex + 1,
                    end: Math.min(wordCloudStartIndex + 20, trendingKeywords.length),
                    total: trendingKeywords.length
                  })}
                </span>
                <button 
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    console.log('Next button clicked, current index:', wordCloudStartIndex);
                    setWordCloudStartIndex(Math.min(trendingKeywords.length - 20, wordCloudStartIndex + 10));
                  }}
                  disabled={wordCloudStartIndex + 20 >= trendingKeywords.length}
                >
                  {t('dashboard.wordCloud.next10')}
                </button>
              </div>
            )}
            <div 
              className={`${settings.uiTheme === 'dark' ? 'bg-dark border-secondary' : 'bg-light border-light'}`}
              style={{ 
                height: '400px', 
                width: '100%',
                padding: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }} 
            >
              {trendingKeywords.slice(wordCloudStartIndex, wordCloudStartIndex + 20).map((keyword, relativeIndex) => {
                const index = wordCloudStartIndex + relativeIndex; // 全体でのインデックス
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
                    <small>{t('dashboard.wordCloud.period', { startDate, endDate })}</small><br/>
                    <small>{t('dashboard.wordCloud.paperCount', { count: keyword.value.toLocaleString() })}</small><br/>
                    <small>{t('dashboard.wordCloud.rank', { rank: index + 1 })}</small><br/>
                    <em style={{ color: '#007bff' }}>{t('dashboard.wordCloud.clickToSearch')}</em>
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
                        e.currentTarget.style.backgroundColor = settings.uiTheme === 'dark' 
                          ? 'rgba(33, 37, 41, 0.9)' 
                          : 'rgba(255,255,255,0.9)';
                        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
                        e.currentTarget.style.border = '2px solid #ffffff';
                        e.currentTarget.style.color = settings.uiTheme === 'dark' ? '#ffffff' : '#000000';
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
              <strong>{t('dashboard.wordCloud.currentKeywords', { total: trendingKeywords.length })}:</strong><br/>
              {trendingKeywords.slice(wordCloudStartIndex, wordCloudStartIndex + 8).map((k, i) => {
                const maxValue = Math.max(...trendingKeywords.map(kw => kw.value));
                const minValue = Math.min(...trendingKeywords.map(kw => kw.value));
                const fontSize = Math.round(calculateFontSize(k.value, maxValue, minValue, wordCloudStartIndex + i));
                return `${k.text}(${k.value}→${fontSize}px)`;
              }).join(', ')}
              {trendingKeywords.slice(wordCloudStartIndex, wordCloudStartIndex + 20).length > 8 && '...'}
              <br/>
              <small>{t('dashboard.wordCloud.overallRange', { 
                min: Math.min(...trendingKeywords.map(k => k.value)), 
                max: Math.max(...trendingKeywords.map(k => k.value)) 
              })}</small>
              {trendingKeywords.length > 20 && (
                <small> | {t('dashboard.wordCloud.displayRange', {
                  start: wordCloudStartIndex + 1,
                  end: Math.min(wordCloudStartIndex + 20, trendingKeywords.length)
                })}</small>
              )}
            </div>
          </Card.Body>
        </Card>
      ) : (
        <p>{t('dashboard.noKeywords')}</p>
      )}

    </div>
  );
};

export default Dashboard;