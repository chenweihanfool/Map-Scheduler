import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWorkdays } from "@/hooks/use-workdays";
import { TW_HOLIDAYS } from "@shared/holidays";

interface WorkdayEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: Date;
}

// 調整工作日：點日期切換上班／休假（比照測量案件排程）；平日改休假可填說明（例 颱風假），假日改上班即補班
export function WorkdayEditor({ open, onOpenChange, month: initial }: WorkdayEditorProps) {
  const { toast } = useToast();
  const { overrides, info } = useWorkdays();
  const [month, setMonth] = useState(initial);
  const [label, setLabel] = useState("");
  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);
  const lead = (getDay(startOfMonth(month)) + 6) % 7; // 週一開頭

  const mutation = useMutation({
    mutationFn: async ({ date, body }: { date: string; body: { kind: string; label: string | null } | null }) =>
      body ? apiRequest("PUT", `/api/workdays/${date}`, body) : apiRequest("DELETE", `/api/workdays/${date}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workdays"] }),
    onError: (error: Error) => toast({ title: "儲存失敗", description: error.message, variant: "destructive" }),
  });

  const toggle = (date: string) => {
    const o = overrides.find((x) => x.date === date);
    if (o) { mutation.mutate({ date, body: null }); return; } // 已調整過 → 恢復預設
    const now = info(date);
    mutation.mutate({ date, body: now.workday ? { kind: "off", label: label.trim() || null } : { kind: "work", label: label.trim() || null } });
  };

  const offCount = days.filter((d) => !info(format(d, "yyyy-MM-dd")).workday && getDay(d) % 6 !== 0).length;
  const workCount = days.filter((d) => info(format(d, "yyyy-MM-dd")).workday).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>調整工作日</DialogTitle>
          <DialogDescription>點日期切換上班或休假。國定假日已內建；平日改休假可先填說明（例 颱風假），假日改上班即為補班。再點一次已調整的日期會恢復預設。</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-semibold">{format(month, "yyyy年 M月")}</div>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs" data-testid="workday-grid">
          {["一", "二", "三", "四", "五", "六", "日"].map((d) => <div key={d} className="text-muted-foreground py-1">{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} />)}
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd"), w = info(key), adjusted = overrides.some((o) => o.date === key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                disabled={mutation.isPending}
                className={cn(
                  "rounded-md border py-1.5 px-0.5 min-h-[52px] flex flex-col items-center gap-0.5 transition-colors",
                  w.workday ? "bg-background hover:bg-muted" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
                  w.kind === "makeup" && "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300",
                  adjusted && "ring-2 ring-amber-400",
                )}
                title={adjusted ? "已手動調整，再點一次恢復預設" : TW_HOLIDAYS[key] || ""}
                data-testid={`workday-${key}`}
              >
                <b className="text-sm">{format(d, "d")}</b>
                <span className="text-[10px] leading-tight line-clamp-2">{w.label || (w.workday ? "" : "週末")}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="說明（選填，例 颱風假、補班）" className="h-8" data-testid="input-workday-label" />
        </div>
        <p className="text-xs text-muted-foreground">本月上班 {workCount} 天、平日休假 {offCount} 天。黃框為手動調整過的日期。月曆開著「不顯示六日」時，週六補班不會顯示，可切換顯示全週。</p>
      </DialogContent>
    </Dialog>
  );
}
