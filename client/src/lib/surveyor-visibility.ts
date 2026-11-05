import { useSyncExternalStore } from "react";

// 各測量員在月曆／排班表的顯示方式：顯示（預設）、淡化、隱藏。
// 只存在這個瀏覽器，每位使用者自己設定，不影響其他人與資料
export type SurveyorVis = "show" | "dim" | "hide";
const KEY = "ms-surveyor-vis";
const listeners = new Set<() => void>();

function read(): Record<string, SurveyorVis> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
let current = read();

function write(next: Record<string, SurveyorVis>) {
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 無痕視窗等情況只在這次有效 */ }
  listeners.forEach((l) => l());
}

export function useSurveyorVisibility() {
  const map = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
  const visOf = (name: string): SurveyorVis => map[name] ?? "show";
  const setVis = (name: string, v: SurveyorVis) => {
    const next = { ...current };
    if (v === "show") delete next[name]; else next[name] = v;
    write(next);
  };
  const reset = () => write({});
  const changed = Object.keys(map).length;
  return { visOf, setVis, reset, changed };
}
