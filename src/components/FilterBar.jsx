import React from 'react';

const FilterBar = ({
    years,
    selectedYear,
    setSelectedYear,
    selectedDimension,
    setSelectedDimension
}) => {
    // 如果還沒有年份資料，就不顯示
    if (years.length === 0) return null;

    return (
        <div className="controls-container">
            <div className="year-selector">
                <label>📅 年度：</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                    {years.map(year => <option key={year} value={year}>{year} 學年度</option>)}
                </select>
            </div>
            <div className="dimension-selector">
                <button
                    className={selectedDimension === 'school' ? 'active' : ''}
                    onClick={() => setSelectedDimension('school')}
                >
                    🏫 學校維度
                </button>
                <button
                    className={selectedDimension === 'dept' ? 'active' : ''}
                    onClick={() => setSelectedDimension('dept')}
                >
                    📚 校系維度
                </button>
                <button
                    className={selectedDimension === 'group' ? 'active' : ''}
                    onClick={() => setSelectedDimension('group')}
                >
                    🎯 系組維度
                </button>
            </div>
        </div>
    );
};

export default FilterBar;