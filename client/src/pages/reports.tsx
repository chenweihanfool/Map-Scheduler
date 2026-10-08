import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, FileBarChart, Printer } from "lucide-react";
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
import { LAND_SECTIONS, UNKNOWN_TOWNSHIP, getTownship } from "@/lib/land-sections";
import type { CaseTypeRecord, SurveyCase, Surveyor } from "@shared/schema";

const UNASSIGNED = "（未指派）";
const TOWNSHIPS = [...LAND_SECTIONS.map((group) => group.township), UNKNOWN_TOWNSHIP];

type SectionKey = "bySurveyor" | "byCaseType" | "byTownship" | "surveyorByCaseType" | "surveyorByTownship" | "details";

const SECTION_OPTIONS: { key: SectionKey; label: string }[] = [
  { key: "bySurveyor", label: "依測量員統計" },
  { key: "byCaseType", label: "依案件類型統計" },
  { key: "byTownship", label: "依地區統計（苑裡／通霄）" },
  { key: "surveyorByCaseType", label: "測量員 × 案件類型 交叉表" },
  { key: "surveyorByTownship", label: "測量員 × 地區 交叉表" },
  { key: "details", label: "案件明細" },
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
  const [initialStart, initialEnd] = getPresetRange("thisMonth");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [townshipFilter, setTownshipFilter] = useState("all");
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    bySurveyor: true,
    byCaseType: true,
    byTownship: true,
    surveyorByCaseType: false,
    surveyorByTownship: false,
    details: false,
  });

  const { data: cases = [], isLoading } = useQuery<SurveyCase[]>({ queryKey: ["/api/cases"] });
  const { data: surveyorsList = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const { data: caseTypesList = [] } = useQuery<CaseTypeRecord[]>({ queryKey: ["/api/case-types"] });

  const rangeInvalid = !startDate || !endDate || startDate > endDate;

  const reportCases = useMemo(() => {
    if (rangeInvalid) return [];
    return cases
      .filter((c) => c.surveyDate >= startDate && c.surveyDate <= endDate)
      .filter((c) => surveyorFilter === "all" || surveyorOf(c) === surveyorFilter)
      .filter((c) => caseTypeFilter === "all" || c.caseType === caseTypeFilter)
      .filter((c) => townshipFilter === "all" || getTownship(c.landParcel) === townshipFilter)
      .sort((a, b) =>
        `${a.surveyDate} ${a.scheduledTime}`.localeCompare(`${b.surveyDate} ${b.scheduledTime}`),
      );
  }, [cases, startDate, endDate, rangeInvalid, surveyorFilter, caseTypeFilter, townshipFilter]);

  const total = reportCases.length;

  // 測量員：清單內的人即使 0 件也列出（看得到工作量差異），篩選單一人時只列那位
  const surveyorKeys = useMemo(() => {
    if (surveyorFilter !== "all") return [surveyorFilter];
    return orderedKeys(surveyorsList.map((s) => s.name), reportCases.map(surveyorOf));
  }, [surveyorFilter, surveyorsList, reportCases]);

  const caseTypeKeys = useMemo(() => {
    if (caseTypeFilter !== "all") return [caseTypeFilter];
    const used = new Set(reportCases.map((c) => c.caseType));
    // 案件類型只列有案件的，避免一長串 0
    return orderedKeys(caseTypesList.map((t) => t.name), used).filter((k) => used.has(k));
  }, [caseTypeFilter, caseTypesList, reportCases]);

  const townshipKeys = useMemo(() => {
    if (townshipFilter !== "all") return [townshipFilter];
    const used = new Set(reportCases.map((c) => getTownship(c.landParcel)));
    // 苑裡、通霄固定列出；「其他／未判定」只有出現時才列
    return TOWNSHIPS.filter((t) => t !== UNKNOWN_TOWNSHIP || used.has(t));
  }, [townshipFilter, reportCases]);

  const bySurveyor = useMemo(() => countBy(reportCases, surveyorOf), [reportCases]);
  const byCaseType = useMemo(() => countBy(reportCases, (c) => c.caseType), [reportCases]);
  const byTownship = useMemo(() => countBy(reportCases, (c) => getTownship(c.landParcel)), [reportCases]);
  const surveyorByCaseType = useMemo(
    () => countBy(reportCases, (c) => `${surveyorOf(c)}\u0000${c.caseType}`),
    [reportCases],
  );
  const surveyorByTownship = useMemo(
    () => countBy(reportCases, (c) => `${surveyorOf(c)}\u0000${getTownship(c.landParcel)}`),
    [reportCases],
  );

  const surveyorAttr = useMemo(() => {
    const map = new Map<string, string>();
    surveyorsList.forEach((s) => map.set(s.name, s.businessAttribute));
    return map;
  }, [surveyorsList]);

  const filterSummary = [
    surveyorFilter !== "all" && `測量員：${surveyorFilter}`,
    caseTypeFilter !== "all" && `案件類型：${caseTypeFilter}`,
    townshipFilter !== "all" && `地區：${townshipFilter}`,
  ].filter(Boolean).join("　");

  const handlePrint = () => {
    // 瀏覽器「另存為 PDF」會用 document.title 當預設檔名
    const originalTitle = document.title;
    document.title = `測量案件報表_${startDate}_${endDate}`;
    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const applyPreset = (preset: string) => {
    const [s, e] = getPresetRange(preset);
    setStartDate(s);
    setEndDate(e);
  };

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
              <Button onClick={handlePrint} disabled={rangeInvalid || isLoading} data-testid="button-print-report">
                <Printer className="h-4 w-4 mr-2" />
                列印 / 另存 PDF
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
              以「測量日期」落在區間內的案件統計。設定好後按右上角「列印 / 另存 PDF」，在列印視窗的目的地選「另存為 PDF」即可存檔。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>時間區間</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-44"
                  data-testid="input-report-start"
                />
                <span className="text-muted-foreground">至</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-44"
                  data-testid="input-report-end"
                />
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
              <Label>報表內容</Label>
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

        {/* 報表本體：固定白底黑字，畫面上是預覽，列印時只印這一塊 */}
        <div
          className="report-sheet mx-auto max-w-4xl rounded-lg border bg-white text-neutral-900 shadow-sm p-8 print:max-w-none print:border-0 print:shadow-none print:rounded-none print:p-0"
          data-testid="report-sheet"
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-wide">測量案件統計報表</h2>
            <p className="mt-1 text-sm text-neutral-600">
              統計期間：{startDate || "—"} 至 {endDate || "—"}
            </p>
            {filterSummary && <p className="text-sm text-neutral-600">篩選條件：{filterSummary}</p>}
            <p className="text-xs text-neutral-500 mt-1">製表時間：{format(new Date(), "yyyy-MM-dd HH:mm")}</p>
          </div>

          {isLoading ? (
            <p className="text-center text-neutral-500 py-8">載入中...</p>
          ) : rangeInvalid ? (
            <p className="text-center text-neutral-500 py-8">請先選擇正確的時間區間</p>
          ) : (
            <div className="space-y-8">
              <ReportSection title="總計">
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
                  <SummaryTile label="案件總數" value={total} />
                  {townshipKeys.map((t) => (
                    <SummaryTile key={t} label={t} value={byTownship.get(t) || 0} />
                  ))}
                  <SummaryTile
                    label="有案件的測量員"
                    value={Array.from(bySurveyor.keys()).filter((k) => k !== UNASSIGNED).length}
                  />
                </div>
              </ReportSection>

              {sections.bySurveyor && (
                <ReportSection title="依測量員統計">
                  <SimpleCountTable
                    headers={["測量員", "業務屬性", "件數", "佔比"]}
                    rows={surveyorKeys.map((k) => [
                      k,
                      surveyorAttr.get(k) || "—",
                      bySurveyor.get(k) || 0,
                      percent(bySurveyor.get(k) || 0, total),
                    ])}
                    totalRow={["合計", "", total, total ? "100%" : "—"]}
                  />
                </ReportSection>
              )}

              {sections.byCaseType && (
                <ReportSection title="依案件類型統計">
                  <SimpleCountTable
                    headers={["案件類型", "件數", "佔比"]}
                    rows={caseTypeKeys.map((k) => [k, byCaseType.get(k) || 0, percent(byCaseType.get(k) || 0, total)])}
                    totalRow={["合計", total, total ? "100%" : "—"]}
                  />
                </ReportSection>
              )}

              {sections.byTownship && (
                <ReportSection title="依地區統計">
                  <SimpleCountTable
                    headers={["地區", "件數", "佔比"]}
                    rows={townshipKeys.map((k) => [k, byTownship.get(k) || 0, percent(byTownship.get(k) || 0, total)])}
                    totalRow={["合計", total, total ? "100%" : "—"]}
                  />
                  {byTownship.get(UNKNOWN_TOWNSHIP) ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      「{UNKNOWN_TOWNSHIP}」為地段地號無法對應到苑裡鎮或通霄鎮地段的案件。
                    </p>
                  ) : null}
                </ReportSection>
              )}

              {sections.surveyorByCaseType && (
                <ReportSection title="測量員 × 案件類型">
                  <CrossTable
                    rowLabel="測量員"
                    rowKeys={surveyorKeys}
                    colKeys={caseTypeKeys}
                    counts={surveyorByCaseType}
                  />
                </ReportSection>
              )}

              {sections.surveyorByTownship && (
                <ReportSection title="測量員 × 地區">
                  <CrossTable
                    rowLabel="測量員"
                    rowKeys={surveyorKeys}
                    colKeys={townshipKeys}
                    counts={surveyorByTownship}
                  />
                </ReportSection>
              )}

              {sections.details && (
                <ReportSection title={`案件明細（${total} 筆）`}>
                  {total === 0 ? (
                    <p className="text-sm text-neutral-500">此區間沒有案件</p>
                  ) : (
                    <table className="report-table w-full text-xs">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>日期</th>
                          <th>時間</th>
                          <th>案號</th>
                          <th>類型</th>
                          <th>地段地號</th>
                          <th>地區</th>
                          <th>測量員</th>
                          <th>所有權人</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportCases.map((c, i) => (
                          <tr key={c.id}>
                            <td className="text-right">{i + 1}</td>
                            <td className="whitespace-nowrap">{c.surveyDate}</td>
                            <td>{c.scheduledTime}</td>
                            <td>{c.caseNumber}</td>
                            <td>{c.caseType}</td>
                            <td>{c.landParcel}</td>
                            <td className="whitespace-nowrap">{getTownship(c.landParcel)}</td>
                            <td className="whitespace-nowrap">{surveyorOf(c)}</td>
                            <td>{c.owner || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ReportSection>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
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
