import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import 'vis-network/styles/vis-network.css';

const NetworkChart = ({ graphData, selectedDept, rankings, activeTab }) => {
    const visJsRef = useRef(null);
    const networkRef = useRef(null);

    const [showInflow, setShowInflow] = useState(true);
    const [showOutflow, setShowOutflow] = useState(true);
    const [showDraw, setShowDraw] = useState(true);

    useEffect(() => {
        if (!visJsRef.current || !selectedDept || activeTab !== 'network') return;
        const { nodes: allNodes, edges: allEdges } = graphData;
        const targetNode = allNodes.find(node => node.id === selectedDept);
        if (!targetNode) return;

        // 建立一個計數器，用來記錄「兩校之間」目前畫到第幾條線了
        const pairCountMap = {};

        // 處理連線：先過濾出跟本系有關的，再根據勾選狀態過濾，最後才設定樣式
        const connectedEdges = allEdges
            .filter(edge => edge.from === selectedDept || edge.to === selectedDept)
            // 新增：根據勾選的狀態進行過濾
            .filter(edge => {
                if (edge.drawn) {
                    return showDraw; // 雙方都沒選
                } else if (edge.from === selectedDept) {
                    return showOutflow; // 流出
                } else if (edge.to === selectedDept) {
                    return showInflow; // 流入
                }
                return false;
            })
            .map(edge => {
                const newEdge = { ...edge };
                delete newEdge.value; // 避免因為 value 太大導致線條粗到蓋住畫面

                // 產生兩校之間的唯一 Key (不分方向)
                const pairKey = [newEdge.from, newEdge.to].sort().join('_');
                // 將這對校系的連線數 +1
                pairCountMap[pairKey] = (pairCountMap[pairKey] || 0) + 1;
                const edgeIndex = pairCountMap[pairKey];

                // 手動賦予平行軌道的彎曲度 (0.15 -> 0.30 -> 0.45)
                newEdge.smooth = {
                    enabled: true,
                    type: 'curvedCW',
                    roundness: edgeIndex * 0.15 // 依序往外推，保證絕對不重疊
                };

                if (newEdge.drawn) {
                    // 🔘 雙方都沒選：同時錄取學生最後兩邊都沒選 (灰色虛線，無箭頭)
                    newEdge.color = { color: '#bdc3c7', highlight: '#95a5a6' };
                    newEdge.dashes = [5, 5];
                    newEdge.arrows = '';
                    newEdge.width = 1.5;
                } else {
                    // 真實發生流動 (有勝負)：實線，箭頭指向 Winner (to)
                    newEdge.dashes = false;
                    newEdge.arrows = 'to';

                    // 判斷是流入還是流出
                    if (newEdge.from === selectedDept) {
                        // 🔴 流失 (本系是 Loser)：紅色警戒線
                        newEdge.color = { color: '#e74c3c', highlight: '#c0392b', hover: '#c0392b' };
                        newEdge.width = 2.5;
                    } else if (newEdge.to === selectedDept) {
                        // 🟢 吸收 (本系是 Winner)：綠色戰果線
                        newEdge.color = { color: '#2ecc71', highlight: '#27ae60', hover: '#27ae60' };
                        newEdge.width = 2.5;
                    }
                }
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
            nodes: {
                shape: 'box',
                margin: 12,
                borderWidth: 2,
                font: {
                    face: 'Microsoft JhengHei',
                    align: 'center'
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.1)',
                    size: 5,
                    x: 2,
                    y: 2
                }
            },
            edges: {},
            physics: {
                enabled: true,
                solver: 'barnesHut',
                barnesHut: {
                    gravitationalConstant: -15000, // 萬有引力常數，數字越負越會被排斥
                    centralGravity: 0.3, // 越小越會往外飛
                    springLength: 260, // 稍微把彈簧拉長一點 (220->250)，讓線條跟箭頭更清楚
                    springConstant: 0.04, // 彈簧拉力，數字越小越鬆
                    damping: 0.2, // 越小越抖
                    avoidOverlap: 1 // 越小越會被推開
                },
                stabilization: {
                    enabled: true,
                    iterations: 300,
                    updateInterval: 25
                }
            },
            interaction: { hover: true, tooltipDelay: 200 }
        };
        networkRef.current = new Network(visJsRef.current, data, options);

        return () => {
            if (networkRef.current) {
                networkRef.current.destroy();
                networkRef.current = null;
            }
        };

    }, [selectedDept, graphData, activeTab, rankings, showInflow, showOutflow, showDraw]);

    return (
        <div className="vis-container-wrapper" style={{
            display: activeTab === 'network' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%'
        }}>
            <div className="network-filter-bar" style={{
                padding: '10px',
                display: 'flex',
                gap: '20px',
                justifyContent: 'center',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #ddd',
                borderRadius: '8px 8px 0 0'
            }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#27ae60' }}>
                    <input
                        type="checkbox"
                        checked={showInflow}
                        onChange={(e) => setShowInflow(e.target.checked)}
                    />
                    🟢 顯示流入
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#c0392b' }}>
                    <input
                        type="checkbox"
                        checked={showOutflow}
                        onChange={(e) => setShowOutflow(e.target.checked)}
                    />
                    🔴 顯示流出
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#7f8c8d' }}>
                    <input
                        type="checkbox"
                        checked={showDraw}
                        onChange={(e) => setShowDraw(e.target.checked)}
                    />
                    🔘 顯示雙方都沒選
                </label>
            </div>

            <div ref={visJsRef} className="vis-graph-container" style={{ flexGrow: 1, minHeight: '500px' }} />
        </div>
    );
};

export default NetworkChart;
