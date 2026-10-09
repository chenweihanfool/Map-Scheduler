import { TOWNSHIPS, findLandSection } from "@shared/land-sections";

export const UNKNOWN_TOWNSHIP = "其他／未判定";

// 由地段地號判斷所屬鄉鎮：先看開頭的鄉鎮名，沒有的話用段名對照
export function getTownship(landParcel: string | null | undefined): string {
  const text = (landParcel || "").trim();
  if (!text) return UNKNOWN_TOWNSHIP;
  const prefix = TOWNSHIPS.find((t) => text.startsWith(t));
  if (prefix) return prefix;
  return findLandSection(text)?.township ?? UNKNOWN_TOWNSHIP;
}
