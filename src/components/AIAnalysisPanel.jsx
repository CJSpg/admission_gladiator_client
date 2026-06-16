import React, { useState, useEffect, useRef } from 'react';

const ANALYSIS_PROMPT_VERSION = 'screening-overlap-2026-06-17-v3';

// --- Helper Functions (replicating calculations for prompt construction) ---
const parseNumber = (val) => {
    if (val === undefined || val === null || val === '--' || val === '') return null;
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? null : num;
};

// --- Simple Markdown Renderer Component ---
const SimpleMarkdown = ({ text }) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let isInsideList = false;
    let listType = null; // 'ul' or 'ol'
    let isInsideBox = false;
    let boxContent = [];
    let keyIdx = 0;

    // Table state variables
    let isInsideTable = false;
    let tableHeader = null;
    let tableRows = [];

    const flushList = () => {
        if (listItems.length > 0) {
            const Tag = listType === 'ol' ? 'ol' : 'ul';
            if (isInsideBox) {
                boxContent.push(<Tag key={`list-${keyIdx++}`}>{listItems}</Tag>);
            } else {
                elements.push(<Tag key={`list-${keyIdx++}`}>{listItems}</Tag>);
            }
            listItems = [];
        }
        isInsideList = false;
        listType = null;
    };

    const flushBox = () => {
        if (boxContent.length > 0) {
            elements.push(
                <div className="ai-recommendation-box" key={`box-${keyIdx++}`}>
                    <h4>💡 校方戰略建議</h4>
                    {boxContent}
                </div>
            );
            boxContent = [];
        }
        isInsideBox = false;
    };

    const flushTable = () => {
        if (isInsideTable) {
            if (tableHeader || tableRows.length > 0) {
                const tableEl = (
                    <div className="ai-table-wrapper" key={`table-wrapper-${keyIdx++}`}>
                        <table className="ai-markdown-table">
                            {tableHeader && (
                                <thead>
                                    <tr>
                                        {tableHeader.map((cell, idx) => (
                                            <th key={`th-${idx}`}>{cell}</th>
                                        ))}
                                    </tr>
                                </thead>
                            )}
                            {tableRows.length > 0 && (
                                <tbody>
                                    {tableRows.map((row, rowIdx) => (
                                        <tr key={`tr-${rowIdx}`}>
                                            {row.map((cell, colIdx) => (
                                                <td key={`td-${colIdx}`}>{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            )}
                        </table>
                    </div>
                );
                if (isInsideBox) {
                    boxContent.push(tableEl);
                } else {
                    elements.push(tableEl);
                }
            }
            isInsideTable = false;
            tableHeader = null;
            tableRows = [];
        }
    };

    const parseInlineStyles = (str) => {
        // Parse bold text like **text**
        const parts = [];
        let i = 0;
        const regex = /\*\*(.*?)\*\*/g;
        let match;
        let lastIndex = 0;

        while ((match = regex.exec(str)) !== null) {
            if (match.index > lastIndex) {
                parts.push(str.substring(lastIndex, match.index));
            }
            parts.push(<strong key={`bold-${i++}`}>{match[1]}</strong>);
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < str.length) {
            parts.push(str.substring(lastIndex));
        }

        return parts.length > 0 ? parts : str;
    };

    lines.forEach((line) => {
        const trimmed = line.trim();

        // 1. Detect and parse Table Rows
        const isTableRow = trimmed.startsWith('|');
        if (isTableRow) {
            flushList(); // if inside list, close it

            const isSeparator = /^\|[\s\-:|]+$/g.test(trimmed) && trimmed.includes('-');
            if (!isSeparator) {
                if (!isInsideTable) {
                    isInsideTable = true;
                    tableHeader = null;
                    tableRows = [];
                }

                let cleanedLine = trimmed;
                if (cleanedLine.startsWith('|')) cleanedLine = cleanedLine.slice(1);
                if (cleanedLine.endsWith('|')) cleanedLine = cleanedLine.slice(0, -1);
                const cols = cleanedLine.split('|').map(c => parseInlineStyles(c.trim()));

                if (tableHeader === null) {
                    tableHeader = cols;
                } else {
                    tableRows.push(cols);
                }
            }
            return;
        } else {
            flushTable(); // if inside table, close it
        }

        // 2. Detect Strategic Advice Highlighting Box
        if (trimmed.startsWith('### 校方應對建議') ||
            trimmed.startsWith('### 校方具體建議') ||
            trimmed.startsWith('### 量化招生與宣傳政策建議') ||
            trimmed.startsWith('💡 校方戰略建議') ||
            trimmed.startsWith('### 3. 校方應對建議') ||
            trimmed.startsWith('### 3. 校方具體建議') ||
            trimmed.startsWith('### 3. 給校方的政策建議') ||
            trimmed.startsWith('### 3. 量化招生與宣傳政策建議') ||
            trimmed.startsWith('#### 💡 建議') ||
            trimmed.startsWith('💡 建議：')) {
            flushList();
            flushBox();
            isInsideBox = true;
            return;
        }

        // Check if box should be closed
        if (isInsideBox && (trimmed.startsWith('## ') || (trimmed.startsWith('### ') && !trimmed.includes('建議')))) {
            flushBox();
        }

        // 3. Horizontal Rules
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            flushList();
            const hrEl = <hr className="ai-markdown-hr" key={`hr-${keyIdx++}`} />;
            if (isInsideBox) boxContent.push(hrEl);
            else elements.push(hrEl);
        }
        // 4. Headings
        else if (trimmed.startsWith('# ')) {
            flushList();
            const content = parseInlineStyles(trimmed.slice(2));
            if (isInsideBox) boxContent.push(<h2 key={`h2-${keyIdx++}`}>{content}</h2>);
            else elements.push(<h2 key={`h2-${keyIdx++}`}>{content}</h2>);
        } else if (trimmed.startsWith('## ')) {
            flushList();
            const content = parseInlineStyles(trimmed.slice(3));
            if (isInsideBox) boxContent.push(<h3 key={`h3-${keyIdx++}`}>{content}</h3>);
            else elements.push(<h3 key={`h3-${keyIdx++}`}>{content}</h3>);
        } else if (trimmed.startsWith('### ')) {
            flushList();
            const content = parseInlineStyles(trimmed.slice(4));
            if (isInsideBox) boxContent.push(<h4 key={`h4-${keyIdx++}`}>{content}</h4>);
            else elements.push(<h4 key={`h4-${keyIdx++}`}>{content}</h4>);
        } else if (trimmed.startsWith('#### ')) {
            flushList();
            const content = parseInlineStyles(trimmed.slice(5));
            if (isInsideBox) boxContent.push(<h4 key={`h4-${keyIdx++}`}>{content}</h4>);
            else elements.push(<h4 key={`h4-${keyIdx++}`}>{content}</h4>);
        }
        // 5. Bullet list items
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!isInsideList || listType !== 'ul') {
                flushList();
                isInsideList = true;
                listType = 'ul';
            }
            const content = parseInlineStyles(trimmed.slice(2));
            listItems.push(<li key={`li-${keyIdx++}`}>{content}</li>);
        }
        // 6. Numbered list items
        else if (/^\d+\.\s/.test(trimmed)) {
            if (!isInsideList || listType !== 'ol') {
                flushList();
                isInsideList = true;
                listType = 'ol';
            }
            const content = parseInlineStyles(trimmed.replace(/^\d+\.\s/, ''));
            listItems.push(<li key={`li-${keyIdx++}`}>{content}</li>);
        }
        // 7. Empty lines
        else if (trimmed === '') {
            flushList();
        }
        // 8. Regular paragraphs
        else {
            flushList();
            const content = parseInlineStyles(trimmed);
            if (isInsideBox) {
                boxContent.push(<p key={`p-${keyIdx++}`}>{content}</p>);
            } else {
                elements.push(<p key={`p-${keyIdx++}`}>{content}</p>);
            }
        }
    });

    flushList();
    flushTable();
    flushBox();

    return <div className="ai-markdown-content">{elements}</div>;
};

// --- Main Panel Component ---
const AIAnalysisPanel = ({
    activeTab,
    trendType = 'rscore_avgscore',
    quadrantMode = 'rscore_avg',
    selectedDept,
    selectedDimension,
    rankings,
    graphData,
    currentYear,
    historicalData,
    currentDeptInfo,
    healthData,
    timelineRankData,
    zhengEffectThreshold = 80,
    yieldRateThreshold = 80
}) => {
    const [analysisCache, setAnalysisCache] = useState({});
    const analysisCacheRef = useRef({});
    const firedPrefixRef = useRef('');

    // Define isDataReady variable to check if necessary data exists before query execution
    const isDataReady = !!(
        rankings && rankings.length > 0 && 
        graphData && graphData.edges && 
        historicalData && historicalData.length > 0 &&
        healthData && healthData.length > 0
    );

    // Keep ref in sync with state
    useEffect(() => {
        analysisCacheRef.current = analysisCache;
    }, [analysisCache]);

    const doApiFetch = async (cacheKey, tabId, tType, qMode) => {
        try {
            const targetName = currentDeptInfo?.name ? currentDeptInfo.name.replace(/\n/g, ' ') : selectedDept;
            const dimensionText = selectedDimension === 'school' ? '學校' : selectedDimension === 'group' ? '系組' : '科系';

            const sortedRankings = [...rankings].sort((a,b) => (b.r_score || 0) - (a.r_score || 0));
            const targetRankIndex = sortedRankings.findIndex(r => r.id === selectedDept);
            const targetRank = targetRankIndex !== -1 ? targetRankIndex + 1 : 'N/A';
            const totalRanked = sortedRankings.length;
            const targetRS = rankings.find(r => r.id === selectedDept)?.r_score || 'N/A';
            const zhengEffectThresholdText = `${zhengEffectThreshold}%`;
            const yieldRateThresholdText = `${yieldRateThreshold}%`;

            const formatMetricValue = (value, digits = 1, suffix = '') => {
                const num = parseNumber(value);
                if (num === null) return 'N/A';
                return `${Number(num.toFixed(digits))}${suffix}`;
            };

            const sortedHistoricalRows = [...historicalData].sort((a, b) =>
                parseInt(a.name.replace(/\D/g, '')) - parseInt(b.name.replace(/\D/g, ''))
            );
            const currentYearNumber = parseInt(currentYear);
            const historicalRowsUpToCurrent = sortedHistoricalRows.filter(row => {
                const rowYear = parseInt(row.name.replace(/\D/g, ''));
                return !Number.isFinite(currentYearNumber) || rowYear <= currentYearNumber;
            });
            const rowsForNarrative = historicalRowsUpToCurrent.length > 0 ? historicalRowsUpToCurrent : sortedHistoricalRows;

            const formatMetricSequence = (id, key, label, digits = 1, suffix = '') => {
                const points = rowsForNarrative
                    .map(row => {
                        const value = row[`${id}_${key}`];
                        if (value === null || value === undefined) return null;
                        return {
                            year: row.name.replace('學年', ''),
                            value: formatMetricValue(value, digits, suffix)
                        };
                    })
                    .filter(Boolean);
                if (points.length === 0) return '';
                return `- ${label}（${points.map(p => p.year).join('→')}）：${points.map(p => p.value).join(' → ')}`;
            };

            const formatScreeningFromParts = (thresholds, groups) => {
                if (thresholds && thresholds.length > 0) return thresholds.join(' ➔ ');
                if (groups && groups.length > 0) {
                    return groups.map(group => {
                        const thresholdText = group.first_stage_thresholds && group.first_stage_thresholds.length > 0
                            ? group.first_stage_thresholds.join(' ➔ ')
                            : '無資料';
                        return `${group.group_name}(${thresholdText})`;
                    }).join('; ');
                }
                return '無資料';
            };

            const formatScreeningSequence = (id) => {
                const points = rowsForNarrative.map(row => ({
                    year: row.name.replace('學年', ''),
                    value: formatScreeningFromParts(row[`${id}_FirstStageThresholds`], row[`${id}_FirstStageGroups`])
                }));
                if (!points.length || points.every(point => point.value === '無資料')) return '';
                return `- 一階篩選門檻（${points.map(p => p.year).join('→')}）：${points.map(p => p.value).join(' → ')}`;
            };

            const targetMetricSummary = [
                formatMetricSequence(selectedDept, 'YieldRate', '報到率', 1, '%'),
                formatMetricSequence(selectedDept, 'ZhengEffect', '正取有效性', 1, '%'),
                formatMetricSequence(selectedDept, 'FlowRate', '流入登分比例', 1, '%'),
                formatMetricSequence(selectedDept, 'RScore', 'R-Score', 3),
                formatMetricSequence(selectedDept, 'AvgScore', '最低錄取平均分數', 3),
                formatMetricSequence(selectedDept, 'AvgScorePR', '最低錄取平均分數 PR', 1),
                formatScreeningSequence(selectedDept)
            ].filter(Boolean).join('\n');

            const yearLabels = rowsForNarrative.map(row => row.name.replace('學年', ''));
            const adjacentYearPairs = yearLabels.slice(1).map((year, index) => `${yearLabels[index]}→${year}`);
            const yearContinuityInstruction = Number.isFinite(currentYearNumber) && yearLabels.length > 1
                ? `目前焦點年度是 ${currentYear}學年度。單年度圖表請先說明 ${currentYear}學年度本身，再依時間順序補充 ${yearLabels.join('→')} 的連續變化；只能做相鄰年度比較（${adjacentYearPairs.join('、')}），不要跳過中間年度直接比較。`
                : `目前焦點年度是 ${currentYear || '當前'}學年度；若沒有前一年資料，請只做單年度分析，不要假裝有年增減。`;

            const comparisonBaseInstruction = `競爭對手比較基準：本次主要競爭對手以使用者目前點選的 ${currentYear}學年度競爭關係為基準；若分析跨年度趨勢，請先聲明此基準，並說明不同年度競爭對手可能變動。`;

            const analysisWritingRules = `
【AI 敘述規則】
- 請直接把關鍵數據寫進文字，不要只叫使用者回去看圖表；多年度數據請使用「指標（年度序列）：數值 → 數值 → 數值」格式，例如「報到率（111→112→113）：40% → 43.8% → 55.6%」。
- 解釋要有前因後果：先說數據變化，再說與競爭對手相比的相對變化，最後才下判斷。若本系最低錄取平均分數上升，但競爭對手上升更快，要明確說「分數改善未有效轉換成學生選擇上的競爭優勢」。
- ${yearContinuityInstruction}
- ${comparisonBaseInstruction}
- 用圖表中既有詞彙描述：R-Score、最低錄取平均分數、最低錄取平均分數 PR、報到率、正取有效性、流入登分比例、一階篩選門檻、競爭對手。避免使用過度學術或圖表沒有出現的詞彙。
- 一階篩選分析只能根據提供的門檻資料判斷；資料不足時請說「一階篩選門檻資料不足」，不要自行推測不存在的科目或倍率。
- 不要只解釋圖表表面意義；如果有同時錄取後的流失、流入、一階篩選門檻與競爭對手資料，必須追問背後原因，例如「學生最後選了誰」、「是否因為一階篩選門檻高度重合」、「是否應降低與強勢競爭對手的一階篩選重合率」。
`;

            const getScreeningTextForItem = (item) => {
                if (!item) return '無資料';
                if (selectedDimension === 'group') {
                    if (item.first_stage_thresholds && item.first_stage_thresholds.length > 0) {
                        return `一階篩選門檻 = ${item.first_stage_thresholds.join(' ➔ ')}`;
                    }
                    return '一階篩選門檻 = 無資料';
                }
                if (selectedDimension === 'dept') {
                    if (item.first_stage_groups && item.first_stage_groups.length > 0) {
                        const groupTexts = item.first_stage_groups.map(g =>
                            `${g.group_name}(篩選門檻: ${g.first_stage_thresholds ? g.first_stage_thresholds.join(' ➔ ') : '無資料'})`
                        );
                        return `各群類別一階篩選 = ${groupTexts.join('; ')}`;
                    }
                    return '一階篩選門檻 = 無資料';
                }
                return '一階篩選門檻 = 無資料';
            };

            const getCleanName = (itemOrName) => {
                const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.name;
                return (name || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            };

            const findRankingInfoByName = (name) => {
                const cleanName = getCleanName(name);
                return rankings.find(item => getCleanName(item) === cleanName) || null;
            };

            const findHealthInfoByName = (name) => {
                const cleanName = getCleanName(name);
                return healthData.find(item => getCleanName(item) === cleanName) || null;
            };

            const getScreeningSourceByName = (name, fallbackItem = null) => {
                return findHealthInfoByName(name) || findRankingInfoByName(name) || fallbackItem;
            };

            const getScreeningEntries = (item) => {
                if (!item) return [];
                if (item.first_stage_thresholds && item.first_stage_thresholds.length > 0) {
                    return item.first_stage_thresholds.map(value => ({
                        raw: String(value).trim(),
                        subject: String(value).replace(/\(.+?\)/g, '').trim()
                    }));
                }
                if (item.first_stage_groups && item.first_stage_groups.length > 0) {
                    return item.first_stage_groups.flatMap(group =>
                        (group.first_stage_thresholds || []).map(value => ({
                            raw: String(value).trim(),
                            subject: String(value).replace(/\(.+?\)/g, '').trim(),
                            groupName: group.group_name
                        }))
                    );
                }
                return [];
            };

            const formatScreeningOverlap = (targetItem, compItem) => {
                const targetEntries = getScreeningEntries(targetItem);
                const compEntries = getScreeningEntries(compItem);
                if (targetEntries.length === 0 || compEntries.length === 0) return '資料不足';

                const targetRawSet = new Set(targetEntries.map(entry => entry.raw));
                const targetSubjectSet = new Set(targetEntries.map(entry => entry.subject));
                const exactMatches = compEntries
                    .filter(entry => targetRawSet.has(entry.raw))
                    .map(entry => entry.raw);
                const subjectMatches = compEntries
                    .filter(entry => !targetRawSet.has(entry.raw) && targetSubjectSet.has(entry.subject))
                    .map(entry => entry.raw);

                const parts = [];
                if (exactMatches.length > 0) parts.push(`完全相同項目：${[...new Set(exactMatches)].join('、')}`);
                if (subjectMatches.length > 0) parts.push(`同科目但門檻不同：${[...new Set(subjectMatches)].join('、')}`);
                return parts.length > 0 ? parts.join('；') : '未見明顯重合';
            };

            const formatHealthText = (item) => {
                if (!item) return '招生效益資料 = 無資料';
                return `報到率 = ${item.yield_rate}% | 正取有效性 = ${item.zheng_effect}% | 流入登分比例 = ${item.flow_rate}%`;
            };

            const buildFlowDiagnosticSummary = () => {
                const connectedEdges = graphData.edges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
                const targetRankingInfo = rankings.find(r => r.id === selectedDept);
                const targetNameForLookup = getCleanName(targetRankingInfo) || targetName;
                const targetScreeningSource = getScreeningSourceByName(targetNameForLookup, targetRankingInfo);
                const targetOverlapSource = targetRankingInfo || targetScreeningSource;
                const targetScreening = getScreeningTextForItem(targetScreeningSource);

                const formatEdge = (edge, direction) => {
                    const compId = edge.from === selectedDept ? edge.to : edge.from;
                    const compRankingInfo = rankings.find(r => r.id === compId);
                    const compName = getCleanName(compRankingInfo) || compId;
                    const compHealthInfo = findHealthInfoByName(compName);
                    const compScreeningSource = getScreeningSourceByName(compName, compRankingInfo);
                    const compOverlapSource = compRankingInfo || compScreeningSource;
                    const compScreening = getScreeningTextForItem(compScreeningSource);
                    const screeningOverlap = formatScreeningOverlap(targetOverlapSource, compOverlapSource);
                    const compRScore = compRankingInfo?.r_score ?? 'N/A';
                    const compAvgScore = compRankingInfo?.avg_score ?? 'N/A';
                    const compHealthText = formatHealthText(compHealthInfo);
                    const label = direction === 'outflow' ? '流失至' : direction === 'inflow' ? '從對手流入' : '雙方都沒選';
                    return `- ${label}【${compName}】：${edge.value || 0} 人 | 對手 R-Score = ${compRScore} | 對手最低錄取平均分數 = ${compAvgScore} | ${compHealthText} | 本校${targetScreening} | 對手${compScreening} | 與本校一階重合 = ${screeningOverlap}`;
                };

                const outflows = connectedEdges
                    .filter(edge => !edge.drawn && edge.from === selectedDept)
                    .sort((a, b) => (b.value || 0) - (a.value || 0))
                    .map(edge => formatEdge(edge, 'outflow'));
                const inflows = connectedEdges
                    .filter(edge => !edge.drawn && edge.to === selectedDept)
                    .sort((a, b) => (b.value || 0) - (a.value || 0))
                    .map(edge => formatEdge(edge, 'inflow'));
                const draws = connectedEdges
                    .filter(edge => edge.drawn)
                    .sort((a, b) => (b.value || 0) - (a.value || 0))
                    .map(edge => formatEdge(edge, 'draw'));

                return `
【招生效益背後原因診斷資料】
1. 主要流失對手（本校與對手同時錄取，學生最後選對手）：
${outflows.length > 0 ? outflows.join('\n') : '- 無顯著流失資料'}

2. 主要流入對手（本校與對手同時錄取，學生最後選本校）：
${inflows.length > 0 ? inflows.join('\n') : '- 無顯著流入資料'}

3. 雙方都沒選（學生同時錄取本校與對手，但最後兩邊都沒選）：
${draws.length > 0 ? draws.join('\n') : '- 無顯著雙方都沒選資料'}
`;
            };

            const flowDiagnosticSummary = buildFlowDiagnosticSummary();

            // Choose prompt and content based on tabId
            let systemPrompt = `你是一個高階教育校務研究與招生戰略分析專家。請只使用正體中文（繁體中文）回答問題。請直接輸出分析結果（直接從大標題或第一段診斷內容開始），絕對不能包含任何社交寒暄、客套話、前言、開場白（例如「好的，我將為您分析...」、「身為分析專家，我將針對...」等）以及結語，直奔分析主題。重要：請勿使用 LaTeX 數學符號或 LaTeX 語法（例如：不要使用 $ 符號包裹算式、不要使用 \\times、\\%、\\frac 等 LaTeX 命令），請直接使用一般文字與符號（如：使用 × 或 * 表示相乘、使用 % 表示百分比、直接書寫 4/4 = 100% 即可）。
${analysisWritingRules}`;
            let prompt = "";

            if (tabId === 'network') {
                const getScreeningText = (item) => {
                    if (!item) return '無資料';
                    if (selectedDimension === 'group') {
                        if (item.first_stage_thresholds && item.first_stage_thresholds.length > 0) {
                            return `一階篩選門檻 = ${item.first_stage_thresholds.join(' ➔ ')}`;
                        }
                        return '一階篩選門檻 = 無資料';
                    } else if (selectedDimension === 'dept') {
                        if (item.first_stage_groups && item.first_stage_groups.length > 0) {
                            const groupTexts = item.first_stage_groups.map(g => 
                                `${g.group_name}(篩選門檻: ${g.first_stage_thresholds ? g.first_stage_thresholds.join(' ➔ ') : '無資料'})`
                            );
                            return `各群類別一階篩選 = ${groupTexts.join('; ')}`;
                        }
                        return '一階篩選門檻 = 無資料';
                    }
                    return '';
                };

                const targetRankingInfo = rankings.find(r => r.id === selectedDept);
                const targetNameForLookup = getCleanName(targetRankingInfo) || targetName;
                const targetScreeningSource = getScreeningSourceByName(targetNameForLookup, targetRankingInfo);
                const targetOverlapSource = targetRankingInfo || targetScreeningSource;
                const targetScreening = getScreeningText(targetScreeningSource);

                const connectedEdges = graphData.edges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
                const inflow = [];
                const outflow = [];
                const draws = [];

                connectedEdges.forEach(edge => {
                    if (edge.from === edge.to) return;
                    
                    const fromId = edge.from;
                    const toId = edge.to;
                    const fromName = rankings.find(r => r.id === fromId)?.name.replace(/\n/g, ' ') || fromId;
                    const toName = rankings.find(r => r.id === toId)?.name.replace(/\n/g, ' ') || toId;

                    const compId = edge.from === selectedDept ? toId : fromId;
                    const compRankingInfo = rankings.find(r => r.id === compId);
                    const compNameForLookup = getCleanName(compRankingInfo);
                    const compScreeningSource = getScreeningSourceByName(compNameForLookup, compRankingInfo);
                    const compOverlapSource = compRankingInfo || compScreeningSource;
                    const compScreening = getScreeningText(compScreeningSource);
                    const screeningOverlap = formatScreeningOverlap(targetOverlapSource, compOverlapSource);

                    if (edge.drawn) {
                        draws.push(`- 與【${edge.from === selectedDept ? toName : fromName}】雙方都沒選（同時錄取學生最後兩邊都沒選）：${edge.value || 0} 人 [對手${compScreening}；與本校一階重合 = ${screeningOverlap}]`);
                    } else if (edge.from === selectedDept) {
                        outflow.push(`- 流失至【${toName}】（考生選擇對方）：${edge.value || 0} 人 [對手${compScreening}；與本校一階重合 = ${screeningOverlap}]`);
                    } else {
                        inflow.push(`- 從【${fromName}】流入（考生選擇本校）：${edge.value || 0} 人 [對手${compScreening}；與本校一階重合 = ${screeningOverlap}]`);
                    }
                });

                prompt = `
請針對以下【競爭關係網】數據進行深入分析，解釋目標${dimensionText}在當前學年度競爭群中的定位與攻防狀況：

【分析主體資訊】
- 目標${dimensionText}：${targetName}
- 維度：${dimensionText} 層級
- 當年度：${currentYear}學年度
- 本系當年度 R-Score：${targetRS}
- 本系在所有校系中的 R-Score 排名：第 ${targetRank} 名 / 共 ${totalRanked} 個
- 本校一階篩選門檻：${targetScreening}

【本系歷年連續數據】
${targetMetricSummary || '- 無歷年連續數據'}

${flowDiagnosticSummary}

【年度與比較基準】
${yearContinuityInstruction}
${comparisonBaseInstruction}

【當年度同時錄取後的學生選擇流向】
1. 學生選擇本校（本校與對手同時錄取，學生最後登記本校）：
${inflow.length > 0 ? inflow.join('\n') : '- 無顯著流入數據'}

2. 學生選擇對手（本校與對手同時錄取，學生最後登記對方）：
${outflow.length > 0 ? outflow.join('\n') : '- 無顯著流失數據'}

3. 雙方都沒選（同時錄取學生最後沒有選本校，也沒有選該對手）：
${draws.length > 0 ? draws.join('\n') : '- 無顯著雙方都沒選數據'}

請幫校方進行以下「單一年度競爭診斷與策略分析」並給予建議：
1. 【最大競爭對手與門檻重合診斷】：識別本${dimensionText}當年度的主要競爭對手有哪些？誰是搶走我們最多學生的「最大流失對手」？並重點評估本校與該最大對手之間，一階篩選門檻（順序1~5）是否高度重合？分析若對方品牌/實力較強但我們篩選門檻卻與之重合，是否會使我們被學生當成「保底選項」（也就是學生若兩個都錄取，會優先選更想去的學校，導致我們流失同時錄取學生）。
   - 最大流失對手必須以「流失學生人數最多」為準；如果門檻較相似的是其他流失人數較少的對手，請另列為「其他門檻重合對手」，不可取代最大流失對手的判斷。
2. 【流入/流失強弱勢診斷】：分析學生在哪些對手之間最後選擇本校（流入），在哪些對手之間最後選擇對手（流失）？這背後代表了學生在選填時面臨怎樣的替代性與吸引力差距（如學校品牌、就業吸引力、地理位置等）？
3. 【篩選門檻調控與防禦策略建議】：針對上述流失狀況與篩選門檻重合度，校方應如何調控一階篩選條件（順序1~5）以錯開與最大競爭對手的重合，防止篩到會優先去更強對手的考生，進而提升登記就讀率？請以條列方式提出具體操作建議。
`;
            } else if (tabId === 'trend') {
                const trendRows = [];
                const connectedEdges = graphData.edges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
                const topCompetitors = connectedEdges
                    .map(e => e.from === selectedDept ? e.to : e.from)
                    .filter((value, index, self) => self.indexOf(value) === index)
                    .map(id => {
                        const edgeSum = connectedEdges
                            .filter(e => e.from === id || e.to === id)
                            .reduce((sum, e) => sum + (e.value || 0), 0);
                        return { id, weight: edgeSum };
                    })
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 3)
                    .map(c => c.id);

                historicalData.forEach(yrData => {
                    trendRows.push(`- **${yrData.name}** (本校): R-Score = ${yrData[`${selectedDept}_RScore`] || 'N/A'}, 最低錄取平均分數 = ${yrData[`${selectedDept}_AvgScore`] || 'N/A'}, 最低錄取平均分數PR = ${yrData[`${selectedDept}_AvgScorePR`] || 'N/A'}, 報到率 = ${yrData[`${selectedDept}_YieldRate`] != null ? yrData[`${selectedDept}_YieldRate`] + '%' : 'N/A'}, 正取有效性 = ${yrData[`${selectedDept}_ZhengEffect`] != null ? yrData[`${selectedDept}_ZhengEffect`] + '%' : 'N/A'}, 流入登分比例 = ${yrData[`${selectedDept}_FlowRate`] != null ? yrData[`${selectedDept}_FlowRate`] + '%' : 'N/A'}, 一階篩選門檻 = ${formatScreeningFromParts(yrData[`${selectedDept}_FirstStageThresholds`], yrData[`${selectedDept}_FirstStageGroups`])}`);
                    topCompetitors.forEach(compId => {
                        const compName = rankings.find(r => r.id === compId)?.name.replace(/\n/g, ' ') || compId;
                        trendRows.push(`  - 對手【${compName}】: R-Score = ${yrData[`${compId}_RScore`] || 'N/A'}, 最低錄取平均分數 = ${yrData[`${compId}_AvgScore`] || 'N/A'}, 最低錄取平均分數PR = ${yrData[`${compId}_AvgScorePR`] || 'N/A'}, 報到率 = ${yrData[`${compId}_YieldRate`] != null ? yrData[`${compId}_YieldRate`] + '%' : 'N/A'}, 正取有效性 = ${yrData[`${compId}_ZhengEffect`] != null ? yrData[`${compId}_ZhengEffect`] + '%' : 'N/A'}, 流入登分比例 = ${yrData[`${compId}_FlowRate`] != null ? yrData[`${compId}_FlowRate`] + '%' : 'N/A'}, 一階篩選門檻 = ${formatScreeningFromParts(yrData[`${compId}_FirstStageThresholds`], yrData[`${compId}_FirstStageGroups`])}`);
                    });
                });

                if (tType === 'rscore') {
                    prompt = `
請針對以下歷年【品牌強度 R-Score 競爭力趨勢】數據進行深度分析，診斷本${dimensionText}歷年的競爭力變化：

【分析主體與主要競爭對手歷年 R-Score 數據】
${trendRows.join('\n')}

【比較基準】
${comparisonBaseInstruction}

請幫校方進行以下「歷年競爭強度 (R-Score) 趨勢診斷」：
1. 【自身品牌實力消長】：本${dimensionText}歷年的 R-Score 競爭力是逐年上升、下降，還是持平？這反映了本${dimensionText}招生品牌實力的發展方向？
2. 【對手競爭力趨勢對比】：在固定/主要的競爭對手群中，哪些對手逐年上升？哪些對手逐年下降？本${dimensionText}與主要競爭對手的實力差距（R-Score 差距）是在拉大還是在縮小？我們是否面臨被後段對手追趕或被前段對手拉開差距的壓力？
3. 【品牌強化與定位引導策略】：針對上述趨勢，校方應採取哪些具體措施來穩定並提升 R-Score（如強化宣傳、重新包裝定位、特色跨域課程等）？請以條列方式提出策略建議。
`;
                } else if (tType === 'avgscore') {
                    prompt = `
請針對以下歷年【錄取分數門檻與 PR 值趨勢】數據進行深度分析，診斷本${dimensionText}歷年分數表現與其背後招生機制的消長：

【分析主體與主要競爭對手歷年錄取分數及 PR 數據】
${trendRows.join('\n')}

【比較基準】
${comparisonBaseInstruction}

請幫校方進行以下「錄取分數與 PR 趨勢診斷」：
1. 【分數與 PR 相對定位消長】：本${dimensionText}的平均錄取分數及平均分數 PR 歷年呈現何種變化？
2. 【矛盾情況診斷（錄取分數上升但 PR 下降）】：檢視是否出現「錄取分數上升，但平均 PR 反而下降」的情況？若有，請解釋其原因（是否是整體分數環境上升的結果，而本系相對競爭力實則下滑？這與流入登分比例的變化有何關聯？）。
3. 【流入登分比例與錄取分數的聯動效應】：分析流入登分比例是否與錄取分數存在反向聯動？（例如流入登分比例下降，是否帶動錄取分數與相對 PR 上升？若流入登分比例長期偏高，如何導致後續錄取分數被拉低？）。
4. 【穩定錄取分數與選材優化策略】：校方應如何調控以降低流入登分比例、穩定錄取分數？（如調整考科採計、落點最佳化等）。請以條列方式提出策略建議。
`;
                } else if (tType === 'flow_pr') {
                    prompt = `
請針對以下歷年【流入登分比例與錄取分數關係 (缺額落點分析)】數據進行深度分析，診斷本${dimensionText}缺額名額流入如何影響分數表現與招生實力：

【分析主體與主要競爭對手歷年 R-Score、平均分數 PR 與流入登分比例數據】
${trendRows.join('\n')}

【比較基準】
${comparisonBaseInstruction}

請幫校方進行以下「歷年流入登分比例與錄取分數關係診斷」：
1. 【自身流入登分比例與分數聯動分析】：本${dimensionText}歷年流入登記分發的名額比例（FlowRate，即缺額流入登分比例）有何變化趨勢？當流入登分比例上升時，錄取分數與相對 PR 是否隨之被拉低？而當流入比例下降（代表甄審階段留住更多學生）時，錄取分數與相對 PR 是否有回升？
2. 【競爭對手流入比例對比診斷】：與主要競爭對手相比，本${dimensionText}的流入登分比例是偏高還是偏低？如果對手的流入名額較少、而本${dimensionText}顯著偏高，這是否是導致本${dimensionText}錄取分數和 PR 排名落後於競爭對手的主要原因之一？
3. 【甄審階段留才效益與策略建議】：若流入登分比例長期偏高，代表甄審階段的留人效率有待加強。校方應如何優化一階篩選條件（如防止篩到會優先去更強對手的考生）、設計更具就讀忠誠度的選材與備取策略，以實質降低流入比例並穩定後續登記分發分數？請以條列方式提出具體操作建議。
`;
                } else {
                    // tType === 'rscore_avgscore'
                    prompt = `
請針對以下歷年【品牌強度 R-Score 與錄取分數 PR 綜合趨勢】數據進行深度分析，診斷本${dimensionText}的招生表現與競爭力的一致性：

【分析主體與主要競爭對手歷年 R-Score、平均分數 PR 與流入登分比例數據】
${trendRows.join('\n')}

【比較基準】
${comparisonBaseInstruction}

請幫校方進行以下「品牌強度與分數 PR 的綜合一致性診斷」：
1. 【競爭力與錄取表現一致性評估】：評估本${dimensionText}的歷年 brand 競爭力（R-Score）與分數表現是否一致？對照以下情況診斷其意義：
   - 【同步改善】（RS 上升，PR 上升）：競爭力與實際分數表現皆強勢成長。
   - 【同步變弱】（RS 下降，PR 下降）：品牌吸引力與錄取表現皆下滑。
   - 【指標改善但實際未跟上】（RS 上升，PR 下降）：指標競爭力改善，但實際錄取分數表現未隨之提升，是否被對手進步幅度超越？
   - 【分數改善但吸引力下降】（RS 下降，PR 上升）：實際分數改善（可能因名額控制或分發有利），但同時錄取學生最後選擇本校的表現下降。
2. 【流入登分比例的負面影響解讀】：本${dimensionText}與主要對手相比，流入登分比例是否偏高？這如何解釋了本${dimensionText}「分數上升但相對 PR 排名下滑」或「競爭力指標與分數出現落差」的現象？
3. 【校方具體精準招生與選材建議】：為了讓品牌強度與錄取分數同步回升、並減少登記分發的流入比例，校方應採取哪些戰略作為？請以條列方式提出策略建議。
`;
                }
            } else if (tabId === 'health') {
                const getScreeningText = (item) => {
                    if (!item) return '無資料';
                    if (selectedDimension === 'group') {
                        if (item.first_stage_thresholds && item.first_stage_thresholds.length > 0) {
                            return `一階篩選門檻 = ${item.first_stage_thresholds.join(' ➔ ')}`;
                        }
                        return '一階篩選門檻 = 無資料';
                    } else if (selectedDimension === 'dept') {
                        if (item.first_stage_groups && item.first_stage_groups.length > 0) {
                            const groupTexts = item.first_stage_groups.map(g => 
                                `${g.group_name}(篩選門檻: ${g.first_stage_thresholds ? g.first_stage_thresholds.join(' ➔ ') : '無資料'})`
                            );
                            return `各群類別一階篩選 = ${groupTexts.join('; ')}`;
                        }
                        return '一階篩選門檻 = 無資料';
                    }
                    return '';
                };

                const healthItems = [];
                healthData.forEach(item => {
                    const isSelf = item.name.includes(targetName.split(' ')[0]) || item.name.includes(targetName);
                    const screeningText = getScreeningText(item);
                    healthItems.push(`- **${item.name}** ${isSelf ? '(本校)' : '(對手)'}: 甄審報到率 = ${item.yield_rate}% | 正取有效性 = ${item.zheng_effect}% | 流失/空缺比例 (即流入登分比例) = ${item.flow_rate}% | ${screeningText}`);
                });

                prompt = `
請針對以下學年度【招生效益】數據進行深入分析，診斷本${dimensionText}在甄審階段與後續分發的健康狀況：

【分析主體與主要競爭對手招生效益數據】
${healthItems.join('\n')}

【本系歷年連續數據】
${targetMetricSummary || '- 無歷年連續數據'}

【年度與比較基準】
${yearContinuityInstruction}
${comparisonBaseInstruction}

【指標定義說明】
- **正取有效性（正取生登記就讀率）**：正取生最終登記報到的比例，代表正取生「是否真的願意來」。
- **甄審報到率（最終甄審報到人數佔招生名額比例）**：代表「備取生是否願意遞補進來」。
- **流失/空缺比例（流入登分比例）**：未能在甄審階段填滿、最終流入登記分發的名額比例。

請幫校方進行以下「招生效益與策略分析」：
1. 【正備取留才健康度與門檻重合診斷】：以正取有效性 ${zhengEffectThresholdText} 與報到率 ${yieldRateThresholdText} 作為高低基準，對照四種招生情境評估本${dimensionText}當前的招生狀態。接著不要停在象限意義，必須用「招生效益背後原因診斷資料」指出學生主要被誰搶走、流失人數是多少、該對手的一階篩選門檻是什麼。
2. 【被誰搶走與為什麼被搶走】：針對主要流失對手，比較本校與對手的 R-Score、最低錄取平均分數、報到率、正取有效性、流入登分比例與一階篩選門檻。若本校與對手的一階篩選門檻高度重合，請明確說明這可能導致篩到同一批考生，而考生最後選擇對手。
3. 【流入登分比例與錄取分數的連動影響】：與主要競爭對手相比，本${dimensionText}的流入登分比例是否偏高？這是否是導致最低錄取平均分數被拉低或改善未轉換成競爭優勢的主要因素？
4. 【降低一階篩選重合率建議】：針對上述健康度與流失對手問題，校方應如何調整一階篩選條件（順序1~5）以降低與強勢競爭對手的重合率，防止篩進來的考生因優先選擇對方而流失？請以條列方式提出具體操作建議。
`;
            } else if (tabId === 'quadrant') {
                // Helper function for calculations
                const calculatePercentileRank = (data, field, targetField) => {
                    const values = data.map(d => d[field]).filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
                    return data.map(d => ({
                        ...d,
                        [targetField]: d[field] === null || d[field] === undefined ? null : 
                            Math.round((values.indexOf(d[field]) / (values.length - 1)) * 100)
                    }));
                };
                const calculateAverageScorePercentileRank = (data, field, targetField) => {
                    const values = data.map(d => d[field]).filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
                    return data.map(d => ({
                        ...d,
                        [targetField]: d[field] === null || d[field] === undefined ? null : 
                            Math.round((values.indexOf(d[field]) / (values.length - 1)) * 100)
                    }));
                };

                const rScorePrData = calculatePercentileRank(rankings, 'r_score', 'r_score_pr');
                const bothPrData = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr');
                const selfPr = bothPrData.find(item => item.id === selectedDept);

                const currentRPr = selfPr?.r_score_pr !== null ? selfPr.r_score_pr : 'N/A';
                const currentAPr = selfPr?.avg_score_pr !== null ? selfPr.avg_score_pr : 'N/A';
                const currentZheng = currentDeptInfo?.zheng_effect !== undefined ? (currentDeptInfo.zheng_effect * 100).toFixed(1) : 'N/A';
                const currentYield = currentDeptInfo?.yield_rate !== undefined ? (currentDeptInfo.yield_rate * 100).toFixed(1) : 'N/A';

                const pathPoints = [];
                historicalData.forEach(yrData => {
                    pathPoints.push(`- **${yrData.name}**: R-Score = ${yrData[`${selectedDept}_RScore`] || 'N/A'}, 平均分數 = ${yrData[`${selectedDept}_AvgScore`] || 'N/A'}`);
                });

                if (qMode === 'effect_yield') {
                    prompt = `
請針對以下【四象限落點定位 - 招生效益落點】數據進行深度分析，診斷本${dimensionText}的正備取招生轉換效益與流失風險：

【分析主體資訊】
- 目標${dimensionText}：${targetName}
- 維度：${dimensionText} 層級

招生效益核心數據（${currentYear}學年度）：
- **正取有效性（正取生登記就讀率）**: ${currentZheng}% (象限門檻為 ${zhengEffectThresholdText})
- **報到率（最終入學人數佔名額比例）**: ${currentYield}% (象限門檻為 ${yieldRateThresholdText})

【本系歷年連續數據】
${targetMetricSummary || '- 無歷年連續數據'}

${flowDiagnosticSummary}

象限類型定義：
1. 【高效穩定型】(正取有效性 >= ${zhengEffectThresholdText}, 報到率 >= ${yieldRateThresholdText})：代表正取生就讀意願高，最終報到狀況也穩定。
2. 【備取依賴型】(正取有效性 < ${zhengEffectThresholdText}, 報到率 >= ${yieldRateThresholdText})：代表正取生流失較多，但靠備取遞補把報到率拉回穩定水準。
3. 【精準但不足型】(正取有效性 >= ${zhengEffectThresholdText}, 報到率 < ${yieldRateThresholdText})：代表正取生願意來，但整體報到率仍不足，可能要檢視招生名額、備取人數或遞補狀況。
4. 【招生弱勢型】(正取有效性 < ${zhengEffectThresholdText}, 報到率 < ${yieldRateThresholdText})：代表正取有效性與報到率都未達各自基準，招生轉換狀況偏弱。

請幫校方進行以下「招生效益落點與二階篩選診斷」：
1. 【當前招生效益定位】：本${dimensionText}目前處於哪一個招生效益象限？請以正取有效性 ${zhengEffectThresholdText} 與報到率 ${yieldRateThresholdText} 作為判斷基準，先說明單年度位置，再用同時錄取後的流失/流入資料解釋背後原因。
2. 【被誰搶走與為什麼被搶走】：如果正取有效性或報到率偏低，請指出學生主要流失到哪些競爭對手、流失人數是多少，並比較本校與對手的一階篩選門檻是否高度重合。若門檻重合且對手 R-Score、最低錄取平均分數或報到率較好，請說明這可能代表本校篩到的學生更容易選擇對手。
3. 【降低一階篩選重合率診斷】：請判斷是否應降低與主要流失對手的一階篩選重合率，例如調整篩選科目順序、門檻或避開與強勢對手完全相同的篩選組合；若資料不足，請明確說資料不足。
4. 【二階甄試與忠誠度診斷】：正取有效性高低代表正取生真的願意來的意願。如果正取有效性偏低，代表發出正取的學生大多流向其他更強競爭學校。我們在面試或書審階段，是否未能有效甄別考生的「就讀忠誠度」？
5. 【正備取名額優化建議】：
   - 應如何科學地調整正備取名額比例與備取倍率？
   - 在甄試面試設計、聯絡正備取生以及宣傳策略上，應採取什麼行動來提高正取就讀率或確保備取遞補成功，進而降低流入登分比例？請以條列方式提出具體操作建議。
`;
                } else {
                    prompt = `
請針對以下【四象限落點定位與歷年移動軌跡】數據進行深度分析，診斷本${dimensionText}品牌競爭力落點與歷年消長：

【分析主體資訊】
- 目標${dimensionText}：${targetName}
- 維度：${dimensionText} 層級

當年度四象限指標（${currentYear}學年度）：
- **R-Score PR（品牌競爭百分等級）**: ${currentRPr} (中位數為 50)
- **最低錄取平均分數 PR（考生成績百分等級）**: ${currentAPr} (中位數為 50)

歷年分數與實力消長路徑：
${pathPoints.join('\n')}

【本系歷年連續數據】
${targetMetricSummary || '- 無歷年連續數據'}

象限類型定義：
1. 【強勢落點型】(R-Score PR >= 50, Avg PR >= 50)：品牌吸引力與錄取分數皆高於中位數，為理想的招生狀態。
2. 【競爭支撐型】(R-Score PR >= 50, Avg PR < 50)：吸引力強（同時錄取學生較願意選擇本系），但錄取學生的學測成績偏低，可能有名額過多或篩選門檻限制，有待提升分數門檻。
3. 【分數支撐型】(R-Score PR < 50, Avg PR >= 50)：分數高，但品牌吸引力弱，同時錄取學生容易把本校當成保底選項，存在嚴重的「高分保底化」風險。
4. 【落點弱勢型】(R-Score PR < 50, Avg PR < 50)：雙低弱勢，品牌實力與錄取分數皆落後。

請幫校方進行以下「圖表細節分析與軌跡診斷」並給予建議：
1. 【當前品牌定位診斷】：本${dimensionText}目前處於哪一個定位象限？是否面臨「高分備胎化（分數高但吸引力弱）」或「雙低弱勢」的風險？
2. 【歷年移動軌跡消長】：分析歷年軌跡走向。我們的競爭實力是朝著「強勢落點型」健康移動，還是逐漸向「落點弱勢型」或「分數支撐型（備胎化）」傾斜？這反映了這幾年招生或考科採計策略的成效如何？
3. 【定位引導與策略建議】：若要將定位軌跡引導至「強勢落點型」，校方該採取何種具體戰略（如調整考科採計、重新包裝學系定位、或是加強特定競爭對手的防範）？請以條列方式提出策略建議。
`;
                }
            } else if (tabId === 'timeline') {
                const timelinePoints = [];
                timelineRankData.forEach((data) => {
                    const ranks = data.ranks || {};
                    const totalCount = data.totalCount || 0;
                    const currId = data.selectedDeptId || selectedDept;
                    const currRank = ranks[currId];
                    const pr = currRank ? Math.round((1 - (currRank - 1) / totalCount) * 100) : 'N/A';
                    
                    timelinePoints.push(`- **${data.year}**:`);
                    timelinePoints.push(`  - 本校排名: ${currRank || 'N/A'} / 總競爭數 ${totalCount} (PR ${pr})`);
                });

                let fixedCompText = "- 無固定競爭對手數據";
                let newCompText = "- 無新增競爭對手數據";
                let disappearedCompText = "- 無消失競爭對手數據";

                if (timelineRankData && timelineRankData.length > 0) {
                    const sortedTimeline = [...timelineRankData].sort((a, b) => parseInt(a.year) - parseInt(b.year));
                    const latestYearData = sortedTimeline[sortedTimeline.length - 1];
                    const previousYearsData = sortedTimeline.slice(0, sortedTimeline.length - 1);

                    const latestIds = latestYearData ? (latestYearData.activeIds || []) : [];
                    const previousIdsUnion = new Set();
                    const previousIdsIntersection = new Set();
                    let isFirstPrev = true;

                    previousYearsData.forEach(yr => {
                        (yr.activeIds || []).forEach(id => {
                            previousIdsUnion.add(id);
                        });
                        if (isFirstPrev) {
                            (yr.activeIds || []).forEach(id => previousIdsIntersection.add(id));
                            isFirstPrev = false;
                        } else {
                            const currentYrIds = new Set(yr.activeIds || []);
                            for (let id of previousIdsIntersection) {
                                if (!currentYrIds.has(id)) {
                                    previousIdsIntersection.delete(id);
                                }
                            }
                        }
                    });

                    const latestNamesMap = latestYearData ? (latestYearData.names || {}) : {};
                    const getDeptName = (id) => {
                        const cleanName = latestNamesMap[id] || rankings.find(r => r.id === id)?.name || id;
                        return cleanName.replace(/\n/g, ' ').trim();
                    };

                    const getPrevDeptName = (id) => {
                        const prevYr = previousYearsData.find(yr => yr.names && yr.names[id]);
                        const cleanName = prevYr ? prevYr.names[id] : rankings.find(r => r.id === id)?.name || id;
                        return cleanName.replace(/\n/g, ' ').trim();
                    };

                    const newIds = latestIds.filter(id => id !== selectedDept && !previousIdsUnion.has(id));
                    const disappearedIds = Array.from(previousIdsUnion).filter(id => id !== selectedDept && !latestIds.includes(id));
                    const fixedIds = latestIds.filter(id => id !== selectedDept && previousIdsIntersection.has(id));

                    if (newIds.length > 0) {
                        newCompText = newIds.map(id => `- 【${getDeptName(id)}】(從未在往年競爭圈出現，今年新增)`).join('\n');
                    }
                    if (disappearedIds.length > 0) {
                        disappearedCompText = disappearedIds.map(id => `- 【${getPrevDeptName(id)}】(往年有競爭關係，今年已退出競爭圈)`).join('\n');
                    }
                    if (fixedIds.length > 0) {
                        fixedCompText = fixedIds.map(id => `- 【${getDeptName(id)}】(歷年皆存在競爭關係，屬於長期主要對手)`).join('\n');
                    }
                }

                prompt = `
請針對以下【競爭時間軸與同時錄取對手變化】數據進行深度分析，解釋目標${dimensionText}在歷史競爭版圖中的變化：

【分析主體資訊】
- 目標${dimensionText}：${targetName}
- 維度：${dimensionText} 層級

【歷年名次與百分等級（PR）演進】
${timelinePoints.join('\n')}

【競爭圈結構動態分析】
1. 固定競爭對手（歷年皆有同時錄取競爭關係）：
${fixedCompText}

2. 新增競爭對手（今年新加入同時錄取競爭圈）：
${newCompText}

3. 消失競爭對手（往年有競爭關係，今年已退出）：
${disappearedCompText}

請幫校方進行以下「競爭對手變化診斷」：
1. 【自身相對位置消長】：在同時錄取競爭圈中，我們歷年的名次與相對百分等級（PR）是上升、持平還是下降？這代表我們在競爭版圖中的實力是在穩步增長還是逐漸衰退？我們的市場定位是否正在被重新定義？
2. 【競爭對手結構與異動解讀】：
   - 【對於固定對手】：我們與固定對手的實力差距是在縮小還是拉大？誰在持續成長對我們構成長期壓力？我們是否長期落後同一批對手，抑或逐漸追上他們？
   - 【對於消失對手】：他們為何退出競爭圈？是他們變得太強（升級到更高層次競爭圈），還是變弱（退出本校系競爭範圍），亦或是學生的選填偏好或招生條件發生了轉移？
   - 【對於新增對手】：今年為何會有新對手加入？這是否意味著學生的選填偏好出現轉移？本${dimensionText}面臨了什麼樣的新招生壓力？
3. 【主要流失對手與本系優勢對手】：根據競爭關係，分析哪些對手經常讓同時錄取學生最後選擇對方？我們又在哪些對手面前比較有優勢，能讓學生最後選擇本系？
4. 【防堵包夾與戰略防禦建議】：面對新對手的侵入、舊對手的長期拉鋸與天敵威脅，校方應如何調整招生宣傳、推廣與資源調配，防堵對手包夾並鞏固領先位置？請以條列方式提出策略建議。
`;
            } else if (tabId === 'flow') {
                const getScreeningText = (item) => {
                    if (!item) return '無資料';
                    if (selectedDimension === 'group') {
                        if (item.first_stage_thresholds && item.first_stage_thresholds.length > 0) {
                            return `一階篩選門檻 = ${item.first_stage_thresholds.join(' ➔ ')}`;
                        }
                        return '一階篩選門檻 = 無資料';
                    } else if (selectedDimension === 'dept') {
                        if (item.first_stage_groups && item.first_stage_groups.length > 0) {
                            const groupTexts = item.first_stage_groups.map(g => 
                                `${g.group_name}(篩選門檻: ${g.first_stage_thresholds ? g.first_stage_thresholds.join(' ➔ ') : '無資料'})`
                            );
                            return `各群類別一階篩選 = ${groupTexts.join('; ')}`;
                        }
                        return '一階篩選門檻 = 無資料';
                    }
                    return '';
                };

                const targetRankingInfo = rankings.find(r => r.id === selectedDept);
                const targetNameForLookup = getCleanName(targetRankingInfo) || targetName;
                const targetScreeningSource = getScreeningSourceByName(targetNameForLookup, targetRankingInfo);
                const targetOverlapSource = targetRankingInfo || targetScreeningSource;
                const targetScreening = getScreeningText(targetScreeningSource);

                const connectedEdges = graphData.edges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
                const inflowDetails = [];
                const outflowDetails = [];

                connectedEdges.forEach(edge => {
                    if (edge.from === edge.to) return;
                    if (edge.drawn) return;
                    
                    const fromId = edge.from;
                    const toId = edge.to;
                    const fromName = rankings.find(r => r.id === fromId)?.name.replace(/\n/g, ' ') || fromId;
                    const toName = rankings.find(r => r.id === toId)?.name.replace(/\n/g, ' ') || toId;

                    const compId = edge.from === selectedDept ? toId : fromId;
                    const compRankingInfo = rankings.find(r => r.id === compId);
                    const compNameForLookup = getCleanName(compRankingInfo);
                    const compScreeningSource = getScreeningSourceByName(compNameForLookup, compRankingInfo);
                    const compOverlapSource = compRankingInfo || compScreeningSource;
                    const compScreening = getScreeningText(compScreeningSource);
                    const screeningOverlap = formatScreeningOverlap(targetOverlapSource, compOverlapSource);

                    if (edge.from === selectedDept) {
                        outflowDetails.push(`  - 流失至【${toName}】：${edge.value || 0} 人 [對手${compScreening}；與本校一階重合 = ${screeningOverlap}]`);
                    }
                    if (edge.to === selectedDept) {
                        inflowDetails.push(`  - 從【${fromName}】流入：${edge.value || 0} 人 [對手${compScreening}；與本校一階重合 = ${screeningOverlap}]`);
                    }
                });

                prompt = `
請針對以下【同時錄取學生的選擇流向】數據進行深入分析，診斷本${dimensionText}在考生實際報到時，學生最後選擇本校或對手的情況：

【分析主體資訊】
- 目標${dimensionText}：${targetName}
- 當年度：${currentYear}學年度
- 本校一階篩選門檻：${targetScreening}

【本系歷年連續數據】
${targetMetricSummary || '- 無歷年連續數據'}

【年度與比較基準】
${yearContinuityInstruction}
${comparisonBaseInstruction}

【學生選擇流向明細】
1. 流失學生明細（同時錄取本校與對手，考生最終選擇登記對方）：
${outflowDetails.length > 0 ? outflowDetails.join('\n') : '  - 無流失數據'}

2. 流入學生明細（同時錄取本校與對手，考生最終選擇登記本校）：
${inflowDetails.length > 0 ? inflowDetails.join('\n') : '  - 無流入數據'}

請幫校方進行以下「學生選擇流向診斷與備取策略建議」：
1. 【最大競爭對手與一階門檻重合分析】：
   - 誰是搶走我們最多學生的「最大流失對手」？這反映了我們與該校系在品牌與就業吸引力上有何落差？
   - 探討我們為什麼都輸的原因。請特別評估本校與該最大對手之間【第一階段篩選標準（順序1~5）】是否具有高度重合性。分析在篩選標準高度重合時，若對方在學術名聲或品牌上比我們更好，為何學生一定會選擇更好的學校，而我們則淪為單純被放棄的「保底學校」。
   - 最大流失對手必須以「流失學生人數最多」為準；如果門檻較相似的是其他流失人數較少的對手，請另列為「其他門檻重合對手」，不可取代最大流失對手的判斷。
2. 【流入流出與吸引力落差】：同時錄取後，學生最後選擇本校的人比較多，還是選擇對手的人比較多？這對本${dimensionText}整體的品牌實力防禦有何啟示？
3. 【科學化備取與一階門檻調整建議】：
   - 根據流失學生的具體人數與流動規模，校方應如何科學化地設定二階備取名單長度，以確保在甄審階段能完全補滿？
   - 為了打破與最大競爭對手高度重合、導致考生流失的困境，校方應如何重新設計或錯開一階篩選條件（順序1~5），以篩進就讀意願較高（對本校較有忠誠度）的考生？請以條列方式提出具體操作建議。
`;
            }

            // Dynamically resolve the hostname of the server hosting the app.
            let host = window.location.hostname;
            if (!host || host === 'localhost' || host === '127.0.0.1') {
                host = '127.0.0.1'; // Local dev fallback
            }
            const apiUrl = `http://${host}:18000/v1/chat/completions`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer EMPTY'
                },
                body: JSON.stringify({
                    model: 'google/gemma-4-E4B-it',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 64000
                })
            });

            if (!response.ok) {
                throw new Error(`vLLM 伺服器錯誤代碼 ${response.status}`);
            }

            const resData = await response.json();
            const resultText = resData.choices[0].message.content;

            // 清理 LaTeX 語法與數學公式符號 (如 $...$, \times, \% 等)
            const cleanedText = resultText
                .replace(/\$([^$]+)\$/g, '$1') // 移除包含在 $ ... $ 內部的包裹符號
                .replace(/\\%/g, '%')           // 將 \% 轉為 %
                .replace(/\\rightarrow/g, '→')  // 將 \rightarrow 轉為 →
                .replace(/\\to/g, '→')           // 將 \to 轉為 →
                .replace(/\\times/g, '×')       // 將 \times 轉為 ×
                .replace(/\\div/g, '÷')         // 將 \div 轉為 ÷
                .replace(/\\cdot/g, '·');       // 將 \cdot 轉為 ·

            return cleanedText;
        } catch (err) {
            console.error('vLLM fetch error:', err);
            throw new Error(`無法從本地 vLLM 伺服器獲取分析結果。請確保您的 Docker 容器已在連接埠 18000 啟動，且模型已載入。 (Error: ${err.message})`);
        }
    };

    useEffect(() => {
        if (!isDataReady) return;

        const prefix = `${ANALYSIS_PROMPT_VERSION}_${currentYear}_${selectedDimension}_${selectedDept}_${zhengEffectThreshold}_${yieldRateThreshold}`;
        if (firedPrefixRef.current === prefix) return;
        firedPrefixRef.current = prefix;

        const targets = [
            { keySuffix: 'network', tabId: 'network', tType: '', qMode: '' },
            { keySuffix: 'trend_rscore_avgscore', tabId: 'trend', tType: 'rscore_avgscore', qMode: '' },
            { keySuffix: 'trend_flow_pr', tabId: 'trend', tType: 'flow_pr', qMode: '' },
            { keySuffix: 'trend_rscore', tabId: 'trend', tType: 'rscore', qMode: '' },
            { keySuffix: 'trend_avgscore', tabId: 'trend', tType: 'avgscore', qMode: '' },
            { keySuffix: 'health', tabId: 'health', tType: '', qMode: '' },
            { keySuffix: 'quadrant_rscore_avg', tabId: 'quadrant', tType: '', qMode: 'rscore_avg' },
            { keySuffix: 'quadrant_effect_yield', tabId: 'quadrant', tType: '', qMode: 'effect_yield' },
            { keySuffix: 'timeline', tabId: 'timeline', tType: '', qMode: '' },
            { keySuffix: 'flow', tabId: 'flow', tType: '', qMode: '' }
        ];

        // Check which targets actually need to be fetched (not in cache or had error)
        const needToFetch = targets.filter(t => {
            const cacheKey = `${prefix}_${t.keySuffix}`;
            const cached = analysisCacheRef.current[cacheKey];
            return !cached || cached.status === 'error';
        });

        if (needToFetch.length === 0) return;

        // Set all needToFetch to loading in cache in state and ref synchronously
        setAnalysisCache(prev => {
            const updated = { ...prev };
            needToFetch.forEach(t => {
                const cacheKey = `${prefix}_${t.keySuffix}`;
                updated[cacheKey] = { status: 'loading', text: '', error: '' };
            });
            analysisCacheRef.current = updated;
            return updated;
        });

        // Fire API requests in parallel for needToFetch
        needToFetch.forEach(async (t) => {
            const cacheKey = `${prefix}_${t.keySuffix}`;
            try {
                const result = await doApiFetch(cacheKey, t.tabId, t.tType, t.qMode);
                setAnalysisCache(prev => {
                    const updated = {
                        ...prev,
                        [cacheKey]: { status: 'success', text: result, error: '' }
                    };
                    analysisCacheRef.current = updated;
                    return updated;
                });
            } catch (err) {
                setAnalysisCache(prev => {
                    const updated = {
                        ...prev,
                        [cacheKey]: { status: 'error', text: '', error: err.message }
                    };
                    analysisCacheRef.current = updated;
                    return updated;
                });
            }
        });
    }, [isDataReady, selectedDept, currentYear, selectedDimension, historicalData, rankings, graphData, healthData, timelineRankData, zhengEffectThreshold, yieldRateThreshold]);

    const getActiveKey = () => {
        const prefix = `${ANALYSIS_PROMPT_VERSION}_${currentYear}_${selectedDimension}_${selectedDept}_${zhengEffectThreshold}_${yieldRateThreshold}`;
        if (activeTab === 'trend') {
            return `${prefix}_trend_${trendType}`;
        }
        if (activeTab === 'quadrant') {
            return `${prefix}_quadrant_${quadrantMode}`;
        }
        return `${prefix}_${activeTab}`;
    };

    const currentActiveKey = getActiveKey();
    const activeEntry = analysisCache[currentActiveKey];

    // Optimize isLoading: If we already have a success cached entry, we display it immediately 
    // instead of showing the skeleton, which prevents the flicker effect during re-rendering/scrolling.
    const hasAnalysis = activeEntry?.status === 'success';
    const isLoading = !hasAnalysis && (!isDataReady || (activeEntry ? activeEntry.status === 'loading' : true));
    const error = activeEntry?.status === 'error' ? activeEntry.error : '';
    const analysis = activeEntry?.status === 'success' ? activeEntry.text : '';

    const getTitleIcon = () => {
        switch (activeTab) {
            case 'network': return '🤝';
            case 'trend': return '📈';
            case 'health': return '🛡️';
            case 'quadrant': return '📍';
            case 'timeline': return '⏳';
            case 'flow': return '🔄';
            default: return '🤖';
        }
    };

    const getTitleText = () => {
        switch (activeTab) {
            case 'network': return 'AI 競爭關係網深度診斷';
            case 'trend':
                if (trendType === 'rscore') return 'AI 歷年品牌強度 (R-Score) 趨勢解析';
                if (trendType === 'avgscore') return 'AI 歷年錄取分數門檻趨勢解析';
                if (trendType === 'flow_pr') return 'AI 歷年缺額流入與錄取分數趨勢解析';
                return 'AI 歷年品牌與分數綜合趨勢解析';
            case 'health': return 'AI 招生效益與健康度診斷';
            case 'quadrant':
                if (quadrantMode === 'effect_yield') return 'AI 正取有效性與報到率落點診斷';
                return 'AI 校系落點定位與歷年軌跡診斷';
            case 'timeline': return 'AI 競爭時間軸演進解析';
            case 'flow': return 'AI 學生選擇流向與備取策略建議';
            default: return 'AI 智慧招生分析';
        }
    };

    return (
        <div className="ai-analysis-container">
            <div className="ai-analysis-card">
                <div className="ai-analysis-header">
                    <h3 className="ai-analysis-title">
                        <span>{getTitleIcon()}</span> {getTitleText()}
                    </h3>
                    <span className="ai-model-badge"> G-4 Local Engine </span>
                </div>

                {isLoading && (
                    <div className="ai-analysis-skeleton">
                        <div className="ai-skeleton-title"></div>
                        <div className="ai-skeleton-line medium"></div>
                        <div className="ai-skeleton-line"></div>
                        <div className="ai-skeleton-line short"></div>
                        <div className="ai-loading-text">
                            <span className="ai-spinner"></span>
                            {!isDataReady 
                                ? "正在彙整歷年圖表與效益數據，準備進行 AI 深度診斷，請稍候..." 
                                : "本地 vLLM (Gemma-4) 正在針對此圖表數據進行決策診斷中，請稍候..."}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="ai-error-box">
                        <h4>⚠️ 診斷分析載入失敗</h4>
                        <p>{error}</p>
                    </div>
                )}

                {!isLoading && !error && analysis && (
                    <SimpleMarkdown text={analysis} />
                )}
            </div>
        </div>
    );
};

export default AIAnalysisPanel;
