import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(4px)', border: '1px solid rgba(224, 224, 224, 0.5)', padding: '12px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '13px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#2c3e50', borderBottom: '1px solid #ddd', paddingBottom: '14px' }}>
                    {String(label).split(' ').map((text, index) => <span key={index} style={{ display: 'block', marginBottom: '-10px' }}>{text}</span>)}
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

const HealthChart = ({ healthData }) => {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

    const metrics = [
        { key: 'yield_rate', label: '報到率', color: '#3498db' },
        { key: 'zheng_effect', label: '正取有效性', color: '#2ecc71' },
        { key: 'flow_rate', label: '流入登分比例', color: '#e74c3c' }
    ];

    const handleLegendClick = (key) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const sortedData = useMemo(() => {
        if (!sortConfig.key || !healthData) return healthData;

        return [...healthData].sort((a, b) => {
            const valA = a[sortConfig.key] || 0;
            const valB = b[sortConfig.key] || 0;
            return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
        });
    }, [healthData, sortConfig]);

    // 💡 空間優化：因為長條圖從 3 條變 2 條，我們把每個校系需要的高度從 65px 降到 50px
    const dynamicHeight = Math.max(400, (sortedData?.length || 0) * 50);

    return (
        <div className="chart-wrapper">
            <h3 style={{ marginBottom: '5px' }}>🛡️ 當年度招生效益比較</h3>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#7f8c8d', marginBottom: '15px', marginTop: 0 }}>
                💡 點擊下方圖例即可針對單一指標進行排序
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', paddingBottom: '15px' }}>
                {metrics.map((metric) => {
                    const isActive = sortConfig.key === metric.key;
                    return (
                        <div
                            key={metric.key}
                            onClick={() => handleLegendClick(metric.key)}
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', padding: '5px 10px', borderRadius: '6px', backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent', transition: 'background-color 0.2s' }}
                        >
                            <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: metric.color, marginRight: '8px' }} />
                            <span style={{ fontWeight: isActive ? 'bold' : 'normal', color: '#2c3e50', fontSize: '14px' }}>
                                {metric.label}
                                {isActive && (sortConfig.direction === 'desc' ? ' 🔽' : ' 🔼')}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div style={{ width: '100%', height: '450px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '10px' }}>
                <ResponsiveContainer width="100%" height={dynamicHeight}>
                    <BarChart layout="vertical" data={sortedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f0f0f0" />
                        <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 12, fill: '#34495e' }} interval={0} />
                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />

                        <Bar dataKey="yield_rate" name="報到率" stackId="a" fill="#3498db" radius={[4, 4, 4, 4]} barSize={15} />
                        <Bar dataKey="flow_rate" name="流入登分比例" stackId="a" fill="#e74c3c" radius={[4, 4, 4, 4]} barSize={15} />

                        <Bar dataKey="zheng_effect" name="正取有效性" fill="#2ecc71" radius={[4, 4, 4, 4]} barSize={15} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default HealthChart;