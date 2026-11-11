import { useEffect, useRef, useSyncExternalStore } from "react";
import { format } from "date-fns";

// 「今天」（YYYY-MM-DD）會跟著換日更新：頁面開著過夜、或電腦休眠到隔天再打開時，
// 每 30 秒檢查一次，電腦喚醒、切回頁面時也立刻檢查
const listeners = new Set<() => void>();
let today = format(new Date(), "yyyy-MM-dd");
const check = () => {
  const now = format(new Date(), "yyyy-MM-dd");
  if (now !== today) { today = now; listeners.forEach((l) => l()); }
};
if (typeof window !== "undefined") {
  setInterval(check, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
}

export function useToday(): string {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => today);
}

// 換日時呼叫 onChange(新的今天, 舊的今天)，例 月曆原本停在本月就跟著換到新的月份
export function useOnDayChange(onChange: (now: string, prev: string) => void) {
  const t = useToday(), prev = useRef(t), cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (prev.current !== t) { const p = prev.current; prev.current = t; cb.current(t, p); }
  }, [t]);
}
