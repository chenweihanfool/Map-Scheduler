import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  startOfWeek,
  endOfWeek,
  isToday,
  isBefore,
  startOfDay,
  addMonths,
  subMonths
} from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, UserX, Maximize2, Pencil, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SurveyCase, Surveyor, SurveyorLeave } from "@shared/schema";
import { LeaveForm, leaveStyle, leaveBarClass } from "@/components/leave-form";

// 請假時段：同一天只顯示時間，跨天加上月/日
const leavePeriod = (l: SurveyorLeave) => {
  const [sd, st] = l.startDatetime.split(" "), [ed, et] = l.endDatetime.split(" ");
  const md = (d: string) => d.slice(5).replace("-", "/");
  return sd === ed ? `${st}~${et}` : `${md(sd)} ${st}~${md(ed)} ${et}`;
};

// 一筆請假在某一週的橫條：從第 start 欄到第 end 欄（含），lane 為第幾條
interface LeaveSegment {
  leave: SurveyorLeave;
  start: number;
  end: number;
  lane: number;
  isStart: boolean; // 這一段是請假的第一天
  isEnd: boolean;   // 這一段是請假的最後一天
}

const BAR_H = 20;  // 橫條高度（px）
const BAR_GAP = 2; // 橫條間距（px）

interface CalendarViewProps {
  cases: SurveyCase[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick: (date: Date) => void;
  onCaseClick: (surveyCase: SurveyCase) => void;
  surveyorFilter: string;
  caseTypeFilter: string;
  showVacantOnly: boolean;
  dimPastCases: boolean;
}

const MAX_CASES_PER_DAY = 10;

const WEEKDAYS_ALL = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_WORK = ["一", "二", "三", "四", "五"];

const COLOR_PALETTE = [
  "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  "bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-800",
  "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800",
  "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800",
  "bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800",
  "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800",
];

export function CalendarView({ 
  cases, 
  currentMonth, 
  onMonthChange, 
  onDateClick,
  onCaseClick,
  surveyorFilter,
  caseTypeFilter,
  showVacantOnly,
  dimPastCases,
}: CalendarViewProps) {
  const today = startOfDay(new Date());
  const [detailDay, setDetailDay] = useState<{ date: Date; dateKey: string } | null>(null);
  const [hideWeekends, setHideWeekends] = useState(true);
  // 開關與內容分開：關閉時保留內容，淡出動畫期間標題不會變空白
  const [openLeave, setOpenLeave] = useState<SurveyorLeave | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState(false);
  const showLeave = (l: SurveyorLeave) => {
    setEditingLeave(false);
    setOpenLeave(l);
    setLeaveOpen(true);
  };
  const closeLeave = () => setLeaveOpen(false);

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const { data: leavesList = [] } = useQuery<SurveyorLeave[]>({
    queryKey: ["/api/leaves"],
  });

  const surveyorColors = useMemo(() => {
    const colors: Record<string, string> = {};
    surveyorsList.forEach((surveyor, index) => {
      colors[surveyor.name] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    });
    return colors;
  }, [surveyorsList]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: hideWeekends ? 1 : 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: hideWeekends ? 1 : 0 });

  const days = useMemo(() => {
    const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    if (hideWeekends) {
      return allDays.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
    }
    return allDays;
  }, [calendarStart, calendarEnd, hideWeekends]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSurveyor = !surveyorFilter || surveyorFilter === "all" || c.surveyor === surveyorFilter;
      const matchesCaseType = !caseTypeFilter || caseTypeFilter === "all" || c.caseType === caseTypeFilter;
      return matchesSurveyor && matchesCaseType;
    });
  }, [cases, surveyorFilter, caseTypeFilter]);

  const casesByDate = useMemo(() => {
    const map = new Map<string, SurveyCase[]>();
    filteredCases.forEach((c) => {
      const dateKey = c.surveyDate;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(c);
    });
    map.forEach((cases) => {
      cases.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    });
    return map;
  }, [filteredCases]);

  // 篩選測量員時，請假也只顯示該測量員的
  const filteredLeaves = useMemo(
    () => leavesList.filter((l) => !surveyorFilter || surveyorFilter === "all" || l.surveyorName === surveyorFilter),
    [leavesList, surveyorFilter],
  );

  const leavesByDate = useMemo(() => {
    const map = new Map<string, SurveyorLeave[]>();
    filteredLeaves.forEach((leave) => {
      if (!leave.startDatetime || !leave.endDatetime) return;
      const startDate = leave.startDatetime.substring(0, 10);
      const endDate = leave.endDatetime.substring(0, 10);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const dateKey = format(cur, "yyyy-MM-dd");
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(leave);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [filteredLeaves]);

  // 依週切開：每週一列，請假跨天時在該週畫成一條橫條，跨週就在下一週接著畫
  const cols = hideWeekends ? 5 : 7;
  const weeks = useMemo(() => {
    const out: { days: Date[]; segments: LeaveSegment[]; lanes: number }[] = [];
    for (let i = 0; i < days.length; i += cols) {
      const weekDays = days.slice(i, i + cols);
      const keys = weekDays.map((d) => format(d, "yyyy-MM-dd"));
      const raw = filteredLeaves
        .map((leave) => {
          const sd = leave.startDatetime.slice(0, 10), ed = leave.endDatetime.slice(0, 10);
          const idx = keys.map((k, j) => (k >= sd && k <= ed ? j : -1)).filter((j) => j >= 0);
          if (!idx.length) return null;
          return { leave, start: idx[0], end: idx[idx.length - 1], isStart: keys[idx[0]] === sd, isEnd: keys[idx[idx.length - 1]] === ed };
        })
        .filter((x): x is Omit<LeaveSegment, "lane"> => !!x)
        .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
      const laneEnds: number[] = [];
      const segments = raw.map((seg) => {
        let lane = laneEnds.findIndex((e) => e < seg.start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = seg.end;
        return { ...seg, lane };
      });
      out.push({ days: weekDays, segments, lanes: laneEnds.length });
    }
    return out;
  }, [days, cols, filteredLeaves]);

  const handlePrevMonth = () => onMonthChange(subMonths(currentMonth, 1));
  const handleNextMonth = () => onMonthChange(addMonths(currentMonth, 1));
  const handleToday = () => onMonthChange(new Date());

  const handleDayNumberClick = (day: Date, dateKey: string) => {
    setDetailDay({ date: day, dateKey });
  };

  const handleAddFromDetail = () => {
    if (detailDay) {
      setDetailDay(null);
      onDateClick(detailDay.date);
    }
  };

  const handleCaseClickFromDetail = (surveyCase: SurveyCase) => {
    setDetailDay(null);
    onCaseClick(surveyCase);
  };

  const detailCases = detailDay ? (casesByDate.get(detailDay.dateKey) || []) : [];
  const detailLeaves = detailDay ? (leavesByDate.get(detailDay.dateKey) || []) : [];
  const detailGrouped = detailCases.reduce((acc, c) => {
    if (!acc[c.surveyor]) acc[c.surveyor] = [];
    acc[c.surveyor].push(c);
    return acc;
  }, {} as Record<string, SurveyCase[]>);

  const weekdayLabels = hideWeekends ? WEEKDAYS_WORK : WEEKDAYS_ALL;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[140px] text-center" data-testid="text-current-month">
            {format(currentMonth, "yyyy年 M月", { locale: zhTW })}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNextMonth} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={hideWeekends ? "default" : "outline"}
            size="sm"
            onClick={() => setHideWeekends(!hideWeekends)}
            data-testid="button-toggle-weekends"
            className="gap-1.5"
          >
            <CalendarDays className="h-4 w-4" />
            {hideWeekends ? "僅顯示平日" : "顯示全週"}
          </Button>
          <Button variant="outline" onClick={handleToday} data-testid="button-today">
            今天
          </Button>
        </div>
      </div>

      {/* Calendar Grid：每週一列，請假橫條疊在該週上層 */}
      <div className="flex flex-col gap-px bg-border rounded-lg overflow-hidden">
        <div className={cn("grid gap-px", hideWeekends ? "grid-cols-5" : "grid-cols-7")}>
          {weekdayLabels.map((day) => (
            <div
              key={day}
              className="bg-muted py-2 text-center text-sm font-medium"
            >
              {day}
            </div>
          ))}
        </div>

        {weeks.map(({ days: weekDays, segments, lanes }) => (
          <div key={format(weekDays[0], "yyyy-MM-dd")} className="relative">
            <div className={cn("grid gap-px", hideWeekends ? "grid-cols-5" : "grid-cols-7")}>
              {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayCases = casesByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const dayOfWeek = day.getDay();
          const hasVacancy = dayCases.length < MAX_CASES_PER_DAY;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isPastDay = isBefore(startOfDay(day), today);

          if (showVacantOnly && (!hasVacancy || isWeekend || !isCurrentMonth)) {
            return (
              <div
                key={dateKey}
                className="bg-muted/30 min-h-[120px] 2xl:min-h-[150px] p-1"
                data-testid={`calendar-day-${dateKey}`}
              >
                <span className="text-sm text-muted-foreground/50 w-7 h-7 flex items-center justify-center">
                  {format(day, "d")}
                </span>
                {lanes > 0 && <div style={{ height: lanes * (BAR_H + BAR_GAP) }} />}
              </div>
            );
          }

          const groupedBySurveyor = dayCases.reduce((acc, c) => {
            if (!acc[c.surveyor]) acc[c.surveyor] = [];
            acc[c.surveyor].push(c);
            return acc;
          }, {} as Record<string, SurveyCase[]>);

          return (
            <div
              key={dateKey}
              className={cn(
                "bg-background min-h-[120px] 2xl:min-h-[150px] p-1 relative group",
                !isCurrentMonth && "bg-muted/50",
                dimPastCases && isPastDay && !isTodayDate && "bg-muted/30"
              )}
              data-testid={`calendar-day-${dateKey}`}
            >
              {/* Date number + Add button */}
              <div className="flex items-center justify-between mb-1">
                <button
                  className={cn(
                    "text-sm w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                    isTodayDate && "bg-primary text-primary-foreground font-bold",
                    !isTodayDate && isCurrentMonth && "hover:bg-muted cursor-pointer",
                    !isCurrentMonth && "text-muted-foreground cursor-pointer hover:bg-muted",
                  )}
                  onClick={() => handleDayNumberClick(day, dateKey)}
                  data-testid={`button-day-detail-${dateKey}`}
                  title="查看當日案件"
                >
                  {format(day, "d")}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDateClick(day)}
                  data-testid={`button-add-${dateKey}`}
                  title="新增案件"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* 預留請假橫條的位置（橫條畫在整週的上層） */}
              {lanes > 0 && <div style={{ height: lanes * (BAR_H + BAR_GAP) }} />}

              {/* Cases grouped by surveyor */}
              <div className="space-y-1 overflow-hidden max-h-[90px] xl:max-h-[140px] 2xl:max-h-[200px]">
                {Object.entries(groupedBySurveyor).map(([surveyor, surveyorCases]) => (
                  <div key={surveyor} className="space-y-0.5">
                    <div className="text-xs font-medium text-muted-foreground truncate">
                      {surveyor}
                    </div>
                    {surveyorCases.map((c) => (
                      <CaseChip
                        key={c.id}
                        surveyCase={c}
                        colorClass={surveyorColors[surveyor] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700"}
                        dimmed={dimPastCases && isPastDay && !isTodayDate}
                        onClick={() => onCaseClick(c)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Expand hint or empty hint */}
              {dayCases.length > 0 ? (
                <button
                  className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDayNumberClick(day, dateKey)}
                  title="展開查看全部"
                  data-testid={`button-expand-${dateKey}`}
                >
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                </button>
              ) : (
                dayCases.length === 0 && isCurrentMonth && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => onDateClick(day)}
                  >
                    <span className="text-xs text-muted-foreground">點擊新增</span>
                  </div>
                )
              )}
            </div>
          );
              })}
            </div>

            {lanes > 0 && (
              <div
                className={cn("absolute inset-x-0 top-[34px] grid gap-x-px pointer-events-none", hideWeekends ? "grid-cols-5" : "grid-cols-7")}
                style={{ gridAutoRows: `${BAR_H}px`, rowGap: `${BAR_GAP}px` }}
              >
                {segments.map((seg) => {
                  const l = seg.leave;
                  const type = l.leaveType || "休假";
                  const sameDay = l.startDatetime.slice(0, 10) === l.endDatetime.slice(0, 10);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => showLeave(l)}
                      className={cn(
                        "pointer-events-auto text-xs px-1.5 flex items-center gap-1 overflow-hidden whitespace-nowrap text-left",
                        leaveBarClass(type),
                        seg.isStart ? "ml-1 rounded-l" : "border-l-0",
                        seg.isEnd ? "mr-1 rounded-r" : "border-r-0",
                      )}
                      style={{ gridColumn: `${seg.start + 1} / ${seg.end + 2}`, gridRow: seg.lane + 1 }}
                      title={`${type}：${l.surveyorName} ${leavePeriod(l)}${l.reason ? `（${l.reason}）` : ""}`}
                      data-testid={`leave-bar-${l.id}`}
                    >
                      {!seg.isStart && <span aria-hidden>‹</span>}
                      <span className="font-semibold">{type}</span>
                      <span className="truncate">
                        {l.surveyorName}
                        {sameDay && (l.startDatetime.slice(11) !== "08:00" || l.endDatetime.slice(11) !== "17:00") ? ` ${leavePeriod(l)}` : ""}
                        {l.reason ? `・${l.reason}` : ""}
                      </span>
                      {!seg.isEnd && <span aria-hidden className="ml-auto">›</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Surveyor legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <span className="text-sm text-muted-foreground">測量員：</span>
        {surveyorsList.map((surveyor) => (
          <div key={surveyor.id} className="flex items-center gap-1">
            <div className={cn("w-3 h-3 rounded-sm border", surveyorColors[surveyor.name] || "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700")} />
            <span className="text-xs">{surveyor.name}</span>
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-2">請假：</span>
        {(["休假", "出差", "上課"] as const).map((t) => (
          <div key={t} className="flex items-center gap-1">
            <div className={cn("w-5 h-3 rounded-sm", leaveBarClass(t))} />
            <span className="text-xs">{t}</span>
          </div>
        ))}
      </div>

      {/* 請假詳細（點月曆上的橫條） */}
      <Dialog open={leaveOpen} onOpenChange={(o) => !o && closeLeave()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-leave-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" />
              {editingLeave ? `編輯${openLeave?.leaveType || "休假"}` : `${openLeave?.leaveType || "休假"}：${openLeave?.surveyorName ?? ""}`}
            </DialogTitle>
          </DialogHeader>
          {openLeave && (editingLeave ? (
            <LeaveForm
              open={editingLeave}
              editingLeave={openLeave}
              onDone={closeLeave}
              onCancel={() => setEditingLeave(false)}
            />
          ) : (
            <div className="space-y-3">
              <div className={cn("h-3 rounded", leaveBarClass(openLeave.leaveType))} />
              <dl className="grid grid-cols-[4rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">類型</dt>
                <dd className={cn("font-medium", leaveStyle(openLeave.leaveType).text)}>{openLeave.leaveType || "休假"}</dd>
                <dt className="text-muted-foreground">測量員</dt>
                <dd>{openLeave.surveyorName}</dd>
                <dt className="text-muted-foreground">開始</dt>
                <dd className="tabular-nums">{openLeave.startDatetime.replace(/-/g, "/")}</dd>
                <dt className="text-muted-foreground">結束</dt>
                <dd className="tabular-nums">{openLeave.endDatetime.replace(/-/g, "/")}</dd>
                <dt className="text-muted-foreground">說明</dt>
                <dd>{openLeave.reason || "—"}</dd>
              </dl>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeLeave}>關閉</Button>
                <Button onClick={() => setEditingLeave(true)} data-testid="button-edit-leave-detail">
                  <Pencil className="h-4 w-4 mr-1" />
                  編輯
                </Button>
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>

      {/* Day Detail Dialog */}
      <Dialog open={!!detailDay} onOpenChange={(open) => !open && setDetailDay(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col" data-testid="dialog-day-detail">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>
                {detailDay && format(detailDay.date, "yyyy年 M月 d日（EEEEE）", { locale: zhTW })}
              </span>
              <Badge variant="secondary" className="font-normal text-sm">
                共 {detailCases.length} 件
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
            {detailLeaves.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border">
                <UserX className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm space-y-0.5">
                  {detailLeaves.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => { setDetailDay(null); showLeave(l); }}
                      className={cn("block text-left hover:underline", leaveStyle(l.leaveType).text)}
                    >
                      <span className="font-medium">{l.leaveType || "休假"}：</span>
                      {l.surveyorName}
                      <span className="text-xs text-muted-foreground"> {leavePeriod(l)}{l.reason ? `（${l.reason}）` : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detailCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                本日無排定案件
              </div>
            ) : (
              Object.entries(detailGrouped).map(([surveyor, surveyorCases]) => (
                <div key={surveyor} className="space-y-2">
                  <div className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-md text-sm font-semibold",
                    surveyorColors[surveyor]?.split(" ").slice(0, 4).join(" ") || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  )}>
                    <span>{surveyor}</span>
                    <span className="text-xs font-normal opacity-70">（{surveyorCases.length} 件）</span>
                  </div>
                  <div className="space-y-1 pl-2">
                    {surveyorCases.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleCaseClickFromDetail(c)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg border hover:shadow-sm transition-shadow",
                          surveyorColors[surveyor] || "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        )}
                        data-testid={`detail-case-${c.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium opacity-70">{c.scheduledTime}</span>
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4">{c.caseType}</Badge>
                            </div>
                            <div className="text-sm font-medium mt-0.5 truncate">{c.landParcel}</div>
                            {c.owner && (
                              <div className="text-xs opacity-60 mt-0.5">{c.owner}</div>
                            )}
                          </div>
                          <Pencil className="h-3.5 w-3.5 opacity-40 shrink-0 mt-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 pt-3 border-t">
            <Button onClick={handleAddFromDetail} className="w-full" data-testid="button-detail-add-case">
              <Plus className="h-4 w-4 mr-2" />
              新增本日案件
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Case chip with fixed-position hover tooltip ───────────────────────────────
function CaseChip({
  surveyCase: c,
  colorClass,
  dimmed,
  onClick,
}: {
  surveyCase: SurveyCase;
  colorClass: string;
  dimmed: boolean;
  onClick: () => void;
}) {
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const tooltipWidth = 280;

    let left = rect.left;
    // If tooltip would overflow right edge, flip to left-align from right side
    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }

    const top = rect.bottom + 6;

    setTooltipStyle({ position: "fixed", left, top, width: tooltipWidth, zIndex: 9999 });
  };

  const handleMouseLeave = () => setTooltipStyle(null);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "w-full text-left text-xs px-1.5 py-0.5 rounded border truncate hover-elevate",
          colorClass,
          dimmed && "opacity-40"
        )}
        data-testid={`case-${c.id}`}
      >
        {c.scheduledTime} {c.caseType} {c.landParcel}
      </button>

      {/* Fixed-position tooltip — renders above all UI elements */}
      {tooltipStyle && (
        <div
          style={tooltipStyle}
          className="pointer-events-none rounded-lg border bg-popover text-popover-foreground shadow-xl px-4 py-3 text-sm"
        >
          <div className="font-semibold text-base mb-2 leading-snug">{c.landParcel}</div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex gap-3">
              <span className="shrink-0 w-8">時間</span>
              <span className="text-foreground font-medium">{c.scheduledTime}</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-8">類型</span>
              <span className="text-foreground">{c.caseType}</span>
            </div>
            {c.owner && (
              <div className="flex gap-3">
                <span className="shrink-0 w-8">地主</span>
                <span className="text-foreground">{c.owner}</span>
              </div>
            )}
            {c.caseNumber && (
              <div className="flex gap-3 mt-2 pt-2 border-t border-border/50">
                <span className="shrink-0 w-8 text-xs text-muted-foreground/60">字號</span>
                <span className="text-xs text-muted-foreground/80 break-all">{c.caseNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
