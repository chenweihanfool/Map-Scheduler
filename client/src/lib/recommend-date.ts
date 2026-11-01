import { addDays, format } from "date-fns";
import { isPostponed, type SurveyCase, type SurveyorLeave } from "@shared/schema";

export type SlotRecommendation = { date: string; time: string; afternoon: boolean; daysAhead: number };

export const MORNING = "09:00";
export const AFTERNOON = "14:00";
const AFTERNOON_AFTER_DAYS = 14;   // 14 天內只推薦上午，超過才考慮下午

// 「上午 09:00」「14:00」「下午 2:00」→ 24 小時制的小時
function hourOf(time: string | null | undefined): number | null {
  const m = (time ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  if (/下午|晚上/.test(time ?? "") && h < 12) h += 12;
  return h;
}

// 休假、出差、上課的時間是否和這個時段重疊
const onLeave = (leaves: SurveyorLeave[], surveyor: string, date: string, from: string, to: string) =>
  leaves.some((l) => l.surveyorName === surveyor && l.startDatetime < `${date} ${to}` && l.endDatetime > `${date} ${from}`);

// 測量員之後的空檔：工作日、沒有休假出差上課、該時段沒有案件。上午優先（09:00），
// 從今天算起超過 14 天的日子才考慮下午（14:00）
export function recommendSlot(opts: {
  surveyor: string;
  cases: SurveyCase[];
  leaves: SurveyorLeave[];
  isWorkday: (date: string) => boolean;
  today?: Date;
  excludeId?: string;
}): SlotRecommendation | null {
  const { surveyor, cases, leaves, isWorkday, today = new Date(), excludeId } = opts;
  if (!surveyor) return null;
  const mine = cases.filter((c) => c.surveyor === surveyor && !isPostponed(c) && c.id !== excludeId);
  for (let i = 1; i <= 366; i++) {
    const date = format(addDays(today, i), "yyyy-MM-dd");
    if (!isWorkday(date)) continue;
    const hours = mine.filter((c) => c.surveyDate === date).map((c) => hourOf(c.scheduledTime) ?? 9);
    if (!hours.some((h) => h < 12) && !onLeave(leaves, surveyor, date, "08:00", "12:00")) {
      return { date, time: MORNING, afternoon: false, daysAhead: i };
    }
    if (i > AFTERNOON_AFTER_DAYS && !hours.some((h) => h >= 12) && !onLeave(leaves, surveyor, date, "13:00", "17:00")) {
      return { date, time: AFTERNOON, afternoon: true, daysAhead: i };
    }
  }
  return null;
}
