# 外部專案介接說明

正式網址：`https://map-scheduler.onrender.com`
所有 API 都在 `/api` 底下，資料格式為 JSON（`Content-Type: application/json`）。

> 免費方案閒置 15 分鐘後會休眠，第一個請求可能要等 30–50 秒，請把逾時設長一點。

## 1. 權限

| 動作 | 需要什麼 |
| --- | --- |
| 讀取（`GET`） | 不需金鑰 |
| 寫入（`POST`、`PATCH`、`PUT`、`DELETE`） | 標頭帶 `X-API-Key: <金鑰>`，金鑰向維護者索取 |
| 從瀏覽器前端呼叫（跨網域） | 你的網域要先加進白名單（見第 4 節） |

金鑰錯誤或沒帶時回 `401 {"error":"Missing or invalid X-API-Key"}`。
金鑰只能放在後端或環境變數，**不要寫進前端程式碼或公開 repo**。

## 2. 端點

### 案件（survey cases）
| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/cases` | 全部案件 |
| GET | `/api/cases/search?q=關鍵字` | 搜尋案號、地號、所有權人等 |
| GET | `/api/cases/recommend-surveyor?section=段名&lotNumber=地號` | 依地點推薦測量員 |
| GET | `/api/cases/:id` | 單一案件 |
| POST | `/api/cases` | 新增案件（會自動查座標） |
| PATCH | `/api/cases/:id` | 修改案件（只送要改的欄位） |
| DELETE | `/api/cases/:id` | 刪除案件，回 204 |
| POST | `/api/cases/:id/refresh-coordinates` | 重新查座標 |

新增案件的欄位：

```json
{
  "caseNumber": "115-頭複-001234",
  "caseType": "鑑界",
  "landParcel": "頭份段 123-4",
  "owner": "王○○",
  "surveyor": "測量員姓名",
  "surveyDate": "2026-11-05",
  "scheduledTime": "09:00",
  "notes": "備註"
}
```

- 必填：`caseNumber`、`landParcel`、`surveyor`、`surveyDate`（`YYYY-MM-DD`）、`scheduledTime`。
- `caseType` 要用 `GET /api/case-types` 回傳的名稱，不在清單裡的照原字串存，但畫面上的分類與權重會對不上。
- `surveyor` 要和 `GET /api/surveyors` 的 `name` 完全一致。

### 測量員、請假、案件類型、設定
| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/surveyors` | 測量員清單 |
| GET | `/api/surveyors/next/suggested?date=YYYY-MM-DD` | 下一位建議指派的測量員 |
| GET | `/api/leaves` | 未結束的請假（`?includePast=true` 含已結束） |
| GET | `/api/leaves/date/:date` | 某日的請假 |
| POST | `/api/leaves` | 新增請假（見下） |
| PATCH / DELETE | `/api/leaves/:id` | 修改／刪除請假 |
| GET | `/api/case-types` | 案件類型清單 |
| GET | `/api/settings` | 排件模式等設定 |
| GET | `/api/health` | 健康檢查 |

新增請假：

```json
{
  "surveyorId": "測量員 id",
  "surveyorName": "測量員姓名",
  "startDatetime": "2026-11-05 08:00",
  "endDatetime": "2026-11-05 17:00",
  "reason": "休假"
}
```

和既有案件衝突時回 `409`，內容列出衝突的案件；確定要建立就加 `?force=true` 再送一次。

測量員、案件類型、設定的寫入端點是給本站管理畫面用的，外部專案請不要呼叫。

## 3. 範例

```bash
# 讀取（不需金鑰）
curl https://map-scheduler.onrender.com/api/cases

# 新增案件（需要金鑰）
curl -X POST https://map-scheduler.onrender.com/api/cases \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MAP_SCHEDULER_API_KEY" \
  -d '{"caseNumber":"115-頭複-001234","caseType":"鑑界","landParcel":"頭份段 123-4","surveyor":"測量員姓名","surveyDate":"2026-11-05","scheduledTime":"09:00"}'
```

## 4. 維護者設定（Render 環境變數）

| 變數 | 用途 | 範例 |
| --- | --- | --- |
| `CORS_ALLOWED_ORIGINS` | 允許從瀏覽器跨網域呼叫的網域，逗號分隔，要含 `https://`、不要結尾斜線 | `https://other-app.onrender.com,http://localhost:3000` |
| `INTEGRATION_API_KEY` | 外部寫入用的金鑰，用夠長的亂數（例如 `openssl rand -hex 32`） | — |

- 兩個都沒設時，行為和以前一樣：不開放跨網域，寫入也不需金鑰。
- 改了環境變數，Render 會自動重新啟動服務。
- 換金鑰：改 `INTEGRATION_API_KEY`，再通知介接的開發者。

### 限制
- 本站畫面本身沒有登入；判斷「同網域請求」靠的是 `Origin` 標頭，瀏覽器無法偽造，但後端程式可以。所以金鑰擋得住誤用與一般跨站呼叫，擋不住有心人。要真正保護資料，需要替整個網站加登入。
- 讀取端點不需金鑰，案件資料（含所有權人姓名）任何人都能讀到。
