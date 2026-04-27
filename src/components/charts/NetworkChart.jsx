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

    return (
        <div className="vis-container-wrapper" style={{ display: activeTab === 'network' ? 'block' : 'none' }}>
            <div ref={visJsRef} className="vis-graph-container" />
        </div>
    );
};

export default NetworkChart;