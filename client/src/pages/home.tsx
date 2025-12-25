import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Map, Calendar as CalendarIcon, List, FileSpreadsheet, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { CaseFormDialog } from "@/components/case-form-dialog";
import { CasesTable } from "@/components/cases-table";
import { CalendarView } from "@/components/calendar-view";
import { CalendarFilters } from "@/components/calendar-filters";
import type { SurveyCase } from "@shared/schema";

export default function Home() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editCase, setEditCase] = useState<SurveyCase | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<"calendar" | "list">("calendar");
  
  const [surveyorFilter, setSurveyorFilter] = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [showVacantOnly, setShowVacantOnly] = useState(false);

  const { data: cases = [], isLoading } = useQuery<SurveyCase[]>({
    queryKey: ["/api/cases"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some(c => c.coordinateStatus === "pending" || c.coordinateStatus === "processing")) {
        return 2000;
      }
      return false;
    },
  });

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSurveyor = !surveyorFilter || surveyorFilter === "all" || c.surveyor === surveyorFilter;
      const matchesCaseType = !caseTypeFilter || caseTypeFilter === "all" || c.caseType === caseTypeFilter;
      return matchesSurveyor && matchesCaseType;
    });
  }, [cases, surveyorFilter, caseTypeFilter]);

  const stats = useMemo(() => {
    const total = cases.length;
    const success = cases.filter(c => c.coordinateStatus === "success").length;
    const pending = cases.filter(c => c.coordinateStatus === "pending").length;
    const failed = cases.filter(c => c.coordinateStatus === "failed").length;
    return { total, success, pending, failed };
  }, [cases]);

  const handleEdit = (surveyCase: SurveyCase) => {
    setEditCase(surveyCase);
    setSelectedDate(undefined);
    setIsFormOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setEditCase(null);
    setSelectedDate(date);
    setIsFormOpen(true);
  };

  const handleCloseForm = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditCase(null);
      setSelectedDate(undefined);
    }
  };

  const clearFilters = () => {
    setSurveyorFilter("");
    setCaseTypeFilter("");
    setShowVacantOnly(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <Map className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">測量案件排程系統</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditCase(null); setSelectedDate(undefined); setIsFormOpen(true); }} data-testid="button-add-case">
                <Plus className="h-4 w-4 mr-2" />
                新增案件
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總案件數</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total">{stats.total}</div>
              <p className="text-xs text-muted-foreground">件</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">座標已取得</CardTitle>
              <Database className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-success">{stats.success}</div>
              <p className="text-xs text-muted-foreground">件成功</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待查詢</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pending">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">件待處理</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">查詢失敗</CardTitle>
              <Database className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="stat-failed">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">件需手動處理</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">測量排程</CardTitle>
                <CardDescription>
                  共 {filteredCases.length} 筆案件{filteredCases.length !== cases.length && ` (已篩選，總共 ${cases.length} 筆)`}
                </CardDescription>
              </div>
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "calendar" | "list")}>
                <TabsList>
                  <TabsTrigger value="calendar" data-testid="tab-calendar">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    月曆
                  </TabsTrigger>
                  <TabsTrigger value="list" data-testid="tab-list">
                    <List className="h-4 w-4 mr-2" />
                    列表
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <CalendarFilters
                surveyorFilter={surveyorFilter}
                onSurveyorFilterChange={setSurveyorFilter}
                caseTypeFilter={caseTypeFilter}
                onCaseTypeFilterChange={setCaseTypeFilter}
                showVacantOnly={showVacantOnly}
                onShowVacantOnlyChange={setShowVacantOnly}
                onClearFilters={clearFilters}
              />
            </div>
            
            {activeView === "calendar" ? (
              <CalendarView
                cases={filteredCases}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onDateClick={handleDateClick}
                onCaseClick={handleEdit}
                surveyorFilter={surveyorFilter}
                caseTypeFilter={caseTypeFilter}
                showVacantOnly={showVacantOnly}
              />
            ) : (
              <CasesTable 
                cases={filteredCases} 
                isLoading={isLoading} 
                onEdit={handleEdit}
              />
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>座標資料來源：</p>
          <p>國土測繪圖資服務雲 (NLSC) | 苗栗縣政府地理資訊系統</p>
        </div>
      </main>

      <CaseFormDialog
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        editCase={editCase}
        defaultDate={selectedDate}
      />
    </div>
  );
}
