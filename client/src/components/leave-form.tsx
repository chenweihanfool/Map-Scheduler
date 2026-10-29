import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { caseLabel } from "@/lib/receive";
import { LEAVE_TYPES, type LeaveType, type Surveyor, type SurveyorLeave } from "@shared/schema";

// 三種類型的顏色比照「測量案件排程」：休假橘、出差紫、上課藍
export const LEAVE_STYLES: Record<LeaveType, { text: string; chip: string; active: string }> = {
  "休假": {
    text: "text-orange-600 dark:text-orange-400",
    chip: "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-300",
    active: "bg-orange-500 text-white border-orange-500 hover:bg-orange-500/90",
  },
  "出差": {
    text: "text-purple-600 dark:text-purple-400",
    chip: "border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300",
    active: "bg-purple-500 text-white border-purple-500 hover:bg-purple-500/90",
  },
  "上課": {
    text: "text-sky-600 dark:text-sky-400",
    chip: "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300",
    active: "bg-sky-500 text-white border-sky-500 hover:bg-sky-500/90",
  },
};

// 月曆橫條的材質類別（見 index.css 的 .leave-bar）
export const LEAVE_BAR_CLASS: Record<LeaveType, string> = { "休假": "lv-vacation", "出差": "lv-trip", "上課": "lv-class" };
export const leaveBarClass = (type?: string | null) => `leave-bar ${LEAVE_BAR_CLASS[(type as LeaveType) in LEAVE_BAR_CLASS ? (type as LeaveType) : "休假"]}`;

export const leaveStyle = (type?: string | null) => LEAVE_STYLES[(type as LeaveType) in LEAVE_STYLES ? (type as LeaveType) : "休假"];

// 時段快選：同一天的上午、下午、全天
const PERIODS = [
  { label: "全天", start: "08:00", end: "17:00" },
  { label: "上午", start: "08:00", end: "12:00" },
  { label: "下午", start: "13:00", end: "17:00" },
];

interface ConflictCase {
  id: string;
  caseNumber: string;
  surveyDate: string;
  scheduledTime: string;
  landParcel: string;
}

type LeaveSubmitData = {
  surveyorId: string;
  surveyorName: string;
  leaveType: LeaveType;
  startDatetime: string;
  endDatetime: string;
  reason?: string;
};

// 月曆等元件用 /api/leaves、請假管理頁用 /api/leaves?includePast=true，異動後全部更新
export function invalidateLeaves() {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith("/api/leaves"),
  });
}

interface LeaveFormProps {
  open: boolean;
  editingLeave?: SurveyorLeave | null;
  defaultDate?: string; // YYYY-MM-DD
  onDone: () => void;
  onCancel: () => void;
}

// 登記／編輯請假（休假、出差、上課）：請假管理頁與「新增案件」視窗共用
export function LeaveForm({ open, editingLeave, defaultDate, onDone, onCancel }: LeaveFormProps) {
  const { toast } = useToast();
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictCase[]>([]);
  const [pending, setPending] = useState<LeaveSubmitData | null>(null);

  const blank = () => ({
    surveyorId: "",
    surveyorName: "",
    leaveType: "休假" as LeaveType,
    startDate: defaultDate || "",
    startTime: "08:00",
    endDate: defaultDate || "",
    endTime: "17:00",
    reason: "",
  });
  const [formData, setFormData] = useState(blank);

  useEffect(() => {
    if (!open) return;
    if (editingLeave) {
      const [startDate, startTime] = editingLeave.startDatetime.split(" ");
      const [endDate, endTime] = editingLeave.endDatetime.split(" ");
      setFormData({
        surveyorId: editingLeave.surveyorId,
        surveyorName: editingLeave.surveyorName,
        leaveType: (LEAVE_TYPES as readonly string[]).includes(editingLeave.leaveType) ? (editingLeave.leaveType as LeaveType) : "休假",
        startDate: startDate || "",
        startTime: startTime || "08:00",
        endDate: endDate || "",
        endTime: endTime || "17:00",
        reason: editingLeave.reason || "",
      });
    } else {
      setFormData(blank());
    }
  }, [open, editingLeave, defaultDate]);

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, force }: { data: LeaveSubmitData; force?: boolean }) => {
      const base = editingLeave ? `/api/leaves/${editingLeave.id}` : "/api/leaves";
      const response = await fetch(force ? `${base}?force=true` : base, {
        method: editingLeave ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const json = await response.json();
        if (response.status === 409 && json.error === "CONFLICT") {
          const err = new Error(json.message) as Error & { conflicts: ConflictCase[] };
          err.conflicts = json.conflicts;
          throw err;
        }
        throw new Error(json.error || (editingLeave ? "更新失敗" : "登記失敗"));
      }
      return response.json();
    },
    onSuccess: (_d, { data }) => {
      invalidateLeaves();
      toast({ title: editingLeave ? `${data.leaveType}已更新` : `${data.leaveType}已登記` });
      setConflictOpen(false);
      setConflicts([]);
      setPending(null);
      onDone();
    },
    onError: (error: Error & { conflicts?: ConflictCase[] }) => {
      if (error.conflicts && error.conflicts.length > 0) {
        setConflicts(error.conflicts);
        setConflictOpen(true);
      } else {
        toast({ title: editingLeave ? "更新失敗" : "登記失敗", description: error.message, variant: "destructive" });
      }
    },
  });

  const set = (patch: Partial<ReturnType<typeof blank>>) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = () => {
    if (!formData.surveyorId) {
      toast({ title: "請選擇測量員", variant: "destructive" });
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast({ title: "請選擇日期", variant: "destructive" });
      return;
    }
    const startDatetime = `${formData.startDate} ${formData.startTime}`;
    const endDatetime = `${formData.endDate} ${formData.endTime}`;
    if (startDatetime >= endDatetime) {
      toast({ title: "開始時間必須早於結束時間", variant: "destructive" });
      return;
    }
    const data: LeaveSubmitData = {
      surveyorId: formData.surveyorId,
      surveyorName: formData.surveyorName,
      leaveType: formData.leaveType,
      startDatetime,
      endDatetime,
      // 編輯時要能把原因清空，所以送空字串而不是省略欄位
      reason: editingLeave ? formData.reason : formData.reason || undefined,
    };
    setPending(data);
    saveMutation.mutate({ data });
  };

  const periodActive = (p: (typeof PERIODS)[number]) =>
    formData.startDate && formData.startDate === formData.endDate && formData.startTime === p.start && formData.endTime === p.end;

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>類型</Label>
          <div className="grid grid-cols-3 gap-2" data-testid="seg-leave-type">
            {LEAVE_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                variant="outline"
                className={cn(formData.leaveType === t && LEAVE_STYLES[t].active)}
                aria-pressed={formData.leaveType === t}
                onClick={() => set({ leaveType: t })}
                data-testid={`button-leave-type-${t}`}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>測量員 *</Label>
          <Select
            value={formData.surveyorId}
            onValueChange={(id) => set({ surveyorId: id, surveyorName: surveyorsList.find((s) => s.id === id)?.name || "" })}
          >
            <SelectTrigger data-testid="select-leave-surveyor">
              <SelectValue placeholder="選擇測量員" />
            </SelectTrigger>
            <SelectContent>
              {surveyorsList.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}（{s.businessAttribute}）</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>開始 *</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => {
                const v = e.target.value;
                // 結束日期還沒填或早於開始日期時，跟著開始日期走
                set({ startDate: v, ...(!formData.endDate || formData.endDate < v ? { endDate: v } : {}) });
              }}
              className="flex-1"
              data-testid="input-leave-start-date"
            />
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
              className="w-28"
              data-testid="input-leave-start-time"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>結束 *</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
              className="flex-1"
              data-testid="input-leave-end-date"
            />
            <Input
              type="time"
              value={formData.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
              className="w-28"
              data-testid="input-leave-end-time"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">當天快選：</span>
            {PERIODS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={periodActive(p) ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const d = formData.startDate || defaultDate || "";
                  if (!d) {
                    toast({ title: "請先選擇開始日期", variant: "destructive" });
                    return;
                  }
                  set({ startDate: d, endDate: d, startTime: p.start, endTime: p.end });
                }}
                data-testid={`button-leave-period-${p.label}`}
              >
                {p.label} {p.start}~{p.end}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            跨天請假：例 2026/3/7 08:00 ~ 2026/3/8 17:00 表示兩天
          </p>
        </div>

        <div className="space-y-2">
          <Label>說明（選填）</Label>
          <Input
            value={formData.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder={formData.leaveType === "上課" ? "例：縣府上課、選舉講習" : formData.leaveType === "出差" ? "例：地政局開會" : "例：特休、病假"}
            data-testid="input-leave-reason"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="button" onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-submit-leave">
          {saveMutation.isPending ? "處理中..." : editingLeave ? `儲存${formData.leaveType}` : `登記${formData.leaveType}`}
        </Button>
      </div>

      {/* 衝突確認 */}
      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              這段時間已有排定案件
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>以下 {conflicts.length} 筆案件在{pending?.leaveType ?? "請假"}時段內，確定仍要{editingLeave ? "儲存修改" : "登記"}嗎？</p>
                <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                  {conflicts.map((c) => (
                    <div key={c.id} className="text-xs p-2 bg-muted rounded border">
                      <span className="font-medium">{caseLabel(c)}</span>
                      {" · "}{c.surveyDate} {c.scheduledTime}
                      {" · "}{c.landParcel}
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回修改</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pending && saveMutation.mutate({ data: pending, force: true })}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-confirm-force-leave"
            >
              {saveMutation.isPending ? "處理中..." : editingLeave ? "仍要儲存修改" : "仍要登記"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
