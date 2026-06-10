import React, { useState, useEffect, useRef } from 'react';
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

  // 儲存當前選取的科系 ID 與舊的 rankings，供切換年度時比對名稱用
  const selectedDeptRef = useRef(selectedDept);
  const rankingsRef = useRef(rankings);
  const prevDimensionRef = useRef(selectedDimension);

  useEffect(() => {
    selectedDeptRef.current = selectedDept;
  }, [selectedDept]);

  useEffect(() => {
    rankingsRef.current = rankings;
  }, [rankings]);

  const normalizeName = (name) => (name || "").replace(/\n/g, '').replace(/\s+/g, '').trim();

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

  // 當維度改變時，清空選取的校系
  useEffect(() => {
    setSelectedDept(null);
  }, [selectedDimension]);

  // 當年度或維度改變時，重新抓取對應資料
  useEffect(() => {
    if (!selectedYear || !selectedDimension) return;

    let isSubscribed = true;

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}rankings_${selectedYear}_${selectedDimension}.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}graph_${selectedYear}_${selectedDimension}.json`).then(res => res.json())
    ]).then(([rankingData, graphData]) => {
      if (!isSubscribed) return;

      const currentSelectedDept = selectedDeptRef.current;
      const currentRankings = rankingsRef.current;

      // 如果有選取校系，且維度沒有改變（代表是切換年度），我們用名稱對齊新的 ID
      if (currentSelectedDept && prevDimensionRef.current === selectedDimension) {
        const oldDept = currentRankings.find(r => r.id === currentSelectedDept);
        if (oldDept) {
          const oldNormalizedName = normalizeName(oldDept.name);
          const newDept = rankingData.find(r => normalizeName(r.name) === oldNormalizedName);
          if (newDept) {
            setSelectedDept(newDept.id);
          } else {
            setSelectedDept(null);
          }
        } else {
          setSelectedDept(null);
        }
      }

      setRankings(rankingData);
      setGraphData(graphData);
      prevDimensionRef.current = selectedDimension;
    }).catch(err => console.error(`⚠️ 無法讀取資料`, err));

    return () => {
      isSubscribed = false;
    };
  }, [selectedYear, selectedDimension]);

  // 當排名資料更新時，檢查原本選取的校系是否在新的資料中依然存在，若不存在則清空
  useEffect(() => {
    if (selectedDept && rankings.length > 0) {
      const exists = rankings.some(r => r.id === selectedDept);
      if (!exists) {
        setSelectedDept(null);
      }
    }
  }, [rankings, selectedDept]);

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
          currentYear={selectedYear}
          setSelectedYear={setSelectedYear}
        />
      </div>
    </div>
  );
}

export default App;