import React, { useMemo, useState, useEffect } from 'react';

const normalizeName = (name) => {
    return (name || "").replace(/\n/g, '').replace(/\s+/g, '').trim();
};

const CompetitionTimeline = ({ timelineRankData, trendDepts, selectedDept, myLabel, currentYear, setSelectedYear }) => {
    // 幻燈片當前頁面的索引值 (0 代表起始學年度)
    const [currentIndex, setCurrentIndex] = useState(0);

    // 計算 PR 值的公式：(1 - (名次 - 1) / 總數) * 100
    // 這樣能保證第一名必定是 PR 100，最後一名依據池子大小遞減，比名次更具指標性
    const computePR = (rank, total) => {
        if (!rank || !total) return 0;
        return Math.round((1 - (rank - 1) / total) * 100);
    };

    const timelineNodes = useMemo(() => {
        if (!timelineRankData || timelineRankData.length === 0) return [];

        return timelineRankData.map((data, index) => {
            let joined = [];
            let left = [];
            let unchanged = []; // 新增：沒有變動的校系
            let prChange = 0;
            const totalCount = data.totalCount || Object.keys(data.ranks).length;

            const currDeptId = data.selectedDeptId || selectedDept;
            const currRank = data.ranks[currDeptId];
            const myPR = currRank ? computePR(currRank, totalCount) : '--';

            // Helper to get name for the CURRENT year
            const getNameCurr = (id) => (data.names && data.names[id]) || trendDepts.find(d => d.id === id)?.name || id;

            if (index > 0) {
                const prevData = timelineRankData[index - 1];
                const prevTotalCount = prevData.totalCount || Object.keys(prevData.ranks).length;

                const prevIds = prevData.activeIds || Object.keys(prevData.ranks);
                const currIds = data.activeIds || Object.keys(data.ranks);

                const prevDeptId = prevData.selectedDeptId || selectedDept;

                // Helper to get name for the PREVIOUS year
                const getNamePrev = (id) => (prevData.names && prevData.names[id]) || trendDepts.find(d => d.id === id)?.name || id;

                // 獲取前一年與當前所有競爭對手的正規化中文名稱（使用各年獨立的對照表，避免跨年 ID 衝突）
                const prevNames = prevIds.map(id => normalizeName(getNamePrev(id)));
                const currNames = currIds.map(id => normalizeName(getNameCurr(id)));

                const currDeptName = normalizeName(getNameCurr(currDeptId));
                const prevDeptName = normalizeName(getNamePrev(prevDeptId));

                // 篩選出三種變動狀態（排除自己本身）
                // 1. 新增對手：在當前年度名單中，但不在前一年度名單中，且不是自己
                const newIds = currIds.filter(id => {
                    const name = normalizeName(getNameCurr(id));
                    return !prevNames.includes(name) && name !== currDeptName;
                });
                
                // 2. 退出對手：在前一年度名單中，但不在當前年度名單中，且不是自己
                const leftIds = prevIds.filter(id => {
                    const name = normalizeName(getNamePrev(id));
                    return !currNames.includes(name) && name !== prevDeptName;
                });

                // 3. 持平對手：在兩年名單中皆有出現，且不是自己
                const sameIds = currIds.filter(id => {
                    const name = normalizeName(getNameCurr(id));
                    return prevNames.includes(name) && name !== currDeptName;
                });

                joined = newIds.map(getNameCurr);
                left = leftIds.map(getNamePrev);
                unchanged = sameIds.map(getNameCurr);

                const prevRank = prevData.ranks[prevDeptId];
                if (prevRank && currRank) {
                    const prevPR = computePR(prevRank, prevTotalCount);
                    prChange = myPR - prevPR;
                }
            }

            // 轉換競爭對手清單，並改用 PR 值重新進行「由大到小」排序
            const sortedCompetitors = Object.entries(data.ranks)
                .map(([id, rank]) => {
                    const name = getNameCurr(id);
                    return {
                        id,
                        rank,
                        pr: computePR(rank, totalCount),
                        name,
                        isMe: id === currDeptId
                    };
                })
                .sort((a, b) => b.pr - a.pr); // PR 高的排在前面

            return {
                ...data,
                joined,
                left,
                unchanged,
                prChange,
                myPR,
                sortedCompetitors,
                totalCount
            };
        });
    }, [timelineRankData, trendDepts, selectedDept]);

    // 安全保護：當切換不同校系導致資料長度改變時，自動校正索引值
    useEffect(() => {
        if (timelineNodes.length > 0 && currentIndex >= timelineNodes.length) {
            setCurrentIndex(timelineNodes.length - 1);
        }
    }, [timelineNodes, currentIndex]);

    // 同步焦點年度到時間軸索引
    useEffect(() => {
        if (!currentYear || !timelineRankData || timelineRankData.length === 0) return;
        const index = timelineRankData.findIndex(data => data.year.replace('學年', '') === currentYear);
        if (index !== -1) {
            setCurrentIndex(index);
        }
    }, [currentYear, timelineRankData]);

    const handleYearChange = (newIndex) => {
        if (newIndex < 0 || newIndex >= timelineNodes.length) return;
        setCurrentIndex(newIndex);
        const newYearStr = timelineNodes[newIndex]?.year; // 例如 "112學年"
        if (newYearStr && setSelectedYear) {
            setSelectedYear(newYearStr.replace('學年', ''));
        }
    };

    if (!timelineRankData || timelineRankData.length === 0 || timelineNodes.length === 0) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>📊 正在計算競爭力時間軸...</div>;
    }

    const node = timelineNodes[currentIndex];

    return (
        <div className="chart-wrapper">
            <h3 style={{ marginBottom: '5px' }}>⏳ 競爭群體演進時間軸</h3>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#7f8c8d', marginBottom: '25px', marginTop: 0 }}>
                💡 追蹤歷年競爭對手組合演進、完整名單，以及 {myLabel} 在群體中的 PR 戰略定位起伏。
            </p>

            {/* 🎯 幻燈片控制按鈕區塊 */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '25px' }}>
                <button
                    disabled={currentIndex === 0}
                    onClick={() => handleYearChange(currentIndex - 1)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #3498db',
                        backgroundColor: currentIndex === 0 ? '#ecf0f1' : '#fff',
                        color: currentIndex === 0 ? '#count' : '#3498db',
                        cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s'
                    }}
                >
                    ◀ 上一學年
                </button>
                <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#2c3e50', minWidth: '80px', textAlign: 'center' }}>
                    {node.year}
                </span>
                <button
                    disabled={currentIndex === timelineNodes.length - 1}
                    onClick={() => handleYearChange(currentIndex + 1)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #3498db',
                        backgroundColor: currentIndex === timelineNodes.length - 1 ? '#ecf0f1' : '#fff',
                        color: currentIndex === timelineNodes.length - 1 ? '#count' : '#3498db',
                        cursor: currentIndex === timelineNodes.length - 1 ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s'
                    }}
                >
                    下一學年 ▶
                </button>
            </div>

            {/* 🎯 幻燈片主要內容看板 (左右並排) */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'stretch',
                gap: '25px',
                padding: '0 10px',
                minHeight: '360px',
                maxWidth: '780px',
                margin: '0 auto'
            }}>

                {/* 1. 左側資訊：變動情報區（寬度自適應佔滿左半邊） */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '240px' }}>
                    <div style={{ borderBottom: '2px solid #bdc3c7', paddingBottom: '6px', textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#34495e' }}>🔄 競爭群體異動情報</span>
                    </div>

                    {currentIndex === 0 ? (
                        // 起始年度特殊視覺提示
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#95a5a6', backgroundColor: '#f8f9fa', border: '1px dashed #bdc3c7', borderRadius: '8px', padding: '20px', textAlign: 'center', lineHeight: '1.6' }}>
                            📅 本學年為觀測波段的「起始起點」<br />無前一年度之變動軌跡可供比對。
                        </div>
                    ) : (
                        // 💡 放寬 maxHeight 限制，配合標籤雲設計，盡量一次展現
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>

                            {/* 🟡 新增區塊 (標籤雲排版) */}
                            {node.joined.length > 0 && (
                                <div style={{ backgroundColor: '#eafaf1', border: '1px solid #2ecc71', borderRadius: '8px', padding: '10px', color: '#27ae60' }}>
                                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>🟡 {node.year} 新增對手 ({node.joined.length})</strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {node.joined.map((name, i) => (
                                            <span key={i} style={{ backgroundColor: '#fff', border: '1px solid #82e0aa', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#1e8449', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                {(name || '').replace(/\n/g, ' ').trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 🔴 退出區塊 (標籤雲排版) */}
                            {node.left.length > 0 && (
                                <div style={{ backgroundColor: '#fdf2e9', border: '1px solid #e67e22', borderRadius: '8px', padding: '10px', color: '#d35400' }}>
                                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>🔴 {node.year} 退出競爭 ({node.left.length})</strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {node.left.map((name, i) => (
                                            <span key={i} style={{ backgroundColor: '#fff', border: '1px solid #f0b27a', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#ba4a00', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                {(name || '').replace(/\n/g, ' ').trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 🔘 持平未變動區塊 (標籤雲排版) */}
                            {node.unchanged.length > 0 && (
                                <div style={{ backgroundColor: '#f4f6f7', border: '1px solid #bdc3c7', borderRadius: '8px', padding: '10px', color: '#566573' }}>
                                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>🔘 穩定留存對手 ({node.unchanged.length})</strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {node.unchanged.map((name, i) => (
                                            <span key={i} style={{ backgroundColor: '#fff', border: '1px solid #d5d8dc', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#34495e', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                {(name || '').replace(/\n/g, ' ').trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. 右側資訊：學年度核心戰略卡片 (固定寬度 270px，維持視覺重心) */}
                <div style={{ flexShrink: 0, width: '270px', backgroundColor: '#fff', border: '2px solid #3498db', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#3498db', color: '#fff', textAlign: 'center', padding: '10px', fontWeight: 'bold', fontSize: '15px', letterSpacing: '1px' }}>
                        📊 {node.year} 戰況總覽
                    </div>

                    <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, justifyContent: 'space-between' }}>
                        {/* 上半部：競爭總數與直接開啟的名細 */}
                        <div style={{ borderBottom: '1px solid #ecf0f1', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: '#7f8c8d', fontSize: '13px', fontWeight: 'bold' }}>群體總數</span>
                                <strong style={{ fontSize: '18px', color: '#2c3e50' }}>{node.totalCount} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#7f8c8d' }}>個校系</span></strong>
                            </div>

                            {/* 💡 預設直接打開，維持原有的理想高度與滾動條機制 */}
                            <div style={{ backgroundColor: '#f9f9f9', padding: '8px 10px', borderRadius: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid #eee' }}>
                                {node.sortedCompetitors.map(c => (
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
                                        {/* 💡 排名標籤全面重構為 PR 值 */}
                                        <span style={{ flexShrink: 0, width: '52px', color: c.isMe ? '#e74c3c' : '#7f8c8d', fontWeight: 'bold' }}>
                                            PR {c.pr}
                                        </span>

                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
                                            {(c.name || '').split(/[\n\s]+/).filter(Boolean).map((part, i) => (
                                                <span key={i}>{part}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 下半部：本校系 PR 定位與變動趨勢 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ color: '#7f8c8d', fontSize: '13px', fontWeight: 'bold', marginTop: '4px', whiteSpace: 'nowrap' }}>
                                {myLabel}定位
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '10px' }}>
                                <strong style={{ fontSize: '24px', color: '#e74c3c', whiteSpace: 'nowrap' }}>
                                    PR {node.myPR}
                                </strong>

                                {/* {currentIndex > 0 && node.prChange !== 0 && (
                                    <div style={{ fontSize: '12px', color: node.prChange > 0 ? '#27ae60' : '#c0392b', marginTop: '6px', fontWeight: 'bold', backgroundColor: node.prChange > 0 ? '#eafaf1' : '#fdedec', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                        {node.prChange > 0 ? `▲ PR 提升 ${node.prChange} 點` : `▼ PR 下降 ${Math.abs(node.prChange)} 點`}
                                    </div>
                                )}
                                {currentIndex > 0 && node.prChange === 0 && (
                                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '6px', backgroundColor: '#f4f6f6', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                        PR 持平
                                    </div>
                                )} */}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default CompetitionTimeline;