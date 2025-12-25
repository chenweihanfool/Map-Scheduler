import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileSpreadsheet, Map, Database } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { CaseFormDialog } from "@/components/case-form-dialog";
import { CasesTable } from "@/components/cases-table";
import { SearchFilters } from "@/components/search-filters";
import type { SurveyCase } from "@shared/schema";

export default function Home() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editCase, setEditCase] = useState<SurveyCase | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [surveyorFilter, setSurveyorFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState("");

  const { data: cases = [], isLoading } = useQuery<SurveyCase[]>({
    queryKey: ["/api/cases"],
    refetchInterval: (query) => {
      // Poll every 2 seconds if there are cases with pending or processing status
      const data = query.state.data;
      if (data && data.some(c => c.coordinateStatus === "pending" || c.coordinateStatus === "processing")) {
        return 2000;
      }
      return false;
    },
  });

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSearch = 
        !searchQuery ||
        c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.landParcel.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSurveyor = 
        !surveyorFilter || 
        surveyorFilter === "all" || 
        c.surveyor === surveyorFilter;

      const matchesDate = 
        !dateFilter || 
        c.surveyDate === format(dateFilter, "yyyy-MM-dd");

      const matchesStatus = 
        !statusFilter || 
        statusFilter === "all" || 
        c.coordinateStatus === statusFilter;

      return matchesSearch && matchesSurveyor && matchesDate && matchesStatus;
    });
  }, [cases, searchQuery, surveyorFilter, dateFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = cases.length;
    const success = cases.filter(c => c.coordinateStatus === "success").length;
    const pending = cases.filter(c => c.coordinateStatus === "pending").length;
    const failed = cases.filter(c => c.coordinateStatus === "failed").length;
    return { total, success, pending, failed };
  }, [cases]);

  const handleEdit = (surveyCase: SurveyCase) => {
    setEditCase(surveyCase);
    setIsFormOpen(true);
  };

  const handleCloseForm = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditCase(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSurveyorFilter("");
    setDateFilter(undefined);
    setStatusFilter("");
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
              <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-case">
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
          <CardHeader>
            <CardTitle className="text-lg">篩選條件</CardTitle>
            <CardDescription>搜尋或篩選測量案件</CardDescription>
          </CardHeader>
          <CardContent>
            <SearchFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              surveyorFilter={surveyorFilter}
              onSurveyorFilterChange={setSurveyorFilter}
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onClearFilters={clearFilters}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">測量排程表</CardTitle>
                <CardDescription>
                  共 {filteredCases.length} 筆案件{filteredCases.length !== cases.length && ` (已篩選，總共 ${cases.length} 筆)`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CasesTable 
              cases={filteredCases} 
              isLoading={isLoading} 
              onEdit={handleEdit}
            />
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
      />
    </div>
  );
}
