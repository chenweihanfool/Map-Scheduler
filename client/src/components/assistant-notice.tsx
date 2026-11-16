import { useQuery } from "@tanstack/react-query";
import { UserRoundX } from "lucide-react";
import { assistantStatus, assistantWarning, halfOfTime, useAssistants } from "@/lib/assistants";
import type { Surveyor } from "@shared/schema";

// 排件時的助理提醒：只有這位測量員的固定助理都請假（或沒有固定助理且非固定助理也都請假）時才顯示，不擋排件
export function AssistantNotice({ surveyorName, date, time }: { surveyorName?: string | null; date?: string | null; time?: string | null }) {
  const { data: surveyors = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const { assistants, leaves } = useAssistants();
  if (!surveyorName || !date || !assistants.length) return null;
  const half = halfOfTime(time);
  const s = assistantStatus(surveyors.find((x) => x.name === surveyorName), date, half, assistants, leaves);
  if (!s.warn) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200" data-testid="assistant-notice">
      <UserRoundX className="h-4 w-4 shrink-0 mt-px" />
      <span>{assistantWarning(surveyorName, s, half)}</span>
    </div>
  );
}
