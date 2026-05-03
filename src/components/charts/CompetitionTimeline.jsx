import React, { useMemo, useState } from 'react';

const CompetitionTimeline = ({ timelineRankData, trendDepts, selectedDept, myLabel }) => {
    const [expandedYears, setExpandedYears] = useState({});

    const toggleYear = (year) => {
        setExpandedYears(prev => ({
            ...prev,
            [year]: !prev[year]
        }));
    };

    if (!timelineRankData || timelineRankData.length === 0) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>📊 正在計算競爭力時間軸...</div>;
    }

    const timelineNodes = useMemo(() => {
        return timelineRankData.map((data, index) => {
            let joined = [];
            let left = [];
            let rankChange = 0;

            if (index > 0) {
                const prevData = timelineRankData[index - 1];
                const prevIds = Object.keys(prevData.ranks);
                const currIds = Object.keys(data.ranks);

                const newIds = currIds.filter(id => !prevIds.includes(id));
                const leftIds = prevIds.filter(id => !currIds.includes(id));

                joined = newIds.map(id => trendDepts.find(d => d.id === id)?.name || id);
                left = leftIds.map(id => trendDepts.find(d => d.id === id)?.name || id);

                const prevRank = prevData.ranks[selectedDept];
                const currRank = data.ranks[selectedDept];
                if (prevRank && currRank) {
                    rankChange = prevRank - currRank;
                }
            }

            const sortedCompetitors = Object.entries(data.ranks)
                .sort((a, b) => a[1] - b[1])
                .map(([id, rank]) => {
                    const deptInfo = trendDepts.find(d => d.id === id);
                    return {
                        id,
                        rank,
                        name: deptInfo ? deptInfo.name : id,
                        isMe: id === selectedDept
                    };
                });

            return {
                ...data,
                joined,
                left,
                rankChange,
                myRank: data.ranks[selectedDept] || '--',
                sortedCompetitors
            };
        });
    }, [timelineRankData, trendDepts, selectedDept]);

    return (
        <div className="chart-wrapper">
            <h3 style={{ marginBottom: '5px' }}>⏳ 競爭群體演進時間軸</h3>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#7f8c8d', marginBottom: '20px', marginTop: 0 }}>
                💡 追蹤歷年競爭對手數量的變化、完整名單，以及 {myLabel} 在群體中的名次起伏。
            </p>

            <div style={{ display: 'flex', overflowX: 'auto', padding: '10px 10px 30px 10px', alignItems: 'flex-start', minHeight: '350px' }}>
                {timelineNodes.map((node, index) => {
                    const isExpanded = !!expandedYears[node.year];

                    return (
                        <React.Fragment key={node.year}>
                            {/* 區塊 A：過渡橋樑 */}
                            {index > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 15px', marginTop: '30px', minWidth: '220px' }}>
                                    <div style={{ width: '100%', height: '3px', backgroundColor: '#bdc3c7', position: 'relative', marginBottom: '15px' }}>
                                        <div style={{ position: 'absolute', right: '-6px', top: '-5px', width: '0', height: '0', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid #bdc3c7' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>

                                        {/* ✨ 新增區塊 */}
                                        {node.joined.length > 0 && (
                                            <div style={{ backgroundColor: '#eafaf1', border: '1px solid #2ecc71', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#27ae60' }}>
                                                <strong style={{ display: 'block', marginBottom: '6px' }}>✨ 新增 ({node.joined.length})</strong>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {node.joined.map((name, i) => {
                                                        // 💡 將文字依照空白或換行切開
                                                        const nameParts = (name || '').split(/[\n\s]+/).filter(Boolean);
                                                        return (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', lineHeight: '1.4' }}>
                                                                {/* 左邊：自訂圓點，固定寬度絕對不被壓縮 */}
                                                                <span style={{ flexShrink: 0, width: '14px', marginTop: '0px' }}>•</span>
                                                                {/* 右邊：文字區塊垂直排列 */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
                                                                    {nameParts.map((part, idx) => (
                                                                        <span key={idx}>{part}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* 🏃 退出區塊 */}
                                        {node.left.length > 0 && (
                                            <div style={{ backgroundColor: '#fdf2e9', border: '1px solid #e67e22', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#d35400' }}>
                                                <strong style={{ display: 'block', marginBottom: '6px' }}>🏃 退出 ({node.left.length})</strong>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {node.left.map((name, i) => {
                                                        // 💡 將文字依照空白或換行切開
                                                        const nameParts = (name || '').split(/[\n\s]+/).filter(Boolean);
                                                        return (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', lineHeight: '1.4' }}>
                                                                {/* 左邊：自訂圓點，固定寬度絕對不被壓縮 */}
                                                                <span style={{ flexShrink: 0, width: '14px', marginTop: '0px' }}>•</span>
                                                                {/* 右邊：文字區塊垂直排列 */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
                                                                    {nameParts.map((part, idx) => (
                                                                        <span key={idx}>{part}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {node.joined.length === 0 && node.left.length === 0 && (
                                            <div style={{ fontSize: '12px', color: '#95a5a6', textAlign: 'center', backgroundColor: '#f4f6f6', padding: '8px', borderRadius: '6px' }}>
                                                該年度群體無變動
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 區塊 B：年份卡片 */}
                            <div style={{ flexShrink: 0, width: '240px', backgroundColor: '#fff', border: '2px solid #3498db', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: '#3498db', color: '#fff', textAlign: 'center', padding: '12px', fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px' }}>
                                    {node.year}
                                </div>

                                <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ borderBottom: '1px solid #ecf0f1', paddingBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#7f8c8d', fontSize: '13px', fontWeight: 'bold' }}>競爭總數</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <strong style={{ fontSize: '20px', color: '#2c3e50' }}>{node.totalCount} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#7f8c8d' }}>校系</span></strong>
                                                <button
                                                    onClick={() => toggleYear(node.year)}
                                                    style={{ fontSize: '12px', padding: '2px 6px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: isExpanded ? '#ecf0f1' : '#fff', color: '#333' }}
                                                >
                                                    {isExpanded ? '▲ 收合' : '▼ 明細'}
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ marginTop: '10px', backgroundColor: '#f9f9f9', padding: '8px 10px', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #eee' }}>
                                                {node.sortedCompetitors.map(c => {
                                                    const nameParts = (c.name || '').split(/[\n\s]+/).filter(Boolean);

                                                    return (
                                                        <div
                                                            key={c.id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'flex-start',
                                                                fontSize: '12px',
                                                                color: c.isMe ? '#e74c3c' : '#555',
                                                                fontWeight: c.isMe ? 'bold' : 'normal',
                                                                marginBottom: '8px',
                                                                lineHeight: '1.4',
                                                                borderBottom: c.isMe ? '1px dashed #fadbd8' : '1px dashed #eee',
                                                                paddingBottom: '6px'
                                                            }}
                                                        >
                                                            <span style={{ flexShrink: 0, width: '28px', color: c.isMe ? '#e74c3c' : '#999', marginTop: '1px' }}>
                                                                #{c.rank}
                                                            </span>

                                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
                                                                {nameParts.map((part, i) => (
                                                                    <span key={i}>{part}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#7f8c8d', fontSize: '13px', fontWeight: 'bold', marginTop: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {myLabel}排名
                                        </span>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '10px' }}>
                                            <strong style={{ fontSize: '24px', color: '#e74c3c', whiteSpace: 'nowrap' }}>
                                                第 {node.myRank} 名
                                            </strong>

                                            {index > 0 && node.rankChange !== 0 && (
                                                <div style={{ fontSize: '13px', color: node.rankChange > 0 ? '#27ae60' : '#c0392b', marginTop: '6px', fontWeight: 'bold', backgroundColor: node.rankChange > 0 ? '#eafaf1' : '#fdedec', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                    {node.rankChange > 0 ? `▲ 進步 ${node.rankChange} 名` : `▼ 退步 ${Math.abs(node.rankChange)} 名`}
                                                </div>
                                            )}
                                            {index > 0 && node.rankChange === 0 && (
                                                <div style={{ fontSize: '13px', color: '#7f8c8d', marginTop: '6px', backgroundColor: '#f4f6f6', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                                    持平
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default CompetitionTimeline;