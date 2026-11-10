import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek, isSameMonth } from "date-fns";
import {
  CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Monitor, MoreHorizontal, Navigation, Pencil,
  Phone, Plus, RefreshCw, Users, CalendarOff, UserRound, Check, MapPin, CalendarClock,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { CaseFormDialog } from "@/components/case-form-dialog";
import { PostponeDialog, ChangePostponeDateDialog, useCancelPostpone } from "@/components/postpone-dialog";
import { useWorkdays } from "@/hooks/use-workdays";
import { surveyorColorKey, COLOR_STYLES } from "@/lib/surveyor-colors";
import { fmtDate } from "@/lib/date-style";
import { applicantText, caseLabel } from "@/lib/receive";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { isPostponed, isPostponePending, subsOf, type Agent, type SurveyCase, type Surveyor, type SurveyorLeave } from "@shared/schema";

// 手機版：以「我的排程」為主的 App 式介面。新增、編輯等功能保留但放在次要位置
const ME_KEY = "ms-me";
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
type Tab = "mine" | "month" | "all" | "more";

const readMe = () => { try { return localStorage.getItem(ME_KEY) ?? ""; } catch { return ""; } };
const saveMe = (v: string) => { try { localStorage.setItem(ME_KEY, v); } catch { /* 只影響這次 */ } };
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const timeOf = (t: string) => t.match(/\d{1,2}:\d{2}/)?.[0] ?? t;

function dayLabel(date: string, today: string) {
  const d = new Date(`${date}T00:00:00`), diff = Math.round((d.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  const md = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  return diff === 0 ? `今天・${md}` : diff === 1 ? `明天・${md}` : diff === 2 ? `後天・${md}` : md;
}

type Item = { kind: "case"; c: SurveyCase } | { kind: "leave"; l: SurveyorLeave };

export default function MobileHome() {
  const [me, setMeState] = useState(readMe);
  const setMe = (v: string) => { setMeState(v); saveMe(v); };
  const [tab, setTab] = useState<Tab>("mine");
  const [detail, setDetail] = useState<SurveyCase | null>(null);
  const [leaveDetail, setLeaveDetail] = useState<SurveyorLeave | null>(null);
  const [form, setForm] = useState<{ open: boolean; edit?: SurveyCase | null; kind?: "case" | "leave" }>({ open: false });
  const [fab, setFab] = useState(false);   // 右上角「＋」的選單
  const [postponeCase, setPostponeCase] = useState<SurveyCase | null>(null);
  const [changeDateCase, setChangeDateCase] = useState<SurveyCase | null>(null);
  const cancelPostpone = useCancelPostpone();
  const [pull, setPull] = useState(0);     // 下拉重新整理：目前拉了多少 px
  const pullStart = useRef<number | null>(null);
  const [month, setMonth] = useState(new Date());
  const today = iso(new Date());
  const [pickDay, setPickDay] = useState(today);

  const { data: cases = [], isFetching, refetch, dataUpdatedAt } = useQuery<SurveyCase[]>({ queryKey: ["/api/cases"] });
  const { data: surveyors = [] } = useQuery<Surveyor[]>({ queryKey: ["/api/surveyors"] });
  const { data: leaves = [] } = useQuery<SurveyorLeave[]>({ queryKey: ["/api/leaves"] });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["/api/agents"] });
  const { info: dayInfo } = useWorkdays();
  const who = me === "*" ? "" : me;   // "*" = 只看全部

  const colorOf = (name: string) => {
    const i = surveyors.findIndex((s) => s.name === name);
    return COLOR_STYLES[surveyorColorKey(surveyors[i] ?? { color: null }, Math.max(i, 0))];
  };
  const refresh = () => { refetch(); queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/leaves") }); };

  // 某人（或全部）在某天的案件與請假
  const itemsOn = (date: string, who: string): Item[] => {
    const cs = cases.filter((c) => c.surveyDate === date && (!who || c.surveyor === who))
      .sort((a, b) => timeOf(a.scheduledTime).localeCompare(timeOf(b.scheduledTime)));
    const ls = leaves.filter((l) => (!who || l.surveyorName === who) && l.startDatetime.slice(0, 10) <= date && l.endDatetime.slice(0, 10) >= date);
    return [...ls.map((l) => ({ kind: "leave", l }) as Item), ...cs.map((c) => ({ kind: "case", c }) as Item)];
  };

  // 接下來 60 天有東西的日子
  const upcoming = useMemo(() => {
    const out: { date: string; items: Item[] }[] = [];
    for (let i = 0; i < 60; i++) {
      const d = iso(addDays(new Date(), i)), items = itemsOn(d, who);
      if (items.length || i === 0) out.push({ date: d, items });
    }
    return out;
  }, [cases, leaves, who]);

  const nextCase = upcoming.flatMap((d) => d.items).find((x) => x.kind === "case" && !isPostponed(x.c) && (x.c.surveyDate > today || timeOf(x.c.scheduledTime) >= format(new Date(), "HH:mm"))) as { kind: "case"; c: SurveyCase } | undefined;
  const weekEnd = iso(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6));
  const countBetween = (a: string, b: string) => cases.filter((c) => (!who || c.surveyor === who) && !isPostponed(c) && c.surveyDate >= a && c.surveyDate <= b).length;

  // 月曆：每天用小圓點表示件數，請假標紅
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 }), out: Date[] = [];
    for (let d = start; d <= endOfMonth(month) || out.length % 7; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  if (!me) return <PickMe surveyors={surveyors} onPick={setMe} />;

  const latest = (c: SurveyCase) => cases.find((x) => x.id === c.id) ?? c;   // 背景更新後用最新內容
  const openEdit = (c: SurveyCase) => { setDetail(null); setForm({ open: true, edit: latest(c) }); };
  const openById = (id: string) => { const c = cases.find((x) => x.id === id); if (c) { setForm({ open: false }); setDetail(c); } };

  // 下拉重新整理（頁面在最上方時往下拉超過 64px 放開）
  const onTouchStart = (e: React.TouchEvent) => { pullStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStart.current == null) return;
    const d = e.touches[0].clientY - pullStart.current;
    setPull(d > 0 && window.scrollY <= 0 ? Math.min(96, d * 0.5) : 0);
  };
  const onTouchEnd = () => { if (pull >= 64) refresh(); setPull(0); pullStart.current = null; };
  const agentOf = (c: SurveyCase) => agents.find((a) => a.name === c.agent?.trim());

  const CaseCard = ({ c, showWho }: { c: SurveyCase; showWho?: boolean }) => {
    const col = colorOf(c.surveyor), pp = isPostponed(c);
    return (
      <button type="button" onClick={() => setDetail(c)} className={cn("w-full text-left flex gap-3 rounded-2xl bg-card p-3.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10 active:scale-[0.99] transition", pp && "opacity-55")} data-testid={`m-case-${c.id}`}>
        <div className="w-14 shrink-0 text-center">
          <div className="text-lg font-semibold tabular-nums leading-6">{timeOf(c.scheduledTime)}</div>
          <div className="text-[11px] text-muted-foreground">{Number(timeOf(c.scheduledTime).slice(0, 2)) < 12 ? "上午" : "下午"}</div>
        </div>
        <div className={cn("w-1 rounded-full shrink-0", col.swatch)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", col.chip)}>{c.caseType}</span>
            {pp && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{isPostponePending(c) ? "延期未排" : "已延期"}</span>}
            {subsOf(c).length > 0 && <span className="text-[11px] text-muted-foreground">連件 +{subsOf(c).length}</span>}
            {showWho && <span className="text-[11px] text-muted-foreground ml-auto">{c.surveyor}</span>}
          </div>
          <div className={cn("mt-1 font-medium leading-snug break-words", pp && "line-through")}>{c.landParcel}</div>
          <div className="mt-0.5 text-sm text-muted-foreground truncate">
            {[applicantText(c), c.agent && `代理 ${c.agent}`].filter(Boolean).join("・") || caseLabel(c)}
          </div>
        </div>
      </button>
    );
  };

  const LeaveCard = ({ l, showWho }: { l: SurveyorLeave; showWho?: boolean }) => (
    <button type="button" onClick={() => setLeaveDetail(l)} className="w-full text-left flex items-center gap-3 rounded-2xl bg-red-50 dark:bg-red-950/40 p-3 ring-1 ring-red-200/70 dark:ring-red-900">
      <CalendarOff className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 ml-1" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-red-700 dark:text-red-300">{l.leaveType || "休假"}{showWho ? `・${l.surveyorName}` : ""}</div>
        <div className="text-xs text-red-700/70 dark:text-red-300/70 truncate">{l.startDatetime.slice(5).replace("-", "/")} ~ {l.endDatetime.slice(5).replace("-", "/")}{l.reason ? `・${l.reason}` : ""}</div>
      </div>
    </button>
  );

  const DayBlock = ({ date, items, showWho }: { date: string; items: Item[]; showWho?: boolean }) => {
    const w = dayInfo(date);
    return (
      <section className="space-y-2">
        <h3 className="sticky top-[60px] z-10 -mx-4 px-4 py-1.5 bg-background/85 backdrop-blur text-sm font-semibold flex items-center gap-2">
          <span className={cn(date === today && "text-primary")}>{dayLabel(date, today)}</span>
          {w.label && <span className={cn("text-xs font-normal", w.workday ? "text-sky-600" : "text-red-500")}>{w.label}</span>}
          <span className="ml-auto text-xs font-normal text-muted-foreground">{items.filter((x) => x.kind === "case").length || ""}{items.some((x) => x.kind === "case") ? " 件" : ""}</span>
        </h3>
        {items.length === 0 && <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{w.workday ? "今天沒有排件" : "今天休息"}</div>}
        {items.map((x) => x.kind === "case" ? <CaseCard key={x.c.id} c={x.c} showWho={showWho} /> : <LeaveCard key={x.l.id} l={x.l} showWho={showWho} />)}
      </section>
    );
  };

  return (
    <div
      className="min-h-[100dvh] bg-background text-foreground"
      style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {pull > 0 && (
        <div className="fixed inset-x-0 z-40 flex justify-center pointer-events-none" style={{ top: `calc(env(safe-area-inset-top) + ${pull - 8}px)` }} data-testid="m-pull">
          <div className="rounded-full bg-card shadow-md ring-1 ring-black/10 px-3 py-1.5 text-xs flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" style={{ transform: `rotate(${pull * 4}deg)` }} />{pull >= 64 ? "放開更新" : "下拉更新"}
          </div>
        </div>
      )}
      {/* 頂部 */}
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border/50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="h-[60px] px-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">
              {fmtDate(new Date(), { weekday: true })}
              {dataUpdatedAt > 0 && <span className="ml-2 opacity-70" data-testid="m-updated">更新於 {format(dataUpdatedAt, "HH:mm")}</span>}
            </div>
            <div className="text-lg font-bold leading-tight truncate">
              {tab === "mine" ? (who ? `${who} 的排程` : "所有人的排程") : tab === "month" ? "月曆" : tab === "all" ? "大家的排程" : "更多"}
            </div>
          </div>
          <button type="button" onClick={refresh} className="h-10 w-10 rounded-full grid place-items-center hover:bg-muted" aria-label="重新整理" data-testid="m-refresh">
            <RefreshCw className={cn("h-5 w-5", isFetching && "animate-spin")} />
          </button>
          {/* 新增是次要功能：收在右上角，不擋住清單 */}
          <div className="relative">
            <button type="button" onClick={() => setFab(!fab)} className="h-10 w-10 rounded-full grid place-items-center bg-primary text-primary-foreground" aria-label="新增" data-testid="m-fab">
              <Plus className={cn("h-5 w-5 transition-transform", fab && "rotate-45")} />
            </button>
            {fab && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFab(false)} />
                <div className="absolute right-0 top-12 z-40 w-40 rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden" data-testid="m-add-menu">
                  <button type="button" onClick={() => { setFab(false); setForm({ open: true, kind: "case" }); }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm active:bg-muted"><ClipboardList className="h-4 w-4 text-primary" />新增案件</button>
                  <button type="button" onClick={() => { setFab(false); setForm({ open: true, kind: "leave" }); }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm border-t border-border/60 active:bg-muted"><CalendarOff className="h-4 w-4 text-red-600" />請假</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pt-3 space-y-5">
        {tab === "mine" && (
          <>
            {/* 摘要卡 */}
            <div className="rounded-3xl p-4 text-white bg-gradient-to-br from-[#1a78dc] to-[#0d5bb0] shadow-lg shadow-blue-500/20" data-testid="m-hero">
              <div className="flex gap-6">
                <div><div className="text-3xl font-bold tabular-nums">{countBetween(today, today)}</div><div className="text-xs text-white/80">今天</div></div>
                <div><div className="text-3xl font-bold tabular-nums">{countBetween(today, weekEnd)}</div><div className="text-xs text-white/80">本週剩下</div></div>
                <div><div className="text-3xl font-bold tabular-nums">{countBetween(today, iso(addDays(new Date(), 29)))}</div><div className="text-xs text-white/80">30 天內</div></div>
              </div>
              {nextCase && (
                <button type="button" onClick={() => setDetail(nextCase.c)} className="mt-4 w-full text-left rounded-2xl bg-white/15 p-3 backdrop-blur">
                  <div className="text-xs text-white/80">下一件・{dayLabel(nextCase.c.surveyDate, today)} {timeOf(nextCase.c.scheduledTime)}</div>
                  <div className="font-semibold mt-0.5 truncate">{nextCase.c.caseType}・{nextCase.c.landParcel}</div>
                </button>
              )}
            </div>
            {upcoming.map((d) => <DayBlock key={d.date} date={d.date} items={d.items} showWho={!who} />)}
            <p className="text-center text-xs text-muted-foreground pb-2">只顯示今天起 60 天內的排程</p>
          </>
        )}

        {tab === "month" && (
          <>
            <div className="rounded-3xl bg-card p-3 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between px-1 pb-2">
                <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="上個月"><ChevronLeft className="h-5 w-5" /></button>
                <div className="font-semibold">{fmtDate(month).replace(/\/\d+$/, "").replace("/", " 年 ")} 月</div>
                <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted" aria-label="下個月"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground pb-1">{WEEK.map((w) => <div key={w}>{w}</div>)}</div>
              <div className="grid grid-cols-7 gap-y-1">
                {monthDays.map((d) => {
                  const k = iso(d), items = itemsOn(k, who), n = items.filter((x) => x.kind === "case" && !isPostponed(x.c)).length, lv = items.some((x) => x.kind === "leave");
                  const wd = dayInfo(k), sel = k === pickDay;
                  return (
                    <button key={k} type="button" onClick={() => setPickDay(k)} className={cn("h-12 rounded-xl flex flex-col items-center justify-center", !isSameMonth(d, month) && "opacity-35", sel && "bg-primary text-primary-foreground")} data-testid={`m-day-${k}`}>
                      <span className={cn("text-sm tabular-nums", k === today && !sel && "text-primary font-bold", !wd.workday && !sel && "text-red-500")}>{d.getDate()}</span>
                      <span className="flex gap-0.5 h-1.5 mt-0.5">
                        {Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} className={cn("w-1.5 h-1.5 rounded-full", sel ? "bg-primary-foreground" : "bg-primary")} />)}
                        {lv && <i className={cn("w-1.5 h-1.5 rounded-full", sel ? "bg-primary-foreground" : "bg-red-500")} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <DayBlock date={pickDay} items={itemsOn(pickDay, who)} showWho={!who} />
          </>
        )}

        {tab === "all" && (
          upcoming.length ? Array.from({ length: 14 }, (_, i) => iso(addDays(new Date(), i))).map((d) => {
            const items = itemsOn(d, "");
            return items.length || d === today ? <DayBlock key={d} date={d} items={items} showWho /> : null;
          }) : null
        )}

        {tab === "more" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <div className="px-4 pt-4 pb-2 text-xs text-muted-foreground">我是</div>
              {[{ name: "*", label: "只看全部（不指定）" }, ...surveyors.map((s) => ({ name: s.name, label: s.name }))].map((o) => (
                <button key={o.name} type="button" onClick={() => setMe(o.name)} className="w-full flex items-center gap-3 px-4 py-3 border-t border-border/60 text-left active:bg-muted">
                  <UserRound className="h-5 w-5 text-muted-foreground" /><span className="flex-1">{o.label}</span>
                  {me === o.name && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
            <div className="rounded-3xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
              <MoreRow icon={<Plus className="h-5 w-5 text-primary" />} label="新增案件" onClick={() => setForm({ open: true, kind: "case" })} />
              <MoreRow icon={<CalendarOff className="h-5 w-5 text-red-600" />} label="登記請假" onClick={() => setForm({ open: true, kind: "leave" })} />
              <MoreRow icon={<Monitor className="h-5 w-5 text-muted-foreground" />} label="切換到電腦版畫面" onClick={() => { try { localStorage.setItem("ms-view", "desktop"); } catch { /* */ } location.reload(); }} />
            </div>
          </div>
        )}
      </main>

      {/* 底部分頁 */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur border-t border-border/60" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-4 h-16">
          {([
            ["mine", "我的", CalendarDays], ["month", "月曆", CalendarDays], ["all", "大家", Users], ["more", "更多", MoreHorizontal],
          ] as const).map(([k, label, Icon], i) => (
            <button key={k} type="button" onClick={() => { setTab(k); setFab(false); }} className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px]", tab === k ? "text-primary font-semibold" : "text-muted-foreground")} data-testid={`m-tab-${k}`}>
              {i === 0 ? <UserRound className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* 案件詳細（下方滑出） */}
      <Drawer open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DrawerContent className="max-h-[85dvh]">
          {detail && (
            <div className="overflow-y-auto px-5 pb-6" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="text-xl leading-snug">{detail.landParcel}</DrawerTitle>
                <DrawerDescription>{dayLabel(detail.surveyDate, today)} {timeOf(detail.scheduledTime)}・{detail.caseType}・{detail.surveyor}</DrawerDescription>
              </DrawerHeader>
              <dl className="grid grid-cols-[5rem_1fr] gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">案號</dt><dd>{caseLabel(detail)}{detail.receiveWord ? `（${detail.receiveWord}）` : ""}</dd>
                {detail.receiveDate && (<><dt className="text-muted-foreground">收件</dt><dd>{fmtDate(detail.receiveDate)}</dd></>)}
                {applicantText(detail) && (<><dt className="text-muted-foreground">申請人</dt><dd>{applicantText(detail)}</dd></>)}
                {detail.agent && (<><dt className="text-muted-foreground">代理人</dt><dd>{detail.agent}</dd></>)}
                {subsOf(detail).length > 0 && (<><dt className="text-muted-foreground">連件</dt><dd>{subsOf(detail).map((x) => `${x.caseNumber} ${x.landParcel}`).join("、")}</dd></>)}
                {isPostponed(detail) && (<><dt className="text-muted-foreground">延期</dt><dd>{detail.postponeReason || "（未填理由）"}{detail.postponedToDate ? `・改到 ${fmtDate(detail.postponedToDate)} ${detail.postponedToTime}` : "・尚未排日期"}</dd></>)}
                {detail.notes && (<><dt className="text-muted-foreground">備註</dt><dd className="whitespace-pre-wrap">{detail.notes}</dd></>)}
              </dl>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {detail.latitude && detail.longitude ? (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${detail.latitude},${detail.longitude}`} target="_blank" rel="noreferrer" className="rounded-2xl bg-primary text-primary-foreground py-3 flex flex-col items-center gap-1 text-sm font-medium">
                    <Navigation className="h-5 w-5" />導航
                  </a>
                ) : (
                  <div className="rounded-2xl bg-muted text-muted-foreground py-3 flex flex-col items-center gap-1 text-sm"><MapPin className="h-5 w-5" />無座標</div>
                )}
                {(() => { const a = agentOf(detail), tel = a?.mobile || a?.tel; return tel ? (
                  <a href={`tel:${tel.replace(/[^\d+#]/g, "")}`} className="rounded-2xl bg-emerald-600 text-white py-3 flex flex-col items-center gap-1 text-sm font-medium"><Phone className="h-5 w-5" />打給代理人</a>
                ) : <div className="rounded-2xl bg-muted text-muted-foreground py-3 flex flex-col items-center gap-1 text-sm"><Phone className="h-5 w-5" />無電話</div>; })()}
                {/* 延期：一般案件與「延期未排日期」可延期；延期後的新案件改成「更改延期日期」 */}
                {!isPostponed(detail) && detail.postponedFromId ? (
                  <button type="button" onClick={() => { const c = latest(detail); setDetail(null); setChangeDateCase(c); }} className="rounded-2xl bg-amber-500 text-white py-3 flex flex-col items-center gap-1 text-sm font-medium" data-testid="m-change-pp">
                    <CalendarClock className="h-5 w-5" />更改延期日期
                  </button>
                ) : !isPostponed(detail) || isPostponePending(detail) ? (
                  <button type="button" onClick={() => { const c = latest(detail); setDetail(null); setPostponeCase(c); }} className="rounded-2xl bg-amber-500 text-white py-3 flex flex-col items-center gap-1 text-sm font-medium" data-testid="m-postpone">
                    <CalendarClock className="h-5 w-5" />{isPostponePending(detail) ? "排定延期日期" : "延期"}
                  </button>
                ) : (
                  <div className="rounded-2xl bg-muted text-muted-foreground py-3 flex flex-col items-center gap-1 text-sm"><CalendarClock className="h-5 w-5" />已延期</div>
                )}
                <button type="button" onClick={() => openEdit(detail)} className="rounded-2xl bg-muted py-3 flex flex-col items-center gap-1 text-sm font-medium" data-testid="m-edit">
                  <Pencil className="h-5 w-5" />編輯
                </button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <Drawer open={!!leaveDetail} onOpenChange={(o) => { if (!o) setLeaveDetail(null); }}>
        <DrawerContent>
          {leaveDetail && (
            <div className="px-5 pb-8">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="text-red-600 dark:text-red-400">{leaveDetail.leaveType || "休假"}・{leaveDetail.surveyorName}</DrawerTitle>
                <DrawerDescription>{fmtDate(leaveDetail.startDatetime)} {leaveDetail.startDatetime.slice(11)} ~ {fmtDate(leaveDetail.endDatetime)} {leaveDetail.endDatetime.slice(11)}</DrawerDescription>
              </DrawerHeader>
              {leaveDetail.reason && <p className="text-sm">{leaveDetail.reason}</p>}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <CaseFormDialog
        open={form.open}
        onOpenChange={(o) => setForm(o ? form : { open: false })}
        editCase={form.edit ?? null}
        initialKind={form.kind}
        defaultSurveyor={!form.edit && form.kind !== "leave" && who ? who : undefined}
        onPostpone={(c) => setPostponeCase(c)}
        onOpenCase={openById}
        onChangePostponeDate={(c) => setChangeDateCase(c)}
        onCancelPostpone={(c) => cancelPostpone.mutate(c.id)}
      />
      <PostponeDialog open={!!postponeCase} onOpenChange={(o) => !o && setPostponeCase(null)} caseData={postponeCase} />
      <ChangePostponeDateDialog open={!!changeDateCase} onOpenChange={(o) => !o && setChangeDateCase(null)} caseData={changeDateCase} />
    </div>
  );
}

function MoreRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 border-border/60 text-left active:bg-muted">
      {icon}<span className="flex-1">{label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

// 第一次打開：選「我是誰」，之後只看自己的排程（在「更多」可以改）
function PickMe({ surveyors, onPick }: { surveyors: Surveyor[]; onPick: (v: string) => void }) {
  return (
    <div className="min-h-[100dvh] bg-background px-5 flex flex-col" style={{ paddingTop: "calc(48px + env(safe-area-inset-top))", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl shadow-md" />
      <h1 className="mt-5 text-2xl font-bold">你是哪一位？</h1>
      <p className="mt-1 text-sm text-muted-foreground">選好後首頁會只顯示你的排程，之後可以在「更多」更改。</p>
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {surveyors.map((s) => (
          <button key={s.id} type="button" onClick={() => onPick(s.name)} className="rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-black/5 dark:ring-white/10 active:scale-[0.98] transition" data-testid={`m-pick-${s.name}`}>
            <div className="font-semibold">{s.name}</div>
            <div className="text-xs text-muted-foreground">{s.businessAttribute}</div>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onPick("*")} className="mt-4 py-3 text-sm text-primary" data-testid="m-pick-all">只看全部，不指定</button>
    </div>
  );
}
