import { useEffect, useState } from "react";
import { format } from "date-fns";
import { DateInput } from "@/components/date-input";
import { fmtDate } from "@/lib/date-style";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { caseLabel } from "@/lib/receive";
import { useNonWorkdayGuard } from "@/components/nonworkday-alert";
import { useWorkdays } from "@/hooks/use-workdays";
import { recommendSlot } from "@/lib/recommend-date";
import { POSTPONE_REASONS, isPostponePending, type SurveyCase, type SurveyorLeave } from "@shared/schema";

interface PostponeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: SurveyCase | null;
  onDone?: (result: { original: SurveyCase; copy?: SurveyCase }) => void;
}

const QUICK_TIMES = [
  { label: "上午9點", value: "09:00" },
  { label: "下午14點", value: "14:00" },
];

// 這位測量員在 after（延期：目前排定日期；改延期日期：原案件日期）之後最近的空檔（避開請假、非工作日，上午優先），按「套用」帶入延期日期時間
function SlotSuggestion({ caseData, after, date, time, onApply }: { caseData: SurveyCase; after?: string | null; date: string; time: string; onApply: (d: string, t: string) => void }) {
  const { data: cases = [] } = useQuery<SurveyCase[]>({ queryKey: ["/api/cases"] });
  const { data: leaves = [] } = useQuery<SurveyorLeave[]>({ queryKey: ["/api/leaves"] });
  const { info } = useWorkdays();
  const from = after || caseData.surveyDate;
  const today = format(new Date(), "yyyy-MM-dd");
  const rec = recommendSlot({
    surveyor: caseData.surveyor, cases, leaves, isWorkday: (d) => info(d).workday,
    excludeId: caseData.id, after: from > today ? from : undefined,
  });
  if (!rec) return null;
  const applied = date === rec.date && time === rec.time;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs" data-testid="postpone-recommendation">
      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground">{caseData.surveyor} 最近空檔：</span>
      <b className="tabular-nums">{fmtDate(rec.date, { weekday: true })} {rec.afternoon ? "下午" : "上午"} {rec.time}</b>
      {!applied && (
        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs ml-auto" onClick={() => onApply(rec.date, rec.time)} data-testid="button-apply-postpone-recommendation">
          套用
        </Button>
      )}
    </div>
  );
}

// 延期（比照測量案件排程）：選延期理由，延期日期可先不填；有日期時另建一筆新案件
export function PostponeDialog({ open, onOpenChange, caseData, onDone }: PostponeDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const pending = !!caseData && isPostponePending(caseData);
  const { guard, alert } = useNonWorkdayGuard();

  useEffect(() => {
    if (!open || !caseData) return;
    setReason(caseData.postponeReason ?? "");
    setDate("");
    const t = caseData.scheduledTime?.match(/(\d{1,2}):(\d{2})/);
    setTime(t ? `${t[1].padStart(2, "0")}:${t[2]}` : "");
  }, [open, caseData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cases/${caseData!.id}/postpone`, { reason, date, time });
      return res.json() as Promise<{ original: SurveyCase; copy?: SurveyCase }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: result.copy ? `已延期至 ${fmtDate(result.copy.surveyDate)} ${result.copy.scheduledTime}` : "已標為延期",
        description: result.copy ? "原案件保留在原日期作紀錄，並已建立新案件" : "尚未排定延期日期，之後打開這件案件按「排定延期日期」即可",
      });
      onOpenChange(false);
      onDone?.(result);
    },
    onError: (error: Error) => toast({ title: "延期失敗", description: error.message, variant: "destructive" }),
  });

  if (!caseData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            {pending ? "排定延期日期" : "延期"}
          </DialogTitle>
          <DialogDescription>
            {caseLabel(caseData)}・{caseData.landParcel}・原排定 {fmtDate(caseData.surveyDate)} {caseData.scheduledTime}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="postpone-reason">延期理由</Label>
            <Input
              id="postpone-reason"
              list="postpone-reasons"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="選擇或輸入，例 當日下雨"
              autoComplete="off"
              data-testid="input-postpone-reason"
            />
            <datalist id="postpone-reasons">
              {POSTPONE_REASONS.map((r) => <option key={r} value={r} />)}
            </datalist>
            <div className="flex flex-wrap gap-1.5">
              {POSTPONE_REASONS.map((r) => (
                <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setReason(r)}>
                  {r}
                </Button>
              ))}
            </div>
          </div>

          <SlotSuggestion caseData={caseData} after={caseData.surveyDate} date={date} time={time} onApply={(d, t) => { setDate(d); setTime(t); }} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="postpone-date">延期日期（可先不填）</Label>
              <DateInput id="postpone-date" value={date} onChange={setDate} data-testid="input-postpone-date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postpone-time">延期時間</Label>
              <Input id="postpone-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-postpone-time" />
              <div className="flex gap-1.5">
                {QUICK_TIMES.map((q) => (
                  <Button key={q.value} type="button" size="sm" variant={time === q.value ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTime(q.value)}>
                    {q.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {date
              ? "原案件會標為「延期」留在原日期作紀錄，並複製一筆到延期日期，兩筆互相連結。"
              : "沒填日期時只標為延期，畫面上方會提醒「尚未排定延期日期」，之後再補上即可。"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => guard(date, () => mutation.mutate())} disabled={mutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="button-confirm-postpone">
            {mutation.isPending ? "處理中..." : date ? "確認延期" : pending ? "儲存" : "標為延期（日期之後再排）"}
          </Button>
        </DialogFooter>
        {alert}
      </DialogContent>
    </Dialog>
  );
}

// 取消延期：原案件或延期後的新案件都可以；會刪除新案件，原案件恢復成一般案件
export function useCancelPostpone(onDone?: () => void) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/cases/${id}/postpone/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "已取消延期", description: "延期後的新案件已刪除，原案件恢復為一般案件" });
      onDone?.();
    },
    onError: (error: Error) => toast({ title: "取消延期失敗", description: error.message, variant: "destructive" }),
  });
}

interface ChangeDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: SurveyCase | null; // 延期後的新案件
}

// 更改延期日期：改新案件的日期時間，原案件記錄的「延期至」會跟著更新
export function ChangePostponeDateDialog({ open, onOpenChange, caseData }: ChangeDateDialogProps) {
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const { guard, alert } = useNonWorkdayGuard();
  useEffect(() => {
    if (!open || !caseData) return;
    setDate(caseData.surveyDate);
    const t = caseData.scheduledTime?.match(/(\d{1,2}):(\d{2})/);
    setTime(t ? `${t[1].padStart(2, "0")}:${t[2]}` : "");
  }, [open, caseData]);
  const mutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/cases/${caseData!.id}`, { surveyDate: date, scheduledTime: time || caseData!.scheduledTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: `延期日期已改為 ${fmtDate(date)} ${time}` });
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "更改失敗", description: error.message, variant: "destructive" }),
  });
  if (!caseData) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-500" />更改延期日期</DialogTitle>
          <DialogDescription>{caseLabel(caseData)}・{caseData.landParcel}・由 {fmtDate(caseData.postponedFromDate)} {caseData.postponedFromTime} 延期</DialogDescription>
        </DialogHeader>
        <SlotSuggestion caseData={caseData} after={caseData.postponedFromDate} date={date} time={time} onApply={(d, t) => { setDate(d); setTime(t); }} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="pp-new-date">延期日期</Label>
            <DateInput id="pp-new-date" value={date} onChange={setDate} data-testid="input-change-pp-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-new-time">時間</Label>
            <Input id="pp-new-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-change-pp-time" />
            <div className="flex gap-1.5">
              {QUICK_TIMES.map((q) => (
                <Button key={q.value} type="button" size="sm" variant={time === q.value ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTime(q.value)}>{q.label}</Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => (date === caseData.surveyDate ? mutation.mutate() : guard(date, () => mutation.mutate()))} disabled={!date || mutation.isPending} data-testid="button-confirm-change-pp-date">{mutation.isPending ? "處理中..." : "確認更改"}</Button>
        </DialogFooter>
        {alert}
      </DialogContent>
    </Dialog>
  );
}
