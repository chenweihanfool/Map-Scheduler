import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isToday, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CaseChip } from "@/components/calendar-view";
import { leaveBarClass } from "@/components/leave-form";
import { useWorkdays } from "@/hooks/use-workdays";
import { surveyorColorStyle } from "@/lib/surveyor-colors";
import { fmtDate } from "@/lib/date-style";
import { hourOf } from "@/lib/recommend-date";
import { isPostponed, type SurveyCase, type Surveyor, type SurveyorLeave } from "@shared/schema";

interface ScheduleBoardProps {
  cases: SurveyCase[];               // 已依測量員／類型篩選
  surveyorFilter?: string;
  dimPastCases?: boolean;
  onCaseClick: (c: SurveyCase) => void;
  onAdd: (date: Date, surveyor: string, time: string) => void;
}

type Half = "am" | "pm";
const HALVES: { key: Half; label: string; time: string; from: string; to: string }[] = [
  { key: "am", label: "上午", time: "09:00", from: "08:00", to: "12:00" },
  { key: "pm", label: "下午", time: "14:00", from: "13:00", to: "17:00" },
];
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const SPAN_KEY = "ms-board-weeks";

const readSpan = () => { try { return localStorage.getItem(SPAN_KEY) === "1" ? 1 : 2; } catch { return 2; } };
const halfOf = (c: SurveyCase): Half => ((hourOf(c.scheduledTime) ?? 9) < 12 ? "am" : "pm");

// 排班表：每位測量員一列、每個工作日一欄，每格分上午／下午，請假整段畫上斜紋。
// 一次看一或兩週，方便看出誰哪天哪個時段有空
export function ScheduleBoard({ cases, surveyorFilter, dimPastCases, onCaseClick, onAdd }: ScheduleBoardProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [span, setSpan] = useState<1 | 2>(readSpan);
  const { info: dayInfo } = useWorkdays();
  const { data: surveyors = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const { data: leaves = [] } = useQuery<SurveyorLeave[]>({ queryKey: ["/api/leaves"] });

  const changeSpan = (n: 1 | 2) => { setSpan(n); try { localStorage.setItem(SPAN_KEY, String(n)); } catch { /* 只影響這次 */ } };

  // 週一到週五；週末只有補班或有排案件／請假時才顯示
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < span * 7; i++) {
      const d = addDays(weekStart, i), key = format(d, "yyyy-MM-dd"), dow = d.getDay();
      if (dow !== 0 && dow !== 6) { out.push(d); continue; }
      if (dayInfo(key).workday || cases.some((c) => c.surveyDate === key && !isPostponed(c))) out.push(d);
    }
    return out;
  }, [weekStart, span, dayInfo, cases]);
  const keys = days.map((d) => format(d, "yyyy-MM-dd"));

  const rows = useMemo(
    () => surveyors.map((s, i) => ({ s, i })).filter(({ s }) => !surveyorFilter || surveyorFilter === "all" || s.name === surveyorFilter),
    [surveyors, surveyorFilter],
  );

  // 測量員|日期|上下午 → 案件
  const slots = useMemo(() => {
    const m = new Map<string, SurveyCase[]>();
    const inRange = new Set(keys);
    cases.forEach((c) => {
      if (!inRange.has(c.surveyDate)) return;
      const k = `${c.surveyor}|${c.surveyDate}|${halfOf(c)}`;
      m.set(k, [...(m.get(k) || []), c]);
    });
    m.forEach((list) => list.sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || "")));
    return m;
  }, [cases, keys.join()]);

  const leaveAt = (surveyor: string, date: string, h: (typeof HALVES)[number]) =>
    leaves.filter((l) => l.surveyorName === surveyor && l.startDatetime < `${date} ${h.to}` && l.endDatetime > `${date} ${h.from}`);

  const today = format(new Date(), "yyyy-MM-dd");
  const countOf = (date: string, half: Half) =>
    rows.reduce((n, { s }) => n + (slots.get(`${s.name}|${date}|${half}`) || []).filter((c) => !isPostponed(c)).length, 0);
  const rangeCount = (name: string) =>
    keys.reduce((n, k) => n + HALVES.reduce((m, h) => m + (slots.get(`${name}|${k}|${h.key}`) || []).filter((c) => !isPostponed(c)).length, 0), 0);

  const gridCols = `7.5rem repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="space-y-2 xl:flex-1 xl:min-h-0 xl:flex xl:flex-col" data-testid="schedule-board">
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} data-testid="button-board-prev" aria-label="上一週">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold tabular-nums min-w-[220px] text-center" data-testid="text-board-range">
            {fmtDate(days[0] ?? weekStart)} – {fmtDate(days[days.length - 1] ?? addDays(weekStart, 4)).replace(/^\d+\//, "")}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="button-board-next" aria-label="下一週">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => changeSpan(n)}
                className={cn("px-3 py-1 text-sm rounded", span === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                data-testid={`button-board-span-${n}`}
              >
                {n === 1 ? "一週" : "兩週"}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} data-testid="button-board-today">本週</Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-auto xl:flex-1 xl:min-h-0 thin-scroll">
        <div
          className="grid min-w-[900px] h-full bg-border gap-px"
          style={{ gridTemplateColumns: gridCols, gridTemplateRows: `auto repeat(${rows.length}, minmax(76px, 1fr)) auto` }}
        >
          {/* 表頭：日期 */}
          <div className="bg-muted sticky left-0 z-20 px-2 py-1.5 text-xs text-muted-foreground flex items-end">測量員</div>
          {days.map((d, j) => {
            const k = keys[j], w = dayInfo(k), weekBreak = j > 0 && d.getDay() < days[j - 1].getDay();
            return (
              <div
                key={k}
                className={cn(
                  "bg-muted px-1.5 py-1 text-center sticky top-0 z-10",
                  isToday(d) && "bg-sky-100 dark:bg-sky-950",
                  weekBreak && "border-l-4 border-l-border",
                )}
              >
                <div className={cn("text-sm font-semibold tabular-nums", !w.workday && "text-red-600 dark:text-red-400", isToday(d) && "text-primary")}>
                  {format(d, "M/d")}（{WEEK[d.getDay()]}）
                </div>
                <div className="text-[11px] leading-4 h-4 truncate text-red-600 dark:text-red-400">
                  {w.label || (isToday(d) ? <span className="text-primary font-medium">今天</span> : "")}
                </div>
              </div>
            );
          })}

          {/* 每位測量員一列 */}
          {rows.map(({ s, i }) => {
            const color = surveyorColorStyle(s, i);
            return [
              <div key={`h-${s.id}`} className={cn("sticky left-0 z-10 px-2 py-1.5 flex flex-col justify-center border-l-4", color.card)} data-testid={`board-row-${s.id}`}>
                <div className="font-medium text-sm truncate">{s.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{s.businessAttribute}・{rangeCount(s.name)} 件</div>
              </div>,
              ...days.map((d, j) => {
                const k = keys[j], w = dayInfo(k), past = k < today, weekBreak = j > 0 && d.getDay() < days[j - 1].getDay();
                return (
                  <div
                    key={`${s.id}-${k}`}
                    className={cn(
                      "bg-background grid grid-rows-2 min-h-0",
                      !w.workday && "bg-[repeating-linear-gradient(135deg,rgb(239_68_68/0.06)_0_6px,transparent_6px_12px)]",
                      isToday(d) && "bg-sky-50 dark:bg-sky-950/60",
                      weekBreak && "border-l-4 border-l-border",
                    )}
                  >
                    {HALVES.map((h) => {
                      const list = slots.get(`${s.name}|${k}|${h.key}`) || [];
                      const lv = leaveAt(s.name, k, h);
                      const free = !list.some((c) => !isPostponed(c)) && !lv.length && w.workday;
                      return (
                        <div
                          key={h.key}
                          className={cn("relative group min-h-0 overflow-y-auto thin-scroll px-1 py-0.5 space-y-0.5", h.key === "pm" && "border-t border-dashed")}
                          data-testid={`board-${s.name}-${k}-${h.key}`}
                        >
                          {!list.length && !lv.length && <span className="absolute right-1 top-0.5 text-[10px] text-muted-foreground/50 pointer-events-none">{h.label}</span>}
                          {lv.map((l) => (
                            <div
                              key={l.id}
                              className={cn("text-[11px] px-1.5 rounded truncate font-medium", leaveBarClass(l.leaveType))}
                              title={`${l.leaveType || "休假"}：${l.surveyorName} ${l.startDatetime} ~ ${l.endDatetime}${l.reason ? `（${l.reason}）` : ""}`}
                            >
                              {l.leaveType || "休假"}{l.reason && l.reason !== (l.leaveType || "休假") ? `・${l.reason}` : ""}
                            </div>
                          ))}
                          {list.map((c) => (
                            <CaseChip key={c.id} surveyCase={c} colorClass={color.chip} dimmed={!!dimPastCases && past} onClick={() => onCaseClick(c)} />
                          ))}
                          {free && !past && (
                            <button
                              type="button"
                              onClick={() => onAdd(d, s.name, h.time)}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground"
                              title={`新增 ${s.name} ${format(d, "M/d")} ${h.label} 的案件`}
                              data-testid={`board-add-${s.name}-${k}-${h.key}`}
                            >
                              <Plus className="h-3.5 w-3.5 mr-0.5" />{h.label}空檔
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }),
            ];
          })}

          {/* 每天合計 */}
          <div className="bg-muted sticky left-0 z-10 px-2 py-1 text-xs text-muted-foreground">每日合計</div>
          {days.map((d, j) => {
            const k = keys[j], am = countOf(k, "am"), pm = countOf(k, "pm"), weekBreak = j > 0 && d.getDay() < days[j - 1].getDay();
            return (
              <div key={`t-${k}`} className={cn("bg-muted px-1.5 py-1 text-center text-xs tabular-nums text-muted-foreground", weekBreak && "border-l-4 border-l-border")}>
                {am + pm ? <>上 <b className="text-foreground">{am}</b>・下 <b className="text-foreground">{pm}</b></> : "—"}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
