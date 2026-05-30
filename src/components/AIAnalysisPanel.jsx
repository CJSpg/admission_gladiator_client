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

    const flushList = () => {
        if (listItems.length > 0) {
            const Tag = listType === 'ol' ? 'ol' : 'ul';
            elements.push(<Tag key={`list-${keyIdx++}`}>{listItems}</Tag>);
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

        // 1. Detect Strategic Advice Highlighting Box
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

        // 2. Headings
        if (trimmed.startsWith('# ')) {
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
        // 3. Bullet list items
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!isInsideList || listType !== 'ul') {
                flushList();
                isInsideList = true;
                listType = 'ul';
            }
            const content = parseInlineStyles(trimmed.slice(2));
            listItems.push(<li key={`li-${keyIdx++}`}>{content}</li>);
        } 
        // 4. Numbered list items
        else if (/^\d+\.\s/.test(trimmed)) {
            if (!isInsideList || listType !== 'ol') {
                flushList();
                isInsideList = true;
                listType = 'ol';
            }
            const content = parseInlineStyles(trimmed.replace(/^\d+\.\s/, ''));
            listItems.push(<li key={`li-${keyIdx++}`}>{content}</li>);
        } 
        // 5. Empty lines
        else if (trimmed === '') {
            flushList();
        } 
        // 6. Regular paragraphs
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
    flushBox();

    return <div className="ai-markdown-content">{elements}</div>;
};

// --- Main Panel Component ---
const AIAnalysisPanel = ({
    activeTab,
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

    // In-memory cache ref to avoid hitting GPU on tab switches
    // Key format: `${currentYear}_${selectedDimension}_${selectedDept}_${activeTab}`
    const cacheRef = useRef({});

    useEffect(() => {
        if (!selectedDept || !activeTab) return;

        const cacheKey = `${currentYear}_${selectedDimension}_${selectedDept}_${activeTab}`;
        
        // 1. Check Cache
        if (cacheRef.current[cacheKey]) {
            setAnalysis(cacheRef.current[cacheKey]);
            setError('');
            setIsLoading(false);
            return;
        }

        // 2. Fetch AI Analysis
        fetchAIAnalysis(cacheKey);
    }, [selectedDept, activeTab, selectedDimension, currentYear]);

    const fetchAIAnalysis = async (cacheKey) => {
        setIsLoading(true);
        setError('');
        setAnalysis('');

        const targetName = currentDeptInfo?.name ? currentDeptInfo.name.replace(/\n/g, ' ') : selectedDept;
        const dimensionText = selectedDimension === 'school' ? '學校' : selectedDimension === 'group' ? '系組' : '科系';

        // Choose prompt and content based on activeTab
        let systemPrompt = "你是一個高階教育校務研究與招生戰略分析專家。請只使用正體中文（繁體中文）回答問題。";
        let prompt = "";

        try {
            if (activeTab === 'network') {
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
            } else if (activeTab === 'trend') {
                const trendRows = [];
                // Gather target and top 3 competitors
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

                // Fetch rankings for each year (asynchronously or reading from memory)
                // Note: historicalData is already compiled by the parent hook!
                historicalData.forEach(yrData => {
                    trendRows.push(`- **${yrData.name}** (本校): R-Score = ${yrData[`${selectedDept}_RScore`] || 'N/A'}, 平均分數 = ${yrData[`${selectedDept}_AvgScore`] || 'N/A'}`);
                    topCompetitors.forEach(compId => {
                        const compName = rankings.find(r => r.id === compId)?.name.replace(/\n/g, ' ') || compId;
                        trendRows.push(`  - 對手【${compName}】: R-Score = ${yrData[`${compId}_RScore`] || 'N/A'}, 平均分數 = ${yrData[`${compId}_AvgScore`] || 'N/A'}`);
                    });
                });

                prompt = `
請針對以下【歷年發展趨勢】數據進行分析：

分析對象：${targetName}
歷年比較數據（包含主要重榜競爭對手）：
${trendRows.join('\n')}

數據背景：
- **R-Score**：基於重榜決鬥勝率的品牌強度指標。能有效排除考科難易度、計分權重等偏差。R-Score 越小代表競爭力越強（或越大，視公式而定。此專案中 R-Score 越高代表吸引力越強）。
- **平均分數**：學生入學考試的分數品質（學測/統測錄取分數門檻）。

請幫校方進行以下「圖表細節分析」並給予建議：
1. 品牌吸引力與錄取門檻的背離診斷：本校的 R-Score 與 平均分數 在過去三年是呈現「健康同步增長」，還是出現背離？例如：「錄取分數上升，但 R-Score 下滑（招生門檻虛胖，實際吸引力在萎縮）」或「R-Score 上升，但錄取分數未跟上（品牌聲譽良好，但考科篩選機制失效）」。
2. 與主要對手的消長對比：在 R-Score 和平均錄取分數的拉鋸中，我們相較於這幾所對手，是在擴大領先、被逐漸追上，還是已經被超越？
3. 校方具體政策建議：根據趨勢，校方應如何調整入學篩選權重？或是加強行銷宣傳？
                `;
            } else if (activeTab === 'health') {
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
            } else if (activeTab === 'quadrant') {
                // Determine current quadrant
                const rScorePrData = calculatePercentileRank(rankings, 'r_score', 'r_score_pr');
                const bothPrData = calculateAverageScorePercentileRank(rScorePrData, 'avg_score', 'avg_score_pr', selectedDimension);
                const selfPr = bothPrData.find(item => item.id === selectedDept);

                const currentRPr = selfPr?.r_score_pr !== null ? selfPr.r_score_pr : 'N/A';
                const currentAPr = selfPr?.avg_score_pr !== null ? selfPr.avg_score_pr : 'N/A';
                const currentZheng = currentDeptInfo?.zheng_effect !== undefined ? (currentDeptInfo.zheng_effect * 100).toFixed(1) : 'N/A';
                const currentYield = currentDeptInfo?.yield_rate !== undefined ? (currentDeptInfo.yield_rate * 100).toFixed(1) : 'N/A';

                // Fetch historical path from historicalData
                const pathPoints = [];
                historicalData.forEach(yrData => {
                    pathPoints.push(`- **${yrData.name}**: R-Score = ${yrData[`${selectedDept}_RScore`] || 'N/A'}, 平均分數 = ${yrData[`${selectedDept}_AvgScore`] || 'N/A'}`);
                });

                prompt = `
請針對以下【四象限落點定位與歷年移動軌跡】數據進行分析：

分析對象：${targetName}
維度：${dimensionText} 層級

四象限定位標準（113學年）：
- **R-Score PR（品牌競爭百分等級）**: ${currentRPr} (中位數為 50)
- **平均分數 PR（考生成績百分等級）**: ${currentAPr} (中位數為 50)
- **正取有效性（正取生登記率）**: ${currentZheng}% 
- **報到率**: ${currentYield}%

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
3. 校方應對建議：校方應該採取什麼策略，將定位軌跡拉回或引導至「強勢落點型」？
                `;
            } else if (activeTab === 'timeline') {
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
1. 自身實力消長：在核心競爭圈內，我們的名次與 PR 歷年來是上升還是下滑？這反映了什麼品牌定位危機或機會？
2. 競爭格局演變：我們在競爭圈中的主導權有何變化？
3. 校方應對建議：校方應如何調配行銷資源，以防堵新舊競爭對手的包夾，並穩固領先地位？
                `;
            } else if (activeTab === 'flow') {
                const outflowDetails = [];
                const inflowDetails = [];

                graphData.edges.forEach(edge => {
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

                const totalOut = outflowDetails.length;
                const totalIn = inflowDetails.length;

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

            // Execute the fetch against local vLLM API
            const response = await fetch('http://localhost:18000/v1/chat/completions', {
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
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                throw new Error(`vLLM 伺服器回傳狀態碼 ${response.status}`);
            }

            const resData = await response.json();
            const resultText = resData.choices[0].message.content;

            // Save to Cache
            cacheRef.current[cacheKey] = resultText;

            setAnalysis(resultText);
            setError('');
        } catch (err) {
            console.error('vLLM fetch error:', err);
            setError(`無法從本地 vLLM 伺服器獲取分析結果。請確保您的 Docker 容器已在連接埠 18000 啟動，且模型已載入。 (Error: ${err.message})`);
        } finally {
            setIsLoading(false);
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
            case 'trend': return 'AI 歷年品牌趨勢深度解析';
            case 'health': return 'AI 招生效益與效益診斷';
            case 'quadrant': return 'AI 校系落點定位軌跡診斷';
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
