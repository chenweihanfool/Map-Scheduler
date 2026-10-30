// 台灣國定假日（行政院人事行政總處行事曆，含補假）。新年度公布後在這裡補上；
// 個別日期也可以在月曆的「調整工作日」改成休假或補班（存在 workday_overrides）
export const TW_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "元旦",
  "2026-02-14": "春節", "2026-02-15": "春節", "2026-02-16": "春節", "2026-02-17": "春節", "2026-02-18": "春節",
  "2026-02-19": "春節", "2026-02-20": "春節", "2026-02-21": "春節", "2026-02-22": "春節",
  "2026-02-27": "和平紀念日（補假）", "2026-02-28": "和平紀念日",
  "2026-04-03": "兒童節（補假）", "2026-04-04": "兒童節", "2026-04-05": "清明節", "2026-04-06": "清明節（補假）",
  "2026-05-01": "勞動節",
  "2026-06-19": "端午節",
  "2026-09-25": "中秋節",
  "2026-09-28": "教師節",
  "2026-10-09": "國慶日（補假）", "2026-10-10": "國慶日",
  "2026-10-25": "光復節", "2026-10-26": "光復節（補假）",
  "2026-12-25": "行憲紀念日",
};

export type WorkdayInfo = { workday: boolean; label: string; kind: "holiday" | "off" | "makeup" | "weekend" | "work" };

// 判斷某天是否上班：手動調整 > 國定假日 > 週末
export function workdayInfo(date: string, overrides: { date: string; kind: string; label: string | null }[] | Map<string, { kind: string; label: string | null }>): WorkdayInfo {
  const o = overrides instanceof Map ? overrides.get(date) : overrides.find((x) => x.date === date);
  const dow = new Date(`${date}T00:00:00`).getDay(), weekend = dow === 0 || dow === 6;
  if (o?.kind === "work") return { workday: true, label: o.label || (weekend ? "補班" : "上班"), kind: "makeup" };
  if (o?.kind === "off") return { workday: false, label: o.label || "休假", kind: "off" };
  if (TW_HOLIDAYS[date]) return { workday: false, label: TW_HOLIDAYS[date], kind: "holiday" };
  if (weekend) return { workday: false, label: "", kind: "weekend" };
  return { workday: true, label: "", kind: "work" };
}
