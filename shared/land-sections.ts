// 通霄地政事務所（KC）轄區地段：苑裡鎮、通霄鎮
// 新增案件的地段選單、報表地區判斷、座標查詢共用這一份。
// 1104 以前的段代碼來自 g0v/posland section.json；1111、1116、1117 為使用者提供。
// 段代碼 1106–1110、1112–1115 目前缺資料，若有新的段請依代碼補進來。
export interface LandSection {
  code: string;     // 段代碼（4 碼）
  name: string;     // 段名（含小段）
  township: string; // 鄉鎮
}

export const LAND_OFFICE_CODE = "KC";

export const TOWNSHIPS = ["苑裡鎮", "通霄鎮"] as const;

export const LAND_SECTIONS: LandSection[] = [
  { code: "0300", name: "苑裡段北勢小段", township: "苑裡鎮" },
  { code: "0301", name: "苑裡段苑裡小段", township: "苑裡鎮" },
  { code: "0306", name: "苑裡坑段水柳坡小段", township: "苑裡鎮" },
  { code: "0308", name: "貓盂段貓盂小段", township: "苑裡鎮" },
  { code: "0309", name: "田寮段", township: "苑裡鎮" },
  { code: "0310", name: "舊社段", township: "苑裡鎮" },
  { code: "0311", name: "山腳段", township: "苑裡鎮" },
  { code: "0312", name: "大埔段青埔小段", township: "苑裡鎮" },
  { code: "0313", name: "大埔段大埔小段", township: "苑裡鎮" },
  { code: "0314", name: "芎蕉坑段", township: "苑裡鎮" },
  { code: "0315", name: "石頭坑段石頭坑小段", township: "苑裡鎮" },
  { code: "0316", name: "石頭坑段新厝子小段", township: "苑裡鎮" },
  { code: "0317", name: "南勢林段", township: "苑裡鎮" },
  { code: "0318", name: "社苓段公館子小段", township: "苑裡鎮" },
  { code: "0319", name: "社苓段社苓小段", township: "苑裡鎮" },
  { code: "0320", name: "山柑段山柑小段", township: "苑裡鎮" },
  { code: "0321", name: "山柑段山柑尾小段", township: "苑裡鎮" },
  { code: "0322", name: "房裡段", township: "苑裡鎮" },
  { code: "0354", name: "苑港段", township: "苑裡鎮" },
  { code: "0355", name: "西海段", township: "苑裡鎮" },
  { code: "0356", name: "房南段", township: "苑裡鎮" },
  { code: "0357", name: "苑東段", township: "苑裡鎮" },
  { code: "0358", name: "苑西段", township: "苑裡鎮" },
  { code: "0359", name: "苑南段", township: "苑裡鎮" },
  { code: "0360", name: "苑北段", township: "苑裡鎮" },
  { code: "0361", name: "苑中段", township: "苑裡鎮" },
  { code: "0362", name: "新興段", township: "苑裡鎮" },
  { code: "0363", name: "福田段", township: "苑裡鎮" },
  { code: "0364", name: "中正段", township: "苑裡鎮" },
  { code: "0365", name: "房北段", township: "苑裡鎮" },
  { code: "0366", name: "泰田段", township: "苑裡鎮" },
  { code: "0367", name: "社柑段", township: "苑裡鎮" },
  { code: "0368", name: "田中段", township: "苑裡鎮" },
  { code: "0369", name: "田心段", township: "苑裡鎮" },
  { code: "0370", name: "鎮安段", township: "苑裡鎮" },
  { code: "0375", name: "玉山段", township: "苑裡鎮" },
  { code: "0376", name: "玉豐段", township: "苑裡鎮" },
  { code: "0377", name: "文山段", township: "苑裡鎮" },
  { code: "0378", name: "新復北段", township: "苑裡鎮" },
  { code: "0379", name: "新復南段", township: "苑裡鎮" },
  { code: "0380", name: "新復東段", township: "苑裡鎮" },
  { code: "0387", name: "啟心段", township: "苑裡鎮" },
  { code: "0388", name: "上館段", township: "苑裡鎮" },
  { code: "0389", name: "火炎山段", township: "苑裡鎮" },
  { code: "0390", name: "慈護段", township: "苑裡鎮" },
  { code: "0391", name: "致民段", township: "苑裡鎮" },
  { code: "0392", name: "十股段", township: "苑裡鎮" },
  { code: "0393", name: "蕉埔段", township: "苑裡鎮" },
  { code: "0397", name: "藍田段", township: "苑裡鎮" },
  { code: "0399", name: "興隆段", township: "苑裡鎮" },
  { code: "1100", name: "苑坑段", township: "苑裡鎮" },
  { code: "1101", name: "中溝段", township: "苑裡鎮" },
  { code: "1102", name: "南山段", township: "苑裡鎮" },
  { code: "1103", name: "順天段", township: "苑裡鎮" },
  { code: "1111", name: "南勢林坑段", township: "苑裡鎮" },
  { code: "0323", name: "白沙屯段", township: "通霄鎮" },
  { code: "0324", name: "內湖島段", township: "通霄鎮" },
  { code: "0325", name: "新埔段", township: "通霄鎮" },
  { code: "0326", name: "上坪段", township: "通霄鎮" },
  { code: "0327", name: "北勢窩段", township: "通霄鎮" },
  { code: "0328", name: "烏眉坑段", township: "通霄鎮" },
  { code: "0329", name: "楓樹窩段", township: "通霄鎮" },
  { code: "0330", name: "內湖段", township: "通霄鎮" },
  { code: "0331", name: "圳頭段", township: "通霄鎮" },
  { code: "0332", name: "北勢段", township: "通霄鎮" },
  { code: "0335", name: "梅樹腳段", township: "通霄鎮" },
  { code: "0336", name: "土城段", township: "通霄鎮" },
  { code: "0337", name: "南和段", township: "通霄鎮" },
  { code: "0338", name: "福興段", township: "通霄鎮" },
  { code: "0339", name: "大坪頂段", township: "通霄鎮" },
  { code: "0341", name: "五里牌段隘口寮小段", township: "通霄鎮" },
  { code: "0343", name: "五里牌段五里牌小段", township: "通霄鎮" },
  { code: "0344", name: "五里牌段羊寮小段", township: "通霄鎮" },
  { code: "0345", name: "五里牌段五福小段", township: "通霄鎮" },
  { code: "0346", name: "通東段", township: "通霄鎮" },
  { code: "0347", name: "通西段", township: "通霄鎮" },
  { code: "0348", name: "通南段", township: "通霄鎮" },
  { code: "0349", name: "通北段", township: "通霄鎮" },
  { code: "0350", name: "竹林段", township: "通霄鎮" },
  { code: "0351", name: "平元段", township: "通霄鎮" },
  { code: "0352", name: "海濱段", township: "通霄鎮" },
  { code: "0353", name: "南華段", township: "通霄鎮" },
  { code: "0381", name: "白沙段", township: "通霄鎮" },
  { code: "0382", name: "白東段", township: "通霄鎮" },
  { code: "0383", name: "內島段", township: "通霄鎮" },
  { code: "0384", name: "雲天段", township: "通霄鎮" },
  { code: "0385", name: "通灣段", township: "通霄鎮" },
  { code: "0386", name: "通平段", township: "通霄鎮" },
  { code: "0394", name: "保安林段", township: "通霄鎮" },
  { code: "0395", name: "內湖東段", township: "通霄鎮" },
  { code: "0396", name: "內湖西段", township: "通霄鎮" },
  { code: "0398", name: "北梅段", township: "通霄鎮" },
  { code: "1104", name: "中山段", township: "通霄鎮" },
  { code: "1105", name: "五南段", township: "通霄鎮" },
  { code: "1116", name: "城南溪南段", township: "通霄鎮" },
  { code: "1117", name: "城北段", township: "通霄鎮" },
].sort((a, b) => a.code.localeCompare(b.code));

// 地段欄位存的格式是「鄉鎮 + 段名」，例如「苑裡鎮苑東段」
export function sectionLabel(section: LandSection): string {
  return `${section.township}${section.name}`;
}

// 長的段名先比對，避免短段名剛好是長段名的一部分時配錯
const BY_NAME_LENGTH = [...LAND_SECTIONS].sort((a, b) => b.name.length - a.name.length);

// 從地段地號字串找出對應的地段（例如「苑裡鎮苑東段184地號」→ 苑東段）
export function findLandSection(text: string | null | undefined): LandSection | undefined {
  const value = (text || "").trim();
  if (!value) return undefined;
  return BY_NAME_LENGTH.find((s) => value.includes(s.name));
}
