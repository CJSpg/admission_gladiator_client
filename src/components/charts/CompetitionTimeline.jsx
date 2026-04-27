import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

const COLORS = [
    '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e', '#d35400',
    '#8e44ad', '#27ae60', '#2980b9', '#f39c12', '#16a085', '#ff9ff3', '#00d2d3', '#7f8c8d'
];

const CompetitionTimeline = ({ timelineRankData, trendDepts, selectedDept, myLabel }) => {

    // 1. 格式化資料給 Recharts 使用
    const chartData = timelineRankData.map(d => ({
        name: d.year,
        ...d.ranks
    }));

    // 2. 找出最大排名（決定 Y 軸範圍）
    const maxRank = Math.max(...timelineRankData.map(d => d.totalCount), 5);

    return (
        <div className="chart-wrapper">
            <h3 style={{ marginBottom: '10px' }}>⚔️ 競爭群體歷年排名遞移 (Bump Chart)</h3>
            <p style={{ fontSize: '13px', color: '#7f8c8d', textAlign: 'center', marginBottom: '20px' }}>
                💡 越往上代表排名越高。若線條中斷，代表該年度該校未進入競爭圈。
            </p>

            <div style={{ width: '100%', height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />

                        {/* 💡 關鍵：reversed={true} 讓第 1 名在最上面 */}
                        <YAxis
                            reversed={true}
                            domain={[1, maxRank]}
                            tickCount={maxRank}
                            tick={{ fontSize: 12 }}
                            label={{ value: '相對排名', angle: -90, position: 'insideLeft', offset: -5 }}
                        />

                        <Tooltip
                            formatter={(value, name) => {
                                const dept = trendDepts.find(td => td.id === name);
                                return [`第 ${value} 名`, dept ? dept.name : name];
                            }}
                        />

                        {trendDepts.map((dept, i) => {
                            const isMain = dept.id === selectedDept;
                            return (
                                <Line
                                    key={dept.id}
                                    type="monotone"
                                    dataKey={dept.id}
                                    name={dept.id}
                                    stroke={isMain ? '#e74c3c' : COLORS[i % COLORS.length]}
                                    strokeWidth={isMain ? 5 : 2}
                                    dot={{ r: isMain ? 6 : 3, fill: isMain ? '#e74c3c' : COLORS[i % COLORS.length] }}
                                    activeDot={{ r: 8 }}
                                    connectNulls={false} // 線條中斷代表消失
                                    opacity={isMain ? 1 : 0.4} // 非本系透明度降低，減少干擾
                                />
                            );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 3. 競爭群體組成分析表 */}
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fdfefe', borderRadius: '8px', border: '1px solid #ebf2f3' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>📊 群體變動分析</h4>
                <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                    {timelineRankData.length >= 2 && (() => {
                        const lastYear = timelineRankData[timelineRankData.length - 2];
                        const thisYear = timelineRankData[timelineRankData.length - 1];

                        const lastIds = Object.keys(lastYear.ranks);
                        const thisIds = Object.keys(thisYear.ranks);

                        const news = thisIds.filter(id => !lastIds.includes(id));
                        const leavers = lastIds.filter(id => !thisIds.includes(id));

                        return (
                            <>
                                <div style={{ color: '#27ae60' }}>✨ <strong>新進競爭者：</strong>
                                    {news.length ? news.map(id => trendDepts.find(t => t.id === id)?.name).join('、') : '無'}
                                </div>
                                <div style={{ color: '#e67e22' }}>🏃 <strong>退出競爭圈：</strong>
                                    {leavers.length ? leavers.map(id => trendDepts.find(t => t.id === id)?.name).join('、') : '無'}
                                </div>
                                <div style={{ color: '#2c3e50', marginTop: '5px', borderTop: '1px dashed #ccc', paddingTop: '5px' }}>
                                    🚩 <strong>戰略地位：</strong> {myLabel} 今年排名第 {thisYear.ranks[selectedDept]} / {thisYear.totalCount}
                                    {lastYear.ranks[selectedDept] && (
                                        <span> (去年第 {lastYear.ranks[selectedDept]}，{thisYear.ranks[selectedDept] > lastYear.ranks[selectedDept] ? '📉 退步' : '📈 進步'})</span>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default CompetitionTimeline;