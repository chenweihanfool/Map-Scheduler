# 測量案件排程系統（Map-Scheduler）

通霄地政事務所（苑裡鎮、通霄鎮）測量案件的排程網頁：排定測量員、管理請假與工作日，並依地段地號自動查座標、在地圖上顯示案件位置。

**正式網址：<https://map-scheduler.onrender.com/>**

> 部署在 Render.com 免費方案，閒置 15 分鐘後會休眠，下次開啟要等約 30–50 秒喚醒，屬正常現象。

## 主要功能

- **案件管理**：新增、編輯、刪除、搜尋案件；支援連件（一次產生多筆、可拆件）與延期（保留原案件紀錄並連結新日期）。
- **排程**：月曆、列表、地圖三種檢視；選定測量員後自動推薦最近空檔，排到非工作日會跳出警示。
- **測量員**：代表顏色、排件量與積分；依歷史地號智慧推薦測量員，排件支援順序制與積分制（積分依案件類型權重計算）。
- **請假與工作日**：請假橫條顯示、台灣國定假日與補班日、可自行調整工作日（例：颱風假）。
- **座標查詢**：依地段地號向國土測繪中心（NLSC）查詢座標，涵蓋通霄地政事務所轄區（苑裡鎮、通霄鎮）各地段。
- **系統設定**：案件類型與權重、日期格式（民國／西元，各瀏覽器自訂）。
- **HERMES 請假 API**：個人助理可用外部編號寫入、更新、刪除請假，不會重複（見下方）。

各版本更新內容點網頁左上角標題旁的版本號即可看到（手機寬度不顯示此按鈕）（原始資料在 `client/src/pages/home.tsx` 的 `CHANGELOG`）。

## 技術架構

| 層 | 使用 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、Tailwind CSS、shadcn/ui、TanStack Query、Wouter |
| 後端 | Node.js、Express（`server/`） |
| 資料庫 | PostgreSQL（Azure，`mapscheduler` schema），Drizzle ORM（`shared/schema.ts`） |
| 部署 | Render.com Web Service，監看 `main` 分支，push 後自動重新部署 |

使用者瀏覽器只連 Render 的 HTTPS 網址，由 Render 伺服器代為連 Azure PostgreSQL，因此不會被公務網路對資料庫 port 的管制擋下。部署細節見 [docs/render-deploy-setup.md](docs/render-deploy-setup.md)。

## 目錄

```
client/   前端（pages/home.tsx 是主頁面與版本紀錄）
server/   Express API、資料存取、座標查詢服務
shared/   前後端共用的 schema、地段對照、國定假日
script/   建置腳本
docs/     部署文件
```

## 本機開發

需要 Node.js 與一個 PostgreSQL 連線字串。

```bash
npm install
DATABASE_URL="postgresql://..." npm run dev   # 開發模式，預設 http://localhost:5000
npm run check                                  # TypeScript 型別檢查
npm run build && npm start                     # 正式建置並啟動
```

`npm run dev`／`npm start` 用的是 `NODE_ENV=...` 的 Unix 寫法，Windows 的 npm 預設用 cmd 跑 scripts 會失敗；可在 Git Bash 直接執行 `NODE_ENV=development DATABASE_URL="postgresql://..." npx tsx server/index.ts`。

## 環境變數

| 名稱 | 必要 | 說明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 連線字串 |
| `NODE_ENV` | 正式環境 | `production` |
| `PORT` | 否 | 監聽埠，預設 5000（Render 會自動給） |
| `LEAVE_API_KEY` | 用請假 API 時 | 請假 API 的金鑰，未設定時 API 不開放 |
| `LEAVE_API_SURVEYOR_NAME` | 用請假 API 時 | 請假 API 寫入的測量員姓名 |

## HERMES 請假 API

需在 header 帶 `x-leave-api-key: <LEAVE_API_KEY>`。

- `PUT /api/public/leaves/:externalId`：以外部編號新增或更新一筆請假（同編號不會重複）。
- `DELETE /api/public/leaves/:externalId`：刪除該外部編號的請假。
