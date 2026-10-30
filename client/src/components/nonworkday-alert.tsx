import { useState } from "react";
import { CalendarX2 } from "lucide-react";
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
import { useWorkdays } from "@/hooks/use-workdays";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

// 排到非工作日（週末、國定假日、調整的休假，補班除外）時先跳警示，確認後才送出
export function useNonWorkdayGuard() {
  const { info } = useWorkdays();
  const [pending, setPending] = useState<{ date: string; run: () => void } | null>(null);

  const guard = (date: string | undefined | null, run: () => void) => {
    if (!date || info(date).workday) { run(); return; }
    setPending({ date, run });
  };

  const w = pending ? info(pending.date) : null;
  const dow = pending ? WEEK[new Date(`${pending.date}T00:00:00`).getDay()] : "";
  const alert = (
    <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
      <AlertDialogContent data-testid="nonworkday-alert">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <CalendarX2 className="h-5 w-5" />
            這天不是工作日
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.date}（週{dow}）是<b className="text-red-600 dark:text-red-400">{w?.label || "週末"}</b>，
            尚未調整為工作日。確定仍要排在這天嗎？
            <br />
            如果當天要上班，可以先到月曆的「調整工作日」改成補班。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-nonworkday-cancel">返回修改</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { const p = pending; setPending(null); p?.run(); }}
            data-testid="button-nonworkday-confirm"
          >
            仍要排定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { guard, alert };
}
