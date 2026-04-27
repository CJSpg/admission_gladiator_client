import { useState, useEffect, useMemo } from 'react';

export const useHistoricalData = (selectedDept, selectedDimension, years, graphData, rankings) => {
    const [historicalData, setHistoricalData] = useState([]);
    const [trendDepts, setTrendDepts] = useState([]);

    // 1. 取得歷年趨勢與對手連動資料
    useEffect(() => {
        if (!selectedDept || !selectedDimension || years.length === 0 || !graphData.nodes.length) return;

        const { edges: allEdges, nodes: allNodes } = graphData;
        const connectedEdges = allEdges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
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
    }, [selectedDept, selectedDimension, years, graphData, rankings]);

    // 2. 取得當前校系資訊
    const currentDeptInfo = useMemo(() => rankings.find(dept => dept.id === selectedDept), [rankings, selectedDept]);

    // 3. 計算刻度 (Ticks)
    const avgTicks = useMemo(() => {
        if (!historicalData.length || !trendDepts.length) return { ticks: [] };
        let min = Infinity, max = -Infinity;
        historicalData.forEach(d => {
            trendDepts.forEach(dept => {
                const val = d[`${dept.id}_AvgScore`];
                if (val != null) { min = Math.min(min, val); max = Math.max(max, val); }
            });
        });
        if (min === Infinity) return { ticks: [] };
        const tickMin = Math.floor(min / 5) * 5;
        const tickMax = Math.ceil(max / 5) * 5;
        const ticks = [];
        for (let i = tickMin; i <= tickMax; i += 5) ticks.push(i);
        return { min: tickMin, max: tickMax, ticks };
    }, [historicalData, trendDepts]);

    const rScoreTicks = useMemo(() => {
        if (!historicalData.length || !trendDepts.length) return { ticks: [] };
        let min = Infinity, max = -Infinity;
        historicalData.forEach(d => {
            trendDepts.forEach(dept => {
                const val = d[`${dept.id}_RScore`];
                if (val != null) { min = Math.min(min, val); max = Math.max(max, val); }
            });
        });
        if (min === Infinity) return { ticks: [] };
        const tickMin = Math.floor(min / 5) * 5;
        const tickMax = Math.ceil(max / 5) * 5;
        const ticks = [];
        for (let i = tickMin; i <= tickMax; i += 5) ticks.push(i);
        return { min: tickMin, max: tickMax, ticks };
    }, [historicalData, trendDepts]);

    const singleRScoreTicks = useMemo(() => {
        if (!historicalData.length || !selectedDept) return { ticks: [] };
        let min = Infinity, max = -Infinity;
        historicalData.forEach(d => {
            const val = d[`${selectedDept}_RScore`];
            if (val != null) { min = Math.min(min, val); max = Math.max(max, val); }
        });
        if (min === Infinity) return { ticks: [] };
        const tickMin = Math.floor(min / 5) * 5;
        const tickMax = Math.ceil(max / 5) * 5;
        const ticks = [];
        for (let i = tickMin; i <= tickMax; i += 5) ticks.push(i);
        return { min: tickMin, max: tickMax, ticks };
    }, [historicalData, selectedDept]);

    const singleAvgTicks = useMemo(() => {
        if (!historicalData.length || !selectedDept) return { ticks: [] };
        let min = Infinity, max = -Infinity;
        historicalData.forEach(d => {
            const val = d[`${selectedDept}_AvgScore`];
            if (val != null) { min = Math.min(min, val); max = Math.max(max, val); }
        });
        if (min === Infinity) return { ticks: [] };
        const tickMin = Math.floor(min / 5) * 5;
        const tickMax = Math.ceil(max / 5) * 5;
        const ticks = [];
        for (let i = tickMin; i <= tickMax; i += 5) ticks.push(i);
        return { min: tickMin, max: tickMax, ticks };
    }, [historicalData, selectedDept]);

    // 4. 定位圖資料
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

    // 5. 招生效益比較資料
    const healthData = useMemo(() => {
        if (!currentDeptInfo || !trendDepts.length) return [];
        return trendDepts.map(dept => {
            const info = rankings.find(r => r.id === dept.id) || {};
            return {
                name: dept.name,
                yield_rate: info.yield_rate ? Number((info.yield_rate * 100).toFixed(1)) : 0,
                zheng_effect: info.zheng_effect ? Number((info.zheng_effect * 100).toFixed(1)) : 0,
                flow_rate: info.flow_rate ? Number((info.flow_rate * 100).toFixed(1)) : 0,
            };
        });
    }, [trendDepts, currentDeptInfo, rankings]);

    const timelineRankData = useMemo(() => {
        if (!historicalData.length || !trendDepts.length) return [];

        return historicalData.map(yearData => {
            const year = yearData.name;

            // 1. 抓出該年所有有分數的校系，並進行排序
            const rankingThisYear = trendDepts
                .map(dept => ({
                    id: dept.id,
                    name: dept.name,
                    // 根據 R-Score 排序 (你也可以之後改成可切換)
                    score: yearData[`${dept.id}_RScore`]
                }))
                .filter(d => d.score !== null) // 只算有出現的學校
                .sort((a, b) => b.score - a.score);

            // 2. 建立一個「校系 ID -> 排名」的對照表
            const rankMap = {};
            rankingThisYear.forEach((d, index) => {
                rankMap[d.id] = index + 1; // 排名從 1 開始
            });

            return {
                year,
                ranks: rankMap,
                totalCount: rankingThisYear.length,
                rawScores: yearData
            };
        });
    }, [historicalData, trendDepts]);

    return {
        historicalData,
        trendDepts,
        currentDeptInfo,
        avgTicks,
        rScoreTicks,
        singleRScoreTicks,
        singleAvgTicks,
        scatterPlotData,
        healthData,
        timelineRankData
    };
};