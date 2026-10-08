import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarOff, Plus, Pencil, Trash2, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Surveyor, type SurveyorLeave } from "@shared/schema";
import { useMemo, useState } from "react";
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

type LeaveSubmitData = {
  surveyorId: string;
  surveyorName: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string;
};

type StatusFilter = "active" | "past" | "all";
type SortOrder = "start-desc" | "start-asc" | "created-desc";

// 頁面一律抓含已結束的完整清單，狀態篩選在前端做；
// 月曆等其他元件仍用 /api/leaves（只含未結束），所以異動後兩個都要更新
const LEAVES_ALL_KEY = "/api/leaves?includePast=true";

function invalidateLeaves() {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith("/api/leaves"),
  });
}

function nowDatetime(): string {
  return format(new Date(), "yyyy-MM-dd HH:mm");
}

function getLeaveStatus(leave: SurveyorLeave, now: string): { label: string; className: string } {
  if (leave.endDatetime < now) {
    return { label: "已結束", className: "text-muted-foreground" };
  }
  if (leave.startDatetime <= now) {
    return { label: "請假中", className: "border-amber-500 text-amber-600 dark:text-amber-400" };
  }
  return { label: "即將開始", className: "border-primary text-primary" };
}

export default function LeavesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLeave, setDeletingLeave] = useState<SurveyorLeave | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictCase[]>([]);
  const [pendingSubmitData, setPendingSubmitData] = useState<LeaveSubmitData | null>(null);
  const [editingLeave, setEditingLeave] = useState<SurveyorLeave | null>(null);

  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [keyword, setKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("start-desc");

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
    queryKey: [LEAVES_ALL_KEY],
  });

  const filteredLeaves = useMemo(() => {
    const now = nowDatetime();
    const q = keyword.trim().toLowerCase();
    const result = leavesList.filter((leave) => {
      if (surveyorFilter !== "all" && leave.surveyorId !== surveyorFilter) return false;
      if (statusFilter === "active" && leave.endDatetime < now) return false;
      if (statusFilter === "past" && leave.endDatetime >= now) return false;
      if (q) {
        const haystack = `${leave.surveyorName} ${leave.reason || ""} ${leave.startDatetime} ${leave.endDatetime}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return result.sort((a, b) => {
      if (sortOrder === "start-asc") return a.startDatetime.localeCompare(b.startDatetime);
      if (sortOrder === "created-desc") {
        return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
      }
      return b.startDatetime.localeCompare(a.startDatetime);
    });
  }, [leavesList, surveyorFilter, statusFilter, keyword, sortOrder]);

  const hasActiveFilters = surveyorFilter !== "all" || statusFilter !== "active" || keyword.trim() !== "";

  const clearFilters = () => {
    setSurveyorFilter("all");
    setStatusFilter("active");
    setKeyword("");
  };

  const saveMutation = useMutation({
    mutationFn: async (params: { data: LeaveSubmitData | null; force?: boolean; editingId?: string }) => {
      const { data, force, editingId } = params;
      const base = editingId ? `/api/leaves/${editingId}` : "/api/leaves";
      const url = force ? `${base}?force=true` : base;
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
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
        throw new Error(json.error || (editingId ? "更新失敗" : "登記失敗"));
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      invalidateLeaves();
      toast({ title: variables.editingId ? "請假已更新" : "請假已登記" });
      setDialogOpen(false);
      setConflictDialogOpen(false);
      setPendingConflicts([]);
      setPendingSubmitData(null);
      setEditingLeave(null);
      resetForm();
    },
    onError: (error: Error & { conflicts?: ConflictCase[] }) => {
      if (error.conflicts && error.conflicts.length > 0) {
        setPendingConflicts(error.conflicts);
        setDialogOpen(false);
        setConflictDialogOpen(true);
      } else {
        toast({ title: editingLeave ? "更新失敗" : "登記失敗", description: error.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/leaves/${id}`);
    },
    onSuccess: () => {
      invalidateLeaves();
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
    setEditingLeave(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (leave: SurveyorLeave) => {
    const [startDate, startTime] = leave.startDatetime.split(" ");
    const [endDate, endTime] = leave.endDatetime.split(" ");
    setEditingLeave(leave);
    setFormData({
      surveyorId: leave.surveyorId,
      surveyorName: leave.surveyorName,
      startDate: startDate || "",
      startTime: startTime || "08:00",
      endDate: endDate || "",
      endTime: endTime || "17:00",
      reason: leave.reason || "",
    });
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

    const submitData: LeaveSubmitData = {
      surveyorId: formData.surveyorId,
      surveyorName: formData.surveyorName,
      startDatetime,
      endDatetime,
      // 編輯時要能把原因清空，所以送空字串而不是省略欄位
      reason: editingLeave ? formData.reason : formData.reason || undefined,
    };
    setPendingSubmitData(submitData);
    saveMutation.mutate({ data: submitData, force: false, editingId: editingLeave?.id });
  };

  const handleForceSubmit = () => {
    if (pendingSubmitData) {
      saveMutation.mutate({ data: pendingSubmitData, force: true, editingId: editingLeave?.id });
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
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>請假紀錄</CardTitle>
              <CardDescription>
                管理測量員的請假時段，可精確到小時。請假期間系統將自動排除該測量員。
                若請假期間已有排定案件，系統會提示確認。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="搜尋姓名、原因、日期"
                    className="pl-8"
                    data-testid="input-leave-search"
                  />
                </div>
                <Select value={surveyorFilter} onValueChange={setSurveyorFilter}>
                  <SelectTrigger data-testid="select-leave-filter-surveyor">
                    <SelectValue placeholder="全部測量員" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部測量員</SelectItem>
                    {surveyorsList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger data-testid="select-leave-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">未結束（請假中／即將開始）</SelectItem>
                    <SelectItem value="past">已結束</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                  <SelectTrigger data-testid="select-leave-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start-desc">請假日期：新到舊</SelectItem>
                    <SelectItem value="start-asc">請假日期：舊到新</SelectItem>
                    <SelectItem value="created-desc">登記時間：新到舊</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 mb-4 text-sm text-muted-foreground">
                <span data-testid="text-leave-count">
                  共 {filteredLeaves.length} 筆{filteredLeaves.length !== leavesList.length && `（全部 ${leavesList.length} 筆）`}
                </span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-leave-filters">
                    清除篩選
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">載入中...</div>
              ) : filteredLeaves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {leavesList.length === 0 ? "目前無請假紀錄" : "沒有符合篩選條件的請假紀錄"}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeaves.map((leave) => {
                    const status = getLeaveStatus(leave, nowDatetime());
                    return (
                    <div
                      key={leave.id}
                      className="flex items-start justify-between p-4 rounded-lg border gap-4"
                      data-testid={`leave-item-${leave.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{leave.surveyorName}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.className}`}>
                            {status.label}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs font-normal">
                          {formatDateRange(leave.startDatetime, leave.endDatetime)}
                        </Badge>
                        {leave.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{leave.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(leave)}
                          data-testid={`button-edit-leave-${leave.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(leave)}
                          data-testid={`button-delete-leave-${leave.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
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
            <DialogTitle>{editingLeave ? "編輯請假" : "登記請假"}</DialogTitle>
            <DialogDescription>
              {editingLeave ? "修改請假測量員、時間段或原因" : "填寫請假測量員與時間段（可精確到小時）"}
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
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-submit-leave">
              {saveMutation.isPending ? "處理中..." : "確定"}
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
                <p>以下 {pendingConflicts.length} 筆案件在請假時段內，確定仍要{editingLeave ? "儲存修改" : "登記請假"}嗎？</p>
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
            <AlertDialogCancel onClick={() => setDialogOpen(true)}>返回修改</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-confirm-force-leave"
            >
              {saveMutation.isPending ? "處理中..." : editingLeave ? "仍要儲存修改" : "仍要登記請假"}
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
