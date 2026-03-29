import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import 'vis-network/styles/vis-network.css';
import './App.css';

function App() {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDimension, setSelectedDimension] = useState('group');
  const [rankings, setRankings] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedDept, setSelectedDept] = useState(null);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);

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

  // --- 💡 核心修改：將魅力值整合進節點標籤 ---
  const displayGraphData = useMemo(() => {
    if (!selectedDept || !graphData.nodes.length) {
      return { nodes: [], edges: [] };
    }

    const relatedEdges = graphData.edges
      .filter(edge => edge.from === selectedDept || edge.to === selectedDept)
      .map(edge => ({
        ...edge,
        value: undefined,
        width: 2,
        font: { align: 'horizontal', size: 14, color: '#34495e', strokeWidth: 3, strokeColor: '#ffffff' }
      }));

    const relatedNodeIds = new Set([selectedDept]);
    relatedEdges.forEach(edge => {
      relatedNodeIds.add(edge.from);
      relatedNodeIds.add(edge.to);
    });

    // 在這裡把節點抓出來，並去 rankings 裡面反查它的魅力值
    const relatedNodes = graphData.nodes
      .filter(node => relatedNodeIds.has(node.id))
      .map(node => {
        const rankingInfo = rankings.find(r => r.id === node.id);
        // 如果有找到對應的排名資料，就在名稱後面加上換行符號與 R 值
        const rScoreText = rankingInfo ? `\n⭐ R-Score: ${rankingInfo.r_score}\n⭐ 錄取分數: ${rankingInfo.avg_score}` : '';
        return {
          ...node,
          label: `${node.label}${rScoreText}`
        };
      });

    return { nodes: relatedNodes, edges: relatedEdges };
  }, [graphData, selectedDept, rankings]); // 注意這裡把 rankings 加入了依賴陣列

  useEffect(() => {
    if (visJsRef.current && displayGraphData.nodes.length > 0) {
      if (networkRef.current) networkRef.current.destroy();

      const options = {
        nodes: {
          shape: 'box',
          font: { size: 14, color: '#333' },
          borderWidth: 2,
          color: { background: '#fff', border: '#3498db' },
          margin: 10
        },
        edges: {
          color: { inherit: 'from' },
          shadow: false,
          // 💡 恢復平滑曲線：因為有了物理引擎，用曲線在拉扯時視覺效果會柔和很多
          smooth: { type: 'continuous' }
        },
        layout: {
          randomSeed: 42
        },
        // 💡 經典物理引擎回歸！
        physics: {
          enabled: true, // 永遠保持開啟
          solver: 'barnesHut',
          barnesHut: {
            gravitationalConstant: -3000, // 適度的斥力，把大家推開
            centralGravity: 0.2,          // 微微的向心力，避免節點飛到螢幕外面
            springLength: 150,            // 彈簧連線的基本長度
            avoidOverlap: 0.5             // 保留一點點避讓機制，但不會硬到卡死
          },
          // 💡 關閉背景預先運算，讓你點擊的瞬間就能看到圖表「飛出來排隊」的療癒過程
          stabilization: {
            enabled: false
          }
        },
        interaction: {
          hover: true,
          selectConnectedEdges: true,
          dragNodes: true
        }
      };

      networkRef.current = new Network(visJsRef.current, displayGraphData, options);

      networkRef.current.on("click", (params) => {
        if (params.nodes.length > 0) setSelectedDept(params.nodes[0]);
      });

      if (networkRef.current) {
        setTimeout(() => networkRef.current.fit(), 100);
      }
    }
  }, [displayGraphData, isGraphFullScreen]);

  return (
    <div className="admin-gladiator-dashboard">
      <header>
        {/* <h1>分發競技場: 大學 TrueSkill 魅力排行榜</h1>
        <p>基於真實考生選擇，提供學校、校系、系組三個維度的熱門度排名。</p> */}

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
          <h2>🏆 Top 排行榜</h2>
          <div className="table-scroll-container">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th style={{ width: '10%', textAlign: 'center' }}>排名</th>
                  <th style={{ textAlign: 'left' }}>{selectedDimension === 'school' ? '學校' : selectedDimension === 'dept' ? '校系' : '系組'}</th>
                  <th style={{ width: '15%', textAlign: 'left' }}>R-Score</th>
                  <th style={{ width: '17%', textAlign: 'left' }}>錄取分數</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((dept, index) => (
                  <tr
                    key={dept.id}
                    className={selectedDept === dept.id ? 'active-row' : ''}
                    onClick={() => setSelectedDept(dept.id)}
                  >
                    <td className="rank-cell" style={{ textAlign: 'center' }}>#{index + 1}</td>
                    <td className="dept-name-cell" style={{ textAlign: 'left' }}>{dept.name.replace(/\n/g, ' ')}</td>
                    <td className="r-score-cell" style={{ textAlign: 'left' }}>{dept.r_score}</td>
                    <td className="avg-score-cell" style={{ textAlign: 'left' }}>{dept.avg_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isGraphFullScreen && (
          <div className="modal-backdrop" onClick={() => setIsGraphFullScreen(false)}></div>
        )}

        <div className={`graph-section ${isGraphFullScreen ? 'modal-mode' : ''}`}>
          <div className="graph-header-row">
            <h2>🤝 比拚關係圖</h2>
            <button
              className="fullscreen-toggle-btn"
              onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
              title={isGraphFullScreen ? '關閉視窗 (Esc)' : '放大視窗觀看'}
            >
              {isGraphFullScreen ? '✖ 關閉視窗' : '⛶ 放大圖表'}
            </button>
          </div>

          {!selectedDept ? (
            <div className="empty-state-placeholder">
              <span className="placeholder-icon">👈</span>
              <h3>請從左側排行榜選擇</h3>
              <p>點擊任一項目，即可解鎖並查看其專屬的競爭關係網。</p>
            </div>
          ) : (
            <>
              <p className="graph-help">🎯 正在顯示競爭對手</p>
              <div ref={visJsRef} className="vis-network-container"></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;