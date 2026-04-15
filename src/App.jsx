import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import 'vis-network/styles/vis-network.css';
import './App.css';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, ReferenceDot, LabelList,
  BarChart, Bar, Cell
} from 'recharts';

// 定義圖表顏色庫
const COLORS = [
  '#3498db', // 經典藍
  '#2ecc71', // 翡翠綠
  '#f1c40f', // 亮黃色
  '#9b59b6', // 紫水晶
  '#e67e22', // 胡蘿蔔橘
  '#1abc9c', // 藍綠色
  '#34495e', // 午夜藍
  '#d35400', // 南瓜橘
  '#8e44ad', // 深紫色
  '#27ae60', // 森林綠
  '#2980b9', // 海洋藍
  '#f39c12', // 鮮橙色
  '#16a085', // 深青色
  '#ff9ff3', // 粉紅色
  '#00d2d3', // 螢光青
  '#7f8c8d'  // 質感灰
];

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
  const [trendDepts, setTrendDepts] = useState([]); // 紀錄要在趨勢圖上畫出的對手名單
  const [trendType, setTrendType] = useState('rscore_avgscore');
  const [hiddenLines, setHiddenLines] = useState([]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isGraphFullScreen) setIsGraphFullScreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGraphFullScreen]);

  // 取得歷年趨勢與對手連動資料
  useEffect(() => {
    if (!selectedDept || !selectedDimension || years.length === 0 || !graphData.nodes.length) return;

    // 找出所有與選中校系有連線的邊（這定義了關係網中的「有關校系」）
    const { edges: allEdges, nodes: allNodes } = graphData;
    const connectedEdges = allEdges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
    // 找出所有出現在連線中的校系 ID（包含選中校系自己）
    const targetIds = new Set([selectedDept]);
    connectedEdges.forEach(e => {
      targetIds.add(e.from);
      targetIds.add(e.to);
    });

    const targetNamesMap = {};
    targetIds.forEach(id => {
      const deptInfo = rankings.find(r => r.id === id);
      targetNamesMap[id] = deptInfo ? deptInfo.name : '';
    });

    const idToName = {};
    allNodes.forEach(n => {
      if (targetIds.has(n.id)) idToName[n.id] = n.label.replace(/\n/g, ' ');
    });

    const fetchHistoricalTrend = async () => {
      try {
        const promises = years.map(year =>
          fetch(`${import.meta.env.BASE_URL}rankings_${year}_${selectedDimension}.json`)
            .then(res => res.json())
            .then(data => ({ year, data }))
        );

        const results = await Promise.all(promises);

        const parseScore = (val) => {
          if (val === undefined || val === null || val === '--' || val === '') return null;
          const num = Number(String(val).replace(/,/g, ''));
          return isNaN(num) ? null : num;
        };

        const normalizeName = (name) => (name || "").replace(/\n/g, '').replace(/\s+/g, '').trim();

        const trendData = results.map(({ year, data }) => {
          const yearData = { name: `${year}學年` };

          targetIds.forEach(id => {
            const currentFullName = targetNamesMap[id];
            const normalizedCurrentName = normalizeName(currentFullName);
            const deptData = data.find(d => normalizeName(d.name) === normalizedCurrentName);
            if (deptData) {
              yearData[`${id}_RScore`] = parseScore(deptData.r_score);
              yearData[`${id}_AvgScore`] = parseScore(deptData.avg_score);
            } else {
              yearData[`${id}_RScore`] = null;
              yearData[`${id}_AvgScore`] = null;
            }
          });
          return yearData;
        });

        trendData.sort((a, b) => {
          const yearA = parseInt(a.name.replace(/\D/g, ''));
          const yearB = parseInt(b.name.replace(/\D/g, ''));
          return yearA - yearB;
        });

        setHistoricalData(trendData);

        // 選中的校系排第一，其餘按連線強度 (value) 降序排列
        const deptsArr = Array.from(targetIds).map(id => ({ id, name: idToName[id] }));
        deptsArr.sort((a, b) => {
          if (a.id === selectedDept) return -1;
          if (b.id === selectedDept) return 1;
          const valA = connectedEdges.find(e => e.from === a.id || e.to === a.id)?.value || 0;
          const valB = connectedEdges.find(e => e.from === b.id || e.to === b.id)?.value || 0;
          return valB - valA;
        });

        setTrendDepts(deptsArr);

      } catch (error) {
        console.error("⚠️ 無法取得歷年趨勢資料", error);
      }
    };

    fetchHistoricalTrend();
  }, [selectedDept, selectedDimension, years, graphData]);

  // 計算錄取分數 Y軸 的動態間距 (最大最小值，間隔5)
  const avgTicks = useMemo(() => {
    if (!historicalData.length || !trendDepts.length) return { ticks: [] };
    let min = Infinity;
    let max = -Infinity;

    historicalData.forEach(d => {
      trendDepts.forEach(dept => {
        const val = d[`${dept.id}_AvgScore`];
        if (val != null) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });

    if (min === Infinity) return { ticks: [] };

    // 無條件捨去/進位至最近的 5 的倍數
    const tickMin = Math.floor(min / 5) * 5;
    const tickMax = Math.ceil(max / 5) * 5;

    const ticks = [];
    for (let i = tickMin; i <= tickMax; i += 5) {
      ticks.push(i);
    }
    return { min: tickMin, max: tickMax, ticks };
  }, [historicalData, trendDepts]);

  const rScoreTicks = useMemo(() => {
    if (!historicalData.length || !trendDepts.length) return { ticks: [] };
    let min = Infinity;
    let max = -Infinity;

    historicalData.forEach(d => {
      trendDepts.forEach(dept => {
        const val = d[`${dept.id}_RScore`];
        if (val != null) {
          min = Math.min(min, val);
          max = Math.max(max, val);
        }
      });
    });

    if (min === Infinity) return { ticks: [] };

    // 無條件捨去/進位至最近的 5 的倍數 (這套邏輯對負數也完美適用)
    const tickMin = Math.floor(min / 5) * 5;
    const tickMax = Math.ceil(max / 5) * 5;

    const ticks = [];
    for (let i = tickMin; i <= tickMax; i += 5) {
      ticks.push(i);
    }
    return { min: tickMin, max: tickMax, ticks };
  }, [historicalData, trendDepts]);

  const singleRScoreTicks = useMemo(() => {
    if (!historicalData.length || !selectedDept) return { ticks: [] };

    let min = Infinity;
    let max = -Infinity;

    historicalData.forEach(d => {
      const val = d[`${selectedDept}_RScore`];
      if (val != null) {
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    });

    if (min === Infinity) return { ticks: [] };

    const tickMin = Math.floor(min / 5) * 5;
    const tickMax = Math.ceil(max / 5) * 5;
    const ticks = [];
    for (let i = tickMin; i <= tickMax; i += 5) {
      ticks.push(i);
    }
    return { min: tickMin, max: tickMax, ticks };
  }, [historicalData, selectedDept]);

  // 🎯 專門給「單一校系雙 Y 軸圖」使用的 錄取分數 刻度 (只算自己)
  const singleAvgTicks = useMemo(() => {
    if (!historicalData.length || !selectedDept) return { ticks: [] };

    let min = Infinity;
    let max = -Infinity;

    historicalData.forEach(d => {
      const val = d[`${selectedDept}_AvgScore`];
      if (val != null) {
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    });

    if (min === Infinity) return { ticks: [] };

    const tickMin = Math.floor(min / 5) * 5;
    const tickMax = Math.ceil(max / 5) * 5;
    const ticks = [];
    for (let i = tickMin; i <= tickMax; i += 5) {
      ticks.push(i);
    }
    return { min: tickMin, max: tickMax, ticks };
  }, [historicalData, selectedDept]);

  const requestSort = (key) => {
    let direction = 'descending';
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  const displayRankings = useMemo(() => {
    let processedData = rankings
      .map((dept, index) => ({ ...dept, originalRank: index + 1 }))
      .filter(dept => {
        if (!searchTerm) return true;
        const cleanDeptName = dept.name.replace(/\n/g, ' ').toLowerCase();
        const searchTermsArray = searchTerm.trim().toLowerCase().split(/\s+/);
        return searchTermsArray.every(term => {
          if (cleanDeptName.includes(term)) return true;
          let textIndex = 0, termIndex = 0;
          while (textIndex < cleanDeptName.length && termIndex < term.length) {
            if (cleanDeptName[textIndex] === term[termIndex]) termIndex++;
            textIndex++;
          }
          return termIndex === term.length;
        });
      });

    if (sortConfig.key) {
      processedData.sort((a, b) => {
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
    if (sortConfig.key !== columnKey) return ' ↕️';
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
        const rScoreText = rankingInfo ? `\n⭐ R-Score: ${rankingInfo.r_score}\n📈 分數: ${rankingInfo.avg_score}` : '';
        const isCenter = node.id === selectedDept;
        return {
          ...node,
          label: `${node.label}${rScoreText}`,
          color: isCenter ? { background: '#fdf2f1', border: '#e74c3c' } : { background: '#ffffff', border: '#3498db' },
          font: { size: isCenter ? 16 : 14, color: '#34495e', align: 'center' },
          borderWidth: isCenter ? 3 : 2,
          ...(isCenter && { x: 0, y: 0, fixed: true })
        };
      });

    const data = { nodes: subNodes, edges: connectedEdges };
    const options = {
      nodes: { shape: 'box', margin: 12, borderWidth: 2, font: { face: 'Microsoft JhengHei', align: 'center' }, shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 5, x: 2, y: 2 } },
      edges: { color: '#bdc3c7', smooth: { type: 'continuous' }, width: 2 },
      physics: {
        enabled: true, solver: 'barnesHut',
        barnesHut: { gravitationalConstant: -12000, centralGravity: 0.5, springLength: 220, springConstant: 0.04, damping: 0.2, avoidOverlap: 0.8 },
        stabilization: { enabled: true, iterations: 300, updateInterval: 25 }
      },
      interaction: { hover: true, tooltipDelay: 200 }
    };
    networkRef.current = new Network(visJsRef.current, data, options);
  }, [selectedDept, graphData, activeTab, rankings]);

  const currentDeptInfo = useMemo(() => rankings.find(dept => dept.id === selectedDept), [rankings, selectedDept]);

  const scatterPlotData = useMemo(() => {
    if (rankings.length < 5) return [];
    const items = rankings.map(dept => ({
      x: dept.r_score || 0, y: dept.avg_score || 0, name: dept.name, id: dept.id,
      fill: dept.id === selectedDept ? '#e74c3c' : '#3498db'
    }));
    const avgX = items.reduce((sum, i) => sum + i.x, 0) / items.length;
    const avgY = items.reduce((sum, i) => sum + i.y, 0) / items.length;
    return { items, avgX, avgY };
  }, [rankings, selectedDept]);

  // 使用真實資料產生體質分析的長條圖
  const healthData = useMemo(() => {
    if (!currentDeptInfo || !trendDepts.length) return [];
    const data = trendDepts.map(dept => {
      const info = rankings.find(r => r.id === dept.id) || {};
      return {
        // name: dept.name.length > 8 ? dept.name.substring(0, 8) + '...' : dept.name, // 名稱太長時截斷
        name: dept.name,
        yield_rate: info.yield_rate ? Number((info.yield_rate * 100).toFixed(1)) : 0,
        zheng_effect: info.zheng_effect ? Number((info.zheng_effect * 100).toFixed(1)) : 0,
        flow_rate: info.flow_rate ? Number((info.flow_rate * 100).toFixed(1)) : 0,
      };
    });
    return data;
  }, [trendDepts, currentDeptInfo, rankings]);

  const renderTabButtons = () => (
    <div className="analysis-tabs">
      {[
        { id: 'network', label: '🤝 競爭關係網' },
        { id: 'trend', label: '📈 歷年趨勢' },
        // { id: 'position', label: '⚔️ 戰略定位' },
        { id: 'health', label: '🛡️ 招生效益' }, // 改為招生效益
      ].map(tab => (
        <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderTrendChart = () => (
    <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* 子切換按鈕區塊 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button
          onClick={() => setTrendType('rscore_avgscore')}
          style={{
            padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
            border: trendType === 'rscore_avgscore' ? 'none' : '1px solid #2ecc71',
            backgroundColor: trendType === 'rscore_avgscore' ? '#2ecc71' : '#fff',
            color: trendType === 'rscore_avgscore' ? '#fff' : '#2ecc71',
            boxShadow: trendType === 'rscore_avgscore' ? '0 2px 5px rgba(46, 204, 113, 0.3)' : 'none'
          }}
        >
          📈 R-Score 與錄取分數趨勢
        </button>
        <button
          onClick={() => setTrendType('rscore')}
          style={{
            padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
            border: trendType === 'rscore' ? 'none' : '1px solid #e74c3c',
            backgroundColor: trendType === 'rscore' ? '#e74c3c' : '#fff',
            color: trendType === 'rscore' ? '#fff' : '#e74c3c',
            boxShadow: trendType === 'rscore' ? '0 2px 5px rgba(231, 76, 60, 0.3)' : 'none'
          }}
        >
          ⭐ R-Score 趨勢
        </button>
        <button
          onClick={() => setTrendType('avgscore')}
          style={{
            padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
            border: trendType === 'avgscore' ? 'none' : '1px solid #3498db',
            backgroundColor: trendType === 'avgscore' ? '#3498db' : '#fff',
            color: trendType === 'avgscore' ? '#fff' : '#3498db',
            boxShadow: trendType === 'avgscore' ? '0 2px 5px rgba(52, 152, 219, 0.3)' : 'none'
          }}
        >
          📊 加權錄取分數趨勢
        </button>
      </div>

      {/* 根據選取的 trendType 顯示對應圖表 (圖表高度設定為 flex: 1 填滿空間) */}

      {/* 區塊 1：R-Score與錄取分數趨勢 */}
      {trendType === 'rscore_avgscore' && currentDeptInfo && (
        <div style={{ width: '100%', height: '400px', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '15px' }}>📈 {currentDeptInfo.name.replace(/\n/g, ' ')} 歷年競爭力趨勢</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickMargin={10} />
              {singleRScoreTicks.ticks && singleRScoreTicks.ticks.length > 0 && (
                <YAxis
                  yAxisId="left"
                  domain={[singleRScoreTicks.min, singleRScoreTicks.max]}
                  ticks={singleRScoreTicks.ticks}
                  label={{ value: 'R-Score', angle: -90, position: 'insideLeft', offset: 10 }}
                  tick={{ fontSize: 12 }}
                />
              )}
              {singleAvgTicks.ticks && singleAvgTicks.ticks.length > 0 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[singleAvgTicks.min, singleAvgTicks.max]}
                  ticks={singleAvgTicks.ticks}
                  label={{ value: '加權錄取分數', angle: 90, position: 'insideRight', offset: 10 }}
                  tick={{ fontSize: 12 }}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={`${selectedDept}_RScore`}
                name="R-Score"
                stroke="#e74c3c"
                strokeWidth={4}
                dot={{ r: 4, fill: '#e74c3c' }}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey={`${selectedDept}_AvgScore`}
                name="加權錄取分數"
                stroke="#3498db"
                strokeWidth={4}
                dot={{ r: 4, fill: '#3498db' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 區塊 2：R-Score 趨勢 */}
      {trendType === 'rscore' && (
        <div style={{ width: '100%', height: '400px', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '15px' }}>📈 歷年 R-Score 趨勢 (本系 vs 競爭對手)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickMargin={10} />
              {rScoreTicks.ticks && rScoreTicks.ticks.length > 0 && (
                <YAxis domain={[rScoreTicks.min, rScoreTicks.max]} ticks={rScoreTicks.ticks} />
              )}
              <Tooltip content={<CustomTooltip />} offset={20} cursor={{ stroke: '#ccc', strokeWidth: 1, strokeDasharray: '3 3' }} />
              {/* <Legend wrapperStyle={{ paddingTop: '15px' }} /> */}
              {trendDepts.map((dept, i) => (
                <Line
                  key={dept.id}
                  type="monotone"
                  dataKey={`${dept.id}_RScore`}
                  name={dept.name}
                  hide={hiddenLines.includes(dept.id)}
                  stroke={dept.id === selectedDept ? '#e74c3c' : COLORS[i % COLORS.length]}
                  strokeWidth={dept.id === selectedDept ? 4 : 2}
                  activeDot={{ r: dept.id === selectedDept ? 8 : 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 區塊 3：錄取分數趨勢 */}
      {trendType === 'avgscore' && (
        <div style={{ width: '100%', height: '400px', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '15px' }}>📈 歷年錄取分數趨勢 (本系 vs 競爭對手)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickMargin={10} />
              {avgTicks.ticks && avgTicks.ticks.length > 0 && (
                <YAxis domain={[avgTicks.min, avgTicks.max]} ticks={avgTicks.ticks} />
              )}
              <Tooltip content={<CustomTooltip />} offset={20} cursor={{ stroke: '#ccc', strokeWidth: 1, strokeDasharray: '3 3' }} />
              {/* <Legend wrapperStyle={{ paddingTop: '15px' }} /> */}
              {trendDepts.map((dept, i) => (
                <Line
                  key={dept.id}
                  type="monotone"
                  dataKey={`${dept.id}_AvgScore`}
                  name={dept.name}
                  hide={hiddenLines.includes(dept.id)}
                  stroke={dept.id === selectedDept ? '#e74c3c' : COLORS[i % COLORS.length]}
                  strokeWidth={dept.id === selectedDept ? 4 : 2}
                  activeDot={{ r: dept.id === selectedDept ? 8 : 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {trendType !== 'rscore_avgscore' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column', /* 💡 關鍵 1：改為 column 讓元素強制垂直往下排 */
          alignItems: 'center',    /* 💡 關鍵 2：讓整排圖例保持在畫面中間 (如果想靠左可以改成 'flex-start') */
          gap: '10px',             /* 💡 上下間隔 */
          marginTop: '45px',
          padding: '0 10px',
          flexShrink: 0
        }}>
          {(() => {
            // 1. 取得最新一年的資料 (陣列的最後一筆) 作為排序基準
            const latestData = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;

            // 2. 將原始的 trendDepts 加工，綁定固定顏色並取出最新分數來排序
            const sortedLegendDepts = [...trendDepts].map((dept, index) => {
              const isMain = dept.id === selectedDept;
              // 💡 關鍵防呆：顏色必須綁定原本的 index，這樣切換 R-Score/錄取分數 時，同校系的顏色才不會亂跳
              const color = isMain ? '#e74c3c' : COLORS[index % COLORS.length];

              // 判斷現在是看哪個 Tab，去抓對應的分數
              const scoreKey = trendType === 'rscore' ? `${dept.id}_RScore` : `${dept.id}_AvgScore`;
              const score = latestData && latestData[scoreKey] != null ? latestData[scoreKey] : -Infinity; // 沒分數的排到最下面

              return { ...dept, isMain, color, score };
            }).sort((a, b) => b.score - a.score); // 分數由高排到低

            // 3. 渲染排序後的圖例
            return sortedLegendDepts.map((dept) => {
              const isHidden = hiddenLines.includes(dept.id);
              return (
                <div key={dept.id} onClick={() => toggleLine(dept.id)} style={{ display: 'flex', alignItems: 'center', fontSize: '14px', width: 'fit-content' }}>
                  <svg width="32" height="12" style={{ marginRight: '8px', flexShrink: 0 }}>
                    <line x1="0" y1="6" x2="32" y2="6" stroke={dept.color} strokeWidth={dept.isMain ? "4" : "2"} />
                    <circle cx="16" cy="6" r={dept.isMain ? "4" : "3"} fill={dept.color} />
                  </svg>
                  <span style={{ fontWeight: dept.isMain ? '600' : '400', color: isHidden ? '#999' : '#444', textDecoration: isHidden ? 'line-through' : 'none' }}>
                    {dept.name}
                    <span style={{ color: '#95a5a6', fontSize: '14px', marginLeft: '8px' }}>
                      {dept.score !== -Infinity ? `(${dept.score})` : '(--)'}
                    </span>
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.7)', // 70% 透明白底
          backdropFilter: 'blur(2px)',                // 蘋果風格的毛玻璃模糊效果
          border: '1px solid rgba(255,255,255,0.5)',
          padding: '10px 15px',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
          fontSize: '13px',
          minWidth: '200px'
        }}>
          {/* 標題 (學年度) */}
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
            {label}
          </p>

          {/* 內容列表 */}
          {payload.map((entry, index) => (
            <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color, marginRight: '8px', flexShrink: 0 }} />
              <span style={{ color: '#555', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '10px' }}>
                {entry.name}
              </span>
              <span style={{ fontWeight: 'bold', color: entry.color }}>
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderPositionChart = () => (
    <div className="chart-wrapper">
      <h3>⚔️ 當前學年度：全台校系定位圖</h3>
      <p className="insight-tip">顧問洞察：落在十字交點（平均值）左下方的校系，應警惕是否陷入雙低區。</p>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="R-Score" domain={[0, 100]} label={{ value: 'R-Score', position: 'insideBottom', offset: -5 }} />
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
          <ZAxis range={[60, 60]} />
          <Scatter name="校系" data={scatterPlotData.items}>
            {scatterPlotData.items.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
          </Scatter>
          <ReferenceLine x={scatterPlotData.avgX} stroke="#7f8c8d" strokeDasharray="5 5" />
          <ReferenceLine y={scatterPlotData.avgY} stroke="#7f8c8d" strokeDasharray="5 5" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  const renderHealthChart = () => (
    <div className="chart-wrapper">
      <h3>🛡️ 當年度招生效益比較 (本系 vs 競爭對手)</h3>
      <ResponsiveContainer width="100%" height={500}>
        {/* 💡 加上 layout="vertical" 變成橫向圖表 */}
        <BarChart
          layout="vertical"
          data={healthData}
          margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
        >
          {/* 網格改為顯示垂直線 */}
          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f0f0f0" />

          {/* 💡 X 軸現在變成數字軸 (0~100%) */}
          <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />

          {/* 💡 Y 軸變成文字類別軸。給予 width={250} (或更大) 來容納超長校系名稱 */}
          <YAxis
            type="category"
            dataKey="name"
            width={200}
            tick={{ fontSize: 12, fill: '#34495e' }}
            interval={0}
          />

          <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '10px' }} />

          {/* 橫向圖表的 radius 圓角方向要稍微改變 [右上, 右下, 左下, 左上] */}
          <Bar dataKey="yield_rate" name="報到率" fill="#3498db" radius={[0, 4, 4, 0]} barSize={15} />
          <Bar dataKey="zheng_effect" name="正取有效性" fill="#2ecc71" radius={[0, 4, 4, 0]} barSize={15} />
          <Bar dataKey="flow_rate" name="流入登分比例" fill="#e74c3c" radius={[0, 4, 4, 0]} barSize={15} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(224, 224, 224, 0.5)',
          padding: '12px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          fontSize: '13px'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '14px' }}>
            {String(label).split(' ').map((text, index, array) => (
              <span key={index} style={{ display: 'block', marginBottom: '-10px' }}>
                {text}
              </span>
            ))}
          </p>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: entry.color, marginRight: '8px' }} />
                <span style={{ color: '#555' }}>{entry.name}</span>
              </div>
              <span style={{ fontWeight: 'bold', color: entry.color }}>{entry.value}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleLine = (id) => {
    setHiddenLines(prev =>
      prev.includes(id)
        ? prev.filter(lineId => lineId !== id) // 如果已隱藏，就把它移除 (顯示)
        : [...prev, id]                        // 如果沒隱藏，就加進陣列 (隱藏)
    );
  };

  return (
    <div className="admin-gladiator-dashboard">
      <header>
        {years.length > 0 && (
          <div className="controls-container">
            <div className="year-selector">
              <label>📅 年度：</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map(year => <option key={year} value={year}>{year} 學年度</option>)}
              </select>
            </div>
            <div className="dimension-selector">
              <button className={selectedDimension === 'school' ? 'active' : ''} onClick={() => setSelectedDimension('school')}>🏫 學校維度</button>
              <button className={selectedDimension === 'dept' ? 'active' : ''} onClick={() => setSelectedDimension('dept')}>📚 校系維度</button>
              <button className={selectedDimension === 'group' ? 'active' : ''} onClick={() => setSelectedDimension('group')}>🎯 系組維度</button>
            </div>
          </div>
        )}
      </header>

      <div className="dashboard-content">
        <div className="leaderboard-section" style={{ flex: '0 0 50%' }}> {/* 加寬排行榜區域以容納新欄位 */}
          <div className="leaderboard-header-row">
            <h2>📊 全台校系競爭力總覽</h2>
            <div className="leaderboard-actions">
              {sortConfig.key && <button className="clear-sort-btn" onClick={() => setSortConfig({ key: null, direction: 'descending' })}>🔄 清除排序</button>}
              <div className="search-container">
                <input type="text" className="search-input" placeholder="🔍 搜尋名稱..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {searchTerm && <button className="clear-search-btn" onClick={() => setSearchTerm('')}>✕</button>}
              </div>
            </div>
          </div>
          <div className="table-scroll-container" style={{ overflowX: 'auto' }}>
            <table className="ranking-table" style={{ whiteSpace: 'nowrap', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>項次</th>
                  <th style={{ minWidth: '250px', textAlign: 'left' }}>{selectedDimension === 'school' ? '學校' : selectedDimension === 'dept' ? '校系' : '系組'}</th>
                  <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('r_score')}>R-Score{getSortIcon('r_score')}</th>
                  <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('avg_score')}>錄取分數{getSortIcon('avg_score')}</th>
                  <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('yield_rate')}>報到率{getSortIcon('yield_rate')}</th>
                  <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('zheng_effect')}>正取有效{getSortIcon('zheng_effect')}</th>
                  <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('flow_rate')}>登分比例{getSortIcon('flow_rate')}</th>
                </tr>
              </thead>
              <tbody>
                {displayRankings.map((dept, index) => (
                  <tr key={dept.id} className={selectedDept === dept.id ? 'active-row' : ''} onClick={() => setSelectedDept(dept.id)}>
                    <td className="rank-cell" style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td className="dept-name-cell" style={{ textAlign: 'left', whiteSpace: 'normal' }}>{dept.name.replace(/\n/g, ' ')}</td>
                    <td className="r-score-cell" style={{ textAlign: 'left' }}>{dept.r_score}</td>
                    <td className="avg-score-cell" style={{ textAlign: 'left' }}>{dept.avg_score}</td>
                    <td style={{ textAlign: 'left', color: '#3498db' }}>{dept.yield_rate != null ? `${(dept.yield_rate * 100).toFixed(1)}%` : '--'}</td>
                    <td style={{ textAlign: 'left', color: '#2ecc71' }}>{dept.zheng_effect != null ? `${(dept.zheng_effect * 100).toFixed(1)}%` : '--'}</td>
                    <td style={{ textAlign: 'left', color: '#e74c3c' }}>{dept.flow_rate != null ? `${(dept.flow_rate * 100).toFixed(1)}%` : '--'}</td>
                  </tr>
                ))}
                {displayRankings.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>找不到符合的資料 🥲</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="graph-section">
          {!selectedDept ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>請從左側點擊一個校系</h3>
              <p>點擊後即可查閱其在全台的競爭關係網、歷年發展趨勢與戰略定位分析。</p>
            </div>
          ) : (
            <>
              {renderTabButtons()}
              <div className="tab-content-container">
                <div className="vis-container-wrapper" style={{ display: activeTab === 'network' ? 'block' : 'none' }}>
                  <div ref={visJsRef} className="vis-graph-container" />
                </div>
                {activeTab === 'trend' && renderTrendChart()}
                {/* {activeTab === 'position' && renderPositionChart()} */}
                {activeTab === 'health' && renderHealthChart()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;