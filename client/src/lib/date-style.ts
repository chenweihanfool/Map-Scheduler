import { useSyncExternalStore } from "react";

// 日期顯示與輸入格式：民國（預設）或西元。資料一律以西元 YYYY-MM-DD 存放，只在畫面上轉換；
// 設定存在各自的瀏覽器，每個人可以選自己習慣的格式
export type DateStyle = "roc" | "ad";
const KEY = "ms-date-style";
const listeners = new Set<() => void>();

function read(): DateStyle {
  try { return localStorage.getItem(KEY) === "ad" ? "ad" : "roc"; } catch { return "roc"; }
}
let current: DateStyle = read();

export const getDateStyle = () => current;
export function setDateStyle(style: DateStyle) {
  current = style;
  try { localStorage.setItem(KEY, style); } catch { /* 無痕視窗等情況存不了，只在這次有效 */ }
  listeners.forEach((l) => l());
}
export function useDateStyle(): [DateStyle, (s: DateStyle) => void] {
  const style = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, getDateStyle);
  return [style, setDateStyle];
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 西元 YYYY-MM-DD（或 Date）→ 畫面文字。short：115/11/05；long：115年11月5日；weekday 加（四）
export function fmtDate(value: string | Date | null | undefined, opts: { long?: boolean; weekday?: boolean; style?: DateStyle } = {}): string {
  const iso = value instanceof Date ? toIso(value) : (value ?? "").slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value instanceof Date ? "" : (value ?? "");
  const style = opts.style ?? current;
  const y = Number(m[1]), year = style === "roc" ? y - 1911 : y;
  const text = opts.long
    ? `${style === "roc" ? "民國" : ""}${year}年${Number(m[2])}月${Number(m[3])}日`
    : `${year}/${m[2]}/${m[3]}`;
  if (!opts.weekday) return text;
  return `${text}（${WEEK[new Date(y, Number(m[2]) - 1, Number(m[3])).getDay()]}）`;
}

// 「YYYY-MM-DD HH:MM」→ 日期依設定、時間照舊
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const [d, t] = value.split(" ");
  return [fmtDate(d), t].filter(Boolean).join(" ");
}

// 月曆標題：115年 11月／2026年 11月
export function fmtMonth(date: Date, style: DateStyle = current): string {
  const y = date.getFullYear();
  return `${style === "roc" ? y - 1911 : y}年 ${date.getMonth() + 1}月`;
}

// 解析使用者輸入的日期，成功回傳西元 YYYY-MM-DD，否則 null。
// 民國：1151105、115/11/5、115.11.05、115-11-05、115年11月5日；西元：20261105、2026/11/05、2026-11-05
export function parseDateInput(text: string): string | null {
  const s = text.trim().replace(/^民國/, "").replace(/\s+/g, "");
  if (!s) return null;
  let y: number, mo: number, d: number;
  const digits = s.match(/^\d+$/);
  if (digits) {
    if (s.length === 8) [y, mo, d] = [Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6))];
    else if (s.length === 7 || s.length === 6) {
      const yl = s.length - 4;
      [y, mo, d] = [Number(s.slice(0, yl)) + 1911, Number(s.slice(yl, yl + 2)), Number(s.slice(yl + 2))];
    } else return null;
  } else {
    const m = s.match(/^(\d{2,4})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})日?$/);
    if (!m) return null;
    y = Number(m[1]) + (m[1].length === 4 ? 0 : 1911);
    mo = Number(m[2]); d = Number(m[3]);
  }
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return toIso(dt);
}
