import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { workdayInfo, type WorkdayInfo } from "@shared/holidays";
import type { WorkdayOverride } from "@shared/schema";

// 國定假日＋手動調整的工作日；回傳查某天是否上班的函式
export function useWorkdays() {
  const { data: overrides = [] } = useQuery<WorkdayOverride[]>({ queryKey: ["/api/workdays"] });
  const map = useMemo(() => new Map(overrides.map((o) => [o.date, o])), [overrides]);
  const info = useMemo(() => (date: string): WorkdayInfo => workdayInfo(date, map), [map]);
  return { overrides, info };
}
