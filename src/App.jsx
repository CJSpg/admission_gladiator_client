import React, { useState, useEffect } from 'react';
import './App.css';
import FilterBar from './components/FilterBar';
import RankingTable from './components/RankingTable';
import GraphViewer from './components/GraphViewer';

function App() {
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDimension, setSelectedDimension] = useState('group');
  const [rankings, setRankings] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedDept, setSelectedDept] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}available_years.json`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setYears(data);
          setSelectedYear(data[0]);
        }
      });
  }, []);

  // 當年度或維度改變時，重新抓取對應資料
  useEffect(() => {
    if (!selectedYear || !selectedDimension) return;

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}rankings_${selectedYear}_${selectedDimension}.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}graph_${selectedYear}_${selectedDimension}.json`).then(res => res.json())
    ]).then(([rankingData, graphData]) => {
      setRankings(rankingData);
      setGraphData(graphData);
      setSelectedDept(null); // 切換年份時清空右側選擇
    }).catch(err => console.error(`⚠️ 無法讀取資料`, err));
  }, [selectedYear, selectedDimension]);

  return (
    <div className="admin-gladiator-dashboard">
      <header>
        <FilterBar
          years={years}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedDimension={selectedDimension}
          setSelectedDimension={setSelectedDimension}
        />
      </header>

      <div className="dashboard-content">
        <RankingTable
          rankings={rankings}
          selectedDimension={selectedDimension}
          selectedDept={selectedDept}
          setSelectedDept={setSelectedDept}
        />

        <GraphViewer
          selectedDept={selectedDept}
          graphData={graphData}
          rankings={rankings}
          years={years}
          selectedDimension={selectedDimension}
        />
      </div>
    </div>
  );
}

export default App;