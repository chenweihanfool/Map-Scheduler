# HERMES 請假 API

讓 HERMES（個人助理／外部系統）用 API 金鑰新增、修改、刪除「同一位固定測量員」本人的請假。每次請求都帶一個外部編號（externalId），同一個編號重送不會重複建立，而是更新原本那一筆；用同一個編號刪除即可移除。

## 環境變數

| 變數 | 說明 |
| --- | --- |
| `LEAVE_API_KEY` | 用來比對請求 header 的 API 金鑰；未設定時 API 回 503 |
| `LEAVE_API_SURVEYOR_NAME` | 固定寫入的測量員姓名（要與系統「測量員管理」裡的姓名完全一致）；未設定回 503、找不到回 422 |

## 端點

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| `PUT` | `/api/public/leaves/:externalId` | 新增或更新請假（依 externalId upsert） |
| `DELETE` | `/api/public/leaves/:externalId` | 依 externalId 刪除請假 |

所有請求都要帶 header：

```
x-leave-api-key: <LEAVE_API_KEY>
```

## 請求 body（PUT）

`externalId` 放在路徑，body 用 JSON：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `startDatetime` | 是 | 開始時間，格式 `YYYY-MM-DD HH:MM` |
| `endDatetime` | 是 | 結束時間，格式 `YYYY-MM-DD HH:MM`，必須晚於開始時間 |
| `leaveType` | 否 | `休假`／`出差`／`上課`，預設 `休假` |
| `reason` | 否 | 請假原因，字串或 null |

body 裡的其他欄位（例如 `surveyorId`、`surveyorName`）會被忽略，測量員一律使用 `LEAVE_API_SURVEYOR_NAME` 指定的那一位。

## 回應碼

| 狀態碼 | 情況 |
| --- | --- |
| `200` | PUT 更新既有請假成功；DELETE 刪除成功 |
| `201` | PUT 新增請假成功 |
| `400` | externalId 格式不符、body 驗證失敗、或開始時間不早於結束時間 |
| `401` | 沒帶或帶錯 `x-leave-api-key` |
| `404` | DELETE 時找不到對應 externalId 的請假 |
| `422` | `LEAVE_API_SURVEYOR_NAME` 在系統測量員清單找不到同名者 |
| `500` | 伺服器錯誤 |
| `503` | `LEAVE_API_KEY` 或 `LEAVE_API_SURVEYOR_NAME` 未設定 |

PUT 成功時回應：

```json
{
  "leave": { "id": "...", "surveyorId": "...", "surveyorName": "...", "leaveType": "休假", "startDatetime": "2026-11-05 09:00", "endDatetime": "2026-11-05 12:00", "reason": null, "externalId": "V-412", "createdAt": "..." },
  "created": false,
  "conflicts": []
}
```

`created` 表示這次是新增（true）還是更新（false）。`conflicts` 是這段請假時間內已排定的案件清單（格式與網頁請假衝突提示相同），沒有衝突時為空陣列；有衝突時照樣寫入，只把衝突清單一併回傳。

DELETE 成功時回應：

```json
{ "success": true }
```

## curl 範例

```bash
# 新增或更新（同一個外部編號重送就是更新，不會重複）
curl -X PUT "https://map-scheduler.onrender.com/api/public/leaves/V-412" \
  -H "Content-Type: application/json" \
  -H "x-leave-api-key: <LEAVE_API_KEY>" \
  -d '{
    "startDatetime": "2026-11-05 09:00",
    "endDatetime": "2026-11-05 12:00",
    "leaveType": "休假",
    "reason": "外出"
  }'

# 刪除
curl -X DELETE "https://map-scheduler.onrender.com/api/public/leaves/V-412" \
  -H "x-leave-api-key: <LEAVE_API_KEY>"
```

## 注意事項

- Render 免費方案閒置後會休眠，第一次請求可能要等約 30–50 秒才回應；HERMES 端呼叫這個 API 的逾時請放寬到 90 秒左右。
- `externalId` 只接受英文字母、數字、底線、連字號，長度 1–64 字元（例如 `V-412`）。
