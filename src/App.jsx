import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import 'vis-network/styles/vis-network.css';
import './App.css';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, ReferenceDot, LabelList,
  BarChart, Bar, Cell
} from 'recharts';

function App() {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDimension, setSelectedDimension] = useState('group');
  const [rankings, setRankings] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedDept, setSelectedDept] = useState(null);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'descending' });
  const [activeTab, setActiveTab] = useState('network');
  const [historicalData, setHistoricalData] = useState([]);

  const visJsRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}available_years.json`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setYears(data);
          setSelectedYear(data[0]);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedYear || !selectedDimension) return;

    // setSearchTerm('');
    setSortConfig({ key: null, direction: 'descending' });

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}rankings_${selectedYear}_${selectedDimension}.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}graph_${selectedYear}_${selectedDimension}.json`).then(res => res.json())
    ]).then(([rankingData, graphData]) => {
      setRankings(rankingData);
      setGraphData(graphData);
      setSelectedDept(null);
    }).catch(err => console.error(`⚠️ 無法讀取資料`, err));
  }, [selectedYear, selectedDimension]);

  // 監聽 Esc 鍵以退出全螢幕
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isGraphFullScreen) {
        setIsGraphFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGraphFullScreen]);

  useEffect(() => {
    // 如果沒有選中校系，或者沒有年度資料，就不執行
    if (!selectedDept || !selectedDimension || years.length === 0) return;

    const fetchHistoricalTrend = async () => {
      try {
        // 同時發送請求去抓取 111, 112, 113... 所有年度的排行榜資料
        const promises = years.map(year =>
          fetch(`${import.meta.env.BASE_URL}rankings_${year}_${selectedDimension}.json`)
            .then(res => res.json())
            .then(data => ({ year, data }))
        );

        const results = await Promise.all(promises);

        // 整理給 Recharts 畫圖用的資料格式
        const trendData = results.map(({ year, data }) => {
          // 在那一年的檔案中，找到目前選中的校系
          const targetDept = data.find(d => d.id === selectedDept);

          return {
            name: `${year}學年`,
            // 如果當年有找到這個校系，就填入分數；如果當年該系還沒成立，就給 null
            RScore: targetDept ? Number(targetDept.r_score) : null,
            AvgScore: targetDept ? Number(targetDept.avg_score) : null,
          };
        });

        // 如果你的 years 陣列是 ['113', '112', '111'] (由新到舊)
        // 圖表通常習慣由左到右是「由舊到新」，所以我們把它反轉一下
        const sortedTrendData = trendData.reverse();

        setHistoricalData(sortedTrendData);
      } catch (error) {
        console.error("⚠️ 無法取得歷年趨勢資料", error);
      }
    };

    fetchHistoricalTrend();
  }, [selectedDept, selectedDimension, years]);

  const requestSort = (key) => {
    let direction = 'descending'; // 預設點擊時從大到小排
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending'; // 如果已經是降冪，再次點擊就換成升冪
    }
    setSortConfig({ key, direction });
  };

  const displayRankings = useMemo(() => {
    let processedData = rankings
      .map((dept, index) => ({ ...dept, originalRank: index + 1 }))
      .filter(dept => {
        if (!searchTerm) return true; // 如果沒有輸入搜尋詞，就全部顯示

        // 1. 清理原始資料的換行符號
        const cleanDeptName = dept.name.replace(/\n/g, ' ').toLowerCase();

        // 2. 將使用者的搜尋詞用空白切割成陣列 (支援多關鍵字，如: "屏科 獸醫")
        const searchTermsArray = searchTerm.trim().toLowerCase().split(/\s+/);

        // 3. 檢查「每一個」關鍵字是否都有配對成功
        return searchTermsArray.every(term => {
          // 先試試看最簡單的直接包含 (精確比對)
          if (cleanDeptName.includes(term)) return true;

          // 如果直接找不到，就啟動「模糊比對 (Fuzzy Match)」
          // 邏輯：只要輸入的字有「按順序」出現在字串中，就算成功
          let textIndex = 0;
          let termIndex = 0;

          while (textIndex < cleanDeptName.length && termIndex < term.length) {
            if (cleanDeptName[textIndex] === term[termIndex]) {
              termIndex++; // 找到一個字了，準備找下一個
            }
            textIndex++; // 繼續往下看資料字串
          }

          // 如果 termIndex 等於搜尋詞的長度，代表搜尋詞的每個字都依序找到了
          return termIndex === term.length;
        });
      });

    if (sortConfig.key) {
      processedData.sort((a, b) => {
        // 轉為數字以防字串比對錯誤，若無值則補 0
        const aValue = Number(a[sortConfig.key]) || 0;
        const bValue = Number(b[sortConfig.key]) || 0;

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return processedData;
  }, [rankings, searchTerm, sortConfig]);

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ↕️'; // 尚未針對此欄位排序的預設圖示
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  };

  useEffect(() => {
    if (!visJsRef.current || !selectedDept || activeTab !== 'network') return;

    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }
    const { nodes: allNodes, edges: allEdges } = graphData;
    const targetNode = allNodes.find(node => node.id === selectedDept);
    if (!targetNode) return;

    const connectedEdges = allEdges
      // 如果需要雙向，要改成 edge.from === selectedDept || edge.to === selectedDept
      .filter(edge => edge.from === selectedDept || edge.to === selectedDept)
      .map(edge => {
        const newEdge = { ...edge };
        delete newEdge.value;
        newEdge.width = 1.5;
        return newEdge;
      });
    const connectedNodeIds = new Set([selectedDept]);
    connectedEdges.forEach(edge => {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    });

    const subNodes = allNodes
      .filter(node => connectedNodeIds.has(node.id))
      .map(node => {
        const rankingInfo = rankings.find(r => r.id === node.id);
        const rScoreText = rankingInfo
          ? `\n⭐ R-Score: ${rankingInfo.r_score}\n📈 錄取分數: ${rankingInfo.avg_score}`
          : '';
        const isCenter = node.id === selectedDept; // 判斷是不是主角
        return {
          ...node,
          label: `${node.label}${rScoreText}`,
          color: isCenter
            ? { background: '#fdf2f1', border: '#e74c3c' } // 中心點：紅框紅底
            : { background: '#ffffff', border: '#3498db' }, // 對手：藍框白底
          font: {
            size: isCenter ? 16 : 14,
            color: '#34495e',
            align: 'center' // 確保多行文字置中對齊
          },
          borderWidth: isCenter ? 3 : 2,
          ...(isCenter && { x: 0, y: 0, fixed: true })
        };
      });

    const data = { nodes: subNodes, edges: connectedEdges };
    const options = {
      nodes: {
        shape: 'box',
        margin: 12,
        borderWidth: 2,
        font: { face: 'Microsoft JhengHei', align: 'center' },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 5, x: 2, y: 2 }
      },
      edges: {
        color: '#bdc3c7',
        smooth: { type: 'continuous' },
        width: 2,
        // arrows: {
        //   to: {
        //     enabled: true,
        //     scaleFactor: 0.8
        //   }
        // }
      },
      physics: {
        enabled: true,
        // 切換為 barnesHut 引擎，它在處理防止重疊上表現較佳
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -12000, // 稍微降低互斥力，避免推擠太大力
          centralGravity: 0.5,          // 增強向心力，把大家往中心拉
          springLength: 220,            // 線再放長一點，給長方形卡片更多伸展空間
          springConstant: 0.04,         // 彈簧常數，數值越小，彈簧越軟，節點間距會變大
          damping: 0.2,                 // 增加阻尼(摩擦力)，讓節點抖動後迅速冷靜停下
          avoidOverlap: 0.8             // 稍微調降一點防重疊(容許極微小的邊緣碰觸)，能大幅提升穩定度
        },
        stabilization: {
          enabled: true,
          iterations: 300, // 增加穩定化的迭代次數，因為排斥力變強了
          updateInterval: 25
        }
      },
      interaction: { hover: true, tooltipDelay: 200 }
    };

    networkRef.current = new Network(visJsRef.current, data, options);
  }, [selectedDept, graphData, activeTab, rankings]);

  const currentDeptInfo = useMemo(() => {
    return rankings.find(dept => dept.id === selectedDept);
  }, [rankings, selectedDept]);

  // 2. 戰略定位 Mock 資料 (所有校系的散佈圖)
  const scatterPlotData = useMemo(() => {
    if (rankings.length < 5) return [];

    // 將所有資料轉為散佈圖格式，並算出平均值
    const items = rankings.map(dept => ({
      x: dept.r_score || 0,
      y: dept.avg_score || 0,
      name: dept.name,
      id: dept.id,
      fill: dept.id === selectedDept ? '#e74c3c' : '#3498db' // 自己是紅點，別人是藍點
    }));

    const avgX = items.reduce((sum, i) => sum + i.x, 0) / items.length;
    const avgY = items.reduce((sum, i) => sum + i.y, 0) / items.length;

    return { items, avgX, avgY };
  }, [rankings, selectedDept]);

  // 3. 學生流失分析 Mock 資料 (簡單的長條圖取代 Sankey)
  const mockLossData = useMemo(() => {
    if (!selectedDept || !currentDeptInfo) return [];
    return [
      { competitor: '競爭者A大學 (資工)', lostStudents: 32 },
      { competitor: '競爭者B大學 (資工)', lostStudents: 25 },
      { competitor: '競爭者C大學 (電機)', lostStudents: 18 },
      { competitor: '其他校系總計', lostStudents: 45 },
    ];
  }, [selectedDept, currentDeptInfo]);

  // A. 頁籤按鈕組件
  const renderTabButtons = () => (
    <div className="analysis-tabs">
      {[
        { id: 'network', label: '🤝 競爭關係網' },
        { id: 'trend', label: '📈 歷年趨勢' },
        // { id: 'position', label: '⚔️ 戰略定位' },
        // { id: 'loss', label: '💧 學生流失' },
      ].map(tab => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // B. 歷年趨勢折線圖
  const renderTrendChart = () => (
    <div className="chart-wrapper">
      <h3>📈 {currentDeptInfo.name.replace(/\n/g, ' ')} 歷年競爭力趨勢</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={historicalData} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tickMargin={10} />
          <YAxis yAxisId="left" label={{ value: 'R-Score', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
          <YAxis yAxisId="right" orientation="right" label={{ value: '錄取分數', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line yAxisId="left" type="monotone" dataKey="RScore" name="R-Score" stroke="#e74c3c" strokeWidth={3} activeDot={{ r: 8 }} />
          <Line yAxisId="right" type="monotone" dataKey="AvgScore" name="錄取分數" stroke="#3498db" strokeWidth={2} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // C. 戰略定位散佈圖
  const renderPositionChart = () => (
    <div className="chart-wrapper">
      <h3>⚔️ 當前學年度：全台校系定位圖</h3>
      <p className="insight-tip">顧問洞察：落在十字交點（平均值）左下方的校系，應警惕是否陷入雙低區。</p>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="R-Score" unit="" domain={[0, 100]} label={{ value: 'R-Score', position: 'insideBottom', offset: -5 }} />
          <YAxis type="number" dataKey="y" name="分數" label={{ value: '錄取分數', angle: -90, position: 'insideLeft' }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
            if (payload && payload.length > 0) {
              const data = payload[0].payload;
              return (
                <div className="scatter-tooltip">
                  <p className="title">{data.name}</p>
                  <p>R-Score: {data.x.toFixed(1)}</p>
                  <p>錄取分數: {data.y.toFixed(1)}</p>
                </div>
              );
            }
            return null;
          }} />
          <ZAxis range={[60, 60]} /> {/* 固定點的大小 */}
          <Scatter name="校系" data={scatterPlotData.items}>
            {scatterPlotData.items.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Scatter>
          {/* 四象限參考線 (平均值) */}
          <ReferenceLine x={scatterPlotData.avgX} stroke="#7f8c8d" strokeDasharray="5 5" />
          <ReferenceLine y={scatterPlotData.avgY} stroke="#7f8c8d" strokeDasharray="5 5" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  // D. 學生流失分析 (長條圖)
  const renderLossChart = () => (
    <div className="chart-wrapper">
      <h3>💧 本系重榜生最終流失去向 (預估)</h3>
      <p className="insight-tip">顧問洞察：數據顯示 B大學資工奪走了最多貴系重榜生，建議分析 B大學的招生宣傳策略。</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={mockLossData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" label={{ value: '預估流失人數', position: 'insideBottom', offset: -5 }} />
          <YAxis type="category" dataKey="competitor" />
          <Tooltip />
          <Bar dataKey="lostStudents" name="流失人數" fill="#c0392b" barSize={20}>
            {mockLossData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === mockLossData.length - 1 ? '#95a5a6' : '#c0392b'} /> // 最後一個用灰色
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="admin-gladiator-dashboard">
      <header>
        {/* <h1>🎓 校系競爭力戰略儀表板</h1> */}

        {years.length > 0 && (
          <div className="controls-container">
            <div className="year-selector">
              <label>📅 年度：</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map(year => <option key={year} value={year}>{year} 學年度</option>)}
              </select>
            </div>

            <div className="dimension-selector">
              <button
                className={selectedDimension === 'school' ? 'active' : ''}
                onClick={() => setSelectedDimension('school')}>🏫 學校維度</button>
              <button
                className={selectedDimension === 'dept' ? 'active' : ''}
                onClick={() => setSelectedDimension('dept')}>📚 校系維度</button>
              <button
                className={selectedDimension === 'group' ? 'active' : ''}
                onClick={() => setSelectedDimension('group')}>🎯 系組維度</button>
            </div>
          </div>
        )}
      </header>

      <div className="dashboard-content">
        <div className="leaderboard-section">
          <div className="leaderboard-header-row">
            <h2>📊 全台校系競爭力總覽</h2>
            <div className="leaderboard-actions">
              {sortConfig.key && <button className="clear-sort-btn" onClick={() => setSortConfig({ key: null, direction: 'descending' })} title="恢復預設排序">🔄 清除排序</button>}
              <div className="search-container">
                <input type="text" className="search-input" placeholder="🔍 搜尋名稱..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {searchTerm && <button className="clear-search-btn" onClick={() => setSearchTerm('')} title="清除搜尋">✕</button>}
              </div>
            </div>
          </div>
          <div className="table-scroll-container">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th style={{ width: '10%', textAlign: 'center' }}>項次</th>
                  <th style={{ textAlign: 'left' }}>{selectedDimension === 'school' ? '學校' : selectedDimension === 'dept' ? '校系' : '系組'}</th>
                  <th className="sortable-header" style={{ width: '20%', textAlign: 'left' }} onClick={() => requestSort('r_score')}>R-Score{getSortIcon('r_score')}</th>
                  <th className="sortable-header" style={{ width: '20%', textAlign: 'left' }} onClick={() => requestSort('avg_score')}>錄取分數{getSortIcon('avg_score')}</th>
                </tr>
              </thead>
              <tbody>
                {displayRankings.map((dept, index) => (
                  <tr key={dept.id} className={selectedDept === dept.id ? 'active-row' : ''} onClick={() => { setSelectedDept(dept.id); /* 💡 選中新校系時，頁籤保持不變， vis.js 會重新載入 */ }}>
                    <td className="rank-cell" style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td className="dept-name-cell" style={{ textAlign: 'left' }}>
                      {dept.name.replace(/\n/g, ' ')}
                    </td>
                    <td className="r-score-cell" style={{ textAlign: 'left' }}>{dept.r_score}</td>
                    <td className="avg-score-cell" style={{ textAlign: 'left' }}>{dept.avg_score}</td>
                  </tr>
                ))}
                {displayRankings.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>找不到符合「{searchTerm}」的資料 🥲</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {isGraphFullScreen && (
          <div className="modal-backdrop" onClick={() => setIsGraphFullScreen(false)}></div>
        )}

        <div className="graph-section">
          {!selectedDept ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>請從左側點擊一個校系</h3>
              <p>點擊後即可查閱其在全台的競爭關係網、歷年發展趨勢與戰略定位分析。</p>
            </div>
          ) : (
            <>
              {/* 1. 頁籤切換欄 */}
              {renderTabButtons()}

              {/* 2. 頁籤內容區域 */}
              <div className="tab-content-container">
                {/* A. 競爭關係網 (保留原來的 vis.js 物理圖) */}
                <div className="vis-container-wrapper" style={{ display: activeTab === 'network' ? 'block' : 'none' }}>
                  <div ref={visJsRef} className="vis-graph-container" />
                </div>

                {/* B. 歷年趨勢圖 (Recharts LineChart) */}
                {activeTab === 'trend' && renderTrendChart()}

                {/* C. 戰略定位圖 (Recharts ScatterChart) */}
                {activeTab === 'position' && renderPositionChart()}

                {/* D. 學生流失圖 (Recharts BarChart) */}
                {activeTab === 'loss' && renderLossChart()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;