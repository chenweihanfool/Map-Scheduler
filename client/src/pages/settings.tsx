import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CASE_TYPES, type SystemSettings } from "@shared/schema";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
  });

  const [assignmentMode, setAssignmentMode] = useState<string>("sequential");
  const [weights, setWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    if (settings) {
      setAssignmentMode(settings.assignmentMode);
      const initialWeights: Record<string, number> = {};
      CASE_TYPES.forEach(type => {
        initialWeights[type] = (settings.caseTypeWeights as Record<string, number>)?.[type] ?? 1;
      });
      setWeights(initialWeights);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { assignmentMode?: string; caseTypeWeights?: Record<string, number> }) => {
      return apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "設定已儲存",
        description: "系統設定已成功更新",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "儲存失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      assignmentMode,
      caseTypeWeights: weights,
    });
  };

  const handleWeightChange = (caseType: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setWeights(prev => ({ ...prev, [caseType]: numValue }));
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
                <SettingsIcon className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">系統設定</h1>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>排件模式</CardTitle>
              <CardDescription>
                選擇系統自動建議測量員的方式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={assignmentMode} 
                onValueChange={setAssignmentMode}
                className="space-y-4"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate">
                  <RadioGroupItem value="sequential" id="sequential" data-testid="radio-sequential" />
                  <div className="space-y-1">
                    <Label htmlFor="sequential" className="font-medium cursor-pointer">
                      順序模式
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      按照測量員順序輪流指派案件。系統會記住上次指派的測量員，下次新增案件時自動建議下一位。
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover-elevate">
                  <RadioGroupItem value="points" id="points" data-testid="radio-points" />
                  <div className="space-y-1">
                    <Label htmlFor="points" className="font-medium cursor-pointer">
                      積分模式
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      根據案件權重累積積分。系統會自動建議積分最少的測量員，以達到工作量平衡。
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {assignmentMode === "points" && (
            <Card>
              <CardHeader>
                <CardTitle>案件類型權重</CardTitle>
                <CardDescription>
                  設定每種案件類型的積分權重。權重越高表示該案件工作量越大。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CASE_TYPES.map((caseType) => (
                    <div key={caseType} className="flex items-center gap-3">
                      <Label htmlFor={`weight-${caseType}`} className="min-w-[80px]">
                        {caseType}
                      </Label>
                      <Input
                        id={`weight-${caseType}`}
                        type="number"
                        min="0"
                        value={weights[caseType] ?? 1}
                        onChange={(e) => handleWeightChange(caseType, e.target.value)}
                        className="w-24"
                        data-testid={`input-weight-${caseType}`}
                      />
                      <span className="text-sm text-muted-foreground">分</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between gap-4">
            <Link href="/surveyors">
              <Button variant="outline" data-testid="button-manage-surveyors">
                管理測量員
              </Button>
            </Link>
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateMutation.isPending ? "儲存中..." : "儲存設定"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
