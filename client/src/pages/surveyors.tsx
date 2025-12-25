import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Users, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BUSINESS_ATTRIBUTES, type Surveyor } from "@shared/schema";
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

export default function SurveyorsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSurveyor, setEditingSurveyor] = useState<Surveyor | null>(null);
  const [deletingSurveyor, setDeletingSurveyor] = useState<Surveyor | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    businessAttribute: "複丈組" as string,
    points: 0,
  });

  const { data: surveyorsList = [], isLoading } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; businessAttribute: string; points: number }) => {
      return apiRequest("POST", "/api/surveyors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors"] });
      toast({ title: "測量員已新增" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "新增失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; businessAttribute?: string; points?: number } }) => {
      return apiRequest("PATCH", `/api/surveyors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors"] });
      toast({ title: "測量員已更新" });
      setDialogOpen(false);
      setEditingSurveyor(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/surveyors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveyors"] });
      toast({ title: "測量員已刪除" });
      setDeleteDialogOpen(false);
      setDeletingSurveyor(null);
    },
    onError: (error: Error) => {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", businessAttribute: "複丈組", points: 0 });
  };

  const handleAdd = () => {
    setEditingSurveyor(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (surveyor: Surveyor) => {
    setEditingSurveyor(surveyor);
    setFormData({
      name: surveyor.name,
      businessAttribute: surveyor.businessAttribute,
      points: surveyor.points,
    });
    setDialogOpen(true);
  };

  const handleDelete = (surveyor: Surveyor) => {
    setDeletingSurveyor(surveyor);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "請輸入測量員姓名", variant: "destructive" });
      return;
    }
    if (editingSurveyor) {
      updateMutation.mutate({ id: editingSurveyor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingSurveyor) {
      deleteMutation.mutate(deletingSurveyor.id);
    }
  };

  const getAttributeVariant = (attr: string) => {
    switch (attr) {
      case "複丈組": return "default";
      case "政策組": return "secondary";
      case "重測組": return "outline";
      default: return "secondary";
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
                onClick={() => navigate("/settings")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">測量員管理</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} data-testid="button-add-surveyor">
                <Plus className="h-4 w-4 mr-1" />
                新增測量員
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
              <CardTitle>測量員清單</CardTitle>
              <CardDescription>
                管理測量員資料與業務屬性。只有「複丈組」的測量員會參與自動排件。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {surveyorsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  尚無測量員資料，請點擊「新增測量員」按鈕新增。
                </div>
              ) : (
                <div className="space-y-2">
                  {surveyorsList.map((surveyor, index) => (
                    <div
                      key={surveyor.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`surveyor-row-${surveyor.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-medium truncate">{surveyor.name}</span>
                        <Badge variant={getAttributeVariant(surveyor.businessAttribute)}>
                          {surveyor.businessAttribute}
                        </Badge>
                        <span className="text-sm text-muted-foreground ml-auto">
                          積分: {surveyor.points}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(surveyor)}
                          data-testid={`button-edit-${surveyor.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(surveyor)}
                          data-testid={`button-delete-${surveyor.id}`}
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
            <DialogTitle>{editingSurveyor ? "編輯測量員" : "新增測量員"}</DialogTitle>
            <DialogDescription>
              {editingSurveyor ? "修改測量員資料" : "輸入新測量員資料"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="請輸入測量員姓名"
                data-testid="input-surveyor-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAttribute">業務屬性</Label>
              <Select
                value={formData.businessAttribute}
                onValueChange={(value) => setFormData(prev => ({ ...prev, businessAttribute: value }))}
              >
                <SelectTrigger data-testid="select-business-attribute">
                  <SelectValue placeholder="選擇業務屬性" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_ATTRIBUTES.map((attr) => (
                    <SelectItem key={attr} value={attr}>
                      {attr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="points">目前積分</Label>
              <Input
                id="points"
                type="number"
                min="0"
                value={formData.points}
                onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                data-testid="input-surveyor-points"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-surveyor"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "處理中..." : "確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除測量員「{deletingSurveyor?.name}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "刪除中..." : "確定刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
