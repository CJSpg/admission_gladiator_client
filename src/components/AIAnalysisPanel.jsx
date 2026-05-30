import React, { useState, useEffect, useRef } from 'react';

// --- Helper Functions (replicating calculations for prompt construction) ---
const parseNumber = (val) => {
    if (val === undefined || val === null || val === '--' || val === '') return null;
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? null : num;
};

const normalizeName = (name) => {
    return (name || "").replace(/\n/g, '').replace(/\s+/g, '').trim();
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
        result[validItems[0].originalIndex][outputKey] = 100;
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
        if (!groups[grp]) groups[grp] = [];
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
        // If line is a box header or starts with specific characters, trigger box mode
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
            return; // Skip rendering this header as a normal header, we render custom box header instead
        }

        // Check if box should be closed (a new major heading starts and we are in a box)
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
    years,
    currentYear,
    historicalData,
    trendDepts,
    currentDeptInfo,
    healthData,
    timelineRankData
}) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // 用於追蹤最新的請求鍵，防止異步請求回傳時覆蓋新分頁的狀態 (Race Condition)
    const latestCacheKeyRef = useRef('');

    // In-memory cache ref to avoid hitting GPU on tab switches
    // Key format: `${currentYear}_${selectedDimension}_${selectedDept}_${activeTab}_${trendType}_${quadrantMode}`
    // cacheRef.current[cacheKey] = { status: 'success'|'pending'|'error', data: string, error: string, promise: Promise }
    const cacheRef = useRef({});

    useEffect(() => {
        if (!selectedDept || !activeTab) return;

        let isCurrent = true;

        const currentActiveKey = `${currentYear}_${selectedDimension}_${selectedDept}_${activeTab}` +
            (activeTab === 'trend' ? `_${trendType}` : '') +
            (activeTab === 'quadrant' ? `_${quadrantMode}` : '');
        
        latestCacheKeyRef.current = currentActiveKey;

        // 1. 優先載入或請求目前分頁分析
        getOrFetch(currentActiveKey, activeTab, trendType, quadrantMode);

        // 2. 延遲 1 秒後，在背景依序預載入其他分頁的分析 (避免同時對 local GPU 送出大量請求造成塞車)
        const timer = setTimeout(() => {
            const tabsToPrefetch = [
                { id: 'network', trend: 'rscore_avgscore', quad: 'rscore_avg' },
                { id: 'trend', trend: 'rscore_avgscore', quad: 'rscore_avg' },
                { id: 'health', trend: 'rscore_avgscore', quad: 'rscore_avg' },
                { id: 'quadrant', trend: 'rscore_avgscore', quad: 'rscore_avg' },
                { id: 'timeline', trend: 'rscore_avgscore', quad: 'rscore_avg' },
                { id: 'flow', trend: 'rscore_avgscore', quad: 'rscore_avg' }
            ].filter(t => {
                if (t.id === activeTab) {
                    if (activeTab === 'trend' && t.trend === trendType) return false;
                    if (activeTab === 'quadrant' && t.quad === quadrantMode) return false;
                    if (activeTab !== 'trend' && activeTab !== 'quadrant') return false;
                }
                return true;
            });

            // 啟動背景佇列預載入
            prefetchSequentially(tabsToPrefetch, isCurrent);
        }, 1000);

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [selectedDept, activeTab, selectedDimension, currentYear, trendType, quadrantMode]);

    const prefetchSequentially = async (tabs, isCurrent) => {
        for (const t of tabs) {
            if (!isCurrent) break;

            const cacheKey = `${currentYear}_${selectedDimension}_${selectedDept}_${t.id}` +
                (t.id === 'trend' ? `_${t.trend}` : '') +
                (t.id === 'quadrant' ? `_${t.quad}` : '');

            // 若該分頁的快取已存在或正在請求中，則跳過
            if (cacheRef.current[cacheKey]) {
                continue;
            }

            try {
                // 在背景發起非同步 Fetch 並存入快取 (使用 Promise)
                await getOrFetch(cacheKey, t.id, t.trend, t.quad);
            } catch (err) {
                console.warn('Background prefetch error for key:', cacheKey, err);
            }
        }
    };

    const getOrFetch = (cacheKey, tabId, tType, qMode) => {
        // A. 命中快取且已完成，直接呈現
        if (cacheRef.current[cacheKey]) {
            const entry = cacheRef.current[cacheKey];
            if (entry.status === 'success') {
                if (latestCacheKeyRef.current === cacheKey) {
                    setAnalysis(entry.data);
                    setError('');
                    setIsLoading(false);
                }
                return entry.promise;
            } else if (entry.status === 'pending') {
                // B. 快取中已有正在進行的請求，進行監聽並顯示載入中
                if (latestCacheKeyRef.current === cacheKey) {
                    setIsLoading(true);
                    setError('');
                    setAnalysis('');
                }
                entry.promise.then(
                    (data) => {
                        if (latestCacheKeyRef.current === cacheKey) {
                            setAnalysis(data);
                            setError('');
                            setIsLoading(false);
                        }
                    },
                    (err) => {
                        if (latestCacheKeyRef.current === cacheKey) {
                            setError(err.message);
                            setIsLoading(false);
                        }
                    }
                );
                return entry.promise;
            }
        }

        // C. 快取中沒有此鍵，發起全新請求
        if (latestCacheKeyRef.current === cacheKey) {
            setIsLoading(true);
            setError('');
            setAnalysis('');
        }

        const fetchPromise = doApiFetch(tabId, tType, qMode);

        cacheRef.current[cacheKey] = {
            status: 'pending',
            data: '',
            error: '',
            promise: fetchPromise
        };

        fetchPromise.then(
            (resultText) => {
                cacheRef.current[cacheKey] = {
                    status: 'success',
                    data: resultText,
                    error: '',
                    promise: fetchPromise
                };
                if (latestCacheKeyRef.current === cacheKey) {
                    setAnalysis(resultText);
                    setError('');
                    setIsLoading(false);
                }
            },
            (err) => {
                cacheRef.current[cacheKey] = {
                    status: 'error',
                    data: '',
                    error: err.message,
                    promise: fetchPromise
                };
                if (latestCacheKeyRef.current === cacheKey) {
                    setError(err.message);
                    setIsLoading(false);
                }
            }
        );

        return fetchPromise;
    };

    const doApiFetch = async (tabId, tType, qMode) => {
        try {
            const targetName = currentDeptInfo?.name ? currentDeptInfo.name.replace(/\n/g, ' ') : selectedDept;
        const dimensionText = selectedDimension === 'school' ? '學校' : selectedDimension === 'group' ? '系組' : '科系';

        // Choose prompt and content based on tabId
        let systemPrompt = "你是一個高階教育校務研究與招生戰略分析專家。請只使用正體中文（繁體中文）回答問題。請直接輸出分析結果（直接從大標題或第一段診斷內容開始），絕對不能包含任何社交寒暄、客套話、前言、開場白（例如「好的，我將為您分析...」、「身為分析專家，我將針對...」等）以及結語，直奔分析主題。重要：請勿使用 LaTeX 數學符號或 LaTeX 語法（例如：不要使用 $ 符號包裹算式、不要使用 \\times、\\%、\\frac 等 LaTeX 命令），請直接使用一般文字與符號（如：使用 × 或 * 表示相乘、使用 % 表示百分比、直接書寫 4/4 = 100% 即可）。";
        let prompt = "";

        if (tabId === 'network') {
            const connectedEdges = graphData.edges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
            const inflow = [];
            const outflow = [];
            const draws = [];

            connectedEdges.forEach(edge => {
                if (edge.from === edge.to) return;
                const fromName = rankings.find(r => r.id === edge.from)?.name.replace(/\n/g, ' ') || edge.from;
                const toName = rankings.find(r => r.id === edge.to)?.name.replace(/\n/g, ' ') || edge.to;

                if (edge.drawn) {
                    draws.push(`- 與【${edge.from === selectedDept ? toName : fromName}】平手交集（雙重錄取考生皆放棄）：${edge.value || 0} 人`);
                } else if (edge.from === selectedDept) {
                    outflow.push(`- 流失至【${toName}】（考生選擇對方）：${edge.value || 0} 人`);
                } else {
                    inflow.push(`- 從【${fromName}】流入（考生選擇本校）：${edge.value || 0} 人`);
                }
            });

            prompt = `
請針對以下【競爭關係網】數據進行深入分析，為校方提出具體招生建議：

分析對象：${targetName}
維度：${dimensionText} 層級
年份：${currentYear}學年度

數據背景：
當一名考生同時被本校與對手校系二階錄取（即雙重錄取），其最終報到登記的選擇即為一次「兩兩對決」。
- 「流入」代表考生放棄對手，選擇登記本校（本校獲勝）。
- 「流失」代表考生放棄本校，選擇登記對手（本校落敗）。
- 「平手交集」代表考生同時放棄兩者。

數據內容：
1. 【流入生源】（本校擊敗對手，吸引學生登記入學）：
${inflow.length > 0 ? inflow.join('\n') : '- 無顯著流入數據'}

2. 【流失生源】（對手擊敗本校，拉走本校學生）：
${outflow.length > 0 ? outflow.join('\n') : '- 無顯著流失數據'}

3. 【平手交集】（重疊考生最終皆未登記此兩校，流向第三校）：
${draws.length > 0 ? draws.join('\n') : '- 無顯著平手交集數據'}

請幫校方進行以下「圖表細節分析」並給予建議：
1. 識別核心競爭圈：誰是我們真正的競爭對手？最主要的生源威脅來自誰？
2. 競爭力強弱診斷：我們在哪些對手上佔有絕對優勢？在哪些對手上處於極度弱勢？其背後可能代表何種品牌形象或就業吸引力差距？
3. 校方應對建議：面對主要的流失渠道，校方該採取何種具體戰略（如獎學金、課程特色行銷、面試日期撞期排程等）進行阻截？請以條列方式提出具體操作建議。
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
                trendRows.push(`- **${yrData.name}** (本校): R-Score = ${yrData[`${selectedDept}_RScore`] || 'N/A'}, 平均分數 = ${yrData[`${selectedDept}_AvgScore`] || 'N/A'}`);
                topCompetitors.forEach(compId => {
                    const compName = rankings.find(r => r.id === compId)?.name.replace(/\n/g, ' ') || compId;
                    trendRows.push(`  - 對手【${compName}】: R-Score = ${yrData[`${compId}_RScore`] || 'N/A'}, 平均分數 = ${yrData[`${compId}_AvgScore`] || 'N/A'}`);
                });
            });

            if (tType === 'rscore') {
                prompt = `
請針對以下【歷年發展趨勢 - R-Score 競爭力趨勢】數據進行深度分析，診斷本校系品牌強度的演進：

分析對象：${targetName}
歷年比較數據（包含主要重榜競爭對手）：
${trendRows.join('\n')}

數據背景：
- **R-Score**：基於重榜決鬥勝率的品牌強度指標。R-Score 越高代表吸引力越強，代表當考生同時錄取本校與對手時，更多人選擇本校。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 本校品牌吸引力變遷：過去三年，本校的 R-Score 呈現上升、持平還是下降趨勢？這反映了本校在招生市場上的品牌形象發生了何種變化？
2. 與競爭對手的 R-Score 消長對比：與主要競爭對手相比，我們的品牌吸引力優勢是否在流失？是否有特定的對手 R-Score 快速崛起，對我們構成直接威脅？
3. 校方品牌強化建議：針對品牌吸引力的消長，校方應該如何在宣傳、系所定位、產學合作或就業宣傳上進行戰略強化，以提升重榜考生的選擇率？請以條列方式提出具體操作建議。
                `;
            } else if (tType === 'avgscore') {
                prompt = `
請針對以下【歷年發展趨勢 - 錄取分數門檻趨勢】數據進行深度分析，診斷錄取生源素質的演進：

分析對象：${targetName}
歷年比較數據（包含主要重榜競爭對手）：
${trendRows.join('\n')}

數據背景：
- **平均分數**：學生入學考試的分數品質（學測/統測錄取分數門檻）。代表錄取學生的考生成績水準。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 錄取門檻走勢診斷：過去三年，本校的平均分數門檻是上升、持平還是下滑？這反映了生源素質的何種演變趨勢？
2. 與主要對手的門檻差距消長：在錄取分數門檻上，我們與主要對手的差距是在拉大還是縮小？我們處於領先還是落後？
3. 篩選機制調整建議：根據錄取門檻趨勢，校方在二階甄試的考科篩選、加權倍率或是名額配置上，該如何進行微調以確保錄取生源水準，或防止因分數崩盤導致的口碑下滑？請以條列方式提出具體政策建議。
                `;
            } else {
                prompt = `
請針對以下【歷年發展趨勢 - 綜合趨勢】數據進行深度分析，診斷本校系品牌吸引力與錄取門檻的關聯性：

分析對象：${targetName}
歷年比較數據（包含主要重榜競爭對手）：
${trendRows.join('\n')}

數據背景：
- **R-Score**：基於重榜決鬥勝率的品牌強度指標（吸引力指標），分值越高代表本校系對學生的品牌吸引力越強。
- **平均分數**：錄取考生的學術考試成績門檻，代表考生的入學成績品質。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 品牌吸引力與錄取門檻的背離診斷：本校的 R-Score 與 平均分數 在過去三年是呈現「健康同步增長」，還是出現背離？例如：「錄取分數上升，但 R-Score 下滑（招生門檻虛胖，實際品牌吸引力在萎縮）」或「R-Score 上升，但錄取分數未跟上（品牌聲譽良好，但篩選或計分機制未能成功篩選高分考生）」。
2. 與主要對手的消長對比：綜合兩項指標，我們相較於這幾所對手，是在擴大領先、被逐漸追上，還是已經被超越？
3. 校方具體政策建議：根據本校的吸引力與分數趨勢，校方應如何調整入學篩選權重？或是加強行銷宣傳？請以條列方式提出具體戰略。
                `;
            }
        } else if (tabId === 'health') {
            const healthItems = [];
            healthData.forEach(item => {
                const isSelf = item.name.includes(targetName.split(' ')[0]) || item.name.includes(targetName);
                healthItems.push(`- **${item.name}** ${isSelf ? '(本校)' : '(對手)'}: 報到率 = ${item.yield_rate}% | 正取有效性 = ${item.zheng_effect}% | 流失/空缺比例 = ${item.flow_rate}%`);
            });

            prompt = `
請針對以下 113 學年度【招生效益】數據進行分析：

分析對象（與主要重榜競爭對手）：
${healthItems.join('\n')}

指標定義：
- **報到率（Yield Rate）**：最終報到人數佔招生名額的比例。
- **正取有效性（Zheng Effect）**：正取學生最終來報到註冊的比例。如果低於 50%，代表大多數正取學生流失，極度依賴備取生遞補。
- **流失/空缺比例（Flow Rate）**：放棄且未補滿的名額比例。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 招生健康度診斷：本校的招生是屬於「高效穩定型」（正取就讀率高，報到率高）還是「備取依賴型」（正取流失極高，靠備取補滿）？這種狀態對系所的二階甄試（如面試、書審）有何實質影響？
2. 競爭效益對比：與主要競爭對手相比，我們的正取有效性與報到率如何？我們在轉換率上輸在或贏在哪裡？
3. 校方應對建議：招生名額分配與正備取倍率應如何進行戰略微調？例如是否應該拉大備取名額，或者調整面試分數篩選出忠誠學生？
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
            const calculateAverageScorePercentileRank = (data, field, targetField, dimension) => {
                const values = data.map(d => d[field]).filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
                return data.map(d => ({
                    ...d,
                    [targetField]: d[field] === null || d[field] === undefined ? null : 
                        Math.round((values.indexOf(d[field]) / (values.length - 1)) * 100)
                }));
            };

            const rScorePrData = calculatePercentileRank(rankings, 'r_score', 'r_score_pr');
            const bothPrData = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr', selectedDimension);
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
請針對以下【四象限落點定位 - 招生效益落點】數據進行深度分析，診斷本校系的正備取招生轉換效益：

分析對象：${targetName}
維度：${dimensionText} 層級

招生效益核心指標（113學年）：
- **正取有效性（正取生登記就讀率）**: ${currentZheng}% (中位數一般為 50%)
- **報到率（最終入學人數佔名額比例）**: ${currentYield}% (滿額為 100%)

象限類型定義：
1. 【高忠誠熱門型】(正取有效性 >= 50%, 報到率 >= 100%)：代表第一志願學生多，且名額全數招滿。品牌認同度極高。
2. 【高保底穩健型】(正取有效性 < 50%, 報到率 >= 100%)：正取生大多流失，但靠著備取生遞補順利招滿。屬於「備胎依賴型」，招生安全，但需花費大量心力進行二階甄試與遞補。
3. 【危險流失型】(正取有效性 < 50%, 報到率 < 100%)：正取流失嚴重，且備取不足或學生放棄，最終產生招生缺額。
4. 【高忠誠缺額型】(正取有效性 >= 50%, 報到率 < 100%)：正取就讀意願高，但可能因備取設定過少或名額配置問題而未招滿。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 當前招生狀態定位：本校/系目前處於哪一個招生效益象限？是否存在過度依賴備取生（高保底穩健型）或面臨招生名額未滿（缺額流失）的風險？
2. 二階甄試篩選機制診斷：正取有效性高低代表了什麼？校方在面試或書審階段，是否未能有效甄別考生的「就讀忠誠度」，導致正取考生重複錄取其他名校而大量流失？
3. 校方具體應對建議：
   - 應如何科學地調整正備取名額比例與備取倍率？
   - 在甄試面試設計、聯絡正備取生以及宣傳策略上，應採取什麼行動來提高正取就讀率或確保備取遞補成功？請以條列方式提出具體操作建議。
                `;
            } else {
                prompt = `
請針對以下【四象限落點定位與歷年移動軌跡】數據進行深度分析，診斷本校系品牌競爭力落點與歷年消長：

分析對象：${targetName}
維度：${dimensionText} 層級

四象限定位標準（113學年）：
- **R-Score PR（品牌競爭百分等級）**: ${currentRPr} (中位數為 50)
- **平均分數 PR（考生成績百分等級）**: ${currentAPr} (中位數為 50)

歷年分數與實力消長路徑：
${pathPoints.join('\n')}

象限類型定義：
1. 【強勢落點型】(R-Score PR >= 50, Avg PR >= 50)：品牌吸引力與錄取分數皆高於中位數。
2. 【競爭支撐型】(R-Score PR >= 50, Avg PR < 50)：吸引力強，但錄取學生學測分數偏低。
3. 【分數支撐型】(R-Score PR < 50, Avg PR >= 50)：分數高，但品牌吸引力弱，重榜生容易將本校當成備胎。
4. 【落點弱勢型】(R-Score PR < 50, Avg PR < 50)：雙低弱勢。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 當前定位診斷：本校/系目前處於哪一個象限？是否面臨「高分備胎化」或「雙低弱勢」的風險？
2. 軌跡移動趨勢分析：歷年分數與 R-Score 是呈健康成長，還是在競爭力上面臨衰退？
3. 校方應對建議：校方應該採取什麼策略，將定位軌跡拉回或引導至「強勢落點型」？請以條列方式提出具體戰略建議。
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

            prompt = `
請針對以下【競爭時間軸與重榜競爭群體演進】數據進行分析：

分析對象：${targetName}
維度：${dimensionText} 層級

歷年名次與百分等級（PR）：
${timelinePoints.join('\n')}

數據背景：
時間軸展示了本校系與其他競爭學校「重榜考生交集」的演進。名次與 PR 越高代表在競爭圈中的贏面越大。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 自身實力消長：在核心競爭圈內，我們的名次與 PR 歷年來是上升還是下滑？這反映了什麼 brand 定位危機或機會？
2. 競爭格局演變：我們在競爭圈中的主導權有何變化？
3. 校方應對建議：校方應如何調配行銷資源，以防堵新舊競爭對手的包夾，並穩固領先地位？
            `;
        } else if (tabId === 'flow') {
            const connectedEdges = graphData.edges.filter(edge => edge.from === selectedDept || edge.to === selectedDept);
            const inflowDetails = [];
            const outflowDetails = [];

            connectedEdges.forEach(edge => {
                if (edge.from === edge.to) return;
                    if (edge.drawn) return;
                    const fromName = rankings.find(r => r.id === edge.from)?.name.replace(/\n/g, ' ') || edge.from;
                    const toName = rankings.find(r => r.id === edge.to)?.name.replace(/\n/g, ' ') || edge.to;

                    if (edge.from === selectedDept) {
                        outflowDetails.push(`  - 流失至【${toName}】：${edge.value || 0} 人`);
                    }
                    if (edge.to === selectedDept) {
                        inflowDetails.push(`  - 從【${fromName}】流入：${edge.value || 0} 人`);
                    }
                });

                prompt = `
請針對以下【重榜學生真實流動情報】數據進行分析：

分析對象：${targetName}
年份：113學年度

流動數據明細：
1. 【流失生源明細】（同時錄取下，選擇登記對方校系）：
${outflowDetails.length > 0 ? outflowDetails.join('\n') : '  - 無流失數據'}

2. 【流入生源明細】（同時錄取下，放棄對方選擇登記本校）：
${inflowDetails.length > 0 ? inflowDetails.join('\n') : '  - 無流入數據'}

請幫校方進行以下「圖表細節分析」並給予建議：
1. 鎖定「頭號天敵」與「生源苦主」：誰是搶走我們最多學生的學校（頭號天敵）？我們能從誰那裡拉來最多學生（生源苦主）？
2. 淨流量與品牌赤字：我們的重榜流動是呈現「淨流入」還是「淨流失」？這對學校整體的品牌實力防禦有何啟示？
3. 量化備取長度與阻截建議：
   - 根據流失的人數與比例，校方應如何科學化地設定備取名單長度，以確保不會產生缺額？
   - 針對最主要的流失去向（頭號天敵），我們應如何設計具體的招生行銷、獎學金或課程包包裝實施精準防禦？
                `;
            }

            // Dynamically resolve the hostname of the server hosting the app.
            // This ensures other computers in the network route requests to Computer A (140.130.33.196)
            // and bypasses Chrome's PNA (Private Network Access) loopback block.
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
                throw new Error(`vLLM 伺服器回傳狀態碼 ${response.status}`);
            }

            const resData = await response.json();
            const resultText = resData.choices[0].message.content;

            // 清理 LaTeX 格式與數學公式符號 (如 $...$, \times, \% 等)
            const cleanedText = resultText
                .replace(/\$([^$]+)\$/g, '$1') // 移除包含在 $ ... $ 內部的包裹字元
                .replace(/\\%/g, '%')           // 將 \% 轉換為 %
                .replace(/\\times/g, '×')       // 將 \times 轉換為 ×
                .replace(/\\div/g, '÷')         // 將 \div 轉換為 ÷
                .replace(/\\cdot/g, '·');       // 將 \cdot 轉換為 ·

            // 檢查是否在此請求回傳期間，使用者已經切換了分頁/校系，若是則直接捨棄此回應 (解決 Race Condition)
            if (latestCacheKeyRef.current !== cacheKey) {
                return;
            }

            // Save to Cache
            cacheRef.current[cacheKey] = cleanedText;

            setAnalysis(cleanedText);
            setError('');
            return cleanedText;
        } catch (err) {
            console.error('vLLM fetch error:', err);
            if (latestCacheKeyRef.current === cacheKey) {
                setError(`無法從本地 vLLM 伺服器獲取分析結果。請確保您的 Docker 容器已在連接埠 18000 啟動，且模型已載入。 (Error: ${err.message})`);
            }
        } finally {
            if (latestCacheKeyRef.current === cacheKey) {
                setIsLoading(false);
            }
        }
    };

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
                return 'AI 歷年品牌與分數綜合趨勢解析';
            case 'health': return 'AI 招生效益與效益診斷';
            case 'quadrant':
                if (quadrantMode === 'effect_yield') return 'AI 正取有效性與報到率落點診斷';
                return 'AI 校系落點定位與歷年軌跡診斷';
            case 'timeline': return 'AI 競爭時間軸演進解析';
            case 'flow': return 'AI 生源流動與備取策略建議';
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
                            本地 vLLM (Gemma-4) 正在針對此圖表數據進行決策診斷中，請稍候...
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
