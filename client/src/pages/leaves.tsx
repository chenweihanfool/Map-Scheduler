import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarOff, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Surveyor, type SurveyorLeave } from "@shared/schema";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";

interface ConflictCase {
  id: string;
  caseNumber: string;
  surveyDate: string;
  scheduledTime: string;
  landParcel: string;
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return "";
  const [startDate, startTime] = start.split(" ");
  const [endDate, endTime] = end.split(" ");
  try {
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    if (startDate === endDate) {
      return `${format(s, "yyyy/M/d", { locale: zhTW })} ${startTime} ~ ${endTime}`;
    }
    return `${format(s, "yyyy/M/d", { locale: zhTW })} ${startTime} ~ ${format(e, "yyyy/M/d", { locale: zhTW })} ${endTime}`;
  } catch {
    return `${start} ~ ${end}`;
  }
}

export default function LeavesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLeave, setDeletingLeave] = useState<SurveyorLeave | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictCase[]>([]);
  const [pendingSubmitData, setPendingSubmitData] = useState<{
    surveyorId: string;
    surveyorName: string;
    startDatetime: string;
    endDatetime: string;
    reason?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    surveyorId: "",
    surveyorName: "",
    startDate: "",
    startTime: "08:00",
    endDate: "",
    endTime: "17:00",
    reason: "",
  });

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const { data: leavesList = [], isLoading } = useQuery<SurveyorLeave[]>({
    queryKey: ["/api/leaves"],
  });

  const createMutation = useMutation({
    mutationFn: async (params: { data: typeof pendingSubmitData; force?: boolean }) => {
      const { data, force } = params;
      const url = force ? "/api/leaves?force=true" : "/api/leaves";
      const response = await fetch(url, {
        method: "POST",
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
        throw new Error(json.error || "登記失敗");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: "請假已登記" });
      setDialogOpen(false);
      setConflictDialogOpen(false);
      setPendingConflicts([]);
      setPendingSubmitData(null);
      resetForm();
    },
    onError: (error: Error & { conflicts?: ConflictCase[] }) => {
      if (error.conflicts && error.conflicts.length > 0) {
        setPendingConflicts(error.conflicts);
        setConflictDialogOpen(true);
      } else {
        toast({ title: "登記失敗", description: error.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/leaves/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: "請假已取消" });
      setDeleteDialogOpen(false);
      setDeletingLeave(null);
    },
    onError: (error: Error) => {
      toast({ title: "取消失敗", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      surveyorId: "",
      surveyorName: "",
      startDate: "",
      startTime: "08:00",
      endDate: "",
      endTime: "17:00",
      reason: "",
    });
  };

  const handleAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleDelete = (leave: SurveyorLeave) => {
    setDeletingLeave(leave);
    setDeleteDialogOpen(true);
  };

  const handleSurveyorChange = (surveyorId: string) => {
    const surveyor = surveyorsList.find(s => s.id === surveyorId);
    setFormData(prev => ({
      ...prev,
      surveyorId,
      surveyorName: surveyor?.name || "",
    }));
  };

  const handleSubmit = () => {
    if (!formData.surveyorId) {
      toast({ title: "請選擇測量員", variant: "destructive" });
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast({ title: "請選擇請假日期", variant: "destructive" });
      return;
    }
    const startDatetime = `${formData.startDate} ${formData.startTime}`;
    const endDatetime = `${formData.endDate} ${formData.endTime}`;
    if (startDatetime >= endDatetime) {
      toast({ title: "開始時間必須早於結束時間", variant: "destructive" });
      return;
    }

    const submitData = {
      surveyorId: formData.surveyorId,
      surveyorName: formData.surveyorName,
      startDatetime,
      endDatetime,
      reason: formData.reason || undefined,
    };
    setPendingSubmitData(submitData);
    createMutation.mutate({ data: submitData, force: false });
  };

  const handleForceSubmit = () => {
    if (pendingSubmitData) {
      createMutation.mutate({ data: pendingSubmitData, force: true });
    }
  };

  const handleConfirmDelete = () => {
    if (deletingLeave) {
      deleteMutation.mutate(deletingLeave.id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <CalendarOff className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">請假管理</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} data-testid="button-add-leave">
                <Plus className="h-4 w-4 mr-2" />
                登記請假
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>請假紀錄</CardTitle>
              <CardDescription>
                管理測量員的請假時段，可精確到小時。請假期間系統將自動排除該測量員。
                若請假期間已有排定案件，系統會提示確認。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : leavesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  目前無請假紀錄（僅顯示尚未結束的請假）
                </div>
              ) : (
                <div className="space-y-3">
                  {leavesList.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-start justify-between p-4 rounded-lg border gap-4"
                      data-testid={`leave-item-${leave.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{leave.surveyorName}</span>
                        </div>
                        <Badge variant="outline" className="text-xs font-normal">
                          {formatDateRange(leave.startDatetime, leave.endDatetime)}
                        </Badge>
                        {leave.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{leave.reason}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(leave)}
                        data-testid={`button-delete-leave-${leave.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 登記請假 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>登記請假</DialogTitle>
            <DialogDescription>
              填寫請假測量員與時間段（可精確到小時）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>測量員 *</Label>
              <Select value={formData.surveyorId} onValueChange={handleSurveyorChange}>
                <SelectTrigger data-testid="select-leave-surveyor">
                  <SelectValue placeholder="選擇測量員" />
                </SelectTrigger>
                <SelectContent>
                  {surveyorsList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}（{s.businessAttribute}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>請假開始 *</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="flex-1"
                  data-testid="input-leave-start-date"
                />
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-28"
                  data-testid="input-leave-start-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>請假結束 *</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="flex-1"
                  data-testid="input-leave-end-date"
                />
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-28"
                  data-testid="input-leave-end-time"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                例：2026/3/7 08:00 ~ 2026/3/8 17:00 表示休假兩天
              </p>
            </div>

            <div className="space-y-2">
              <Label>原因（選填）</Label>
              <Input
                value={formData.reason}
                onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="例：年假、病假、外出訓練"
                data-testid="input-leave-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-leave">
              {createMutation.isPending ? "處理中..." : "確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 衝突確認 Dialog */}
      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              請假期間已有排定案件
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>以下 {pendingConflicts.length} 筆案件在請假時段內，確定仍要登記請假嗎？</p>
                <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                  {pendingConflicts.map(c => (
                    <div key={c.id} className="text-xs p-2 bg-muted rounded border">
                      <span className="font-medium">{c.caseNumber}</span>
                      {" · "}{c.surveyDate} {c.scheduledTime}
                      {" · "}{c.landParcel}
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-confirm-force-leave"
            >
              {createMutation.isPending ? "處理中..." : "仍要登記請假"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除確認 Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要取消請假嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要取消「{deletingLeave?.surveyorName}」的請假紀錄嗎？
              {deletingLeave && (
                <span className="block mt-1 text-xs">
                  {formatDateRange(deletingLeave.startDatetime, deletingLeave.endDatetime)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "處理中..." : "確定取消請假"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
