import { useState, useEffect, useMemo } from 'react';

// --- Percentile Rank Helper Functions ---
const parseNumber = (val) => {
    if (val === undefined || val === null || val === '--' || val === '') return null;
    const str = String(val).trim().replace(/,/g, '');
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
};

const calculatePercentileRank = (data, key, outputKey) => {
    if (!data || data.length === 0) return [];
    const result = data.map(item => ({ ...item, [outputKey]: null }));
    const validItems = data
        .map((item, index) => ({
            originalIndex: index,
            val: parseNumber(item[key])
        }))
        .filter(item => item.val !== null);

    const N = validItems.length;
    if (N === 0) return result;
    if (N === 1) {
        const itemIdx = validItems[0].originalIndex;
        result[itemIdx][outputKey] = 100;
        return result;
    }

    validItems.sort((a, b) => a.val - b.val);

    let i = 0;
    while (i < N) {
        let j = i;
        while (j < N && validItems[j].val === validItems[i].val) {
            j++;
        }
        const avgRank = (i + 1 + j) / 2;
        const pr = ((avgRank - 1) / (N - 1)) * 100;

        for (let k = i; k < j; k++) {
            validItems[k].pr = pr;
        }
        i = j;
    }

    validItems.forEach(item => {
        result[item.originalIndex][outputKey] = Number(item.pr.toFixed(2));
    });

    return result;
};

const getGroupName = (name) => {
    if (!name) return 'UNKNOWN';
    const parts = name.split('\n');
    return parts[2] ? parts[2].trim() : 'UNKNOWN';
};

const calculateAverageScorePercentileRank = (data, key, outputKey, dimension) => {
    if (!data || data.length === 0) return [];
    if (dimension !== 'group') {
        return calculatePercentileRank(data, key, outputKey);
    }
    const groups = {};
    data.forEach((item, index) => {
        const grp = getGroupName(item.name);
        if (!groups[grp]) {
            groups[grp] = [];
        }
        groups[grp].push({ item, index });
    });

    const result = data.map(item => ({ ...item, [outputKey]: null }));

    Object.keys(groups).forEach(grp => {
        const groupItems = groups[grp].map(g => g.item);
        const rankedGroupItems = calculatePercentileRank(groupItems, key, outputKey);

        groups[grp].forEach((g, idx) => {
            result[g.index][outputKey] = rankedGroupItems[idx][outputKey];
        });
    });

    return result;
};

export const useHistoricalData = (selectedDept, selectedDimension, years, graphData, rankings) => {
    const [historicalData, setHistoricalData] = useState([]);
    const [trendDepts, setTrendDepts] = useState([]);
    const [timelineRankDataState, setTimelineRankDataState] = useState([]);

    // 1. 取得歷年趨勢與對手連動資料
    useEffect(() => {
        if (!selectedDept || !selectedDimension || years.length === 0 || !graphData.nodes.length) return;

        const { edges: allEdges, nodes: allNodes } = graphData;

        // 這是「當前選擇年度」的連線，保留給折線圖使用
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
                // 同時抓取歷年的「成績單(rankings)」與「關聯圖(graph)」
                const promises = years.map(year =>
                    Promise.all([
                        fetch(`${import.meta.env.BASE_URL}rankings_${year}_${selectedDimension}.json`)
                            .then(res => res.ok ? res.json() : []),
                        fetch(`${import.meta.env.BASE_URL}graph_${year}_${selectedDimension}.json`)
                            .then(res => res.ok ? res.json() : null)
                    ]).then(([rankingData, yearGraphData]) => ({ year, rankingData, yearGraphData }))
                );

                const results = await Promise.all(promises);

                const parseScore = (val) => {
                    if (val === undefined || val === null || val === '--' || val === '') return null;
                    const num = Number(String(val).replace(/,/g, ''));
                    return isNaN(num) ? null : num;
                };

                const normalizeName = (name) => (name || "").replace(/\n/g, '').replace(/\s+/g, '').trim();

                const trendData = results.map(({ year, rankingData }) => {
                    const yearData = { name: `${year}學年` };

                    // Calculate percentile ranks for this year's rankings
                    let processedRankings = [];
                    if (rankingData && rankingData.length > 0) {
                        const rScorePrData = calculatePercentileRank(rankingData, 'r_score', 'r_score_pr');
                        processedRankings = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr', selectedDimension);
                    }

                    targetIds.forEach(id => {
                        const currentFullName = targetNamesMap[id] || idToName[id];
                        const normalizedCurrentName = normalizeName(currentFullName);
                        const deptData = processedRankings.find(d => normalizeName(d.name) === normalizedCurrentName);
                        if (deptData) {
                            yearData[`${id}_RScore`] = parseScore(deptData.r_score);
                            yearData[`${id}_AvgScore`] = parseScore(deptData.avg_score);
                            yearData[`${id}_AvgScorePR`] = parseScore(deptData.avg_score_pr);
                            yearData[`${id}_FlowRate`] = deptData.flow_rate !== undefined ? Number((parseScore(deptData.flow_rate) * 100).toFixed(1)) : null;
                        } else {
                            yearData[`${id}_RScore`] = null;
                            yearData[`${id}_AvgScore`] = null;
                            yearData[`${id}_AvgScorePR`] = null;
                            yearData[`${id}_FlowRate`] = null;
                        }
                    });
                    return yearData;
                });

                trendData.sort((a, b) => parseInt(a.name.replace(/\D/g, '')) - parseInt(b.name.replace(/\D/g, '')));
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

                // --- 區塊 B：計算給「競爭時間軸」用的資料 (✨ 真實動態的年度群體) ---
                const newTimelineData = [];

                results.forEach(({ year, rankingData, yearGraphData }) => {
                    if (!yearGraphData || !yearGraphData.edges || !yearGraphData.nodes) return;

                    // 1. 找出該年度真實跟 selectedDept (根據相同名稱解析出該年度 ID) 有連線的學校
                    const currentFullName = targetNamesMap[selectedDept] || idToName[selectedDept];
                    const normalizedCurrentName = normalizeName(currentFullName);
                    const deptThisYear = (rankingData || []).find(d => normalizeName(d.name) === normalizedCurrentName);
                    const yearDeptId = deptThisYear ? deptThisYear.id : null;

                    let yearTargetIds = new Set();
                    let yearEdges = [];
                    if (yearDeptId) {
                        yearEdges = yearGraphData.edges.filter(edge => edge.from === yearDeptId || edge.to === yearDeptId);
                        yearTargetIds.add(yearDeptId);
                        yearEdges.forEach(e => {
                            yearTargetIds.add(e.from);
                            yearTargetIds.add(e.to);
                        });
                    }

                    // 2. 準備該年度的名稱對照表
                    const yearNames = {};
                    const yearCompetitors = [];
                    yearGraphData.nodes.forEach(n => {
                        if (yearTargetIds.has(n.id)) {
                            const cleanName = n.label.replace(/\n/g, ' ');
                            yearNames[n.id] = cleanName;
                            yearCompetitors.push({ id: n.id, name: cleanName });
                        }
                    });

                    // 3. 取得這些真實對手在該年度的成績並排序
                    const rankingThisYear = yearCompetitors.map(dept => {
                        const normName = normalizeName(dept.name);
                        const deptData = (rankingData || []).find(d => normalizeName(d.name) === normName);
                        return {
                            id: dept.id,
                            name: dept.name,
                            score: deptData ? parseScore(deptData.r_score) : null
                        };
                    }).filter(d => d.score !== null).sort((a, b) => b.score - a.score);

                    // 4. 建立排名對照表與原始分數
                    const rankMap = {};
                    const rawScores = {};
                    rankingThisYear.forEach((d, index) => {
                        rankMap[d.id] = index + 1;
                        rawScores[`${d.id}_RScore`] = d.score;
                    });

                    newTimelineData.push({
                        year: `${year}學年`,
                        ranks: rankMap,
                        rawScores: rawScores,
                        names: yearNames, // ✨ 記錄當年度的真實名稱
                        activeIds: Array.from(yearTargetIds), // ✨ 記錄當年度真實連線的ID，作為退出/加入判斷依據
                        totalCount: rankingThisYear.length,
                        selectedDeptId: yearDeptId // ✨ 記錄該年度 selectedDept 的真實 ID
                    });
                });

                newTimelineData.sort((a, b) => parseInt(a.year.replace(/\D/g, '')) - parseInt(b.year.replace(/\D/g, '')));
                setTimelineRankDataState(newTimelineData);

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

    const singleFlowTicks = useMemo(() => {
        if (!historicalData.length || !selectedDept) return { ticks: [0, 25, 50, 75, 100] };
        let min = Infinity, max = -Infinity;
        historicalData.forEach(d => {
            const val = d[`${selectedDept}_FlowRate`];
            if (val != null) {
                min = Math.min(min, val);
                max = Math.max(max, val);
            }
        });
        if (min === Infinity) return { ticks: [0, 25, 50, 75, 100] };

        // 上限多5, 下限多5
        let tickMin = Math.max(0, Math.floor((min - 5) / 5) * 5);
        let tickMax = Math.min(100, Math.ceil((max + 5) / 5) * 5);

        // 如果數值完全相同
        if (tickMin === tickMax) {
            const adjustedMin = Math.max(0, tickMin - 10);
            const adjustedMax = Math.min(100, tickMax + 10);
            const ticks = [];
            const step = (adjustedMax - adjustedMin) / 4;
            for (let i = adjustedMin; i <= adjustedMax; i += step) {
                ticks.push(Math.round(i));
            }
            return { min: adjustedMin, max: adjustedMax, ticks };
        }

        const diff = tickMax - tickMin;
        let step = 5;
        if (diff > 40) {
            tickMin = Math.max(0, Math.floor((min - 5) / 10) * 10);
            tickMax = Math.min(100, Math.ceil((max + 5) / 10) * 10);
            step = 10;
        }

        const ticks = [];
        for (let i = tickMin; i <= tickMax; i += step) {
            ticks.push(i);
        }
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

    const timelineRankData = timelineRankDataState;

    return {
        historicalData,
        trendDepts,
        currentDeptInfo,
        avgTicks,
        rScoreTicks,
        singleRScoreTicks,
        singleAvgTicks,
        singleFlowTicks,
        scatterPlotData,
        healthData,
        timelineRankData
    };
};