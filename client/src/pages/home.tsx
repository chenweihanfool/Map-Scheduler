import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Map as MapIcon, Calendar as CalendarIcon, List, Settings, User, CalendarOff } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { CaseFormDialog } from "@/components/case-form-dialog";
import { CasesTable } from "@/components/cases-table";
import { CalendarView } from "@/components/calendar-view";
import { CalendarFilters } from "@/components/calendar-filters";
import { CaseSearch } from "@/components/case-search";
import { CaseDetailDialog } from "@/components/case-detail-dialog";
import { CaseMap } from "@/components/case-map";
import { cn } from "@/lib/utils";
import type { SurveyCase, Surveyor, SystemSettings } from "@shared/schema";

const COLOR_PALETTE = [
  { bg: "bg-blue-100 dark:bg-blue-900", border: "border-blue-300 dark:border-blue-700" },
  { bg: "bg-green-100 dark:bg-green-900", border: "border-green-300 dark:border-green-700" },
  { bg: "bg-purple-100 dark:bg-purple-900", border: "border-purple-300 dark:border-purple-700" },
  { bg: "bg-orange-100 dark:bg-orange-900", border: "border-orange-300 dark:border-orange-700" },
  { bg: "bg-pink-100 dark:bg-pink-900", border: "border-pink-300 dark:border-pink-700" },
  { bg: "bg-teal-100 dark:bg-teal-900", border: "border-teal-300 dark:border-teal-700" },
  { bg: "bg-amber-100 dark:bg-amber-900", border: "border-amber-300 dark:border-amber-700" },
  { bg: "bg-indigo-100 dark:bg-indigo-900", border: "border-indigo-300 dark:border-indigo-700" },
  { bg: "bg-rose-100 dark:bg-rose-900", border: "border-rose-300 dark:border-rose-700" },
  { bg: "bg-cyan-100 dark:bg-cyan-900", border: "border-cyan-300 dark:border-cyan-700" },
];

export default function Home() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editCase, setEditCase] = useState<SurveyCase | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<"calendar" | "list" | "map">("calendar");
  
  const [surveyorFilter, setSurveyorFilter] = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [showVacantOnly, setShowVacantOnly] = useState(false);
  const [dimPastCases, setDimPastCases] = useState(false);
  
  const [detailCase, setDetailCase] = useState<SurveyCase | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedMapCaseId, setSelectedMapCaseId] = useState<string | null>(null);

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

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
  });

  // Calculate next assignee based on assignment mode
  const nextAssigneeId = useMemo(() => {
    const eligibleSurveyors = surveyorsList.filter(s => s.businessAttribute === "複丈組");
    if (eligibleSurveyors.length === 0) return null;

    if (settings?.assignmentMode === "points") {
      // Points mode: lowest points is next
      const lowestPointsSurveyor = eligibleSurveyors.reduce((min, s) => 
        s.points < min.points ? s : min, eligibleSurveyors[0]);
      return lowestPointsSurveyor.id;
    } else {
      // Sequential mode: next after lastAssignedSurveyorId
      const lastId = settings?.lastAssignedSurveyorId;
      if (!lastId) {
        return eligibleSurveyors[0].id;
      }
      const lastIndex = eligibleSurveyors.findIndex(s => s.id === lastId);
      const nextIndex = (lastIndex + 1) % eligibleSurveyors.length;
      return eligibleSurveyors[nextIndex].id;
    }
  }, [surveyorsList, settings]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSurveyor = !surveyorFilter || surveyorFilter === "all" || c.surveyor === surveyorFilter;
      const matchesCaseType = !caseTypeFilter || caseTypeFilter === "all" || c.caseType === caseTypeFilter;
      return matchesSurveyor && matchesCaseType;
    });
  }, [cases, surveyorFilter, caseTypeFilter]);

  const surveyorCaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach((c) => {
      if (c.surveyor) {
        counts[c.surveyor] = (counts[c.surveyor] || 0) + 1;
      }
    });
    return counts;
  }, [cases]);

  const handleSurveyorCardClick = (surveyorName: string) => {
    if (surveyorFilter === surveyorName) {
      setSurveyorFilter("");
    } else {
      setSurveyorFilter(surveyorName);
    }
  };

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
    setDimPastCases(false);
  };

  const handleCaseDetail = (surveyCase: SurveyCase) => {
    setDetailCase(surveyCase);
    setIsDetailOpen(true);
    setSelectedMapCaseId(surveyCase.id);
  };

  const handleEditFromDetail = (surveyCase: SurveyCase) => {
    setEditCase(surveyCase);
    setSelectedDate(undefined);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3 shrink-0">
              <MapIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold hidden sm:block">測量案件排程系統</h1>
            </div>
            <div className="flex-1 max-w-md mx-4">
              <CaseSearch onCaseSelect={handleCaseDetail} />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={() => { setEditCase(null); setSelectedDate(undefined); setIsFormOpen(true); }} data-testid="button-add-case">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">新增案件</span>
              </Button>
              <Link href="/leaves">
                <Button variant="outline" data-testid="button-leaves">
                  <CalendarOff className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">請假管理</span>
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="icon" data-testid="button-settings">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">測量排程</CardTitle>
                <CardDescription>
                  共 {filteredCases.length} 筆案件{filteredCases.length !== cases.length && ` (已篩選，總共 ${cases.length} 筆)`}
                </CardDescription>
              </div>
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "calendar" | "list" | "map")}>
                <TabsList>
                  <TabsTrigger value="calendar" data-testid="tab-calendar">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    月曆
                  </TabsTrigger>
                  <TabsTrigger value="list" data-testid="tab-list">
                    <List className="h-4 w-4 mr-2" />
                    列表
                  </TabsTrigger>
                  <TabsTrigger value="map" data-testid="tab-map">
                    <MapIcon className="h-4 w-4 mr-2" />
                    地圖
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
                dimPastCases={dimPastCases}
                onDimPastCasesChange={setDimPastCases}
                onClearFilters={clearFilters}
              />
            </div>
            
            {activeView === "calendar" && (
              <CalendarView
                cases={filteredCases}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onDateClick={handleDateClick}
                onCaseClick={handleEdit}
                surveyorFilter={surveyorFilter}
                caseTypeFilter={caseTypeFilter}
                showVacantOnly={showVacantOnly}
                dimPastCases={dimPastCases}
              />
            )}
            {activeView === "list" && (
              <CasesTable 
                cases={filteredCases} 
                isLoading={isLoading} 
                onEdit={handleEdit}
                dimPastCases={dimPastCases}
              />
            )}
            {activeView === "map" && (
              <CaseMap
                cases={filteredCases}
                onCaseClick={handleCaseDetail}
                selectedCaseId={selectedMapCaseId}
                className="h-[600px]"
                dimPastCases={dimPastCases}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          {surveyorsList.map((surveyor, index) => {
            const caseCount = surveyorCaseCounts[surveyor.name] || 0;
            const isSelected = surveyorFilter === surveyor.name;
            const isNextAssignee = surveyor.id === nextAssigneeId;
            const isEligible = surveyor.businessAttribute === "複丈組";
            const isPointsMode = settings?.assignmentMode === "points";
            const colorStyle = COLOR_PALETTE[index % COLOR_PALETTE.length];
            
            return (
              <Card
                key={surveyor.id}
                className={cn(
                  "cursor-pointer transition-all hover-elevate border-2",
                  colorStyle.bg,
                  colorStyle.border,
                  isSelected && "ring-2 ring-primary"
                )}
                onClick={() => handleSurveyorCardClick(surveyor.name)}
                data-testid={`card-surveyor-${surveyor.id}`}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-medium truncate">{surveyor.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{surveyor.businessAttribute}</p>
                  </div>
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`stat-cases-${surveyor.id}`}>{caseCount}</div>
                  <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-muted-foreground">件案件</p>
                    {isEligible && (
                      isPointsMode ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground" data-testid={`stat-points-${surveyor.id}`}>
                            積分: {surveyor.points}
                          </span>
                          {isNextAssignee && (
                            <Badge variant="default" className="text-[10px] px-1 py-0" data-testid={`badge-next-${surveyor.id}`}>
                              下一位
                            </Badge>
                          )}
                        </div>
                      ) : (
                        isNextAssignee && (
                          <Badge variant="default" className="text-[10px] px-1 py-0" data-testid={`badge-next-${surveyor.id}`}>
                            下一位承辦
                          </Badge>
                        )
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

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

      <CaseDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        caseData={detailCase}
        onEdit={handleEditFromDetail}
      />
    </div>
  );
}
