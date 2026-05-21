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
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? null : num;
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
export const calculatePercentileRank = (data, key) => {
    if (!data || data.length === 0) return [];

    // Filter valid entries
    const validItems = data
        .map((item, index) => ({
            originalIndex: index,
            val: parseNumber(item[key]),
            originalItem: item
        }))
        .filter(item => item.val !== null);

    const N = validItems.length;
    if (N === 0) {
        return data.map(item => ({ ...item, [`${key}_pr`]: null }));
    }

    if (N === 1) {
        const result = data.map(item => ({ ...item, [`${key}_pr`]: null }));
        const itemIdx = validItems[0].originalIndex;
        result[itemIdx] = { ...result[itemIdx], [`${key}_pr`]: 100 };
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

    // Add PR value back to the dataset
    const result = data.map(item => ({ ...item, [`${key}_pr`]: null }));
    validItems.forEach(item => {
        result[item.originalIndex] = {
            ...item.originalItem,
            [`${key}_pr`]: Number(item.pr.toFixed(2))
        };
    });

    return result;
};

/**
 * Classifies coordinates into quadrants and provides localized descriptions.
 */
export const getQuadrant = (yieldRatePercent, avgScorePr) => {
    if (yieldRatePercent === null || avgScorePr === null || yieldRatePercent === undefined || avgScorePr === undefined) {
        return { name: '資料不足', desc: '無法判斷招生象限' };
    }
    const yieldThreshold = 95;
    const prThreshold = 50;

    if (yieldRatePercent >= yieldThreshold && avgScorePr >= prThreshold) {
        return {
            name: '高品質穩定型',
            desc: '目前本校系組位於「高品質穩定型」象限，代表其平均分數 PR 高於同群類中位水準，且報到率達到穩定標準，顯示該校系組在錄取學生品質與報到轉換上皆具有良好表現。'
        };
    } else if (yieldRatePercent < yieldThreshold && avgScorePr >= prThreshold) {
        return {
            name: '高分流失型',
            desc: '目前本校系組位於「高分流失型」象限，代表其錄取學生平均分數 PR 較高，但報到率未達穩定標準，顯示該校系組雖具備吸引高分學生之能力，但錄取後可能存在學生流失情形，建議搭配學生流動分析與競爭關係網路進一步檢視主要流失對象。'
        };
    } else if (yieldRatePercent >= yieldThreshold && avgScorePr < prThreshold) {
        return {
            name: '穩定但品質待提升型',
            desc: '目前本校系組位於「穩定但品質待提升型」象限，代表其報到率達到穩定標準，但平均分數 PR 低於同群類中位水準，顯示招生轉換穩定，但錄取學生分數品質仍有提升空間。'
        };
    } else {
        return {
            name: '招生風險型',
            desc: '目前本校系組位於「招生風險型」象限，代表其報到率與平均分數 PR 皆低於設定標準，顯示該校系組在招生品質與報到穩定度上皆相對弱勢，建議優先檢討招生定位、競爭校系與學生流向。'
        };
    }
};

// --- Custom Tooltip Component ---

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const quadrant = getQuadrant(data.x, data.y);
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
                minWidth: '240px'
            }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                    {data.name.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>📊 報到率: <strong style={{ color: '#2c3e50' }}>{data.x != null ? `${data.x.toFixed(1)}%` : '--'}</strong></div>
                    <div>⭐ 平均分數 PR: <strong style={{ color: '#2ecc71' }}>{data.y != null ? `PR ${data.y.toFixed(1)}` : '--'}</strong></div>
                    <div>📝 平均分數: <strong>{data.avgScore != null ? data.avgScore.toFixed(2) : '--'}</strong></div>
                    <div>⚡ R-Score: <strong>{data.rScore != null ? data.rScore.toFixed(3) : '--'}</strong></div>
                    <div>🛡️ 正取有效性: <strong>{data.zhengEffect != null ? `${(data.zhengEffect * 100).toFixed(1)}%` : '--'}</strong></div>
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #eee', fontWeight: 'bold', color: '#e74c3c' }}>
                        📍 定位: {quadrant.name}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// --- Main Component ---

const PlacementQuadrantChart = ({
    rankings,
    selectedDept,
    selectedDimension,
    years,
    currentYear,
    myLabel
}) => {
    const [historicalPath, setHistoricalPath] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch and process historical data to build selected department's path
    useEffect(() => {
        if (!selectedDept || !selectedDimension || !years || years.length === 0) {
            setHistoricalPath([]);
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

                const pathPoints = results
                    .map(({ year, data }) => {
                        if (!data || !Array.isArray(data)) return null;

                        // Recalculate PR in the context of this specific year
                        const rankingsWithPr = calculatePercentileRank(data, 'avg_score');

                        // Find the department by exact normalized name (since IDs are reused and unstable across years)
                        const deptData = rankingsWithPr.find(item => {
                            return normalizedCurrentName && normalizeName(item.name) === normalizedCurrentName;
                        });

                        if (!deptData) return null;

                        const yieldRate = parseNumber(deptData.yield_rate);
                        const avgScorePr = parseNumber(deptData.avg_score_pr);

                        if (yieldRate === null || avgScorePr === null) return null;

                        return {
                            year: String(year),
                            x: yieldRate * 100,
                            y: avgScorePr,
                            avgScore: parseNumber(deptData.avg_score),
                            rScore: parseNumber(deptData.r_score),
                            zhengEffect: parseNumber(deptData.zheng_effect),
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

                setHistoricalPath(pathPoints);
            } catch (err) {
                console.error("Error loading history for PlacementQuadrantChart", err);
            } finally {
                setLoadingHistory(false);
            }
        };

        fetchHistory();
    }, [selectedDept, selectedDimension, years, rankings]);

    // Compute PR on current year rankings
    const processedRankings = useMemo(() => {
        if (!rankings || rankings.length === 0) return [];
        return calculatePercentileRank(rankings, 'avg_score').map(item => {
            const yieldRate = parseNumber(item.yield_rate);
            const yieldRatePercent = yieldRate !== null ? yieldRate * 100 : null;
            return {
                ...item,
                x: yieldRatePercent,
                y: item.avg_score_pr,
                avgScore: parseNumber(item.avg_score),
                rScore: parseNumber(item.r_score),
                zhengEffect: parseNumber(item.zheng_effect)
            };
        });
    }, [rankings]);

    // Check basic availability of data
    if (!rankings || rankings.length === 0) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>招生品質與報到穩定四象限分析</h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>資料不足，無法產生四象限落點分析。</p>
            </div>
        );
    }

    const currentDept = rankings.find(r => r.id === selectedDept);
    if (selectedDept && !currentDept) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>招生品質與報到穩定四象限分析</h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>找不到目前選取校系組資料。</p>
            </div>
        );
    }

    const plottablePoints = processedRankings.filter(item => item.x !== null && item.y !== null);
    if (plottablePoints.length === 0) {
        return (
            <div className="chart-wrapper" style={{ padding: '30px', textAlign: 'center', color: '#7f8c8d' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>招生品質與報到穩定四象限分析</h3>
                <p style={{ fontSize: '14px', color: '#95a5a6' }}>資料不足，無法產生四象限落點分析。</p>
            </div>
        );
    }

    // Determine X-axis Domain bounds dynamically
    const validYields = plottablePoints.map(item => item.x);
    const minYield = validYields.length > 0 ? Math.min(...validYields) : 0;
    const xDomain = minYield >= 80 ? [80, 100] : [0, 100];

    // Split points into current selection and the rest
    const otherPoints = plottablePoints.filter(item => item.id !== selectedDept);
    const currentDeptPoint = plottablePoints.find(item => item.id === selectedDept);

    // Current quadrant information
    const quadrantInfo = currentDeptPoint ? getQuadrant(currentDeptPoint.x, currentDeptPoint.y) : null;

    // Generate YoY movement analysis
    const generateTrendAnalysis = (path) => {
        if (!path || path.length < 2) return null;

        const earliest = path[0];
        const latest = path[path.length - 1];

        const deltaYield = latest.x - earliest.x;
        const deltaPR = latest.y - earliest.y;

        const threshold = 1.0; // Changes less than 1.0 are treated as flat
        const isYieldFlat = Math.abs(deltaYield) < threshold;
        const isPrFlat = Math.abs(deltaPR) < threshold;

        if (isYieldFlat && isPrFlat) {
            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：本系招生品質與報到率均呈現持平穩定態勢。`
            };
        } else if (deltaYield >= threshold && deltaPR >= threshold) {
            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：本系招生品質與報到穩定度同步提升，整體朝正向發展（報到率提升 ${deltaYield.toFixed(1)}%、平均分數 PR 提升 ${deltaPR.toFixed(1)}）。`
            };
        } else if (deltaYield <= -threshold && deltaPR >= threshold) {
            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：本系平均分數品質提升，但報到率下降，可能出現高分學生流失情形（報到率下降 ${Math.abs(deltaYield).toFixed(1)}%、平均分數 PR 提升 ${deltaPR.toFixed(1)}）。`
            };
        } else if (deltaYield >= threshold && deltaPR <= -threshold) {
            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：本系報到穩定度提升，但平均分數品質下降，可能是招生穩定但品質待提升（報到率提升 ${deltaYield.toFixed(1)}%、平均分數 PR 下降 ${Math.abs(deltaPR).toFixed(1)}）。`
            };
        } else if (deltaYield <= -threshold && deltaPR <= -threshold) {
            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：本系報到率與平均分數 PR 皆下降，招生狀態需優先關注（報到率下降 ${Math.abs(deltaYield).toFixed(1)}%、平均分數 PR 下降 ${Math.abs(deltaPR).toFixed(1)}）。`
            };
        } else {
            const yieldText = isYieldFlat ? '報到率維持持平' : `報到率${deltaYield > 0 ? `提升 ${deltaYield.toFixed(1)}%` : `下降 ${Math.abs(deltaYield).toFixed(1)}%`}`;
            const prText = isPrFlat ? '分數品質維持持平' : `平均分數 PR ${deltaPR > 0 ? `提升 ${deltaPR.toFixed(1)}` : `下降 ${Math.abs(deltaPR).toFixed(1)}`}`;
            return {
                analysisText: `歷年分析（自 ${earliest.year} 至 ${latest.year} 學年）：本系 ${yieldText}，且 ${prText}。`
            };
        }
    };

    const trendAnalysis = generateTrendAnalysis(historicalPath);

    return (
        <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px' }}>
            {/* Header info */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#2c3e50', fontWeight: 'bold' }}>
                    招生品質與報到穩定四象限分析
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#7f8c8d', lineHeight: '1.5' }}>
                    以報到率作為招生穩定度指標，並以平均分數 PR 衡量錄取學生分數品質，觀察校系組於當年度招生市場中的相對位置。
                </p>
            </div>

            {/* Scatter Plot area */}
            <div style={{ width: '100%', height: '420px', position: 'relative', backgroundColor: '#fff', borderRadius: '12px', padding: '10px 10px 20px 10px' }}>
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
                            name="報到率"
                            unit="%"
                            domain={xDomain}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{ value: '報到率（%）', position: 'bottom', offset: 5, fontSize: 13, fill: '#334155', fontWeight: 'bold' }}
                        />

                        {/* Y Axis */}
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="平均分數 PR"
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{ value: '平均分數 PR', angle: -90, position: 'insideLeft', offset: 0, fontSize: 13, fill: '#334155', fontWeight: 'bold' }}
                        />

                        {/* Quadrant backgrounds */}
                        {/* Top-Right: High Quality, Stable */}
                        <ReferenceArea
                            x1={95}
                            x2={xDomain[1]}
                            y1={50}
                            y2={100}
                            fill="rgba(46, 204, 113, 0.02)"
                            label={{ value: "高品質穩定型", position: "insideTopRight", fill: "rgba(39, 174, 96, 0.4)", fontSize: 11, fontWeight: "bold" }}
                        />
                        {/* Top-Left: High Score, Leakage */}
                        <ReferenceArea
                            x1={xDomain[0]}
                            x2={95}
                            y1={50}
                            y2={100}
                            fill="rgba(241, 196, 15, 0.02)"
                            label={{ value: "高分流失型", position: "insideTopLeft", fill: "rgba(211, 84, 0, 0.4)", fontSize: 11, fontWeight: "bold" }}
                        />
                        {/* Bottom-Right: Stable but Needs Improvement */}
                        <ReferenceArea
                            x1={95}
                            x2={xDomain[1]}
                            y1={0}
                            y2={50}
                            fill="rgba(52, 152, 219, 0.02)"
                            label={{ value: "穩定但品質待提升型", position: "insideBottomRight", fill: "rgba(41, 128, 185, 0.4)", fontSize: 11, fontWeight: "bold" }}
                        />
                        {/* Bottom-Left: Admission Risk */}
                        <ReferenceArea
                            x1={xDomain[0]}
                            x2={95}
                            y1={0}
                            y2={50}
                            fill="rgba(231, 76, 60, 0.02)"
                            label={{ value: "招生風險型", position: "insideBottomLeft", fill: "rgba(192, 57, 43, 0.4)", fontSize: 11, fontWeight: "bold" }}
                        />

                        {/* Reference lines (Dividers) */}
                        <ReferenceLine x={95} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                        <ReferenceLine y={50} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />

                        {/* Tooltip */}
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} />

                        {/* Scatter points for other departments */}
                        <Scatter
                            name="其他校系"
                            data={otherPoints}
                            fill="#94a3b8"
                            fillOpacity={0.5}
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

            {/* Analysis text cards at bottom */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                {quadrantInfo && (
                    <div style={{
                        padding: '16px 20px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🎯 {myLabel || '本校系組'}招生定位分析
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                backgroundColor: quadrantInfo.name === '高品質穩定型' ? '#eafaf1' :
                                    quadrantInfo.name === '高分流失型' ? '#fdf2e9' :
                                        quadrantInfo.name === '穩定但品質待提升型' ? '#e8f4fd' : '#fdedec',
                                color: quadrantInfo.name === '高品質穩定型' ? '#27ae60' :
                                    quadrantInfo.name === '高分流失型' ? '#d35400' :
                                        quadrantInfo.name === '穩定但品質待提升型' ? '#2980b9' : '#e74c3c',
                                border: `1px solid ${quadrantInfo.name === '高品質穩定型' ? '#2ecc71' :
                                        quadrantInfo.name === '高分流失型' ? '#f1c40f' :
                                            quadrantInfo.name === '穩定但品質待提升型' ? '#3498db' : '#e74c3c'
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
                            🔄 歷年移動方向分析
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

export default PlacementQuadrantChart;
