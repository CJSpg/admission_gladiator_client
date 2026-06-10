import React, { useState, useEffect, useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea
} from 'recharts';

// --- Helper Functions ---

/**
 * Parses value to float, handling commas and invalid entries.
 * Returns null if parsing fails.
 */
export const parseNumber = (val) => {
    if (val === undefined || val === null || val === '--' || val === '') return null;
    const str = String(val).trim().replace(/,/g, '');
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
};

/**
 * Strips newlines, spaces and trims string for robust name comparison.
 */
export const normalizeName = (name) => {
    return (name || "").replace(/\n/g, '').replace(/\s+/g, '').trim();
};

/**
 * Calculates the Percentile Rank (PR) of a key field within dataset.
 * Handles ties using average rank logic.
 * PR = ((avgRank - 1) / (N - 1)) * 100
 */
export const calculatePercentileRank = (data, key, outputKey) => {
    if (!data || data.length === 0) return [];

    // Initialize result with a shallow copy of each item and set outputKey to null
    const result = data.map(item => ({ ...item, [outputKey]: null }));

    // Filter valid entries
    const validItems = data
        .map((item, index) => ({
            originalIndex: index,
            val: parseNumber(item[key])
        }))
        .filter(item => item.val !== null);

    const N = validItems.length;
    if (N === 0) {
        return result;
    }

    if (N === 1) {
        const itemIdx = validItems[0].originalIndex;
        result[itemIdx][outputKey] = 100;
        return result;
    }

    // Sort by key value ascending
    validItems.sort((a, b) => a.val - b.val);

    // Compute average ranks for ties
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

    // Add PR value back to the result dataset
    validItems.forEach(item => {
        result[item.originalIndex][outputKey] = Number(item.pr.toFixed(2));
    });

    return result;
};

/**
 * Extracts the exam group name from a department's name field in the 'group' dimension.
 * Expected format: "SchoolName\nDepartmentName\nGroupName"
 */
export const getGroupName = (name) => {
    if (!name) return 'UNKNOWN';
    const parts = name.split('\n');
    return parts[2] ? parts[2].trim() : 'UNKNOWN';
};

/**
 * Calculates the Average Score Percentile Rank (PR) in a potentially group-segregated manner.
 * If dimension is 'group', calculations are done *within* each respective exam group.
 * Otherwise, calculations are done globally.
 */
export const calculateAverageScorePercentileRank = (data, key, outputKey, dimension) => {
    if (!data || data.length === 0) return [];

    if (dimension !== 'group') {
        return calculatePercentileRank(data, key, outputKey);
    }

    // Partition logic for group dimension
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


/**
 * Classifies coordinates into quadrants and provides localized descriptions for Mode 1.
 * X axis: r_score_pr (50)
 * Y axis: avg_score_pr (50)
 */
export const getQuadrantRScoreAvg = (rScorePr, avgScorePr) => {
    if (rScorePr === null || avgScorePr === null || rScorePr === undefined || avgScorePr === undefined) {
        return { name: '資料不足', desc: '無法判斷招生象限' };
    }

    if (rScorePr >= 50 && avgScorePr >= 50) {
        return {
            name: '強勢落點型',
            desc: '目前本校系組位於「強勢落點型」象限，代表其 R-Score PR 與平均分數 PR 皆高於同年度、同維度之中位水準，顯示該校系組在招生市場中具有較佳競爭位置，且錄取學生分數品質亦相對較高，屬於招生落點表現較佳之類型。'
        };
    } else if (rScorePr >= 50 && avgScorePr < 50) {
        return {
            name: '競爭支撐型',
            desc: '目前本校系組位於「競爭支撐型」象限，代表其 R-Score PR 高於中位水準，但平均分數 PR 低於中位水準，顯示該校系組具備一定招生競爭位置，但錄取學生分數品質仍有提升空間。建議後續搭配錄取分數趨勢與招生效益分析，觀察是否存在分數品質未同步提升之現象。'
        };
    } else if (rScorePr < 50 && avgScorePr >= 50) {
        return {
            name: '分數支撐型',
            desc: '目前本校系組位於「分數支撐型」象限，代表其平均分數 PR 高於中位水準，但 R-Score PR 低於中位水準，顯示錄取學生分數品質相對不差，但整體招生競爭位置未同步提升。建議進一步搭配競爭關係網路與學生流動分析，檢視是否受到競爭校系或流動結構影響。'
        };
    } else {
        return {
            name: '落點弱勢型',
            desc: '目前本校系組位於「落點弱勢型」象限，代表其 R-Score PR 與平均分數 PR 皆低於同年度、同維度之中位水準，顯示招生競爭力與錄取學生分數品質皆相對弱勢，應列為招生策略優先檢討對象。'
        };
    }
};

/**
 * Classifies coordinates into quadrants and provides localized descriptions for Mode 2.
 * X axis: zheng_effect_percent (50)
 * Y axis: yield_rate_percent (50)
 */
export const getQuadrantEffectYield = (zhengEffect, yieldRate) => {
    if (zhengEffect === null || yieldRate === null || zhengEffect === undefined || yieldRate === undefined) {
        return { name: '資料不足', desc: '無法判斷招生象限' };
    }
    const zhengThreshold = 50;
    const yieldThreshold = 50;

    if (zhengEffect >= zhengThreshold && yieldRate >= yieldThreshold) {
        return {
            name: '高效穩定型',
            desc: '目前本校系組位於「高效穩定型」象限，代表其正取有效性與報到率皆高於設定標準。這顯示正取學生有極高意願就讀，且最終報到狀況非常穩定，招生精準度與吸引力皆表現優異。'
        };
    } else if (zhengEffect < zhengThreshold && yieldRate >= yieldThreshold) {
        return {
            name: '備取依賴型',
            desc: '目前本校系組位於「備取依賴型」象限，代表報到率達到穩定標準，但正取有效性較低。這顯示大部分正取學生流失，但透過備取遞補成功填滿名額。建議檢視招生定位，或調整正備取倍率與篩選標準。'
        };
    } else if (zhengEffect >= zhengThreshold && yieldRate < yieldThreshold) {
        return {
            name: '精準但不足型',
            desc: '目前本校系組位於「精準但不足型」象限，代表正取有效性高，但最終報到率未達穩定標準。這顯示雖然錄取的學生報到意願高，但可能因為招生名額過多、備取人數不足或有缺額情形，導致整體報到率偏低。'
        };
    } else {
        return {
            name: '招生弱勢型',
            desc: '目前本校系組位於「招生弱勢型」象限，代表正取有效性與報到率皆未達標準。這顯示正取學生就讀意願低，且最終報到轉換狀況欠佳，屬於招生風險較高之校系，建議優先檢討招生策略與競爭對手關係。'
        };
    }
};

// --- Custom Tooltip Component ---

const CustomTooltip = ({ active, payload, selectedDept, mode }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (!data) return null;

        const isSelf = data.id === selectedDept;

        if (mode === 'rscore_avg') {
            const rScorePr = data.r_score_pr !== undefined ? data.r_score_pr : data.x;
            const avgScorePr = data.avg_score_pr !== undefined ? data.avg_score_pr : data.y;
            const quadrant = getQuadrantRScoreAvg(rScorePr, avgScorePr);

            return (
                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(224, 224, 224, 0.8)',
                    padding: '15px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    fontSize: '13px',
                    color: '#2c3e50',
                    minWidth: '260px'
                }}>
                    <div style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                        {data.name ? data.name.split('\n').map((line, i) => <div key={i}>{line}</div>) : '--'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>⚡ R-Score：<strong>{data.r_score != null ? data.r_score.toFixed(3) : '--'}</strong></div>
                        <div>📊 R-Score PR：<strong style={{ color: '#3498db' }}>{rScorePr != null ? rScorePr.toFixed(1) : '--'}</strong></div>
                        <div>📝 平均分數：<strong>{data.avg_score != null ? data.avg_score.toFixed(3) : '--'}</strong></div>
                        <div>⭐ 最低錄取平均分數 PR：<strong style={{ color: '#2ecc71' }}>{avgScorePr != null ? avgScorePr.toFixed(1) : '--'}</strong></div>
                        {isSelf ? (
                            <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>📍 目前選取校系組</div>
                        ) : (
                            <div style={{ color: '#475569', marginTop: '4px' }}>
                                🔗 與本校系組關聯權重：<strong>{data.relationWeight || 0}</strong>
                            </div>
                        )}
                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #eee', fontWeight: 'bold', color: '#e74c3c' }}>
                            📍 象限：{quadrant.name}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Mode: effect_yield
            const zhengEffectPercent = data.zheng_effect_percent !== undefined ? data.zheng_effect_percent : data.x;
            const yieldRatePercent = data.yield_rate_percent !== undefined ? data.yield_rate_percent : data.y;
            const quadrant = getQuadrantEffectYield(zhengEffectPercent, yieldRatePercent);

            return (
                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(224, 224, 224, 0.8)',
                    padding: '15px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    fontSize: '13px',
                    color: '#2c3e50',
                    minWidth: '260px'
                }}>
                    <div style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                        {data.name ? data.name.split('\n').map((line, i) => <div key={i}>{line}</div>) : '--'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>🛡️ 正取有效性：<strong style={{ color: '#2ecc71' }}>{zhengEffectPercent != null ? `${zhengEffectPercent.toFixed(1)}%` : '--'}</strong></div>
                        <div>📊 報到率：<strong style={{ color: '#3498db' }}>{yieldRatePercent != null ? `${yieldRatePercent.toFixed(1)}%` : '--'}</strong></div>
                        <div>⚡ R-Score：<strong>{data.r_score != null ? data.r_score.toFixed(3) : '--'}</strong></div>
                        <div>📝 平均分數：<strong>{data.avg_score != null ? data.avg_score.toFixed(3) : '--'}</strong></div>
                        {isSelf ? (
                            <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>📍 目前選取校系組</div>
                        ) : (
                            <div style={{ color: '#475569', marginTop: '4px' }}>
                                🔗 與本校系組關聯權重：<strong>{data.relationWeight || 0}</strong>
                            </div>
                        )}
                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #eee', fontWeight: 'bold', color: '#e74c3c' }}>
                            📍 象限：{quadrant.name}
                        </div>
                    </div>
                </div>
            );
        }
    }
    return null;
};

// --- Main Component ---

const PlacementQuadrantChart = ({
    mode: propsMode,
    setMode: propsSetMode,
    rankings,
    selectedDept,
    selectedDimension,
    years,
    currentYear,
    myLabel,
    graphData,
    trendDepts
}) => {
    // Mode switcher: 'rscore_avg' (R-score PR vs Avg Score PR) or 'effect_yield' (Zheng effect vs Yield rate)
    const [localMode, setLocalMode] = useState('rscore_avg');
    const mode = propsMode !== undefined ? propsMode : localMode;
    const setMode = propsSetMode !== undefined ? propsSetMode : setLocalMode;
    const [historicalPathRaw, setHistoricalPathRaw] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch and process historical data to build selected department's path
    useEffect(() => {
        let isCurrent = true;
        setHistoricalPathRaw([]); // Clear immediately when selectedDept changes

        if (!selectedDept || !selectedDimension || !years || years.length === 0) {
            return;
        }

        setLoadingHistory(true);
        const fetchHistory = async () => {
            try {
                // Find current department details for name matching
                const currentDeptItem = rankings?.find(r => r.id === selectedDept);
                const currentDeptName = currentDeptItem ? currentDeptItem.name : '';
                const normalizedCurrentName = normalizeName(currentDeptName);

                const promises = years.map(async (year) => {
                    try {
                        const res = await fetch(`${import.meta.env.BASE_URL}rankings_${year}_${selectedDimension}.json`);
                        if (!res.ok) return { year, data: null };
                        const data = await res.json();
                        return { year, data };
                    } catch (e) {
                        console.warn(`Could not load rankings for year ${year}`, e);
                        return { year, data: null };
                    }
                });

                const results = await Promise.all(promises);

                if (!isCurrent) return;

                const pathPoints = results
                    .map(({ year, data }) => {
                        if (!data || !Array.isArray(data)) return null;

                        // Recalculate PR in the context of this specific year for Mode 1
                        const rScorePrData = calculatePercentileRank(data, 'r_score', 'r_score_pr');
                        const bothPrData = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr', selectedDimension);

                        // Find the department by exact normalized name
                        const deptData = bothPrData.find(item => {
                            return normalizedCurrentName && normalizeName(item.name) === normalizedCurrentName;
                        });

                        if (!deptData) return null;

                        const rScorePr = parseNumber(deptData.r_score_pr);
                        const avgScorePr = parseNumber(deptData.avg_score_pr);
                        const yieldRate = parseNumber(deptData.yield_rate);
                        const zhengEffect = parseNumber(deptData.zheng_effect);

                        return {
                            year: String(year),
                            rScorePr,
                            avgScorePr,
                            zhengEffectPercent: zhengEffect !== null ? zhengEffect * 100 : null,
                            yieldRatePercent: yieldRate !== null ? yieldRate * 100 : null,
                            r_score: parseNumber(deptData.r_score),
                            avg_score: parseNumber(deptData.avg_score),
                            name: deptData.name,
                            id: deptData.id
                        };
                    })
                    .filter(Boolean);

                // Sort path by year chronologically
                pathPoints.sort((a, b) => {
                    const numA = parseInt(a.year.replace(/\D/g, ''), 10) || 0;
                    const numB = parseInt(b.year.replace(/\D/g, ''), 10) || 0;
                    return numA - numB;
                });

                if (isCurrent) {
                    setHistoricalPathRaw(pathPoints);
                }
            } catch (err) {
                console.error("Error loading history for PlacementQuadrantChart", err);
            } finally {
                if (isCurrent) {
                    setLoadingHistory(false);
                }
            }
        };

        fetchHistory();

        return () => {
            isCurrent = false;
        };
    }, [selectedDept, selectedDimension, years, rankings]);

    // Compute PR on current year rankings (Full rankings logic)
    const processedRankings = useMemo(() => {
        if (!rankings || rankings.length === 0) return [];

        const rScorePrData = calculatePercentileRank(rankings, 'r_score', 'r_score_pr');
        const bothPrData = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr', selectedDimension);

        return bothPrData
            .map(item => {
                const rScore = parseNumber(item.r_score);
                const avgScore = parseNumber(item.avg_score);
                const yieldRate = parseNumber(item.yield_rate);
                const zhengEffect = parseNumber(item.zheng_effect);

                return {
                    id: item.id,
                    name: item.name,
                    r_score: rScore,
                    avg_score: avgScore,
                    r_score_pr: item.r_score_pr,
                    avg_score_pr: item.avg_score_pr,
                    yield_rate: yieldRate,
                    zheng_effect: zhengEffect,
                    yield_rate_percent: yieldRate !== null ? yieldRate * 100 : null,
                    zheng_effect_percent: zhengEffect !== null ? zhengEffect * 100 : null,
                    flow_rate: parseNumber(item.flow_rate)
                };
            })
            .filter(Boolean);
    }, [rankings, selectedDimension]);

    // Filter to related rankings and limit displaying count
    const finalChartData = useMemo(() => {
        if (processedRankings.length === 0 || !selectedDept) return [];

        const relatedIds = new Set([selectedDept]);

        // 1. Build relatedIds based on trendDepts or graphData.edges
        if (trendDepts && trendDepts.length > 0) {
            trendDepts.forEach(d => {
                if (d.id) relatedIds.add(d.id);
            });
        } else if (graphData?.edges?.length) {
            graphData.edges.forEach(edge => {
                if (edge.from === selectedDept) relatedIds.add(edge.to);
                if (edge.to === selectedDept) relatedIds.add(edge.from);
            });
        }

        // 2. Build relationWeightMap based on graphData.edges
        const relationWeightMap = {};
        if (graphData?.edges?.length) {
            graphData.edges.forEach(edge => {
                const weight = parseNumber(edge.value) || 0;
                if (edge.from === selectedDept) {
                    relationWeightMap[edge.to] = (relationWeightMap[edge.to] || 0) + weight;
                }
                if (edge.to === selectedDept) {
                    relationWeightMap[edge.from] = (relationWeightMap[edge.from] || 0) + weight;
                }
            });
        }

        const mappedData = processedRankings
            .map(d => {
                let x = null;
                let y = null;

                if (mode === 'rscore_avg') {
                    x = d.r_score_pr;
                    y = d.avg_score_pr;
                } else {
                    x = d.zheng_effect_percent;
                    y = d.yield_rate_percent;
                }

                if (x === null || y === null) return null;

                return {
                    ...d,
                    relationWeight: relationWeightMap[d.id] || 0,
                    x,
                    y
                };
            })
            .filter(Boolean);

        const selectedPoint = mappedData.find(d => d.id === selectedDept);

        // Competitors filtered by relationship and sorted by weight descending, taking top 15
        const competitorPoints = mappedData
            .filter(d => d.id !== selectedDept && relatedIds.has(d.id))
            .sort((a, b) => (relationWeightMap[b.id] || 0) - (relationWeightMap[a.id] || 0))
            .slice(0, 15);

        return selectedPoint
            ? [selectedPoint, ...competitorPoints]
            : competitorPoints;
    }, [processedRankings, selectedDept, graphData, trendDepts, mode]);

    // Check basic availability of data
    if (!rankings || rankings.length === 0) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    四象限落點定位分析
                </h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    資料不足，無法產生四象限落點定位分析。
                </p>
            </div>
        );
    }

    const currentDept = rankings.find(r => r.id === selectedDept);
    if (selectedDept && !currentDept) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    四象限落點定位分析
                </h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    找不到目前選取校系組資料，無法產生四象限落點定位分析。
                </p>
            </div>
        );
    }

    if (currentDept) {
        if (mode === 'rscore_avg') {
            const rVal = parseNumber(currentDept.r_score);
            const aVal = parseNumber(currentDept.avg_score);
            if (rVal === null || aVal === null) {
                return (
                    <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                            R-Score 與最低錄取平均分數 PR 四象限落點分析
                        </h3>
                        <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                            目前選取校系組缺少 R-Score 或平均分數資料，無法進行落點分析。
                        </p>
                    </div>
                );
            }
        } else {
            const zVal = parseNumber(currentDept.zheng_effect);
            const yVal = parseNumber(currentDept.yield_rate);
            if (zVal === null || yVal === null) {
                return (
                    <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                            正取有效性與報到率四象限分析
                        </h3>
                        <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                            目前選取校系組缺少正取有效性或報到率資料，無法進行分析。
                        </p>
                    </div>
                );
            }
        }
    }

    if (finalChartData.length === 0) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    四象限落點定位分析
                </h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    資料不足，無法產生四象限分析圖表。
                </p>
            </div>
        );
    }

    // Split points into current selection and the rest
    const otherPoints = finalChartData.filter(item => item.id !== selectedDept);
    const currentDeptPoint = finalChartData.find(item => item.id === selectedDept);

    // Current quadrant info
    const quadrantInfo = currentDeptPoint
        ? (mode === 'rscore_avg'
            ? getQuadrantRScoreAvg(currentDeptPoint.x, currentDeptPoint.y)
            : getQuadrantEffectYield(currentDeptPoint.x, currentDeptPoint.y))
        : null;

    // Convert historicalPathRaw to specific mode coordinates
    const historicalPath = historicalPathRaw
        .map(point => {
            const x = mode === 'rscore_avg' ? point.rScorePr : point.zhengEffectPercent;
            const y = mode === 'rscore_avg' ? point.avgScorePr : point.yieldRatePercent;
            if (x === null || y === null) return null;
            return {
                ...point,
                x,
                y
            };
        })
        .filter(Boolean);

    // Generate YoY movement analysis
    const generateTrendAnalysis = (path, currentMode) => {
        if (!path || path.length < 2) return null;

        const earliest = path[0];
        const latest = path[path.length - 1];

        const threshold = 1.0;

        if (currentMode === 'rscore_avg') {
            const deltaX = latest.rScorePr - earliest.rScorePr;
            const deltaY = latest.avgScorePr - earliest.avgScorePr;
            const xFlat = Math.abs(deltaX) < threshold;
            const yFlat = Math.abs(deltaY) < threshold;

            let analysis = "";
            if (xFlat && yFlat) {
                analysis = "招生競爭力與錄取分數品質均呈現持平穩定態勢。";
            } else if (xFlat) {
                analysis = `招生競爭力（R-Score PR）呈現持平，而平均分數 PR ${deltaY > 0 ? "提升" : "下降"}，整體招生定位呈現${deltaY > 0 ? "穩定偏好" : "待加強"}。`;
            } else if (yFlat) {
                analysis = `平均分數 PR 呈現持平，而招生競爭力（R-Score PR）${deltaX > 0 ? "提升" : "下降"}，顯示整體招生競爭位置${deltaX > 0 ? "改善" : "轉弱"}。`;
            } else if (deltaX > 0 && deltaY > 0) {
                analysis = "招生競爭力與錄取分數品質同步提升，整體落點朝正向發展。";
            } else if (deltaX > 0 && deltaY < 0) {
                analysis = "R-Score PR 提升，代表招生競爭位置改善，但平均分數 PR 下降，顯示整體競爭力提升未完全反映在錄取分數品質上，需進一步檢視招生來源與學生組成。";
            } else if (deltaX < 0 && deltaY > 0) {
                analysis = "平均分數 PR 提升，但 R-Score PR 下降，表示錄取分數品質尚有支撐，但整體招生競爭位置轉弱，可能受到競爭校系、學生流動或市場偏好變化影響。";
            } else if (deltaX < 0 && deltaY < 0) {
                analysis = "招生競爭力與錄取分數品質皆下降，整體落點朝弱勢方向移動，應優先檢討招生策略。";
            }

            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：${analysis}（R-Score PR ${deltaX > 0 ? '提升' : '變化'} ${deltaX.toFixed(1)}，平均分數 PR ${deltaY > 0 ? '提升' : '變化'} ${deltaY.toFixed(1)}）`
            };
        } else {
            // Mode: effect_yield
            const deltaX = latest.zhengEffectPercent - earliest.zhengEffectPercent;
            const deltaY = latest.yieldRatePercent - earliest.yieldRatePercent;
            const xFlat = Math.abs(deltaX) < threshold;
            const yFlat = Math.abs(deltaY) < threshold;

            let analysis = "";
            if (xFlat && yFlat) {
                analysis = "正取有效性與報到率均呈現持平穩定態勢。";
            } else if (xFlat) {
                analysis = `正取有效性呈現持平，而報到率 ${deltaY > 0 ? "提升" : "下降"}，招生穩定度呈現${deltaY > 0 ? "改善" : "轉弱"}。`;
            } else if (yFlat) {
                analysis = `報到率呈現持平，而正取有效性 ${deltaX > 0 ? "提升" : "下降"}，顯示正取生就讀意願${deltaX > 0 ? "提高" : "降低"}。`;
            } else if (deltaX > 0 && deltaY > 0) {
                analysis = "正取有效性與報到率同步提升，招生精準度與轉換效益朝正向發展。";
            } else if (deltaX > 0 && deltaY < 0) {
                analysis = "正取有效性提升，但報到率下降，顯示正取生雖然就讀意願高，但可能因為備取名額不足或缺額，使得最終報到率偏低。";
            } else if (deltaX < 0 && deltaY > 0) {
                analysis = "報到率提升，但正取有效性下降，顯示正取生流失較多，但成功透過備取遞補穩定了報到率，對備取之依賴度增加。";
            } else if (deltaX < 0 && deltaY < 0) {
                analysis = "正取有效性與報到率皆下降，整體招生精準度與轉換率轉弱，建議檢討招生宣傳與正備取策略。";
            }

            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：${analysis}（正取有效性 ${deltaX > 0 ? '提升' : '變化'} ${deltaX.toFixed(1)}%，報到率 ${deltaY > 0 ? '提升' : '變化'} ${deltaY.toFixed(1)}%）`
            };
        }
    };

    const trendAnalysis = generateTrendAnalysis(historicalPath, mode);

    // Calculate dynamic domains and ticks depending on mode
    let xDomain, yDomain, xTicks, yTicks;

    if (mode === 'rscore_avg') {
        const allX = [
            ...finalChartData.map(d => d.x),
            ...historicalPath.map(d => d.x)
        ].filter(val => val !== null && val !== undefined);

        const allY = [
            ...finalChartData.map(d => d.y),
            ...historicalPath.map(d => d.y)
        ].filter(val => val !== null && val !== undefined);

        const minX = allX.length > 0 ? Math.min(...allX) : 0;
        const maxX = allX.length > 0 ? Math.max(...allX) : 100;
        const minY = allY.length > 0 ? Math.min(...allY) : 0;
        const maxY = allY.length > 0 ? Math.max(...allY) : 100;

        xDomain = [
            Math.max(0, Math.floor((minX - 5) / 5) * 5),
            Math.min(100, Math.ceil((maxX + 5) / 5) * 5)
        ];
        yDomain = [
            Math.max(0, Math.floor((minY - 5) / 5) * 5),
            Math.min(100, Math.ceil((maxY + 5) / 5) * 5)
        ];

        xTicks = [];
        for (let i = xDomain[0]; i <= xDomain[1]; i += 5) {
            xTicks.push(i);
        }

        yTicks = [];
        for (let i = yDomain[0]; i <= yDomain[1]; i += 5) {
            yTicks.push(i);
        }
    } else {
        // Mode: effect_yield (Keep full 0 - 100 scale, with standard ticks)
        xDomain = [0, 100];
        yDomain = [0, 100];
        xTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        yTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    }

    return (
        <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', padding: '10px' }}>
            {/* Header info */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#2c3e50', fontWeight: 'bold' }}>
                    {mode === 'rscore_avg' ? "R-Score 與最低錄取平均分數 PR 分佈落點分析" : "正取有效性與報到率四象限分析"}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#7f8c8d', lineHeight: '1.5' }}>
                    {mode === 'rscore_avg'
                        ? "僅顯示目前校系組及其直接競爭／流動關係校系組；PR 值仍以完整同年度資料計算。"
                        : "分析正取學生的就讀意願（正取有效性）與最終招生填滿度（報到率）之關係。"}
                </p>
            </div>

            {/* Premium Toggle Button Switcher */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
                <button
                    onClick={() => setMode('rscore_avg')}
                    style={{
                        padding: '8px 18px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: mode === 'rscore_avg' ? '#e74c3c' : '#fff',
                        color: mode === 'rscore_avg' ? '#fff' : '#64748b',
                        boxShadow: mode === 'rscore_avg' ? '0 4px 12px rgba(231, 76, 60, 0.2)' : 'none'
                    }}
                >
                    📍 R-Score 與最低錄取平均分數 PR
                </button>
                <button
                    onClick={() => setMode('effect_yield')}
                    style={{
                        padding: '8px 18px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: mode === 'effect_yield' ? '#e74c3c' : '#fff',
                        color: mode === 'effect_yield' ? '#fff' : '#64748b',
                        boxShadow: mode === 'effect_yield' ? '0 4px 12px rgba(231, 76, 60, 0.2)' : 'none'
                    }}
                >
                    🛡️ 正取有效性與報到率
                </button>
            </div>

            {/* Scatter Plot area */}
            <div style={{ width: '100%', height: '400px', minHeight: '400px', flexShrink: 0, position: 'relative', backgroundColor: '#fff', borderRadius: '12px', padding: '10px 10px 20px 10px', marginBottom: '20px' }}>
                {loadingHistory && (
                    <div style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        fontSize: '11px',
                        color: '#7f8c8d',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        zIndex: 10,
                        border: '1px solid #eee'
                    }}>
                        🔄 正在載入歷年軌跡...
                    </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

                        {/* X Axis */}
                        <XAxis
                            type="number"
                            dataKey="x"
                            name={mode === 'rscore_avg' ? "R-Score PR" : "正取有效性"}
                            domain={xDomain}
                            ticks={xTicks}
                            tickFormatter={(v) => mode === 'rscore_avg' ? Math.round(v) : `${Math.round(v)}%`}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{
                                value: mode === 'rscore_avg' ? 'R-Score PR' : '正取有效性（%）',
                                position: 'bottom',
                                offset: 5,
                                fontSize: 13,
                                fill: '#334155',
                                fontWeight: 'bold'
                            }}
                        />

                        {/* Y Axis */}
                        <YAxis
                            type="number"
                            dataKey="y"
                            name={mode === 'rscore_avg' ? "最低錄取平均分數 PR" : "報到率"}
                            domain={yDomain}
                            ticks={yTicks}
                            tickFormatter={(v) => mode === 'rscore_avg' ? Math.round(v) : `${Math.round(v)}%`}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{
                                value: mode === 'rscore_avg' ? '最低錄取平均分數 PR' : '報到率（%）',
                                angle: -90,
                                position: 'insideLeft',
                                offset: 0,
                                fontSize: 13,
                                fill: '#334155',
                                fontWeight: 'bold'
                            }}
                        />

                        {/* Conditional Quadrant backgrounds & dividers for effect_yield mode */}
                        {mode === 'effect_yield' && (
                            <>
                                {/* Top-Right */}
                                <ReferenceArea
                                    x1={50}
                                    x2={100}
                                    y1={50}
                                    y2={100}
                                    fill="rgba(46, 204, 113, 0.02)"
                                    label={{
                                        value: "高效穩定型",
                                        position: "insideTopRight",
                                        fill: "rgba(39, 174, 96, 0.45)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />
                                {/* Top-Left */}
                                <ReferenceArea
                                    x1={0}
                                    x2={50}
                                    y1={50}
                                    y2={100}
                                    fill="rgba(241, 196, 15, 0.02)"
                                    label={{
                                        value: "備取依賴型",
                                        position: "insideTopLeft",
                                        fill: "rgba(211, 84, 0, 0.45)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />
                                {/* Bottom-Right */}
                                <ReferenceArea
                                    x1={50}
                                    x2={100}
                                    y1={0}
                                    y2={50}
                                    fill="rgba(52, 152, 219, 0.02)"
                                    label={{
                                        value: "精準但不足型",
                                        position: "insideBottomRight",
                                        fill: "rgba(41, 128, 185, 0.45)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />
                                {/* Bottom-Left */}
                                <ReferenceArea
                                    x1={0}
                                    x2={50}
                                    y1={0}
                                    y2={50}
                                    fill="rgba(231, 76, 60, 0.02)"
                                    label={{
                                        value: "招生弱勢型",
                                        position: "insideBottomLeft",
                                        fill: "rgba(192, 57, 43, 0.45)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />

                                {/* Reference lines (Dividers) */}
                                <ReferenceLine x={50} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                                <ReferenceLine y={50} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                            </>
                        )}

                        {/* Tooltip */}
                        <Tooltip content={<CustomTooltip selectedDept={selectedDept} mode={mode} />} cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} />

                        {/* Scatter points for other related departments */}
                        <Scatter
                            name="其他校系"
                            data={otherPoints}
                            fill="#64748b"
                            fillOpacity={0.6}
                            shape="circle"
                            legendType="none"
                            isAnimationActive={false}
                        />

                        {/* Connected line & markers for historical path */}
                        {historicalPath.length >= 2 && (
                            <Scatter
                                name="歷年軌跡"
                                data={historicalPath}
                                fill="#e11d48"
                                line={{ stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4 4' }}
                                shape={(props) => {
                                    const { cx, cy, payload } = props;
                                    return (
                                        <g key={`hist-point-${payload.year}`}>
                                            <circle cx={cx} cy={cy} r={4.5} fill="#f43f5e" stroke="#fff" strokeWidth={1} />
                                            <text
                                                x={cx + 8}
                                                y={cy + 4}
                                                fontSize={10}
                                                fontWeight="bold"
                                                fill="#ef4444"
                                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                                            >
                                                {payload.year}
                                            </text>
                                        </g>
                                    );
                                }}
                                legendType="none"
                                isAnimationActive={false}
                            />
                        )}

                        {/* Highlighted current selection */}
                        {currentDeptPoint && (
                            <Scatter
                                name="目前選取校系"
                                data={[currentDeptPoint]}
                                fill="#ef4444"
                                shape={(props) => {
                                    const { cx, cy } = props;
                                    return (
                                        <g>
                                            <circle cx={cx} cy={cy} r={11} fill="none" stroke="#ef4444" strokeWidth={2} strokeOpacity={0.3} />
                                            <circle cx={cx} cy={cy} r={6.5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                                        </g>
                                    );
                                }}
                                legendType="none"
                                isAnimationActive={false}
                            />
                        )}
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {/* Warning when only self is in chart */}
            {finalChartData.length === 1 && (
                <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    color: '#64748b',
                    fontSize: '13px',
                    textAlign: 'center',
                    marginBottom: '15px'
                }}>
                    ℹ️ 目前僅找到本校系組資料，尚無直接競爭或流動關係校系組可供比較。
                </div>
            )}
        </div>
    );
};

export default PlacementQuadrantChart;
