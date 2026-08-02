# Render.com 部署設定

跟 Azure App Service 同樣的角色分工：使用者瀏覽器只走一般 HTTPS 連
Render 給的網址，真正連 Azure PostgreSQL 這件事發生在 Render 的伺服器
上，不經過使用者自己的辦公室網路，不會被公務系統外網對「直連遠端資料庫
port」的管制擋下。資料庫本身還是留在 Azure（`toufen.postgres.database.azure.com`），
Render 只是負責跑這個 Node.js 網頁服務。

## 1. 建立 Web Service

1. 到 [Render Dashboard](https://dashboard.render.com/) 註冊/登入
   （可以直接用 GitHub 帳號登入，順便完成授權）。
2. **New** → **Web Service**。
3. 選擇 `chenweihanfool/Map-Scheduler` 這個 repo（第一次使用需要先授權
   Render 存取你的 GitHub 帳號/repo）。
4. 基本設定：
   - **Name**：例如 `map-scheduler`（會變成
     `https://map-scheduler.onrender.com`）。
   - **Region**：選 **Singapore**（離台灣最近，Render 沒有台灣或東亞
     其他地區可選）。
   - **Branch**：`main`。
   - **Runtime**：**Node**。
   - **Build Command**：`npm ci --include=dev && npm run build`
     （`--include=dev` 必須加，因為下面第 2 步設定的
     `NODE_ENV=production` 在建置階段也會生效，導致 `npm ci` 預設跳過
     `tsx`/`esbuild`/`vite` 這些放在 devDependencies 裡的建置工具，
     建置會直接失敗報 `tsx: not found`。）
   - **Start Command**：`npm start`
   - **Instance Type**：**Free**。

## 2. 設定環境變數

同一頁往下捲到 **Environment Variables**，新增：
```
DATABASE_URL = postgresql://PostgreSQL_toufen:<密碼>@toufen.postgres.database.azure.com:5432/postgres?sslmode=require&options=-csearch_path%3Dmapscheduler
NODE_ENV = production
```

## 3. 確認 Azure PostgreSQL 防火牆放行 Render

Render 免費方案沒有固定的對外 IP（要付費才有），沒辦法在 Azure 那邊
用「只允許特定 IP」的白名單方式精準放行。如果部署後連不上資料庫（記錄
裡看到連線逾時/被拒絕），去 Azure Portal 找到 `toufen` 這個 PostgreSQL
資源 → **網路功能** → 確認**允許從任何 Azure 服務及此伺服器內的資源
存取此伺服器**有沒有涵蓋、或乾脆新增一條防火牆規則允許 `0.0.0.0` -
`255.255.255.255`（等於對外開放，用密碼 + 強制 SSL 當防線）。因為
Render 的 IP 會變動，這是在免費方案下唯一可靠的做法。

## 4. 部署 & 自動更新

點 **Create Web Service** 後 Render 會自動抓 repo、建置、啟動，第一次
部署完成大約幾分鐘。**不需要另外設定 GitHub Actions**——Render 自己
會監看這個 repo 的 `main` 分支，之後每次 `git push` 都會自動觸發重新
部署。

## 5. 驗證

1. 部署完成後打開 `https://<你的服務名稱>.onrender.com`，應該看到
   排程系統畫面，載入 579 筆真實案件資料。
2. 免費方案閒置 15 分鐘後會休眠，下次有人連線時要等約 30-50 秒喚醒
   （這段時間瀏覽器看起來像是卡住在讀取中，屬正常現象，重新整理或
   稍等即可）。
3. 如果畫面空白或報錯，看 Render Dashboard 裡這個服務的 **Logs**
   分頁，通常是 `DATABASE_URL` 打錯或防火牆沒放行（見上面第 3 點）。
