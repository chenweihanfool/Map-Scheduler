import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarOff, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { LeaveForm, leaveStyle, invalidateLeaves } from "@/components/leave-form";

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

type StatusFilter = "active" | "past" | "all";
type SortOrder = "start-desc" | "start-asc" | "created-desc";

// 頁面一律抓含已結束的完整清單，狀態篩選在前端做（異動後由 invalidateLeaves 一併更新）
const LEAVES_ALL_KEY = "/api/leaves?includePast=true";

function nowDatetime(): string {
  return format(new Date(), "yyyy-MM-dd HH:mm");
}

function getLeaveStatus(leave: SurveyorLeave, now: string): { label: string; className: string } {
  if (leave.endDatetime < now) {
    return { label: "已結束", className: "text-muted-foreground" };
  }
  if (leave.startDatetime <= now) {
    return { label: "進行中", className: "border-amber-500 text-amber-600 dark:text-amber-400" };
  }
  return { label: "即將開始", className: "border-primary text-primary" };
}

export default function LeavesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLeave, setDeletingLeave] = useState<SurveyorLeave | null>(null);
  const [editingLeave, setEditingLeave] = useState<SurveyorLeave | null>(null);

  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [keyword, setKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("start-desc");

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
        const haystack = `${leave.surveyorName} ${leave.leaveType || ""} ${leave.reason || ""} ${leave.startDatetime} ${leave.endDatetime}`.toLowerCase();
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

  const handleAdd = () => {
    setEditingLeave(null);
    setDialogOpen(true);
  };

  const handleEdit = (leave: SurveyorLeave) => {
    setEditingLeave(leave);
    setDialogOpen(true);
  };

  const handleDelete = (leave: SurveyorLeave) => {
    setDeletingLeave(leave);
    setDeleteDialogOpen(true);
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
                <span className="text-sm text-muted-foreground hidden sm:inline">休假／出差／上課</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} data-testid="button-add-leave">
                <Plus className="h-4 w-4 mr-2" />
                登記
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
                管理測量員的休假、出差、上課時段，可精確到小時。這段期間系統將自動排除該測量員。
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
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${leaveStyle(leave.leaveType).chip}`}>
                            {leave.leaveType || "休假"}
                          </Badge>
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
            <DialogTitle>{editingLeave ? "編輯休假／出差／上課" : "登記休假／出差／上課"}</DialogTitle>
            <DialogDescription>
              {editingLeave ? "修改類型、測量員、時間段或說明" : "填寫測量員與時間段（可精確到小時）；也可以在「新增案件」視窗直接登記"}
            </DialogDescription>
          </DialogHeader>
          <LeaveForm
            open={dialogOpen}
            editingLeave={editingLeave}
            onDone={() => {
              setDialogOpen(false);
              setEditingLeave(null);
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 刪除確認 Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要取消請假嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要取消「{deletingLeave?.surveyorName}」的{deletingLeave?.leaveType || "請假"}紀錄嗎？
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
