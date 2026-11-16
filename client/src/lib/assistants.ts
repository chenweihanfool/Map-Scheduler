import { useQuery } from "@tanstack/react-query";
import { hourOf } from "@/lib/recommend-date";
import type { Assistant, AssistantLeave, Surveyor } from "@shared/schema";

export type Half = "am" | "pm";
const RANGE: Record<Half, [string, string]> = { am: ["08:00", "12:00"], pm: ["13:00", "17:00"] };
export const halfOfTime = (t: string | null | undefined): Half => ((hourOf(t) ?? 9) < 12 ? "am" : "pm");

export function useAssistants() {
  const { data: assistants = [] } = useQuery<Assistant[]>({ queryKey: ["/api/assistants"] });
  const { data: leaves = [] } = useQuery<AssistantLeave[]>({ queryKey: ["/api/assistant-leaves"] });
  return { assistants, leaves };
}

// 這位助理在某天某半天（或整天任一時段）是否請假
export const assistantOff = (leaves: AssistantLeave[], a: Assistant, date: string, half?: Half) =>
  leaves.some((l) => {
    if (l.assistantId !== a.id) return false;
    const [from, to] = half ? RANGE[half] : ["00:00", "23:59"];
    return l.startDatetime < `${date} ${to}` && l.endDatetime > `${date} ${from}`;
  });

// 某天請假的助理（給月曆、排班表顯示）
export const assistantLeavesOn = (leaves: AssistantLeave[], date: string, half?: Half) =>
  leaves.filter((l) => {
    const [from, to] = half ? RANGE[half] : ["00:00", "23:59"];
    return l.startDatetime < `${date} ${to}` && l.endDatetime > `${date} ${from}`;
  });

// 測量員某時段的助理狀況：固定助理都請假時要提醒，並列出可支援的非固定助理。
// 沒有固定助理的測量員，只在非固定助理也都請假時提醒
export function assistantStatus(surveyor: Pick<Surveyor, "id"> | undefined, date: string, half: Half, assistants: Assistant[], leaves: AssistantLeave[]) {
  const fixed = surveyor ? assistants.filter((a) => a.surveyorId === surveyor.id) : [];
  const floating = assistants.filter((a) => !a.surveyorId);
  const fixedOff = fixed.filter((a) => assistantOff(leaves, a, date, half));
  const floatAvail = floating.filter((a) => !assistantOff(leaves, a, date, half));
  const allFixedOff = fixed.length > 0 && fixedOff.length === fixed.length;
  const warn = allFixedOff || (fixed.length === 0 && floating.length > 0 && floatAvail.length === 0);
  return { fixed, fixedOff, floating, floatAvail, allFixedOff, warn };
}

// 提醒文字，例「王建鑫的助理 張小明 這天上午請假；可支援的非固定助理：李大華」
export function assistantWarning(surveyorName: string, s: ReturnType<typeof assistantStatus>, half: Half): string {
  const when = half === "am" ? "上午" : "下午";
  const head = s.allFixedOff
    ? `${surveyorName}的助理 ${s.fixedOff.map((a) => a.name).join("、")} 這天${when}請假`
    : `${surveyorName}沒有固定助理`;
  const tail = s.floatAvail.length ? `可支援的非固定助理：${s.floatAvail.map((a) => a.name).join("、")}` : s.floating.length ? "非固定助理也都請假" : "沒有非固定助理可支援";
  return `${head}；${tail}`;
}
