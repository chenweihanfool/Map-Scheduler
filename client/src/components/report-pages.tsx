import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/date-style";
import type { SurveyCase } from "@shared/schema";

// A3 橫向（420×297mm）在 96dpi 下的大小；畫面預覽、列印、PDF 都用同一份分頁
export const PAGE_W = 1587;
export const PAGE_H = 1122;
const PAD = 40;          // 頁面四周留白
const HEAD_H = 58;       // 每頁頁首（報表名稱、期間）
const FOOT_H = 26;       // 每頁頁尾（製表時間、頁碼）

export type DetailRow =
  | { kind: "month"; key: string; label: string; count: number }
  | { kind: "case"; key: string; no: number; c: SurveyCase; date: string; time: string; type: string; recvDate: string; recvWord: string;
      caseNo: string; section: string; lot: string; applicant: string; surveyor: string; postponed: boolean }
  | { kind: "sub"; key: string; type: string; caseNo: string; section: string; lot: string };

const COLS: { label: string; w?: number; cls?: string }[] = [
  { label: "#", w: 44, cls: "text-right" },
  { label: "排件日期", w: 128 },
  { label: "案件類型", w: 104 },
  { label: "收件日期", w: 96 },
  { label: "收件字", w: 96 },
  { label: "案號", w: 150 },
  { label: "地段", w: 170 },
  { label: "地號", w: 220 },
  { label: "申請人／法院" },
  { label: "測量員", w: 84 },
];

function DetailHead() {
  return (
    <thead>
      <tr>
        {COLS.map((c) => (
          <th key={c.label} style={c.w ? { width: c.w } : undefined} className={cn("text-left", c.cls)}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
}

function DetailTr({ r }: { r: DetailRow }) {
  if (r.kind === "month") {
    return (
      <tr className="rp-month">
        <td colSpan={COLS.length}>{r.label}<span className="ml-3 font-normal text-neutral-600">共 {r.count} 件</span></td>
      </tr>
    );
  }
  if (r.kind === "sub") {
    return (
      <tr className="rp-sub">
        <td />
        <td className="text-neutral-500">↳ 連件</td>
        <td>{r.type}</td>
        <td />
        <td />
        <td className="tabular-nums rp-no">{r.caseNo}</td>
        <td>{r.section}</td>
        <td>{r.lot}</td>
        <td />
        <td />
      </tr>
    );
  }
  return (
    <tr>
      <td className="text-right tabular-nums text-neutral-500">{r.no}</td>
      <td className="tabular-nums whitespace-nowrap">{r.date}<span className="ml-1.5 text-neutral-600">{r.time}</span></td>
      <td>{r.type}{r.postponed && <span className="ml-1 text-amber-700">（延期）</span>}</td>
      <td className="tabular-nums whitespace-nowrap">{r.recvDate}</td>
      <td className="whitespace-nowrap">{r.recvWord}</td>
      <td className="tabular-nums rp-no">{r.caseNo}</td>
      <td>{r.section}</td>
      <td>{r.lot}</td>
      <td>{r.applicant}</td>
      <td className="whitespace-nowrap">{r.surveyor}</td>
    </tr>
  );
}

interface ReportPagesProps {
  title: string;
  period: string;
  filters?: string;
  summaryPages: React.ReactNode[];   // 第一頁起的統計頁，每個元素一頁
  rows: DetailRow[];
  detailTitle: string;
}

// 分頁好的 A3 報表：先在畫面外量每一列的高度，再依可用高度分頁（每頁重複表頭）
export const ReportPages = forwardRef<HTMLDivElement, ReportPagesProps>(function ReportPages(
  { title, period, filters, summaryPages, rows, detailTitle },
  ref,
) {
  const measureRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<{ head: number; title: number; rows: number[] } | null>(null);
  const [scale, setScale] = useState(1);
  const [fontsTick, setFontsTick] = useState(0);
  const printedAt = useMemo(() => `${fmtDate(new Date())} ${new Date().toTimeString().slice(0, 5)}`, [rows]);

  useEffect(() => { document.fonts?.ready.then(() => setFontsTick((n) => n + 1)); }, []);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const head = el.querySelector("thead")?.getBoundingClientRect().height ?? 30;
    const t = (el.querySelector(".rp-detail-title") as HTMLElement | null)?.getBoundingClientRect().height ?? 30;
    const hs = Array.from(el.querySelectorAll("tbody tr")).map((tr) => tr.getBoundingClientRect().height);
    setHeights({ head, title: t, rows: hs });
  }, [rows, fontsTick]);

  // 預覽縮放到容器寬度
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(Math.min(1, (box.clientWidth - 2) / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const detailPages = useMemo(() => {
    if (!heights || !rows.length) return [] as DetailRow[][];
    // 內容區上方留白 12px（pt-3），再多留幾 px 避免表格框線誤差
    const body = PAGE_H - PAD * 2 - HEAD_H - FOOT_H - heights.head - 12 - 6;
    const pages: DetailRow[][] = [];
    let cur: DetailRow[] = [], used = heights.title;   // 明細第一頁有小標題
    rows.forEach((r, i) => {
      const h = heights.rows[i] ?? 26;
      // 月份列不要落在頁尾：放不下它加下一列就換頁
      const need = r.kind === "month" ? h + (heights.rows[i + 1] ?? 26) : h;
      if (cur.length && used + need > body) { pages.push(cur); cur = []; used = 0; }
      cur.push(r); used += h;
    });
    if (cur.length) pages.push(cur);
    return pages;
  }, [heights, rows]);

  const total = summaryPages.length + detailPages.length;

  const page = (key: string, n: number, children: React.ReactNode) => (
    <div key={key} className="rp-wrap" style={{ height: PAGE_H * scale + 16 }}>
      <div className="rp-scale" style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W }}>
        <div className="rp-page bg-white text-neutral-900 shadow-md" style={{ width: PAGE_W, height: PAGE_H, padding: PAD }} data-testid={`report-page-${n}`}>
          <div className="flex items-end justify-between border-b-2 border-neutral-800 pb-2" style={{ height: HEAD_H }}>
            <div>
              <div className="text-2xl font-bold tracking-wide">{title}</div>
              <div className="text-sm text-neutral-600">{period}{filters ? `　篩選：${filters}` : ""}</div>
            </div>
            <div className="text-sm text-neutral-600 tabular-nums">第 {n} / {total} 頁</div>
          </div>
          <div style={{ height: PAGE_H - PAD * 2 - HEAD_H - FOOT_H }} className="overflow-hidden pt-3">{children}</div>
          <div className="flex justify-between items-end text-xs text-neutral-500" style={{ height: FOOT_H }}>
            <span>製表時間：{printedAt}</span>
            <span className="tabular-nums">第 {n} / {total} 頁</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={boxRef} className="w-full">
      {/* 量高度用，不顯示也不列印 */}
      <div ref={measureRef} aria-hidden className="print:hidden" style={{ position: "absolute", left: -99999, top: 0, width: PAGE_W - PAD * 2, visibility: "hidden" }}>
        <div className="rp-detail-title text-base font-semibold pb-2">{detailTitle}</div>
        <table className="report-table rp-detail w-full"><DetailHead /><tbody>{rows.map((r) => <DetailTr key={r.key} r={r} />)}</tbody></table>
      </div>

      <div ref={ref} className="rp-pages">
        {summaryPages.map((content, i) => page(`s${i}`, i + 1, content))}
        {detailPages.map((list, i) => page(`d${i}`, summaryPages.length + i + 1, (
          <>
            {i === 0 && <div className="rp-detail-title text-base font-semibold pb-2">{detailTitle}</div>}
            <table className="report-table rp-detail w-full">
              <DetailHead />
              <tbody>{list.map((r) => <DetailTr key={r.key} r={r} />)}</tbody>
            </table>
          </>
        )))}
      </div>
    </div>
  );
});

// 下載 PDF：每頁轉成圖片放進 A3 橫向 PDF（中文字型不用另外嵌入，畫面看到什麼就輸出什麼）
export async function downloadReportPdf(container: HTMLElement, filename: string, onProgress?: (done: number, total: number) => void) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const wraps = Array.from(container.querySelectorAll<HTMLElement>(".rp-wrap"));
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
  for (let i = 0; i < wraps.length; i++) {
    onProgress?.(i, wraps.length);
    const target = wraps[i];
    const canvas = await html2canvas(target.querySelector<HTMLElement>(".rp-page")!, {
      scale: 1.6,   // A3 約 180dpi，文字清楚、檔案不會太大
      backgroundColor: "#ffffff",
      logging: false,
      // 只複製這一頁（其他頁和量高度用的表格略過），速度快很多
      ignoreElements: (el) => (el.classList?.contains("rp-wrap") && el !== target) || el.getAttribute?.("aria-hidden") === "true" && !!el.querySelector?.(".rp-detail-title"),
      // 畫面上是縮小預覽，截圖時還原成原尺寸
      onclone: (doc) => {
        doc.querySelectorAll<HTMLElement>(".rp-scale").forEach((e) => { e.style.transform = "none"; });
        // html2canvas 畫中文字會比實際位置低幾 px、壓到格線：表格上下留白對調一點來抵銷（列高不變）
        const st = doc.createElement("style");
        st.textContent = ".rp-page .report-table th,.rp-page .report-table td{padding-top:1px!important;padding-bottom:7px!important}";
        doc.head.appendChild(st);
      },
    });
    if (i > 0) pdf.addPage("a3", "landscape");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.8), "JPEG", 0, 0, 420, 297, undefined, "FAST");
    await new Promise((r) => setTimeout(r, 0));   // 讓畫面更新進度
  }
  onProgress?.(wraps.length, wraps.length);
  // 用自己的下載連結，確保檔名正確
  const url = URL.createObjectURL(pdf.output("blob"));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
