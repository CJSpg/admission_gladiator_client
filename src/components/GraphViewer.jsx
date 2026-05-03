import React, { useState } from 'react';
import { useHistoricalData } from '../hooks/useHistoricalData';

// 引入我們剛做好的三大子圖表
import NetworkChart from './charts/NetworkChart';
import TrendChart from './charts/TrendChart';
import HealthChart from './charts/HealthChart';
import CompetitionTimeline from './charts/CompetitionTimeline';
import FlowTable from './charts/FlowTable';

const GraphViewer = ({ selectedDept, graphData, rankings, years, selectedDimension }) => {
    const [activeTab, setActiveTab] = useState('network');

    // 把資料算好
    const {
        historicalData, trendDepts, currentDeptInfo, avgTicks, rScoreTicks,
        singleRScoreTicks, singleAvgTicks, healthData, timelineRankData
    } = useHistoricalData(selectedDept, selectedDimension, years, graphData, rankings);

    const dimensionText = selectedDimension === 'school' ? '校' : selectedDimension === 'group' ? '系組' : '系';
    const myLabel = `本${dimensionText}`;

    const renderTabButtons = () => (
        <div className="analysis-tabs">
            {[
                { id: 'network', label: '🤝 競爭關係網' },
                { id: 'trend', label: '📈 歷年趨勢' },
                { id: 'health', label: '🛡️ 招生效益' },
                { id: 'timeline', label: '⏳ 競爭時間軸' },
                { id: 'flow', label: '🔄 流動情報' },
            ].map(tab => (
                <button
                    key={tab.id}
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="graph-section">
            {!selectedDept ? (
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>請從左側點擊一個校系</h3>
                    <p>點擊後即可查閱其在全台的競爭關係網、歷年發展趨勢與戰略定位分析。</p>
                </div>
            ) : (
                <>
                    {renderTabButtons()}

                    <div className="tab-content-container">
                        {/* 子元件 1：關係網圖 */}
                        <NetworkChart
                            activeTab={activeTab}
                            graphData={graphData}
                            selectedDept={selectedDept}
                            rankings={rankings}
                        />

                        {/* 子元件 2：趨勢圖 */}
                        {activeTab === 'trend' && (
                            <TrendChart
                                historicalData={historicalData}
                                trendDepts={trendDepts}
                                selectedDept={selectedDept}
                                currentDeptInfo={currentDeptInfo}
                                singleRScoreTicks={singleRScoreTicks}
                                singleAvgTicks={singleAvgTicks}
                                rScoreTicks={rScoreTicks}
                                avgTicks={avgTicks}
                                selectedDimension={selectedDimension}
                                myLabel={myLabel}
                            />
                        )}

                        {/* 子元件 3：招生效益圖 */}
                        {activeTab === 'health' && (
                            <HealthChart healthData={healthData} />
                        )}

                        {/* 子元件 4：時間軸圖 */}
                        {activeTab === 'timeline' && (
                            <CompetitionTimeline
                                timelineRankData={timelineRankData}
                                trendDepts={trendDepts}
                                selectedDept={selectedDept}
                                myLabel={myLabel}
                            />
                        )}

                        {/* 子元件 5：流動情報圖 */}
                        {activeTab === 'flow' && (
                            <FlowTable
                                graphData={graphData}
                                selectedDept={selectedDept}
                                rankings={rankings}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default GraphViewer;