// 代理人資訊的初始資料：來自「測量案件排程」的代理人通訊錄。
// 只在代理人資料表是空的時候放入一次（見 server/schema-upgrade.ts），之後在系統設定裡維護。
export const AGENT_SEED: { name: string; tel: string; fax: string; mobile: string }[] = [
  { name: "吳月雲", tel: "863521", fax: "863521", mobile: "" },
  { name: "林束靜", tel: "37868116", fax: "37860166", mobile: "" },
  { name: "林汶賢", tel: "", fax: "", mobile: "0925-317569" },
  { name: "孫詠聖", tel: "758062", fax: "", mobile: "" },
  { name: "許宏誠", tel: "", fax: "", mobile: "" },
  { name: "陳喜燕", tel: "866493", fax: "854653", mobile: "" },
  { name: "彭桂容", tel: "", fax: "", mobile: "" },
  { name: "鄭永進", tel: "", fax: "", mobile: "" },
  { name: "鄭碧針", tel: "868386", fax: "851995", mobile: "" },
  { name: "鄭麗卿", tel: "759811", fax: "", mobile: "" },
  { name: "盧淑美", tel: "0426871211", fax: "0426879324", mobile: "" },
  { name: "林秀美", tel: "0910322287", fax: "", mobile: "" },
  { name: "鄭逸真/鄭勝田", tel: "863756", fax: "863756", mobile: "" },
  { name: "黃秋蓮", tel: "757585", fax: "", mobile: "" },
  { name: "潘亭君", tel: "374560", fax: "373817", mobile: "0934-130609" },
  { name: "劉興政", tel: "350668#109", fax: "", mobile: "0912-309018" },
  { name: "建管鄭成峰", tel: "559184", fax: "", mobile: "" },
];
