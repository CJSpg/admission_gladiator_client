# 校系競爭力戰略儀表板 (Admission Gladiator)

這是一個基於 React 與 Vite 打造的視覺化資料分析儀表板，專門用來檢視與分析台灣大專院校各校系的「招生競爭力」、「歷年分數趨勢」以及「校系間的競爭關係網路」。

## ✨ 主要功能

- **🏆 競爭力排行榜**：支援以「學校」、「校系」、「系組」三個維度查看招生 R-Score 與錄取分數，並提供欄位排序與關鍵字搜尋功能。
- **🤝 競爭關係網**：透過圖論視覺化呈現目標校系與其他校系間的「競爭／重榜關聯」，幫助快速識別主要招生對手。
- **📈 歷年發展趨勢**：追蹤特定校系的歷年 R-Score 與錄取分數變化，洞察學生好感度及招生優勢的趨勢狀態。

## 🛠 技術棧

- **核心框架**：[React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **資料視覺化**：
  - [Recharts](https://recharts.org/)：用於繪製歷年趨勢折線圖等。
  - [Vis-Network](https://visjs.org/)：運用其物理引擎繪製動態的校系競爭關係網路圖。

## 🚀 本地開發與運行

請確保您的環境已安裝 [Node.js](https://nodejs.org/)。

1. **安裝依賴套件**
   ```bash
   npm install
   ```

2. **啟動本地開發伺服器**
   ```bash
   npm run dev
   ```
   啟動後即可在瀏覽器預覽應用程式。

3. **專案打包（Production Build）**
   ```bash
   npm run build
   ```
   打包後的靜態檔案會輸出至 `dist/` 資料夾。

## 📁 資料結構需求

本專案介面顯示需載入對應的靜態 JSON 檔案（基於所在的環境目錄或 public 資料夾）：
- `available_years.json`：可用的學年度清單。
- `rankings_{year}_{dimension}.json`：各年度及不同維度（school/dept/group）的排行榜分數。
- `graph_{year}_{dimension}.json`：網路圖的節點屬性與連線關聯。
