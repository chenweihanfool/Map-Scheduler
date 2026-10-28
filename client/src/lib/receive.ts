import { RECEIVE_WORDS } from "@shared/schema";

// 收件日期以 YYYY-MM-DD 存放，畫面以民國年顯示
export function formatRocDate(value?: string | null, style: "short" | "long" = "short"): string {
  const m = (value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const year = Number(m[1]) - 1911;
  return style === "long"
    ? `民國 ${year} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`
    : `${year}/${m[2]}/${m[3]}`;
}

// 輸入前兩碼（例 81）就帶出完整收件字（81通圖土）；其他內容維持原樣
export function completeReceiveWord(value: string): string {
  const v = value.trim();
  if (!/^\d{2}$/.test(v)) return value;
  return RECEIVE_WORDS.find((w) => w.startsWith(v)) ?? value;
}

// 案號可留空（案件有時還沒收件），顯示時改用「未收件」
export function caseLabel(c: { caseNumber?: string | null }): string {
  return c.caseNumber?.trim() || "（未收件）";
}

// 「收件日期・收件字」的簡短說明，沒有資料時回傳空字串
export function receiveSummary(c: { receiveDate?: string | null; receiveWord?: string | null }): string {
  return [formatRocDate(c.receiveDate), c.receiveWord ?? ""].filter(Boolean).join("・");
}
