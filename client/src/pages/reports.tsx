import { useMemo, useRef, useState } from "react";
import { DateInput } from "@/components/date-input";
import { fmtDate, getDateStyle } from "@/lib/date-style";
import { ReportPages, downloadReportPdf, type DetailRow } from "@/components/report-pages";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Download, FileBarChart, Loader2, Printer } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { UNKNOWN_TOWNSHIP, getTownship } from "@/lib/land-sections";
import { TOWNSHIPS as LAND_TOWNSHIPS } from "@shared/land-sections";
import { isPostponed, subsOf, type CaseTypeRecord, type SurveyCase, type Surveyor } from "@shared/schema";
import { applicantText } from "@/lib/receive";

const UNASSIGNED = "（未指派）";
const TOWNSHIPS = [...LAND_TOWNSHIPS, UNKNOWN_TOWNSHIP];

type SectionKey = "bySurveyor" | "byCaseType" | "byTownship" | "surveyorByCaseType" | "surveyorByTownship";

const SECTION_OPTIONS: { key: SectionKey; label: string }[] = [
  { key: "bySurveyor", label: "依測量員統計" },
  { key: "byCaseType", label: "依案件類型統計" },
  { key: "byTownship", label: "依地區統計（苑裡／通霄）" },
  { key: "surveyorByCaseType", label: "測量員 × 案件類型 交叉表" },
  { key: "surveyorByTownship", label: "測量員 × 地區 交叉表" },
];

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function getPresetRange(preset: string): [string, string] {
  const today = new Date();
  switch (preset) {
    case "lastMonth": {
      const last = subMonths(today, 1);
      return [ymd(startOfMonth(last)), ymd(endOfMonth(last))];
    }
    case "quarter":
      return [ymd(startOfQuarter(today)), ymd(endOfQuarter(today))];
    case "year":
      return [ymd(startOfYear(today)), ymd(endOfYear(today))];
    case "thisMonth":
    default:
      return [ymd(startOfMonth(today)), ymd(endOfMonth(today))];
  }
}

function percent(count: number, total: number): string {
  if (total === 0) return "—";
  return `${((count / total) * 100).toFixed(1)}%`;
}

// 依「既有順序」排出所有出現過的值：先放清單裡的，再放清單外但資料裡有的
function orderedKeys(preferred: string[], present: Iterable<string>): string[] {
  const seen = new Set(preferred);
  const extras = Array.from(new Set(present)).filter((k) => !seen.has(k)).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  return [...preferred, ...extras];
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const k = key(item);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

const surveyorOf = (c: SurveyCase) => c.surveyor?.trim() || UNASSIGNED;

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"range" | "year">("range");
  const [initialStart, initialEnd] = getPresetRange("thisMonth");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [year, setYear] = useState(new Date().getFullYear());
  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [townshipFilter, setTownshipFilter] = useState("all");
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    bySurveyor: true,
    byCaseType: true,
    byTownship: true,
    surveyorByCaseType: false,
    surveyorByTownship: false,
  });
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const { data: cases = [], isLoading } = useQuery<SurveyCase[]>({ queryKey: ["/api/cases"] });
  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const { data: caseTypesList = [] } = useQuery<CaseTypeRecord[]>({ queryKey: ["/api/case-types"] });

  // 年度報表：資料裡出現過的年份（加上今年），新的在前
  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    cases.forEach((c) => { const y = Number(c.surveyDate?.slice(0, 4)); if (y > 1900) ys.add(y); });
    return Array.from(ys).sort((a, b) => b - a);
  }, [cases]);

  const from = mode === "year" ? `${year}-01-01` : startDate;
  const to = mode === "year" ? `${year}-12-31` : endDate;
  const rangeInvalid = !from || !to || from > to;

  const reportCases = useMemo(() => {
    if (rangeInvalid) return [];
    return cases
      .filter((c) => c.surveyDate >= from && c.surveyDate <= to)
      .filter((c) => surveyorFilter === "all" || surveyorOf(c) === surveyorFilter)
      .filter((c) => caseTypeFilter === "all" || c.caseType === caseTypeFilter)
      .filter((c) => townshipFilter === "all" || getTownship(c.landParcel) === townshipFilter)
      .sort((a, b) =>
        `${a.surveyDate} ${a.scheduledTime}`.localeCompare(`${b.surveyDate} ${b.scheduledTime}`),
      );
  }, [cases, from, to, rangeInvalid, surveyorFilter, caseTypeFilter, townshipFilter]);

  const total = reportCases.length;

  // 測量員：清單內的人即使 0 件也列出（看得到工作量差異），篩選單一人時只列那位
  const surveyorKeys = useMemo(() => {
    if (surveyorFilter !== "all") return [surveyorFilter];
    return orderedKeys(surveyorsList.map((s) => s.name), reportCases.map(surveyorOf));
  }, [surveyorsList, reportCases, surveyorFilter]);
  const caseTypeKeys = useMemo(
    () => orderedKeys(caseTypesList.map((t) => t.name), reportCases.map((c) => c.caseType)).filter((k) => reportCases.some((c) => c.caseType === k)),
    [caseTypesList, reportCases],
  );
  const townshipKeys = useMemo(() => {
    if (townshipFilter !== "all") return [townshipFilter];
    return TOWNSHIPS.filter((t) => t !== UNKNOWN_TOWNSHIP || reportCases.some((c) => getTownship(c.landParcel) === t));
  }, [reportCases, townshipFilter]);
  const monthKeys = useMemo(() => Array.from({ length: 12 }, (_, i) => `${i + 1} 月`), []);
  const monthOf = (c: SurveyCase) => `${Number(c.surveyDate.slice(5, 7))} 月`;

  const bySurveyor = useMemo(() => countBy(reportCases, surveyorOf), [reportCases]);
  const byCaseType = useMemo(() => countBy(reportCases, (c) => c.caseType), [reportCases]);
  const byTownship = useMemo(() => countBy(reportCases, (c) => getTownship(c.landParcel)), [reportCases]);
  const cross = (rk: (c: SurveyCase) => string, ck: (c: SurveyCase) => string) => countBy(reportCases, (c) => `${rk(c)}\u0000${ck(c)}`);
  const surveyorByCaseType = useMemo(() => cross(surveyorOf, (c) => c.caseType), [reportCases]);
  const surveyorByTownship = useMemo(() => cross(surveyorOf, (c) => getTownship(c.landParcel)), [reportCases]);
  const monthByCaseType = useMemo(() => cross(monthOf, (c) => c.caseType), [reportCases]);
  const monthBySurveyor = useMemo(() => cross(monthOf, surveyorOf), [reportCases]);

  const surveyorAttr = useMemo(() => {
    const m = new Map<string, string>();
    surveyorsList.forEach((s) => m.set(s.name, s.businessAttribute));
    return m;
  }, [surveyorsList]);

  const filterSummary = [
    surveyorFilter !== "all" && `測量員：${surveyorFilter}`,
    caseTypeFilter !== "all" && `案件類型：${caseTypeFilter}`,
    townshipFilter !== "all" && `地區：${townshipFilter}`,
  ].filter(Boolean).join("　");

  const yearLabel = (y: number) => (getDateStyle() === "roc" ? `${y - 1911} 年` : `${y} 年`);
  const title = mode === "year" ? `${yearLabel(year)}度測量案件報表` : "測量案件報表";
  const period = mode === "year" ? `統計期間：${fmtDate(from)} 至 ${fmtDate(to)}（全年度）` : `統計期間：${fmtDate(from)} 至 ${fmtDate(to)}`;

  // 明細：依月份分段，連件列在主件下方
  const detailRows = useMemo<DetailRow[]>(() => {
    const out: DetailRow[] = [];
    let lastM = "", no = 0;
    const monthCount = countBy(reportCases, (c) => c.surveyDate.slice(0, 7));
    reportCases.forEach((c) => {
      const m = c.surveyDate.slice(0, 7);
      if (m !== lastM) {
        const y = Number(m.slice(0, 4));
        out.push({ kind: "month", key: `m${m}`, label: `${getDateStyle() === "roc" ? y - 1911 : y} 年 ${Number(m.slice(5))} 月`, count: monthCount.get(m) || 0 });
        lastM = m;
      }
      const p = splitParcel(c.landParcel);
      out.push({
        kind: "case", key: c.id, no: ++no, c,
        date: fmtDate(c.surveyDate), time: (c.scheduledTime.match(/\d{1,2}:\d{2}/)?.[0] ?? c.scheduledTime),
        type: c.caseType, recvDate: c.receiveDate ? fmtDate(c.receiveDate) : "", recvWord: c.receiveWord ?? "",
        caseNo: c.caseNumber?.trim() || "（未收件）", section: p.section, lot: p.lot,
        applicant: applicantText(c), surveyor: surveyorOf(c), postponed: isPostponed(c),
      });
      subsOf(c).forEach((x, i) => {
        const q = splitParcel(x.landParcel);
        out.push({ kind: "sub", key: `${c.id}-${i}`, type: x.caseType, caseNo: x.caseNumber, section: q.section, lot: q.lot });
      });
    });
    return out;
  }, [reportCases]);

  // 統計頁：第 1 頁總計＋三張分類表並排；交叉表每頁放兩張
  const summaryPages = useMemo(() => {
    const tiles = (
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <SummaryTile label="案件總數" value={total} />
        {mode === "year" && <SummaryTile label="每月平均" value={Math.round((total / 12) * 10) / 10} />}
        {townshipKeys.map((t) => <SummaryTile key={t} label={t} value={byTownship.get(t) || 0} />)}
        <SummaryTile label="有案件的測量員" value={Array.from(bySurveyor.keys()).filter((k) => k !== UNASSIGNED).length} />
        <SummaryTile label="連件" value={reportCases.reduce((n, c) => n + subsOf(c).length, 0)} />
      </div>
    );
    const simple = [
      sections.bySurveyor && (
        <ReportSection key="s" title="依測量員統計">
          <SimpleCountTable headers={["測量員", "業務屬性", "件數", "佔比"]}
            rows={surveyorKeys.map((k) => [k, surveyorAttr.get(k) || "—", bySurveyor.get(k) || 0, percent(bySurveyor.get(k) || 0, total)])}
            totalRow={["合計", "", total, total ? "100%" : "—"]} />
        </ReportSection>
      ),
      sections.byCaseType && (
        <ReportSection key="t" title="依案件類型統計">
          <SimpleCountTable headers={["案件類型", "件數", "佔比"]}
            rows={caseTypeKeys.map((k) => [k, byCaseType.get(k) || 0, percent(byCaseType.get(k) || 0, total)])}
            totalRow={["合計", total, total ? "100%" : "—"]} />
        </ReportSection>
      ),
      sections.byTownship && (
        <ReportSection key="w" title="依地區統計">
          <SimpleCountTable headers={["地區", "件數", "佔比"]}
            rows={townshipKeys.map((k) => [k, byTownship.get(k) || 0, percent(byTownship.get(k) || 0, total)])}
            totalRow={["合計", total, total ? "100%" : "—"]} />
        </ReportSection>
      ),
    ].filter(Boolean);
    const first = (
      <div>
        {tiles}
        <div className="grid gap-6 items-start" style={{ gridTemplateColumns: `repeat(${Math.max(simple.length, 1)}, minmax(0, 1fr))` }}>{simple}</div>
      </div>
    );
    const crosses = [
      mode === "year" && <ReportSection key="mt" title="各月份 × 案件類型"><CrossTable rowLabel="月份" rowKeys={monthKeys} colKeys={caseTypeKeys} counts={monthByCaseType} /></ReportSection>,
      mode === "year" && <ReportSection key="ms" title="各月份 × 測量員"><CrossTable rowLabel="月份" rowKeys={monthKeys} colKeys={surveyorKeys.filter((k) => bySurveyor.get(k))} counts={monthBySurveyor} /></ReportSection>,
      sections.surveyorByCaseType && <ReportSection key="sc" title="測量員 × 案件類型"><CrossTable rowLabel="測量員" rowKeys={surveyorKeys} colKeys={caseTypeKeys} counts={surveyorByCaseType} /></ReportSection>,
      sections.surveyorByTownship && <ReportSection key="sw" title="測量員 × 地區"><CrossTable rowLabel="測量員" rowKeys={surveyorKeys} colKeys={townshipKeys} counts={surveyorByTownship} /></ReportSection>,
    ].filter(Boolean);
    const pages: React.ReactNode[] = [first];
    for (let i = 0; i < crosses.length; i += 2) pages.push(<div className="space-y-6">{crosses.slice(i, i + 2)}</div>);
    return pages;
  }, [mode, total, reportCases, sections, surveyorKeys, caseTypeKeys, townshipKeys, monthKeys, bySurveyor, byCaseType, byTownship,
      surveyorByCaseType, surveyorByTownship, monthByCaseType, monthBySurveyor, surveyorAttr]);

  const fileBase = mode === "year"
    ? `測量案件年度報表_${getDateStyle() === "roc" ? `${year - 1911}年` : `${year}`}`
    : `測量案件報表_${from}_${to}`;

  const handlePrint = () => {
    // 瀏覽器「另存為 PDF」會用 document.title 當預設檔名
    const originalTitle = document.title;
    document.title = fileBase;
    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const handlePdf = async () => {
    if (!pagesRef.current) return;
    try {
      setPdfProgress("準備中…");
      await downloadReportPdf(pagesRef.current, `${fileBase}.pdf`, (d, n) => setPdfProgress(d < n ? `產生中 ${d + 1} / ${n} 頁` : "完成"));
      toast({ title: "已下載 PDF", description: `${fileBase}.pdf` });
    } catch (e) {
      toast({ title: "PDF 產生失敗", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setPdfProgress(null);
    }
  };

  const applyPreset = (preset: string) => {
    const [s, e] = getPresetRange(preset);
    setStartDate(s);
    setEndDate(e);
  };

  const busy = rangeInvalid || isLoading || !!pdfProgress;

  return (
    <div className="min-h-screen bg-background print:bg-white print:min-h-0">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <FileBarChart className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">案件報表</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handlePdf} disabled={busy} data-testid="button-download-pdf">
                {pdfProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {pdfProgress ?? "下載 PDF"}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={busy} data-testid="button-print-report">
                <Printer className="h-4 w-4 mr-2" />
                列印
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 print:p-0 print:max-w-none">
        <Card className="mb-6 print:hidden">
          <CardHeader>
            <CardTitle>報表條件</CardTitle>
            <CardDescription>
              以「排件日期」落在期間內的案件產製，A3 橫向。按右上角「下載 PDF」直接存檔；要紙本再按「列印」（印表機紙張請選 A3、橫向）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>報表種類</Label>
              <div className="inline-flex rounded-md border p-0.5">
                {([["range", "期間報表"], ["year", "年度報表"]] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setMode(v)} data-testid={`button-mode-${v}`}
                    className={cn("px-4 py-1.5 text-sm rounded", mode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "year" ? (
              <div className="space-y-2">
                <Label>年度</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-44" data-testid="select-report-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{yearLabel(y)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">年度報表另附「各月份 × 案件類型」「各月份 × 測量員」統計，明細依月份分段。</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>時間區間</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <DateInput value={startDate} onChange={setStartDate} className="w-44" data-testid="input-report-start" />
                  <span className="text-muted-foreground">至</span>
                  <DateInput value={endDate} onChange={setEndDate} className="w-44" data-testid="input-report-end" />
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={() => applyPreset("thisMonth")}>本月</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset("lastMonth")}>上月</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset("quarter")}>本季</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset("year")}>今年</Button>
                  </div>
                </div>
                {rangeInvalid && (
                  <p className="text-sm text-destructive">請選擇起訖日期，且開始日期不可晚於結束日期</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>測量員</Label>
                <Select value={surveyorFilter} onValueChange={setSurveyorFilter}>
                  <SelectTrigger data-testid="select-report-surveyor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部測量員</SelectItem>
                    {surveyorsList.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}（{s.businessAttribute}）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>案件類型</Label>
                <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                  <SelectTrigger data-testid="select-report-case-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部類型</SelectItem>
                    {caseTypesList.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>地區</Label>
                <Select value={townshipFilter} onValueChange={setTownshipFilter}>
                  <SelectTrigger data-testid="select-report-township"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部地區</SelectItem>
                    {TOWNSHIPS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>統計頁內容（案件明細一律附上）</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SECTION_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={sections[opt.key]}
                      onCheckedChange={(v) => setSections((prev) => ({ ...prev, [opt.key]: v === true }))}
                      data-testid={`checkbox-section-${opt.key}`}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">載入中...</p>
        ) : rangeInvalid ? (
          <p className="text-center text-muted-foreground py-8">請先選擇正確的時間區間</p>
        ) : (
          <ReportPages
            ref={pagesRef}
            title={title}
            period={period}
            filters={filterSummary}
            summaryPages={summaryPages}
            rows={detailRows}
            detailTitle={total ? `案件明細（${total} 件）` : "案件明細：此期間沒有案件"}
          />
        )}
      </main>
    </div>
  );
}

// 「苑裡鎮田寮段571地號」→ 地段「苑裡鎮田寮段」、地號「571」
function splitParcel(landParcel: string): { section: string; lot: string } {
  const m = (landParcel || "").match(/^(.*段)(.*)$/);
  if (!m) return { section: landParcel || "", lot: "" };
  return { section: m[1], lot: m[2].replace(/地號$/, "").trim() };
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section">
      <h3 className="text-base font-semibold border-b-2 border-neutral-800 pb-1 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-neutral-300 px-3 py-2">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

// 最後兩欄固定是「件數」「佔比」，靠右對齊
function SimpleCountTable({
  headers,
  rows,
  totalRow,
}: {
  headers: string[];
  rows: (string | number)[][];
  totalRow: (string | number)[];
}) {
  const align = (i: number) => (i >= headers.length - 2 ? "text-right tabular-nums" : "text-left");
  return (
    <table className="report-table w-full text-sm">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={h} className={align(i)}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="text-center text-neutral-500">無資料</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={String(row[0])}>
              {row.map((cell, i) => (
                <td key={i} className={align(i)}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          {totalRow.map((cell, i) => (
            <td key={i} className={align(i)}>{cell}</td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

function CrossTable({
  rowLabel,
  rowKeys,
  colKeys,
  counts,
}: {
  rowLabel: string;
  rowKeys: string[];
  colKeys: string[];
  counts: Map<string, number>;
}) {
  const cell = (r: string, c: string) => counts.get(`${r}\u0000${c}`) || 0;
  const colTotals = colKeys.map((c) => rowKeys.reduce((sum, r) => sum + cell(r, c), 0));
  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  if (colKeys.length === 0) {
    return <p className="text-sm text-neutral-500">此區間沒有案件</p>;
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="report-table w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">{rowLabel}</th>
            {colKeys.map((c) => (
              <th key={c} className="text-right">{c}</th>
            ))}
            <th className="text-right">合計</th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((r) => {
            const rowTotal = colKeys.reduce((sum, c) => sum + cell(r, c), 0);
            return (
              <tr key={r}>
                <td>{r}</td>
                {colKeys.map((c) => (
                  <td key={c} className="text-right tabular-nums">{cell(r, c) || ""}</td>
                ))}
                <td className="text-right tabular-nums font-medium">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>合計</td>
            {colTotals.map((t, i) => (
              <td key={colKeys[i]} className="text-right tabular-nums">{t}</td>
            ))}
            <td className="text-right tabular-nums">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
