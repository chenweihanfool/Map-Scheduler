import { useMemo } from "react";
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
  addMonths,
  subMonths
} from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SurveyCase, Surveyor } from "@shared/schema";

interface CalendarViewProps {
  cases: SurveyCase[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick: (date: Date) => void;
  onCaseClick: (surveyCase: SurveyCase) => void;
  surveyorFilter: string;
  caseTypeFilter: string;
  showVacantOnly: boolean;
}

const MAX_CASES_PER_DAY = 10;

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
  showVacantOnly
}: CalendarViewProps) {
  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
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
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(() => {
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarStart, calendarEnd]);

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
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(c);
    });
    return map;
  }, [filteredCases]);

  const handlePrevMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    onMonthChange(new Date());
  };

  return (
    <div className="space-y-4">
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
        <Button variant="outline" onClick={handleToday} data-testid="button-today">
          今天
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={cn(
              "bg-muted py-2 text-center text-sm font-medium",
              index === 0 && "text-red-500 dark:text-red-400",
              index === 6 && "text-blue-500 dark:text-blue-400"
            )}
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayCases = casesByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const dayOfWeek = day.getDay();
          const hasVacancy = dayCases.length < MAX_CASES_PER_DAY;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

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
            if (!acc[c.surveyor]) {
              acc[c.surveyor] = [];
            }
            acc[c.surveyor].push(c);
            return acc;
          }, {} as Record<string, SurveyCase[]>);

          return (
            <div
              key={dateKey}
              className={cn(
                "bg-background min-h-[120px] p-1 relative group",
                !isCurrentMonth && "bg-muted/50"
              )}
              data-testid={`calendar-day-${dateKey}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-sm w-7 h-7 flex items-center justify-center rounded-full",
                    isTodayDate && "bg-primary text-primary-foreground font-bold",
                    !isCurrentMonth && "text-muted-foreground",
                    dayOfWeek === 0 && isCurrentMonth && !isTodayDate && "text-red-500 dark:text-red-400",
                    dayOfWeek === 6 && isCurrentMonth && !isTodayDate && "text-blue-500 dark:text-blue-400"
                  )}
                >
                  {format(day, "d")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDateClick(day)}
                  data-testid={`button-add-${dateKey}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-1 overflow-y-auto max-h-[80px]">
                {Object.entries(groupedBySurveyor).map(([surveyor, surveyorCases]) => (
                  <div key={surveyor} className="space-y-0.5">
                    <div className="text-xs font-medium text-muted-foreground truncate">
                      {surveyor}
                    </div>
                    {surveyorCases.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onCaseClick(c)}
                        className={cn(
                          "w-full text-left text-xs px-1.5 py-0.5 rounded border truncate hover-elevate",
                          surveyorColors[surveyor] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                        )}
                        data-testid={`case-${c.id}`}
                      >
                        {c.scheduledTime} {c.caseType}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {dayCases.length === 0 && isCurrentMonth && (
                <div 
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => onDateClick(day)}
                >
                  <span className="text-xs text-muted-foreground">點擊新增</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <span className="text-sm text-muted-foreground">測量員：</span>
        {surveyorsList.map((surveyor) => (
          <div key={surveyor.id} className="flex items-center gap-1">
            <div className={cn("w-3 h-3 rounded-sm border", surveyorColors[surveyor.name] || "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700")} />
            <span className="text-xs">{surveyor.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
