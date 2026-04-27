import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
    '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e', '#d35400',
    '#8e44ad', '#27ae60', '#2980b9', '#f39c12', '#16a085', '#ff9ff3', '#00d2d3', '#7f8c8d'
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(2px)', border: '1px solid rgba(255,255,255,0.5)', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)', fontSize: '13px', minWidth: '200px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>{label}</p>
                {payload.map((entry, index) => (
                    <div key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color, marginRight: '8px', flexShrink: 0 }} />
                        <span style={{ color: '#555', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '10px' }}>{entry.name}</span>
                        <span style={{ fontWeight: 'bold', color: entry.color }}>{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const TrendChart = ({ currentDeptInfo, historicalData, singleRScoreTicks, singleAvgTicks, rScoreTicks, avgTicks, trendDepts, selectedDept, myLabel }) => {
    const [trendType, setTrendType] = useState('rscore_avgscore');
    const [hiddenLines, setHiddenLines] = useState([]);

    // 💡 自動優化邏輯：當競爭對手改變時，預設只顯示前 5 名（不包含當前校系）
    useEffect(() => {
        if (trendDepts.length > 6) {
            // 找出排名在第 5 名之後的所有校系 ID
            const toHide = trendDepts
                .slice(6) // 索引 0 是自己，1-5 是前五名，之後的都隱藏
                .map(d => d.id);
            setHiddenLines(toHide);
        } else {
            setHiddenLines([]);
        }
    }, [trendDepts]);

    const toggleLine = (id) => {
        setHiddenLines(prev => prev.includes(id) ? prev.filter(lineId => lineId !== id) : [...prev, id]);
    };

    const toggleAllSupporters = () => {
        if (hiddenLines.length > 0) {
            setHiddenLines([]);
        } else {
            const allExceptMe = trendDepts.filter(d => d.id !== selectedDept).map(d => d.id);
            setHiddenLines(allExceptMe);
        }
    };

    return (
        <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 趨勢類型切換 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
                <button onClick={() => setTrendType('rscore_avgscore')} style={{ padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', border: trendType === 'rscore_avgscore' ? 'none' : '1px solid #2ecc71', backgroundColor: trendType === 'rscore_avgscore' ? '#2ecc71' : '#fff', color: trendType === 'rscore_avgscore' ? '#fff' : '#2ecc71' }}>📈 綜合趨勢</button>
                <button onClick={() => setTrendType('rscore')} style={{ padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', border: trendType === 'rscore' ? 'none' : '1px solid #e74c3c', backgroundColor: trendType === 'rscore' ? '#e74c3c' : '#fff', color: trendType === 'rscore' ? '#fff' : '#e74c3c' }}>⭐ R-Score</button>
                <button onClick={() => setTrendType('avgscore')} style={{ padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', border: trendType === 'avgscore' ? 'none' : '1px solid #3498db', backgroundColor: trendType === 'avgscore' ? '#3498db' : '#fff', color: trendType === 'avgscore' ? '#fff' : '#3498db' }}>📊 錄取分數</button>
            </div>

            {/* 綜合趨勢 */}
            {trendType === 'rscore_avgscore' && currentDeptInfo && (
                <h3 style={{ marginBottom: '15px' }}>📈 {currentDeptInfo.name.replace(/\n/g, ' ')} 歷年競爭力趨勢</h3>
            )}

            {/* R-Score 或 分數趨勢 */}
            {trendType !== 'rscore_avgscore' && (
                <h3 style={{ marginBottom: '15px' }}>📈 歷年 {trendType === 'rscore' ? 'R-Score' : '錄取分數'} 趨勢 ({myLabel} vs 競爭對手)</h3>
            )}

            {/* 圖表渲染區 */}
            <div style={{ width: '100%', height: '400px', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={true} />
                        <XAxis dataKey="name" tickMargin={10} />

                        {trendType === 'rscore_avgscore' ? (
                            <>
                                <YAxis yAxisId="left" domain={[singleRScoreTicks.min, singleRScoreTicks.max]} ticks={singleRScoreTicks.ticks} tick={{ fontSize: 12 }} />
                                <YAxis yAxisId="right" orientation="right" domain={[singleAvgTicks.min, singleAvgTicks.max]} ticks={singleAvgTicks.ticks} tick={{ fontSize: 12 }} />
                                <Line yAxisId="left" type="monotone" dataKey={`${selectedDept}_RScore`} name={`R-Score`} stroke="#e74c3c" strokeWidth={4} />
                                <Line yAxisId="right" type="monotone" dataKey={`${selectedDept}_AvgScore`} name={`錄取分數`} stroke="#3498db" strokeWidth={4} />
                            </>
                        ) : (
                            <>
                                <YAxis
                                    domain={trendType === 'rscore' ? [rScoreTicks.min, rScoreTicks.max] : [avgTicks.min, avgTicks.max]}
                                    ticks={trendType === 'rscore' ? rScoreTicks.ticks : avgTicks.ticks}
                                />
                                {trendDepts.map((dept, i) => (
                                    <Line
                                        key={dept.id}
                                        type="monotone"
                                        dataKey={trendType === 'rscore' ? `${dept.id}_RScore` : `${dept.id}_AvgScore`}
                                        name={dept.name}
                                        hide={hiddenLines.includes(dept.id)}
                                        stroke={dept.id === selectedDept ? '#e74c3c' : COLORS[i % COLORS.length]}
                                        strokeWidth={dept.id === selectedDept ? 4 : 2}
                                        dot={dept.id === selectedDept}
                                    />
                                ))}
                            </>
                        )}
                        <Tooltip content={<CustomTooltip />} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 💡 互動圖例區 */}
            {trendType !== 'rscore_avgscore' && (
                <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '10px', userSelect: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: '#2c3e50' }}>校系對照（點擊可切換顯示）</h4>
                        <button onClick={toggleAllSupporters} style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {hiddenLines.length > 0 ? '顯示全部' : '隱藏全部'}
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                        {trendDepts.map((dept, index) => {
                            const isHidden = hiddenLines.includes(dept.id);
                            const color = dept.id === selectedDept ? '#e74c3c' : COLORS[index % COLORS.length];
                            return (
                                <div key={dept.id} onClick={() => toggleLine(dept.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', cursor: 'pointer', opacity: isHidden ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color, marginRight: '8px', flexShrink: 0 }} />
                                    <span style={{ textDecoration: isHidden ? 'line-through' : 'none', color: '#444', display: 'flex', flexDirection: 'column' }}>
                                        {dept.name.split(' ').map((line, i) => (
                                            <span key={i}>{line}</span>
                                        ))}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrendChart;