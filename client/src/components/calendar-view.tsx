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

  const leavesByDate = useMemo(() => {
    const map = new Map<string, SurveyorLeave[]>();
    leavesList.forEach((leave) => {
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
  }, [leavesList]);

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

      {/* Calendar Grid */}
      <div className={cn(
        "grid gap-px bg-border rounded-lg overflow-hidden",
        hideWeekends ? "grid-cols-5" : "grid-cols-7"
      )}>
        {/* Weekday headers */}
        {weekdayLabels.map((day) => (
          <div
            key={day}
            className="bg-muted py-2 text-center text-sm font-medium"
          >
            {day}
          </div>
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayCases = casesByDate.get(dateKey) || [];
          const dayLeaves = leavesByDate.get(dateKey) || [];
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
                className="bg-muted/30 min-h-[120px] p-1"
                data-testid={`calendar-day-${dateKey}`}
              >
                <span className="text-sm text-muted-foreground/50 w-7 h-7 flex items-center justify-center">
                  {format(day, "d")}
                </span>
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
                "bg-background min-h-[120px] p-1 relative group",
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

              {/* Leave indicators */}
              {dayLeaves.length > 0 && (
                <div className="mb-1 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400" data-testid={`leaves-${dateKey}`}>
                  <UserX className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{dayLeaves.map(l => l.surveyorName).join(", ")}</span>
                </div>
              )}

              {/* Cases grouped by surveyor */}
              <div className="space-y-1 overflow-hidden max-h-[90px]">
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

      {/* Surveyor legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <span className="text-sm text-muted-foreground">測量員：</span>
        {surveyorsList.map((surveyor) => (
          <div key={surveyor.id} className="flex items-center gap-1">
            <div className={cn("w-3 h-3 rounded-sm border", surveyorColors[surveyor.name] || "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700")} />
            <span className="text-xs">{surveyor.name}</span>
          </div>
        ))}
      </div>

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
              <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                <UserX className="h-4 w-4 text-orange-500 shrink-0" />
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  <span className="font-medium">請假：</span>
                  {detailLeaves.map(l => l.surveyorName).join("、")}
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

// ── Case chip with hover tooltip ──────────────────────────────────────────────
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
  return (
    <div className="relative group/chip">
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left text-xs px-1.5 py-0.5 rounded border truncate hover-elevate",
          colorClass,
          dimmed && "opacity-40"
        )}
        data-testid={`case-${c.id}`}
      >
        {c.scheduledTime} {c.caseType} {c.landParcel}
      </button>

      {/* Hover tooltip */}
      <div className={cn(
        "absolute left-0 top-full mt-0.5 z-50 pointer-events-none",
        "hidden group-hover/chip:block",
        "min-w-[180px] max-w-[260px]",
        "rounded-md border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs"
      )}>
        <div className="font-semibold mb-1 text-sm">{c.landParcel}</div>
        <div className="space-y-0.5 text-muted-foreground">
          <div className="flex gap-2">
            <span className="shrink-0">時間</span>
            <span className="text-foreground">{c.scheduledTime}</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0">類型</span>
            <span className="text-foreground">{c.caseType}</span>
          </div>
          {c.owner && (
            <div className="flex gap-2">
              <span className="shrink-0">地主</span>
              <span className="text-foreground">{c.owner}</span>
            </div>
          )}
          {c.caseNumber && (
            <div className="flex gap-2 mt-1 pt-1 border-t">
              <span className="shrink-0 text-muted-foreground/70">字號</span>
              <span className="text-muted-foreground/70 break-all">{c.caseNumber}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
