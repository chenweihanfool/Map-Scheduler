import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Map, Calendar as CalendarIcon, List, Settings, User } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { CaseFormDialog } from "@/components/case-form-dialog";
import { CasesTable } from "@/components/cases-table";
import { CalendarView } from "@/components/calendar-view";
import { CalendarFilters } from "@/components/calendar-filters";
import type { SurveyCase, Surveyor } from "@shared/schema";

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

  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({
    queryKey: ["/api/surveyors"],
  });

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          {surveyorsList.map((surveyor) => {
            const caseCount = surveyorCaseCounts[surveyor.name] || 0;
            const isSelected = surveyorFilter === surveyor.name;
            return (
              <Card
                key={surveyor.id}
                className={`cursor-pointer transition-all hover-elevate ${isSelected ? "ring-2 ring-primary" : ""}`}
                onClick={() => handleSurveyorCardClick(surveyor.name)}
                data-testid={`card-surveyor-${surveyor.id}`}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate">{surveyor.name}</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`stat-cases-${surveyor.id}`}>{caseCount}</div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">件案件</p>
                    <p className="text-xs text-muted-foreground" data-testid={`stat-points-${surveyor.id}`}>
                      積分: {surveyor.points}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
