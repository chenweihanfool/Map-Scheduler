# Azure App Service 部署設定

這個系統改用 Azure App Service 部署（取代 Replit），角色分工比照 Replit
當初的模式：使用者的瀏覽器只走一般 HTTPS 連 App Service 給的網址，真正
連資料庫這件事發生在 App Service 上，不會經過使用者自己的辦公室網路，
所以不會被公務系統外網對「直連遠端資料庫 port」的管制擋下。

## 1. 建立 App Service

1. 到 [Azure Portal](https://portal.azure.com/) → **建立資源** → 搜尋
   **Web App**。
2. 基本設定：
   - **訂用帳戶**：跟你現有的 `toufen` PostgreSQL 資源同一個。
   - **資源群組**：可以跟 PostgreSQL 放同一個資源群組，方便管理。
   - **名稱**：例如 `mapscheduler`（會變成
     `https://mapscheduler.azurewebsites.net`，名稱要全域唯一，被佔用
     的話系統會提示改名）。
   - **發佈**：選 **程式碼**。
   - **執行階段堆疊**：**Node 20 LTS**。
   - **作業系統**：**Linux**。
   - **地區**：跟 `toufen` PostgreSQL 那個資源群組顯示的地區選同一個
     （在 Postgres 資源的「總覽」頁面可以看到，通常是 Japan East 或
     Southeast Asia 這類離台灣近的地區）——同地區延遲較低，資料庫連線
     也不用跨區。
3. **定價方案**：先選 **F1（免費）** 試用即可。缺點是閒置一段時間後
   會休眠，下次連線要等它醒來幾秒；如果覺得這個延遲困擾，之後可以隨時
   升級到 **B1（Basic）**（月費約 300-400 台幣），沒有休眠問題。
4. 其他頁籤（網路功能等）維持預設即可，直接建立。

## 2. 設定環境變數（Application Settings）

App Service 建立完成後：

1. 進入這個 Web App 資源 → 左側選單 **設定** → **環境變數**
   （Configuration → Application settings）。
2. 新增以下設定：
   ```
   DATABASE_URL = postgresql://PostgreSQL_toufen:<密碼>@toufen.postgres.database.azure.com:5432/postgres?sslmode=require&options=-csearch_path%3Dmapscheduler
   NODE_ENV = production
   ```
   （`DATABASE_URL` 裡的 `options=-csearch_path%3Dmapscheduler` 是讓連線
   預設查詢範圍鎖定在 `mapscheduler` schema，跟其他共用這個資料庫的
   專案分開，不是必要但建議加上。）
3. 儲存後 App Service 會自動重新啟動套用新設定。

## 3. 接上 GitHub 自動部署

1. 左側選單 **部署** → **部署中心**（Deployment Center）。
2. 來源選 **GitHub**，登入並授權存取 `chenweihanfool/Map-Scheduler` 這個
   repo，分支選 `main`。
3. 建置提供者選 **GitHub Actions**，執行階段堆疊選 **Node.js**。
4. 儲存後，Azure 會自動在這個 repo 建立一個
   `.github/workflows/main_<你的app名稱>.yml`（或類似命名）的工作流程
   檔案，並自動把部署用的憑證存成 GitHub secret——這一步不需要你手動
   複製貼上任何金鑰，Azure 自己會處理。
5. 之後每次 `git push` 到 `main`，這個 workflow 就會自動建置並部署到
   App Service，幾分鐘後網站會更新。

## 4. 驗證

1. 部署完成後打開 `https://<你的app名稱>.azurewebsites.net`，應該會
   看到排程系統的畫面，載入 579 筆真實案件資料。
2. 如果打開後空白或報錯，先看 **監控** → **記錄串流**（Log stream），
   通常是 `DATABASE_URL` 沒設定對或者建置指令跟 Azure 預設的 Node.js
   建置流程對不上（這個 repo 的建置指令是自訂的 `npm run build`，
   Azure 自動產生的 workflow 通常會抓對，但如果沒有，需要手動調整
   workflow 裡的 build/deploy 步驟）。
