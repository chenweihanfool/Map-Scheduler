import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fmtDate } from "@/lib/date-style";
import { hourOf } from "@/lib/recommend-date";
import { useNonWorkdayGuard } from "@/components/nonworkday-alert";
import { patchCase, StaleError, useUndoToast } from "@/lib/undo";
import { isPostponed, type SurveyCase } from "@shared/schema";

export type MoveTarget = { date: string; time?: string; surveyor?: string };
const half = (t: string) => ((hourOf(t) ?? 9) < 12 ? "am" : "pm");

// 改期（拖曳、請假衝突一鍵改期共用）：檢查非工作日、同時段已有案件，改完跳「復原」
export function useReschedule() {
  const { toast } = useToast();
  const undoToast = useUndoToast();
  const { guard, alert: nonWorkdayAlert } = useNonWorkdayGuard();
  const { data: cases = [] } = useQuery<SurveyCase[]>({ queryKey: ["/api/cases"] });
  const [clash, setClash] = useState<{ c: SurveyCase; to: Required<MoveTarget>; other: SurveyCase; run: () => void } | null>(null);

  const doMove = async (c: SurveyCase, to: Required<MoveTarget>, quiet?: boolean) => {
    const before = { surveyDate: c.surveyDate, scheduledTime: c.scheduledTime, surveyor: c.surveyor };
    try {
      const updated = await patchCase(c.id, { surveyDate: to.date, scheduledTime: to.time, surveyor: to.surveyor }, c.updatedAt);
      await queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      if (!quiet) {
        undoToast(
          `已改到 ${fmtDate(to.date)} ${to.time}${to.surveyor !== c.surveyor ? `・${to.surveyor}` : ""}`,
          `${c.caseNumber || ""} ${c.landParcel}`.trim(),
          async () => { await patchCase(c.id, before, updated.updatedAt); await queryClient.invalidateQueries({ queryKey: ["/api/cases"] }); },
        );
      }
      return updated;
    } catch (e) {
      if (e instanceof StaleError) {
        await queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
        toast({ title: "沒有改期：這件剛被其他人修改過", description: "畫面已更新成最新內容，請再確認一次", variant: "destructive" });
      } else {
        toast({ title: "改期失敗", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      }
      return null;
    }
  };

  // to.time 沒給就沿用原時間；to.surveyor 沒給就沿用原測量員
  const move = (c: SurveyCase, target: MoveTarget, opts: { quiet?: boolean; onDone?: (u: SurveyCase | null) => void } = {}) => {
    const to = { date: target.date, time: target.time ?? c.scheduledTime, surveyor: target.surveyor ?? c.surveyor };
    if (to.date === c.surveyDate && to.time === c.scheduledTime && to.surveyor === c.surveyor) return;
    const run = () => { doMove(c, to, opts.quiet).then((u) => opts.onDone?.(u)); };
    const other = cases.find((x) => x.id !== c.id && !isPostponed(x) && x.surveyor === to.surveyor && x.surveyDate === to.date && half(x.scheduledTime) === half(to.time));
    const check = () => (other ? setClash({ c, to, other, run }) : run());
    guard(to.date, check);
  };

  const alert = (
    <>
      {nonWorkdayAlert}
      <AlertDialog open={!!clash} onOpenChange={(o) => { if (!o) setClash(null); }}>
        <AlertDialogContent data-testid="reschedule-clash">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />這個時段已有案件
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clash && <>{clash.to.surveyor} {fmtDate(clash.to.date)} {half(clash.to.time) === "am" ? "上午" : "下午"}已有「{clash.other.scheduledTime} {clash.other.caseType} {clash.other.landParcel}」，仍要改到這個時段嗎？</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const r = clash?.run; setClash(null); r?.(); }} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="button-clash-confirm">
              仍要改期
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
  return { move, alert };
}

// 拖曳用的資料格式
export const DRAG_TYPE = "application/x-ms-case";
