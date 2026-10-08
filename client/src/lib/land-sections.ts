// 地段清單（依鄉鎮分組），新增案件表單與報表的地區統計共用
export const LAND_SECTIONS = [
  { township: "苑裡鎮", sections: [
    "苑裡段北勢小段", "苑裡段苑裡小段", "苑裡坑段水柳坡小段", "貓盂段貓盂小段",
    "田寮段", "舊社段", "山腳段", "大埔段青埔小段", "大埔段大埔小段", "芎蕉坑段",
    "石頭坑段石頭坑小段", "石頭坑段新厝子小段", "南勢林段", "社苓段公館子小段", "社苓段社苓小段",
    "山柑段山柑小段", "山柑段山柑尾小段", "房裡段", "苑港段", "西海段", "房南段",
    "苑東段", "苑西段", "苑南段", "苑北段", "苑中段", "新興段", "福田段", "中正段",
    "房北段", "泰田段", "社柑段", "田中段", "田心段", "鎮安段", "玉山段", "玉豐段",
    "文山段", "新復北段", "新復南段", "新復東段", "啟心段", "上館段", "火炎山段",
    "慈護段", "致民段", "十股段", "蕉埔段", "藍田段", "興隆段", "苑坑段", "中溝段",
    "南山段", "順天段"
  ]},
  { township: "通霄鎮", sections: [
    "白沙屯段", "內湖島段", "新埔段", "上坪段", "北勢窩段", "烏眉坑段", "楓樹窩段", "內湖段",
    "圳頭段", "北勢段", "梅樹腳段", "土城段", "南和段", "福興段", "大坪頂段",
    "五里牌段隘口寮小段", "五里牌段五里牌小段", "五里牌段羊寮小段", "五里牌段五福小段",
    "通東段", "通西段", "通南段", "通北段", "竹林段", "平元段", "海濱段", "南華段",
    "白沙段", "白東段", "內島段", "雲天段", "通灣段", "通平段", "保安林段",
    "內湖東段", "內湖西段", "北梅段", "中山段", "五南段"
  ]},
];

export const UNKNOWN_TOWNSHIP = "其他／未判定";

// 長的段名先比對，避免「內湖段」先吃掉「內湖東段」這類情況
const SECTION_LOOKUP = LAND_SECTIONS
  .flatMap((group) => group.sections.map((section) => ({ section, township: group.township })))
  .sort((a, b) => b.section.length - a.section.length);

// 由地段地號判斷所屬鄉鎮：先看開頭的鄉鎮名，沒有的話用段名對照
export function getTownship(landParcel: string | null | undefined): string {
  const text = (landParcel || "").trim();
  if (!text) return UNKNOWN_TOWNSHIP;
  const prefix = text.match(/^([一-龥]{1,3}[鄉鎮市區])/);
  if (prefix && LAND_SECTIONS.some((group) => group.township === prefix[1])) {
    return prefix[1];
  }
  const hit = SECTION_LOOKUP.find((entry) => text.includes(entry.section));
  return hit ? hit.township : UNKNOWN_TOWNSHIP;
}
