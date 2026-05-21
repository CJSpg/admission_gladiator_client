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
 * Classifies coordinates into quadrants and provides localized descriptions.
 * X axis: r_score_pr
 * Y axis: avg_score_pr
 */
export const getQuadrant = (rScorePr, avgScorePr) => {
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
 * Formats a decimal ratio into a percentage string.
 */
export const formatPercent = (val) => {
    const num = parseNumber(val);
    if (num === null) return '--';
    return `${(num * 100).toFixed(1)}%`;
};

// --- Custom Tooltip Component ---

const CustomTooltip = ({ active, payload, selectedDept }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (!data) return null;

        const rScorePr = data.r_score_pr !== undefined ? data.r_score_pr : data.x;
        const avgScorePr = data.avg_score_pr !== undefined ? data.avg_score_pr : data.y;
        const quadrant = getQuadrant(rScorePr, avgScorePr);
        const isSelf = data.id === selectedDept;

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
                    <div>⭐ 平均分數 PR：<strong style={{ color: '#2ecc71' }}>{avgScorePr != null ? avgScorePr.toFixed(1) : '--'}</strong></div>
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
    return null;
};

// --- Main Component ---

const PlacementRScoreQuadrantChart = ({
    rankings,
    selectedDept,
    selectedDimension,
    years,
    currentYear,
    myLabel,
    graphData,
    trendDepts
}) => {
    const [historicalPath, setHistoricalPath] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch and process historical data to build selected department's path
    useEffect(() => {
        let isCurrent = true;
        setHistoricalPath([]); // Clear immediately when selectedDept changes

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

                        // Recalculate PR in the context of this specific year
                        const rScorePrData = calculatePercentileRank(data, 'r_score', 'r_score_pr');
                        const bothPrData = calculatePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr');

                        // Find the department by exact normalized name (since IDs are reused and unstable across years)
                        const deptData = bothPrData.find(item => {
                            return normalizedCurrentName && normalizeName(item.name) === normalizedCurrentName;
                        });

                        if (!deptData) return null;

                        const rScorePr = parseNumber(deptData.r_score_pr);
                        const avgScorePr = parseNumber(deptData.avg_score_pr);

                        if (rScorePr === null || avgScorePr === null) return null;

                        return {
                            year: String(year),
                            x: rScorePr,
                            y: avgScorePr,
                            r_score: parseNumber(deptData.r_score),
                            avg_score: parseNumber(deptData.avg_score),
                            yield_rate: parseNumber(deptData.yield_rate),
                            zheng_effect: parseNumber(deptData.zheng_effect),
                            flow_rate: parseNumber(deptData.flow_rate),
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
                    setHistoricalPath(pathPoints);
                }
            } catch (err) {
                console.error("Error loading history for PlacementRScoreQuadrantChart", err);
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

    // Log PR verification to console
    useEffect(() => {
        if (!rankings || rankings.length === 0) return;

        const rankingsWithRScorePR = calculatePercentileRank(rankings, 'r_score', 'r_score_pr');
        const rankingsWithBothPR = calculatePercentileRank(rankingsWithRScorePR, 'avg_score', 'avg_score_pr');

        console.table(
            rankingsWithBothPR
                .filter(d => d.r_score_pr != null && d.avg_score_pr != null)
                .sort((a, b) => b.r_score_pr - a.r_score_pr)
                .slice(0, 10)
                .map(d => ({
                    id: d.id,
                    name: d.name,
                    r_score: d.r_score,
                    r_score_pr: d.r_score_pr,
                    avg_score: d.avg_score,
                    avg_score_pr: d.avg_score_pr
                }))
        );

        if (selectedDept) {
            const selected = rankingsWithBothPR.find(d => d.id === selectedDept);
            console.log('selectedDept PR check:', {
                id: selected?.id,
                name: selected?.name,
                r_score: selected?.r_score,
                r_score_pr: selected?.r_score_pr,
                avg_score: selected?.avg_score,
                avg_score_pr: selected?.avg_score_pr
            });
        }
    }, [rankings, selectedDept]);

    // Compute PR on current year rankings (Full rankings logic)
    const processedRankings = useMemo(() => {
        if (!rankings || rankings.length === 0) return [];

        const rScorePrData = calculatePercentileRank(rankings, 'r_score', 'r_score_pr');
        const bothPrData = calculatePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr');

        return bothPrData
            .map(item => {
                const rScorePr = item.r_score_pr;
                const avgScorePr = item.avg_score_pr;
                const rScore = parseNumber(item.r_score);
                const avgScore = parseNumber(item.avg_score);

                // Exclude if either r_score or avg_score is missing (cannot plot without coords)
                if (rScore === null || avgScore === null || rScorePr === null || avgScorePr === null) {
                    return null;
                }

                const quad = getQuadrant(rScorePr, avgScorePr);

                return {
                    id: item.id,
                    name: item.name,
                    r_score: rScore,
                    avg_score: avgScore,
                    r_score_pr: rScorePr,
                    avg_score_pr: avgScorePr,
                    yield_rate: parseNumber(item.yield_rate),
                    zheng_effect: parseNumber(item.zheng_effect),
                    flow_rate: parseNumber(item.flow_rate),
                    quadrant: quad.name
                };
            })
            .filter(Boolean);
    }, [rankings]);

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

        const mappedData = processedRankings.map(d => ({
            ...d,
            relationWeight: relationWeightMap[d.id] || 0,
            x: d.r_score_pr,
            y: d.avg_score_pr
        }));

        const selectedPoint = mappedData.find(d => d.id === selectedDept);

        // Competitors filtered by relationship and sorted by weight descending, taking top 15
        const competitorPoints = mappedData
            .filter(d => d.id !== selectedDept && relatedIds.has(d.id))
            .sort((a, b) => (relationWeightMap[b.id] || 0) - (relationWeightMap[a.id] || 0))
            .slice(0, 15);

        return selectedPoint
            ? [selectedPoint, ...competitorPoints]
            : competitorPoints;
    }, [processedRankings, selectedDept, graphData, trendDepts]);

    // Check basic availability of data
    if (!rankings || rankings.length === 0) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    R-Score 與平均分數 PR 四象限落點分析
                </h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    資料不足，無法產生 R-Score 與平均分數 PR 四象限落點分析。
                </p>
            </div>
        );
    }

    const currentDept = rankings.find(r => r.id === selectedDept);
    if (selectedDept && !currentDept) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    R-Score 與平均分數 PR 四象限落點分析
                </h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    找不到目前選取校系組資料，無法產生四象限落點分析。
                </p>
            </div>
        );
    }

    if (currentDept) {
        const rVal = parseNumber(currentDept.r_score);
        const aVal = parseNumber(currentDept.avg_score);
        if (rVal === null || aVal === null) {
            return (
                <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                        R-Score 與平均分數 PR 四象限落點分析
                    </h3>
                    <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                        目前選取校系組缺少 R-Score 或平均分數資料，無法進行落點分析。
                    </p>
                </div>
            );
        }
    }

    if (finalChartData.length === 0) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    R-Score 與平均分數 PR 四象限落點分析
                </h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>
                    資料不足，無法產生 R-Score 與平均分數 PR 四象限落點分析。
                </p>
            </div>
        );
    }

    // Split points into current selection and the rest
    const otherPoints = finalChartData.filter(item => item.id !== selectedDept);
    const currentDeptPoint = finalChartData.find(item => item.id === selectedDept);

    // Current quadrant info
    const quadrantInfo = currentDeptPoint ? getQuadrant(currentDeptPoint.x, currentDeptPoint.y) : null;

    // Generate YoY movement analysis
    const generateTrendAnalysis = (path) => {
        if (!path || path.length < 2) return null;

        const earliest = path[0];
        const latest = path[path.length - 1];

        const deltaRScorePR = latest.x - earliest.x;
        const deltaAvgScorePR = latest.y - earliest.y;

        const threshold = 1.0;
        const rFlat = Math.abs(deltaRScorePR) < threshold;
        const aFlat = Math.abs(deltaAvgScorePR) < threshold;

        let analysis = "";

        if (rFlat && aFlat) {
            analysis = "招生競爭力與錄取分數品質均呈現持平穩定態勢。";
        } else if (rFlat) {
            analysis = `招生競爭力（R-Score PR）呈現持平，而平均分數 PR ${deltaAvgScorePR > 0 ? "提升" : "下降"}，整體招生定位呈現${deltaAvgScorePR > 0 ? "穩定偏好" : "待加強"}。`;
        } else if (aFlat) {
            analysis = `平均分數 PR 呈現持平，而招生競爭力（R-Score PR）${deltaRScorePR > 0 ? "提升" : "下降"}，顯示整體招生競爭位置${deltaRScorePR > 0 ? "改善" : "轉弱"}。`;
        } else if (deltaRScorePR > 0 && deltaAvgScorePR > 0) {
            analysis = "招生競爭力與錄取分數品質同步提升，整體落點朝正向發展。";
        } else if (deltaRScorePR > 0 && deltaAvgScorePR < 0) {
            analysis = "R-Score PR 提升，代表招生競爭位置改善，但平均分數 PR 下降，顯示整體競爭力提升未完全反映在錄取分數品質上，需進一步檢視招生來源與學生組成。";
        } else if (deltaRScorePR < 0 && deltaAvgScorePR > 0) {
            analysis = "平均分數 PR 提升，但 R-Score PR 下降，表示錄取分數品質尚有支撐，但整體招生競爭位置轉弱，可能受到競爭校系、學生流動或市場偏好變化影響。";
        } else if (deltaRScorePR < 0 && deltaAvgScorePR < 0) {
            analysis = "招生競爭力與錄取分數品質皆下降，整體落點朝弱勢方向移動，應優先檢討招生策略。";
        }

        return {
            earliestYear: earliest.year,
            latestYear: latest.year,
            deltaRScorePR,
            deltaAvgScorePR,
            analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：${analysis}（R-Score PR ${deltaRScorePR > 0 ? '提升' : '變化'} ${deltaRScorePR.toFixed(1)}，平均分數 PR ${deltaAvgScorePR > 0 ? '提升' : '變化'} ${deltaAvgScorePR.toFixed(1)}）`
        };
    };

    const trendAnalysis = generateTrendAnalysis(historicalPath);

    return (
        <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', padding: '10px' }}>
            {/* Header info */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#2c3e50', fontWeight: 'bold' }}>
                    R-Score 與平均分數 PR 四象限落點分析
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#7f8c8d', lineHeight: '1.5' }}>
                    僅顯示目前校系組及其直接競爭／流動關係校系組；PR 值仍以完整同年度資料計算。
                </p>
            </div>

            {/* Scatter Plot area - Wrapped in a fixed height container to prevent squash */}
            <div style={{ width: '100%', height: '450px', minHeight: '450px', flexShrink: 0, position: 'relative', backgroundColor: '#fff', borderRadius: '12px', padding: '10px 10px 20px 10px', marginBottom: '20px' }}>
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
                            name="R-Score PR"
                            domain={[0, 100]}
                            tickFormatter={(v) => Math.round(v)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{ value: 'R-Score PR', position: 'bottom', offset: 5, fontSize: 13, fill: '#334155', fontWeight: 'bold' }}
                        />

                        {/* Y Axis */}
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="平均分數 PR"
                            domain={[0, 100]}
                            tickFormatter={(v) => Math.round(v)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{ value: '平均分數 PR', angle: -90, position: 'insideLeft', offset: 0, fontSize: 13, fill: '#334155', fontWeight: 'bold' }}
                        />

                        {/* Quadrant backgrounds */}
                        {/* Top-Right: 強勢落點型 (x >= 50, y >= 50) */}
                        <ReferenceArea
                            x1={50}
                            x2={100}
                            y1={50}
                            y2={100}
                            fill="rgba(46, 204, 113, 0.02)"
                            label={{ value: "強勢落點型", position: "insideTopRight", fill: "rgba(39, 174, 96, 0.45)", fontSize: 11, fontWeight: "bold" }}
                        />
                        {/* Top-Left: 分數支撐型 (x < 50, y >= 50) */}
                        <ReferenceArea
                            x1={0}
                            x2={50}
                            y1={50}
                            y2={100}
                            fill="rgba(241, 196, 15, 0.02)"
                            label={{ value: "分數支撐型", position: "insideTopLeft", fill: "rgba(211, 84, 0, 0.45)", fontSize: 11, fontWeight: "bold" }}
                        />
                        {/* Bottom-Right: 競爭支撐型 (x >= 50, y < 50) */}
                        <ReferenceArea
                            x1={50}
                            x2={100}
                            y1={0}
                            y2={50}
                            fill="rgba(52, 152, 219, 0.02)"
                            label={{ value: "競爭支撐型", position: "insideBottomRight", fill: "rgba(41, 128, 185, 0.45)", fontSize: 11, fontWeight: "bold" }}
                        />
                        {/* Bottom-Left: 落點弱勢型 (x < 50, y < 50) */}
                        <ReferenceArea
                            x1={0}
                            x2={50}
                            y1={0}
                            y2={50}
                            fill="rgba(231, 76, 60, 0.02)"
                            label={{ value: "落點弱勢型", position: "insideBottomLeft", fill: "rgba(192, 57, 43, 0.45)", fontSize: 11, fontWeight: "bold" }}
                        />

                        {/* Reference lines (Dividers) */}
                        <ReferenceLine x={50} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                        <ReferenceLine y={50} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />

                        {/* Tooltip */}
                        <Tooltip content={<CustomTooltip selectedDept={selectedDept} />} cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} />

                        {/* Scatter points for other related departments */}
                        <Scatter
                            name="其他校系"
                            data={otherPoints}
                            fill="#64748b"
                            fillOpacity={0.6}
                            shape="circle"
                            legendType="none"
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

            {/* Analysis text cards at bottom - outside chart container to avoid compression */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {quadrantInfo && (
                    <div style={{
                        padding: '16px 20px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🎯 {myLabel || '本校系組'}招生落點定位分析
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                backgroundColor: quadrantInfo.name === '強勢落點型' ? '#eafaf1' :
                                    quadrantInfo.name === '競爭支撐型' ? '#e8f4fd' :
                                        quadrantInfo.name === '分數支撐型' ? '#fdf2e9' : '#fdedec',
                                color: quadrantInfo.name === '強勢落點型' ? '#27ae60' :
                                    quadrantInfo.name === '競爭支撐型' ? '#2980b9' :
                                        quadrantInfo.name === '分數支撐型' ? '#d35400' : '#e74c3c',
                                border: `1px solid ${quadrantInfo.name === '強勢落點型' ? '#2ecc71' :
                                    quadrantInfo.name === '競爭支撐型' ? '#3498db' :
                                        quadrantInfo.name === '分數支撐型' ? '#f1c40f' : '#e74c3c'
                                    }`,
                                whiteSpace: 'nowrap'
                            }}>
                                {quadrantInfo.name}
                            </span>
                            <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                                {quadrantInfo.desc}
                            </p>
                        </div>
                    </div>
                )}

                {trendAnalysis && (
                    <div style={{
                        padding: '16px 20px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🔄 歷年落點移動方向分析
                        </h4>
                        <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                            {trendAnalysis.analysisText}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlacementRScoreQuadrantChart;
