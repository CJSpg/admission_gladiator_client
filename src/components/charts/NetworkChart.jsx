import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import 'vis-network/styles/vis-network.css';

const NetworkChart = ({ graphData, selectedDept, rankings, activeTab }) => {
    const visJsRef = useRef(null);
    const networkRef = useRef(null);

    useEffect(() => {
        if (!visJsRef.current || !selectedDept || activeTab !== 'network') return;
        if (networkRef.current) {
            networkRef.current.destroy();
            networkRef.current = null;
        }
        const { nodes: allNodes, edges: allEdges } = graphData;
        const targetNode = allNodes.find(node => node.id === selectedDept);
        if (!targetNode) return;

        // 建立一個計數器，用來記錄「兩校之間」目前畫到第幾條線了
        const pairCountMap = {};

        // 處理連線樣式：根據 drawn 與流動方向給予不同的視覺暗示
        const connectedEdges = allEdges
            .filter(edge => edge.from === selectedDept || edge.to === selectedDept)
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
                    // 🔘 平手交集：兩個都沒去 (灰色虛線，無箭頭)
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
                        // 🩸 流失 (本系是 Loser)：紅色警戒線
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

            // 使用自訂的 smooth 設定，不要用預設的
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
    }, [selectedDept, graphData, activeTab, rankings]);

    return (
        <div className="vis-container-wrapper" style={{ display: activeTab === 'network' ? 'block' : 'none' }}>
            <div ref={visJsRef} className="vis-graph-container" />
        </div>
    );
};

export default NetworkChart;