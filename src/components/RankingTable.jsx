import React, { useState, useMemo, useEffect } from 'react';

const RankingTable = ({
    rankings,
    selectedDimension,
    selectedDept,
    setSelectedDept
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'ascending' });

    // 當「年度」或「維度」改變導致排名資料 (rankings) 更新時，清除排序
    useEffect(() => {
        setSortConfig({ key: 'id', direction: 'ascending' });
    }, [rankings]);

    // 排序邏輯
    const requestSort = (key) => {
        let direction = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    // 排序圖示
    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return ' ↕️';
        return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
    };

    // 處理數值
    const formatValue = (value) => {
        if (value === null || value === undefined || value === '--' || value === '') return '--';
        const num = Number(value);
        return isNaN(num) ? '--' : num.toFixed(2);
    };

    // 處理搜尋與排序的資料
    const displayRankings = useMemo(() => {
        let processedData = rankings
            .map((dept, index) => ({ ...dept, originalRank: index + 1 }))
            .filter(dept => {
                if (!searchTerm) return true;
                const cleanDeptName = dept.name.replace(/\n/g, ' ').toLowerCase();
                const searchTermsArray = searchTerm.trim().toLowerCase().split(/\s+/);
                return searchTermsArray.every(term => {
                    if (cleanDeptName.includes(term)) return true;
                    let textIndex = 0, termIndex = 0;
                    while (textIndex < cleanDeptName.length && termIndex < term.length) {
                        if (cleanDeptName[textIndex] === term[termIndex]) termIndex++;
                        textIndex++;
                    }
                    return termIndex === term.length;
                });
            });

        if (sortConfig.key) {
            processedData.sort((a, b) => {
                // 3. 針對 'id' 欄位，改用字串比對，避免校系代碼 (如 001) 被轉為數字出錯
                if (sortConfig.key === 'id') {
                    const aId = String(a.id || '');
                    const bId = String(b.id || '');
                    return sortConfig.direction === 'ascending'
                        ? aId.localeCompare(bId)
                        : bId.localeCompare(aId);
                }

                // 其他成績、比例欄位，維持原本的數字比對
                const aValue = Number(a[sortConfig.key]) || 0;
                const bValue = Number(b[sortConfig.key]) || 0;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return processedData;
    }, [rankings, searchTerm, sortConfig]);

    return (
        <div className="leaderboard-section" style={{ flex: '0 0 40%' }}>
            <div className="leaderboard-header-row">
                <h2>📊 全台校系競爭力總覽</h2>
                <div className="leaderboard-actions">
                    {sortConfig.key !== 'id' && (
                        <button className="clear-sort-btn" onClick={() => setSortConfig({ key: 'id', direction: 'ascending' })}>
                            🔄 清除排序
                        </button>
                    )}
                    <div className="search-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="🔍 搜尋名稱..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && <button className="clear-search-btn" onClick={() => setSearchTerm('')}>✕</button>}
                    </div>
                </div>
            </div>
            <div className="table-scroll-container" style={{ overflowX: 'auto' }}>
                <table className="ranking-table" style={{ whiteSpace: 'nowrap', minWidth: '800px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '5%', textAlign: 'center' }}>項次</th>
                            <th style={{ minWidth: '250px', textAlign: 'left' }}>
                                {selectedDimension === 'school' ? '學校' : selectedDimension === 'dept' ? '校系' : '系組'}
                            </th>
                            <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('r_score')}>R-Score{getSortIcon('r_score')}</th>
                            <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('avg_score')}>錄取分數{getSortIcon('avg_score')}</th>
                            <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('yield_rate')}>報到率{getSortIcon('yield_rate')}</th>
                            <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('zheng_effect')}>正取有效{getSortIcon('zheng_effect')}</th>
                            <th className="sortable-header" style={{ width: '12%', textAlign: 'left' }} onClick={() => requestSort('flow_rate')}>登分比例{getSortIcon('flow_rate')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRankings.map((dept, index) => (
                            <tr key={dept.id} className={selectedDept === dept.id ? 'active-row' : ''} onClick={() => setSelectedDept(dept.id)}>
                                <td className="rank-cell" style={{ textAlign: 'center' }}>{index + 1}</td>
                                <td className="dept-name-cell" style={{ textAlign: 'left', whiteSpace: 'normal' }}>{dept.name.replace(/\n/g, ' ')}</td>
                                <td className="r-score-cell" style={{ textAlign: 'right' }}>{formatValue(dept.r_score)}</td>
                                <td className="avg-score-cell" style={{ textAlign: 'right' }}>{formatValue(dept.avg_score)}</td>
                                <td style={{ textAlign: 'right', color: '#3498db' }}>{dept.yield_rate != null ? `${(dept.yield_rate * 100).toFixed(1)}%` : '--'}</td>
                                <td style={{ textAlign: 'right', color: '#2ecc71' }}>{dept.zheng_effect != null ? `${(dept.zheng_effect * 100).toFixed(1)}%` : '--'}</td>
                                <td style={{ textAlign: 'right', color: '#e74c3c' }}>{dept.flow_rate != null ? `${(dept.flow_rate * 100).toFixed(1)}%` : '--'}</td>
                            </tr>
                        ))}
                        {displayRankings.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>找不到符合的資料 🥲</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RankingTable;