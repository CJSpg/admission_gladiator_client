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

const DEFAULT_EFFECT_YIELD_THRESHOLD = 80;
const DEFAULT_FLOW_RATE_THRESHOLD = 20;
const DEFAULT_AVG_SCORE_PR_THRESHOLD = 50;

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

const getSchoolName = (name) => {
    if (!name) return '';
    return String(name).split('\n')[0]?.trim() || '';
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
 * X axis: zheng_effect_percent
 * Y axis: yield_rate_percent
 */
export const getQuadrantEffectYield = (
    zhengEffect,
    yieldRate,
    zhengThreshold = DEFAULT_EFFECT_YIELD_THRESHOLD,
    yieldThreshold = DEFAULT_EFFECT_YIELD_THRESHOLD
) => {
    if (zhengEffect === null || yieldRate === null || zhengEffect === undefined || yieldRate === undefined) {
        return { name: '資料不足', desc: '無法判斷招生象限' };
    }
    const zhengThresholdText = `${zhengThreshold}%`;
    const yieldThresholdText = `${yieldThreshold}%`;

    if (zhengEffect >= zhengThreshold && yieldRate >= yieldThreshold) {
        return {
            name: '高效穩定型',
            desc: `目前本校系組位於「高效穩定型」象限，代表其正取有效性達 ${zhengThresholdText} 基準，報到率也達 ${yieldThresholdText} 基準。這顯示正取學生有較高意願就讀，且最終報到狀況相對穩定。`
        };
    } else if (zhengEffect < zhengThreshold && yieldRate >= yieldThreshold) {
        return {
            name: '備取依賴型',
            desc: `目前本校系組位於「備取依賴型」象限，代表報到率達 ${yieldThresholdText} 基準，但正取有效性未達 ${zhengThresholdText}。這顯示正取學生流失較多，但透過備取遞補把報到率拉回穩定水準。`
        };
    } else if (zhengEffect >= zhengThreshold && yieldRate < yieldThreshold) {
        return {
            name: '精準但不足型',
            desc: `目前本校系組位於「精準但不足型」象限，代表正取有效性達 ${zhengThresholdText} 基準，但報到率未達 ${yieldThresholdText}。這顯示正取學生就讀意願相對穩定，但整體報到仍不足，需檢視招生名額、備取人數或遞補狀況。`
        };
    } else {
        return {
            name: '招生弱勢型',
            desc: `目前本校系組位於「招生弱勢型」象限，代表正取有效性未達 ${zhengThresholdText} 基準，報到率也未達 ${yieldThresholdText} 基準。這顯示正取學生就讀意願與最終報到轉換狀況都偏弱，建議優先檢討招生策略與競爭對手關係。`
        };
    }
};

/**
 * Classifies coordinates into quadrants for school-internal department comparison.
 * X axis: flow_rate_percent
 * Y axis: avg_score_pr
 */
const getQuadrantFlowAvgPr = (
    flowRatePercent,
    avgScorePr,
    flowThreshold = DEFAULT_FLOW_RATE_THRESHOLD,
    avgPrThreshold = DEFAULT_AVG_SCORE_PR_THRESHOLD
) => {
    if (flowRatePercent === null || avgScorePr === null || flowRatePercent === undefined || avgScorePr === undefined) {
        return { name: '資料不足', desc: '無法判斷校內系科象限' };
    }

    const flowThresholdText = `${flowThreshold}%`;
    const avgThresholdText = `${avgPrThreshold}`;

    if (flowRatePercent >= flowThreshold && avgScorePr >= avgPrThreshold) {
        return {
            name: '第一象限：考試支撐型',
            desc: `流入登分比例達 ${flowThresholdText} 以上，但最低錄取平均分數 PR 仍達 ${avgThresholdText} 以上。這代表甄選階段留才或推甄轉換可能偏弱，但登記分發仍能招到分數品質不錯的學生，顯示該系具備與較高競爭層級校系抗衡的本錢。`
        };
    }
    if (flowRatePercent < flowThreshold && avgScorePr >= avgPrThreshold) {
        return {
            name: '第二象限：強勢穩健型',
            desc: `流入登分比例低於 ${flowThresholdText}，且最低錄取平均分數 PR 達 ${avgThresholdText} 以上。這是最理想的位置，代表甄選階段轉換穩定，同時錄取分數品質也高，系科體質與招生策略都相對健康。`
        };
    }
    if (flowRatePercent < flowThreshold && avgScorePr < avgPrThreshold) {
        return {
            name: '第三象限：先招防守型',
            desc: `流入登分比例低於 ${flowThresholdText}，但最低錄取平均分數 PR 低於 ${avgThresholdText}。這通常表示系科採取先招先贏策略，可能透過較低或較保守的一階門檻先把名額補滿；策略方向可以理解，但長期隱憂是系科體質與分數競爭力仍需提升。`
        };
    }
    return {
        name: '第四象限：雙弱警戒型',
        desc: `流入登分比例達 ${flowThresholdText} 以上，且最低錄取平均分數 PR 低於 ${avgThresholdText}。這是最需要優先處理的位置，代表甄選階段留才不足，後續登記分發也未能拉高錄取分數品質，系科在少子化壓力下的抵抗力相對不足。`
    };
};

// --- Custom Tooltip Component ---

const CustomTooltip = ({
    active,
    payload,
    selectedDept,
    mode,
    zhengEffectThreshold,
    yieldRateThreshold,
    flowRateThreshold,
    avgScorePrThreshold
}) => {
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
        } else if (mode === 'effect_yield') {
            // Mode: effect_yield
            const zhengEffectPercent = data.zheng_effect_percent !== undefined ? data.zheng_effect_percent : data.x;
            const yieldRatePercent = data.yield_rate_percent !== undefined ? data.yield_rate_percent : data.y;
            const quadrant = getQuadrantEffectYield(zhengEffectPercent, yieldRatePercent, zhengEffectThreshold, yieldRateThreshold);

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
        } else {
            const flowRatePercent = data.flow_rate_percent !== undefined ? data.flow_rate_percent : data.x;
            const avgScorePr = data.avg_score_pr !== undefined ? data.avg_score_pr : data.y;
            const quadrant = getQuadrantFlowAvgPr(flowRatePercent, avgScorePr, flowRateThreshold, avgScorePrThreshold);

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
                        <div>🔻 流入登分比例：<strong style={{ color: '#e74c3c' }}>{flowRatePercent != null ? `${flowRatePercent.toFixed(1)}%` : '--'}</strong></div>
                        <div>⭐ 最低錄取平均分數 PR：<strong style={{ color: '#2ecc71' }}>{avgScorePr != null ? avgScorePr.toFixed(1) : '--'}</strong></div>
                        <div>📝 平均分數：<strong>{data.avg_score != null ? data.avg_score.toFixed(3) : '--'}</strong></div>
                        {isSelf ? (
                            <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>📍 目前選取校系</div>
                        ) : (
                            <div style={{ color: '#475569', marginTop: '4px' }}>
                                🏫 同校系科比較對象
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

const COMPARE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

const PlacementQuadrantChart = ({
    mode: propsMode,
    setMode: propsSetMode,
    rankings,
    selectedDept,
    selectedDimension,
    years,
    graphData,
    trendDepts,
    zhengEffectThreshold = DEFAULT_EFFECT_YIELD_THRESHOLD,
    setZhengEffectThreshold,
    yieldRateThreshold = DEFAULT_EFFECT_YIELD_THRESHOLD,
    setYieldRateThreshold,
    flowRateThreshold = DEFAULT_FLOW_RATE_THRESHOLD,
    setFlowRateThreshold,
    avgScorePrThreshold = DEFAULT_AVG_SCORE_PR_THRESHOLD,
    setAvgScorePrThreshold
}) => {
    // Mode switcher: 'rscore_avg', 'effect_yield', or 'flow_avg_pr'
    const [localMode, setLocalMode] = useState('rscore_avg');
    const mode = propsMode !== undefined ? propsMode : localMode;
    const setMode = propsSetMode !== undefined ? propsSetMode : setLocalMode;
    const [allYearsRankings, setAllYearsRankings] = useState({});
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [comparedDepts, setComparedDepts] = useState([]);
    const zhengThresholdNumber = Number(zhengEffectThreshold);
    const yieldThresholdNumber = Number(yieldRateThreshold);
    const normalizedZhengEffectThreshold = Number.isFinite(zhengThresholdNumber)
        ? Math.min(100, Math.max(0, zhengThresholdNumber))
        : DEFAULT_EFFECT_YIELD_THRESHOLD;
    const normalizedYieldRateThreshold = Number.isFinite(yieldThresholdNumber)
        ? Math.min(100, Math.max(0, yieldThresholdNumber))
        : DEFAULT_EFFECT_YIELD_THRESHOLD;
    const flowThresholdNumber = Number(flowRateThreshold);
    const avgPrThresholdNumber = Number(avgScorePrThreshold);
    const normalizedFlowRateThreshold = Number.isFinite(flowThresholdNumber)
        ? Math.min(100, Math.max(0, flowThresholdNumber))
        : DEFAULT_FLOW_RATE_THRESHOLD;
    const normalizedAvgScorePrThreshold = Number.isFinite(avgPrThresholdNumber)
        ? Math.min(100, Math.max(0, avgPrThresholdNumber))
        : DEFAULT_AVG_SCORE_PR_THRESHOLD;

    const updateZhengEffectThreshold = (value) => {
        if (!setZhengEffectThreshold) return;
        const nextValue = Math.min(100, Math.max(0, Number(value) || 0));
        setZhengEffectThreshold(nextValue);
    };

    const updateYieldRateThreshold = (value) => {
        if (!setYieldRateThreshold) return;
        const nextValue = Math.min(100, Math.max(0, Number(value) || 0));
        setYieldRateThreshold(nextValue);
    };

    const updateFlowRateThreshold = (value) => {
        if (!setFlowRateThreshold) return;
        const nextValue = Math.min(100, Math.max(0, Number(value) || 0));
        setFlowRateThreshold(nextValue);
    };

    const updateAvgScorePrThreshold = (value) => {
        if (!setAvgScorePrThreshold) return;
        const nextValue = Math.min(100, Math.max(0, Number(value) || 0));
        setAvgScorePrThreshold(nextValue);
    };

    // Clear compared competitors on department or dimension change
    useEffect(() => {
        setComparedDepts([]);
    }, [selectedDept, selectedDimension]);

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
                const flowRate = parseNumber(item.flow_rate);

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
                    flow_rate: flowRate,
                    flow_rate_percent: flowRate !== null ? flowRate * 100 : null
                };
            })
            .filter(Boolean);
    }, [rankings, selectedDimension]);

    // Filter to related rankings and limit displaying count
    const finalChartData = useMemo(() => {
        if (processedRankings.length === 0 || !selectedDept) return [];

        const relatedIds = new Set([selectedDept]);

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
                } else if (mode === 'effect_yield') {
                    x = d.zheng_effect_percent;
                    y = d.yield_rate_percent;
                } else {
                    x = d.flow_rate_percent;
                    y = d.avg_score_pr;
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

        if (mode === 'flow_avg_pr') {
            const selectedSchoolName = getSchoolName(selectedPoint?.name || processedRankings.find(d => d.id === selectedDept)?.name);
            const sameSchoolPoints = mappedData
                .filter(d => d.id !== selectedDept && getSchoolName(d.name) === selectedSchoolName)
                .sort((a, b) => {
                    if (b.y !== a.y) return b.y - a.y;
                    return a.x - b.x;
                });

            return selectedPoint
                ? [selectedPoint, ...sameSchoolPoints]
                : sameSchoolPoints;
        }

        const competitorPoints = mappedData
            .filter(d => d.id !== selectedDept && relatedIds.has(d.id))
            .sort((a, b) => (relationWeightMap[b.id] || 0) - (relationWeightMap[a.id] || 0))
            .slice(0, 15);

        return selectedPoint
            ? [selectedPoint, ...competitorPoints]
            : competitorPoints;
    }, [processedRankings, selectedDept, graphData, trendDepts, mode]);

    // Fetch ranking data for all years when dimension or years change
    useEffect(() => {
        if (!selectedDimension || !years || years.length === 0) return;
        let isCurrent = true;
        setLoadingHistory(true);

        const fetchAllHistory = async () => {
            try {
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

                const rankingsMap = {};
                results.forEach(({ year, data }) => {
                    if (data) rankingsMap[year] = data;
                });
                setAllYearsRankings(rankingsMap);
            } catch (err) {
                console.error("Error loading all years history", err);
            } finally {
                if (isCurrent) setLoadingHistory(false);
            }
        };

        fetchAllHistory();
        return () => { isCurrent = false; };
    }, [selectedDimension, years]);

    // Helper to calculate path for any department name dynamically across all years
    const getDeptPath = useMemo(() => {
        return (deptId) => {
            if (!deptId || !allYearsRankings || Object.keys(allYearsRankings).length === 0) return [];

            const deptItem = processedRankings.find(r => r.id === deptId) || rankings.find(r => r.id === deptId);
            if (!deptItem) return [];
            const normalizedNameTarget = normalizeName(deptItem.name);

            const pathPoints = Object.entries(allYearsRankings)
                .map(([year, data]) => {
                    if (!data || !Array.isArray(data)) return null;

                    const rScorePrData = calculatePercentileRank(data, 'r_score', 'r_score_pr');
                    const bothPrData = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr', selectedDimension);

                    const yearDept = bothPrData.find(item => normalizeName(item.name) === normalizedNameTarget);
                    if (!yearDept) return null;

                    const rScorePr = parseNumber(yearDept.r_score_pr);
                    const avgScorePr = parseNumber(yearDept.avg_score_pr);
                    const yieldRate = parseNumber(yearDept.yield_rate);
                    const zhengEffect = parseNumber(yearDept.zheng_effect);
                    const flowRate = parseNumber(yearDept.flow_rate);
                    let x = null;
                    let y = null;

                    if (mode === 'rscore_avg') {
                        x = rScorePr;
                        y = avgScorePr;
                    } else if (mode === 'effect_yield') {
                        x = zhengEffect !== null ? zhengEffect * 100 : null;
                        y = yieldRate !== null ? yieldRate * 100 : null;
                    } else {
                        x = flowRate !== null ? flowRate * 100 : null;
                        y = avgScorePr;
                    }

                    return {
                        year: String(year),
                        rScorePr,
                        avgScorePr,
                        zhengEffectPercent: zhengEffect !== null ? zhengEffect * 100 : null,
                        yieldRatePercent: yieldRate !== null ? yieldRate * 100 : null,
                        flowRatePercent: flowRate !== null ? flowRate * 100 : null,
                        r_score: parseNumber(yearDept.r_score),
                        avg_score: parseNumber(yearDept.avg_score),
                        name: yearDept.name,
                        id: yearDept.id,
                        x,
                        y
                    };
                })
                .filter(point => point && point.x !== null && point.y !== null);

            pathPoints.sort((a, b) => {
                const numA = parseInt(a.year.replace(/\D/g, ''), 10) || 0;
                const numB = parseInt(b.year.replace(/\D/g, ''), 10) || 0;
                return numA - numB;
            });

            return pathPoints;
        };
    }, [allYearsRankings, rankings, processedRankings, selectedDimension, mode]);

    const historicalPath = useMemo(() => {
        return selectedDept ? getDeptPath(selectedDept) : [];
    }, [selectedDept, getDeptPath]);

    const comparedPaths = useMemo(() => {
        return comparedDepts.map(id => ({
            id,
            path: getDeptPath(id)
        }));
    }, [comparedDepts, getDeptPath]);

    const toggleCompareDept = (deptId) => {
        if (deptId === selectedDept) return;
        setComparedDepts(prev => {
            if (prev.includes(deptId)) {
                return prev.filter(id => id !== deptId);
            }
            if (prev.length >= 5) {
                return [...prev.slice(1), deptId];
            }
            return [...prev, deptId];
        });
    };

    // Split points into current selection and the rest
    const otherPoints = finalChartData.filter(item => item.id !== selectedDept);
    const currentDeptPoint = finalChartData.find(item => item.id === selectedDept);

    // Calculate dynamic domains and ticks depending on mode
    let xDomain, yDomain, xTicks, yTicks;

    if (mode === 'rscore_avg') {
        const allX = [
            ...finalChartData.map(d => d.x),
            ...historicalPath.map(d => d.x),
            ...comparedPaths.flatMap(p => p.path.map(d => d.x))
        ].filter(val => val !== null && val !== undefined);

        const allY = [
            ...finalChartData.map(d => d.y),
            ...historicalPath.map(d => d.y),
            ...comparedPaths.flatMap(p => p.path.map(d => d.y))
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
        // Percent-based quadrant modes keep full 0 - 100 scale with standard ticks.
        xDomain = [0, 100];
        yDomain = [0, 100];
        xTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        yTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    }

    const chartTitle = mode === 'rscore_avg'
        ? 'R-Score 與最低錄取平均分數 PR 分佈落點分析'
        : mode === 'effect_yield'
            ? '正取有效性與報到率四象限分析'
            : '校內各系流入登分比例與最低錄取平均分數 PR 分析';
    const chartSubtitle = mode === 'rscore_avg'
        ? '僅顯示目前校系組及其直接競爭／流動關係校系組；PR 值仍以完整同年度資料計算。'
        : mode === 'effect_yield'
            ? '分析正取學生的就讀意願（正取有效性）與最終招生填滿度（報到率）之關係。'
            : selectedDimension === 'dept'
                ? '比較同校其他系科是否往左上方移動：流入登分比例下降、最低錄取平均分數 PR 上升。'
                : '此模式以校內各系比較為主，建議切到「系」層級使用；目前會先依現有層級資料呈現。';
    const xAxisName = mode === 'rscore_avg'
        ? 'R-Score PR'
        : mode === 'effect_yield'
            ? '正取有效性'
            : '流入登分比例';
    const xAxisLabel = mode === 'rscore_avg'
        ? 'R-Score PR'
        : mode === 'effect_yield'
            ? '正取有效性（%）'
            : '流入登分比例（%）';
    const yAxisName = mode === 'effect_yield' ? '報到率' : '最低錄取平均分數 PR';
    const yAxisLabel = mode === 'effect_yield' ? '報到率（%）' : '最低錄取平均分數 PR';
    const xTickFormatter = (v) => mode === 'rscore_avg' ? Math.round(v) : `${Math.round(v)}%`;
    const yTickFormatter = (v) => mode === 'effect_yield' ? `${Math.round(v)}%` : Math.round(v);

    return (
        <div className="chart-wrapper" style={{ display: 'flex', flexDirection: 'column', padding: '10px' }}>
            {/* Header info */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#2c3e50', fontWeight: 'bold' }}>
                    {chartTitle}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#7f8c8d', lineHeight: '1.5' }}>
                    {chartSubtitle}
                </p>
            </div>

            {/* Premium Toggle Button Switcher */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
                <button
                    onClick={() => setMode('flow_avg_pr')}
                    style={{
                        padding: '8px 18px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: mode === 'flow_avg_pr' ? '#e74c3c' : '#fff',
                        color: mode === 'flow_avg_pr' ? '#fff' : '#64748b',
                        boxShadow: mode === 'flow_avg_pr' ? '0 4px 12px rgba(231, 76, 60, 0.2)' : 'none'
                    }}
                >
                    🏫 校內系科體質
                </button>
            </div>

            {(mode === 'effect_yield' || mode === 'flow_avg_pr') && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '-4px 0 18px 0',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: '#475569'
                }}>
                    {(mode === 'effect_yield'
                        ? [
                            {
                                id: 'zheng-effect-threshold',
                                label: '正取有效性門檻',
                                value: normalizedZhengEffectThreshold,
                                update: updateZhengEffectThreshold,
                                color: '#2ecc71',
                                suffix: '%'
                            },
                            {
                                id: 'yield-rate-threshold',
                                label: '報到率門檻',
                                value: normalizedYieldRateThreshold,
                                update: updateYieldRateThreshold,
                                color: '#3498db',
                                suffix: '%'
                            }
                        ]
                        : [
                            {
                                id: 'flow-rate-threshold',
                                label: '流入登分比例門檻',
                                value: normalizedFlowRateThreshold,
                                update: updateFlowRateThreshold,
                                color: '#e74c3c',
                                suffix: '%'
                            },
                            {
                                id: 'avg-score-pr-threshold',
                                label: '最低錄取平均分數 PR 門檻',
                                value: normalizedAvgScorePrThreshold,
                                update: updateAvgScorePrThreshold,
                                color: '#2ecc71',
                                suffix: ''
                            }
                        ]).map(control => (
                        <div key={control.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <label htmlFor={control.id} style={{ fontWeight: 'bold', color: '#334155' }}>
                                {control.label}
                            </label>
                            <input
                                id={control.id}
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={control.value}
                                onChange={(event) => control.update(event.target.value)}
                                style={{ width: '150px', accentColor: control.color }}
                            />
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="5"
                                value={control.value}
                                onChange={(event) => control.update(event.target.value)}
                                style={{
                                    width: '68px',
                                    padding: '5px 8px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    color: '#334155',
                                    fontWeight: 'bold'
                                }}
                            />
                            {control.suffix && <span>{control.suffix}</span>}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            if (mode === 'effect_yield') {
                                updateZhengEffectThreshold(DEFAULT_EFFECT_YIELD_THRESHOLD);
                                updateYieldRateThreshold(DEFAULT_EFFECT_YIELD_THRESHOLD);
                            } else {
                                updateFlowRateThreshold(DEFAULT_FLOW_RATE_THRESHOLD);
                                updateAvgScorePrThreshold(DEFAULT_AVG_SCORE_PR_THRESHOLD);
                            }
                        }}
                        style={{
                            padding: '5px 10px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: '#fff',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        重設
                    </button>
                </div>
            )}

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
                            name={xAxisName}
                            domain={xDomain}
                            ticks={xTicks}
                            tickFormatter={xTickFormatter}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{
                                value: xAxisLabel,
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
                            name={yAxisName}
                            domain={yDomain}
                            ticks={yTicks}
                            tickFormatter={yTickFormatter}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            label={{
                                value: yAxisLabel,
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
                                    x1={normalizedZhengEffectThreshold}
                                    x2={100}
                                    y1={normalizedYieldRateThreshold}
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
                                    x2={normalizedZhengEffectThreshold}
                                    y1={normalizedYieldRateThreshold}
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
                                    x1={normalizedZhengEffectThreshold}
                                    x2={100}
                                    y1={0}
                                    y2={normalizedYieldRateThreshold}
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
                                    x2={normalizedZhengEffectThreshold}
                                    y1={0}
                                    y2={normalizedYieldRateThreshold}
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
                                <ReferenceLine x={normalizedZhengEffectThreshold} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                                <ReferenceLine y={normalizedYieldRateThreshold} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                            </>
                        )}

                        {mode === 'flow_avg_pr' && (
                            <>
                                {/* Q1: high flow, high PR */}
                                <ReferenceArea
                                    x1={normalizedFlowRateThreshold}
                                    x2={100}
                                    y1={normalizedAvgScorePrThreshold}
                                    y2={100}
                                    fill="rgba(241, 196, 15, 0.025)"
                                    label={{
                                        value: "第一象限：考試支撐型",
                                        position: "insideTopRight",
                                        fill: "rgba(211, 84, 0, 0.5)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />
                                {/* Q2: low flow, high PR */}
                                <ReferenceArea
                                    x1={0}
                                    x2={normalizedFlowRateThreshold}
                                    y1={normalizedAvgScorePrThreshold}
                                    y2={100}
                                    fill="rgba(46, 204, 113, 0.025)"
                                    label={{
                                        value: "第二象限：強勢穩健型",
                                        position: "insideTopLeft",
                                        fill: "rgba(39, 174, 96, 0.5)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />
                                {/* Q3: low flow, low PR */}
                                <ReferenceArea
                                    x1={0}
                                    x2={normalizedFlowRateThreshold}
                                    y1={0}
                                    y2={normalizedAvgScorePrThreshold}
                                    fill="rgba(52, 152, 219, 0.02)"
                                    label={{
                                        value: "第三象限：先招防守型",
                                        position: "insideBottomLeft",
                                        fill: "rgba(41, 128, 185, 0.5)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />
                                {/* Q4: high flow, low PR */}
                                <ReferenceArea
                                    x1={normalizedFlowRateThreshold}
                                    x2={100}
                                    y1={0}
                                    y2={normalizedAvgScorePrThreshold}
                                    fill="rgba(231, 76, 60, 0.025)"
                                    label={{
                                        value: "第四象限：雙弱警戒型",
                                        position: "insideBottomRight",
                                        fill: "rgba(192, 57, 43, 0.55)",
                                        fontSize: 11,
                                        fontWeight: "bold"
                                    }}
                                />

                                <ReferenceLine x={normalizedFlowRateThreshold} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                                <ReferenceLine y={normalizedAvgScorePrThreshold} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 3" />
                            </>
                        )}

                        {/* Tooltip */}
                        <Tooltip
                            content={(
                                <CustomTooltip
                                    selectedDept={selectedDept}
                                    mode={mode}
                                    zhengEffectThreshold={normalizedZhengEffectThreshold}
                                    yieldRateThreshold={normalizedYieldRateThreshold}
                                    flowRateThreshold={normalizedFlowRateThreshold}
                                    avgScorePrThreshold={normalizedAvgScorePrThreshold}
                                />
                            )}
                            cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                        />

                        {/* Scatter points for other related departments */}
                        <Scatter
                            name="其他校系"
                            data={otherPoints}
                            legendType="none"
                            isAnimationActive={false}
                            style={{ cursor: 'pointer' }}
                            onClick={(node) => {
                                if (node && node.id) {
                                    toggleCompareDept(node.id);
                                }
                            }}
                            shape={(props) => {
                                const { cx, cy, payload } = props;
                                const compareIdx = comparedDepts.indexOf(payload.id);
                                const isCompared = compareIdx !== -1;
                                const fill = isCompared ? COMPARE_COLORS[compareIdx % COMPARE_COLORS.length] : '#94a3b8';
                                const opacity = isCompared ? 0.95 : 0.6;
                                const radius = isCompared ? 7 : 4.5;
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={radius}
                                        fill={fill}
                                        fillOpacity={opacity}
                                        stroke={isCompared ? '#fff' : 'none'}
                                        strokeWidth={isCompared ? 1.5 : 0}
                                    />
                                );
                            }}
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

                        {/* Connected line & markers for compared competitor paths */}
                        {comparedPaths.map(({ id, path }, index) => {
                            if (path.length < 2) return null;
                            const color = COMPARE_COLORS[index % COMPARE_COLORS.length];
                            return (
                                <Scatter
                                    key={`compare-path-${id}`}
                                    name={`對手軌跡-${index + 1}`}
                                    data={path}
                                    fill={color}
                                    line={{ stroke: color, strokeWidth: 2, strokeDasharray: '4 4' }}
                                    shape={(props) => {
                                        const { cx, cy, payload } = props;
                                        return (
                                            <g key={`comp-${id}-point-${payload.year}`}>
                                                <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={1} />
                                                <text
                                                    x={cx + 8}
                                                    y={cy + 4}
                                                    fontSize={10}
                                                    fontWeight="bold"
                                                    fill={color}
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
                            );
                        })}

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

            {/*對手軌跡比對控制區*/}
            {otherPoints.length > 0 && (
                <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '10px', userSelect: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: '#2c3e50', fontSize: '14px', fontWeight: 'bold' }}>
                            🔍 {mode === 'flow_avg_pr' ? '校內系科軌跡比對' : '對手軌跡比對'}（點擊或勾選，最多顯示 5 個）
                        </h4>
                        {comparedDepts.length > 0 && (
                            <button
                                onClick={() => setComparedDepts([])}
                                style={{ fontSize: '11px', padding: '2px 8px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', transition: 'all 0.2s' }}
                            >
                                清除選擇
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {otherPoints.map((dept) => {
                            const compareIdx = comparedDepts.indexOf(dept.id);
                            const isCompared = compareIdx !== -1;
                            const color = isCompared ? COMPARE_COLORS[compareIdx % COMPARE_COLORS.length] : '#cbd5e1';
                            const badgeBg = isCompared ? `${color}15` : '#fff';
                            const badgeColor = isCompared ? color : '#475569';
                            const borderStyle = isCompared ? `1.5px solid ${color}` : '1px solid #e2e8f0';

                            return (
                                <button
                                    key={dept.id}
                                    onClick={() => toggleCompareDept(dept.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '12px',
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        borderRadius: '20px',
                                        border: borderStyle,
                                        backgroundColor: badgeBg,
                                        color: badgeColor,
                                        fontWeight: isCompared ? 'bold' : 'normal',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isCompared ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
                                    }}
                                >
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: isCompared ? color : '#cbd5e1',
                                        display: 'inline-block'
                                    }} />
                                    {dept.name.replace(/\n/g, ' ')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlacementQuadrantChart;
