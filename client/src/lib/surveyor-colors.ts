import { SURVEYOR_COLORS, type Surveyor, type SurveyorColor } from "@shared/schema";

// 測量員代表顏色：月曆案件標籤（chip）、首頁測量員卡片（card）、色塊（swatch）
// Tailwind 需要完整的 class 字串，所以逐一列出
export const COLOR_STYLES: Record<SurveyorColor, { label: string; chip: string; card: string; swatch: string }> = {
  blue:    { label: "藍", chip: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800", card: "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700", swatch: "bg-blue-500" },
  green:   { label: "綠", chip: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800", card: "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700", swatch: "bg-green-500" },
  purple:  { label: "紫", chip: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800", card: "bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700", swatch: "bg-purple-500" },
  orange:  { label: "橘", chip: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800", card: "bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700", swatch: "bg-orange-500" },
  pink:    { label: "粉紅", chip: "bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-800", card: "bg-pink-100 dark:bg-pink-900 border-pink-300 dark:border-pink-700", swatch: "bg-pink-500" },
  teal:    { label: "藍綠", chip: "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800", card: "bg-teal-100 dark:bg-teal-900 border-teal-300 dark:border-teal-700", swatch: "bg-teal-500" },
  amber:   { label: "琥珀", chip: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800", card: "bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700", swatch: "bg-amber-500" },
  indigo:  { label: "靛", chip: "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800", card: "bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700", swatch: "bg-indigo-500" },
  rose:    { label: "玫瑰", chip: "bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800", card: "bg-rose-100 dark:bg-rose-900 border-rose-300 dark:border-rose-700", swatch: "bg-rose-500" },
  cyan:    { label: "青", chip: "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800", card: "bg-cyan-100 dark:bg-cyan-900 border-cyan-300 dark:border-cyan-700", swatch: "bg-cyan-500" },
  lime:    { label: "萊姆", chip: "bg-lime-100 dark:bg-lime-900 text-lime-800 dark:text-lime-200 border-lime-300 dark:border-lime-800", card: "bg-lime-100 dark:bg-lime-900 border-lime-400 dark:border-lime-700", swatch: "bg-lime-500" },
  red:     { label: "紅", chip: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800", card: "bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700", swatch: "bg-red-600" },
  sky:     { label: "天藍", chip: "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800", card: "bg-sky-100 dark:bg-sky-900 border-sky-300 dark:border-sky-700", swatch: "bg-sky-400" },
  fuchsia: { label: "洋紅", chip: "bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-200 dark:border-fuchsia-800", card: "bg-fuchsia-100 dark:bg-fuchsia-900 border-fuchsia-300 dark:border-fuchsia-700", swatch: "bg-fuchsia-500" },
  yellow:  { label: "黃", chip: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-800", card: "bg-yellow-100 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-700", swatch: "bg-yellow-400" },
  slate:   { label: "灰", chip: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700", card: "bg-slate-200 dark:bg-slate-800 border-slate-400 dark:border-slate-600", swatch: "bg-slate-500" },
};

// 沒選顏色的測量員，依清單順序用前 10 種
const DEFAULT_ORDER: SurveyorColor[] = ["blue", "green", "purple", "orange", "pink", "teal", "amber", "indigo", "rose", "cyan"];

export function surveyorColorKey(s: Pick<Surveyor, "color">, index: number): SurveyorColor {
  return (SURVEYOR_COLORS as readonly string[]).includes(s.color ?? "") ? (s.color as SurveyorColor) : DEFAULT_ORDER[index % DEFAULT_ORDER.length];
}

export const surveyorColorStyle = (s: Pick<Surveyor, "color">, index: number) => COLOR_STYLES[surveyorColorKey(s, index)];
