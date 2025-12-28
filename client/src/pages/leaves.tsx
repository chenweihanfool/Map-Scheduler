import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, Plus, Trash2 } from "lucide-react";
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
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function LeavesPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLeave, setDeletingLeave] = useState<SurveyorLeave | null>(null);
  const [formData, setFormData] = useState({
    surveyorId: "",
    surveyorName: "",
    leaveDate: "",
    reason: "",
  });

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const { data: leavesList = [], isLoading } = useQuery<SurveyorLeave[]>({
    queryKey: ["/api/leaves"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { surveyorId: string; surveyorName: string; leaveDate: string; reason?: string }) => {
      return apiRequest("POST", "/api/leaves", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      toast({ title: "請假已登記" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "登記失敗", description: error.message, variant: "destructive" });
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
    setFormData({ surveyorId: "", surveyorName: "", leaveDate: "", reason: "" });
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
    if (!formData.leaveDate) {
      toast({ title: "請選擇請假日期", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      surveyorId: formData.surveyorId,
      surveyorName: formData.surveyorName,
      leaveDate: formData.leaveDate,
      reason: formData.reason || undefined,
    });
  };

  const handleConfirmDelete = () => {
    if (deletingLeave) {
      deleteMutation.mutate(deletingLeave.id);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "yyyy/MM/dd (EEEE)", { locale: zhTW });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">請假管理</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} data-testid="button-add-leave">
                <Plus className="h-4 w-4 mr-1" />
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
              <CardTitle>即將請假清單</CardTitle>
              <CardDescription>
                請假當天自動排件會跳過該測量員。顯示今日及未來的請假記錄。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leavesList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  目前無請假記錄，請點擊「登記請假」按鈕新增。
                </div>
              ) : (
                <div className="space-y-2">
                  {leavesList.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`leave-row-${leave.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                        <Badge variant="secondary">
                          {formatDate(leave.leaveDate)}
                        </Badge>
                        <span className="font-medium">{leave.surveyorName}</span>
                        {leave.reason && (
                          <span className="text-sm text-muted-foreground truncate">
                            ({leave.reason})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(leave)}
                          data-testid={`button-delete-${leave.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登記請假</DialogTitle>
            <DialogDescription>
              選擇測量員和請假日期。請假當天自動排件會跳過該測量員。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="surveyor">測量員</Label>
              <Select
                value={formData.surveyorId}
                onValueChange={handleSurveyorChange}
              >
                <SelectTrigger data-testid="select-leave-surveyor">
                  <SelectValue placeholder="選擇測量員" />
                </SelectTrigger>
                <SelectContent>
                  {surveyorsList.map((surveyor) => (
                    <SelectItem key={surveyor.id} value={surveyor.id}>
                      {surveyor.name} ({surveyor.businessAttribute})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leaveDate">請假日期</Label>
              <Input
                id="leaveDate"
                type="date"
                value={formData.leaveDate}
                onChange={(e) => setFormData(prev => ({ ...prev, leaveDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                data-testid="input-leave-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">原因 (選填)</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="例如：年假、病假"
                data-testid="input-leave-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit-leave"
            >
              {createMutation.isPending ? "處理中..." : "確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要取消請假嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要取消「{deletingLeave?.surveyorName}」於 {deletingLeave?.leaveDate} 的請假嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "處理中..." : "確定取消"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
