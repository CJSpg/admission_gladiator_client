import React, { useMemo } from 'react';

const FlowTable = ({ graphData, selectedDept, rankings }) => {
    // 💡 利用 useMemo 計算流入與流出資料，避免重複運算
    const { outflow, inflow } = useMemo(() => {
        const outMap = {};
        const inMap = {};

        if (!graphData || !graphData.edges) return { outflow: [], inflow: [] };

        graphData.edges.forEach(edge => {
            // 排除自己流向自己 (避免同系內的流動干擾對手判斷)
            if (edge.from === edge.to) return;
            // 排除平手的關係 (避免平手的干擾對手判斷)
            if (edge.drawn) return;

            // 流出：從本系流向其他系 (被誰拉走)
            if (edge.from === selectedDept) {
                // 使用累加的方式，因為 graphData 中可能會有重複連線被切分的狀況
                outMap[edge.to] = (outMap[edge.to] || 0) + (edge.value || 0);
            }

            // 流入：從其他系流向本系 (從誰拉來)
            if (edge.to === selectedDept) {
                inMap[edge.from] = (inMap[edge.from] || 0) + (edge.value || 0);
            }
        });

        // 將整理好的 Map 轉換為陣列，並加上校系名稱與排序
        const formatAndSort = (mapData) => {
            return Object.entries(mapData)
                .map(([id, count]) => {
                    const deptInfo = rankings.find(r => r.id === id);
                    return {
                        id,
                        name: deptInfo ? deptInfo.name.replace(/\n/g, ' ') : id,
                        count
                    };
                })
                .sort((a, b) => b.count - a.count); // 依照人數由多排到少
        };

        return {
            outflow: formatAndSort(outMap),
            inflow: formatAndSort(inMap)
        };
    }, [graphData, selectedDept, rankings]);

    return (
        <div className="chart-wrapper" style={{ padding: '10px' }}>
            <h3 style={{ marginBottom: '5px' }}>🔄 學生流動情報分析</h3>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#7f8c8d', marginBottom: '20px', marginTop: 0 }}>
                💡 追蹤真實的學生移動軌跡，精準界定主要競爭對手。
            </p>

            {/* 左右雙欄排版 */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* 左側：被拉走 (流出) */}
                <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#fdf2e9', border: '1px solid #fad7a1', borderRadius: '8px', padding: '15px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#d35400', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🏃</span> 流失學生
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                        {outflow.length === 0 ? (
                            <div style={{ color: '#95a5a6', fontSize: '13px', textAlign: 'center', padding: '20px' }}>無流出紀錄</div>
                        ) : (
                            outflow.map((item, index) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fff', padding: '12px 15px', borderRadius: '6px', border: '1px solid #fdebd0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ color: '#d35400', fontWeight: 'bold', width: '22px', flexShrink: 0 }}>{index + 1}.</span>
                                        <span style={{ fontSize: '14px', color: '#2c3e50', lineHeight: '1.4' }}>{item.name}</span>
                                    </div>
                                    <strong style={{ color: '#e74c3c', flexShrink: 0, marginLeft: '10px', fontSize: '15px' }}>{item.count} 人</strong>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 右側：拉過來 (流入) */}
                <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#eafaf1', border: '1px solid #abebc6', borderRadius: '8px', padding: '15px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#27ae60', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>🧲</span> 吸收學生
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                        {inflow.length === 0 ? (
                            <div style={{ color: '#95a5a6', fontSize: '13px', textAlign: 'center', padding: '20px' }}>無流入紀錄</div>
                        ) : (
                            inflow.map((item, index) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fff', padding: '12px 15px', borderRadius: '6px', border: '1px solid #d5f5e3', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ color: '#27ae60', fontWeight: 'bold', width: '22px', flexShrink: 0 }}>{index + 1}.</span>
                                        <span style={{ fontSize: '14px', color: '#2c3e50', lineHeight: '1.4' }}>{item.name}</span>
                                    </div>
                                    <strong style={{ color: '#2ecc71', flexShrink: 0, marginLeft: '10px', fontSize: '15px' }}>{item.count} 人</strong>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default FlowTable;