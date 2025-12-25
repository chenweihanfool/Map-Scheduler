// Coordinate fetching service for Taiwan land parcel lookup
// Uses NLSC (National Land Surveying and Mapping Center)
// API Reference: https://github.com/g0v/posland

import { storage } from "./storage";

interface CoordinateResult {
  longitude: number;
  latitude: number;
  source: string;
}

// Section mapping for Miaoli County (苗栗縣)
// Format: { "section_name": { office: "office_code", sect: "section_code" } }
const MIAOLI_SECTIONS: Record<string, { office: string; sect: string }> = {
  // 苗栗市
  "中正段": { office: "HA", sect: "0301" },
  "嘉盛段": { office: "HA", sect: "0302" },
  "維祥段": { office: "HA", sect: "0303" },
  "文山段": { office: "HA", sect: "0401" },
  "玉清段": { office: "HA", sect: "0402" },
  "福星段": { office: "HA", sect: "0403" },
  "恭敬段": { office: "HA", sect: "0501" },
  "新英段": { office: "HA", sect: "0502" },
  "建功段": { office: "HA", sect: "0601" },
  // 苑裡鎮
  "苑東段": { office: "HA", sect: "1101" },
  "苑西段": { office: "HA", sect: "1102" },
  "苑南段": { office: "HA", sect: "1103" },
  "苑北段": { office: "HA", sect: "1104" },
  "苑港段": { office: "HA", sect: "1105" },
  "苑坑段": { office: "HA", sect: "1106" },
  "苑中段": { office: "HA", sect: "1107" },
  "房裡段": { office: "HA", sect: "1201" },
  "社苓段": { office: "HA", sect: "1301" },
  // 通霄鎮
  "通霄段": { office: "HA", sect: "1401" },
  "白沙段": { office: "HA", sect: "1402" },
  "白東段": { office: "HA", sect: "1403" },
  "圳頭段": { office: "HA", sect: "1501" },
  "梅樹段": { office: "HA", sect: "1502" },
  "南和段": { office: "HA", sect: "1601" },
  // 竹南鎮
  "竹南段": { office: "HB", sect: "0101" },
  "頂埔段": { office: "HB", sect: "0102" },
  "大埔段": { office: "HB", sect: "0103" },
  "營盤段": { office: "HB", sect: "0201" },
  "新南段": { office: "HB", sect: "0202" },
  "港墘段": { office: "HB", sect: "0301" },
  "公義段": { office: "HB", sect: "0401" },
  // 頭份市
  "頭份段": { office: "HB", sect: "0501" },
  "蘆竹段": { office: "HB", sect: "0502" },
  "上埔段": { office: "HB", sect: "0601" },
  "尖山段": { office: "HB", sect: "0701" },
  "斗煥段": { office: "HB", sect: "0801" },
  // 後龍鎮
  "後龍段": { office: "HA", sect: "0701" },
  "龍坑段": { office: "HA", sect: "0702" },
  "校椅段": { office: "HA", sect: "0801" },
  "大山段": { office: "HA", sect: "0802" },
  "灣瓦段": { office: "HA", sect: "0901" },
  "海埔段": { office: "HA", sect: "1001" },
  // 三義鄉
  "三義段": { office: "HA", sect: "2101" },
  "廣盛段": { office: "HA", sect: "2102" },
  "雙連段": { office: "HA", sect: "2201" },
  // 銅鑼鄉
  "銅鑼段": { office: "HA", sect: "1801" },
  "中平段": { office: "HA", sect: "1802" },
  "新隆段": { office: "HA", sect: "1901" },
  // 公館鄉
  "公館段": { office: "HA", sect: "2301" },
  "福基段": { office: "HA", sect: "2302" },
  "石圍段": { office: "HA", sect: "2401" },
  // 大湖鄉
  "大湖段": { office: "HA", sect: "2501" },
  "南湖段": { office: "HA", sect: "2502" },
  "東興段": { office: "HA", sect: "2601" },
  // 頭屋鄉
  "頭屋段": { office: "HA", sect: "2001" },
  "曲洞段": { office: "HA", sect: "2002" },
  // 造橋鄉
  "造橋段": { office: "HB", sect: "0901" },
  "談文段": { office: "HB", sect: "1001" },
  "平興段": { office: "HB", sect: "1101" },
  // 西湖鄉
  "西湖段": { office: "HA", sect: "1701" },
  "五湖段": { office: "HA", sect: "1702" },
  // 三灣鄉
  "三灣段": { office: "HB", sect: "1201" },
  "大河段": { office: "HB", sect: "1301" },
  // 南庄鄉
  "南庄段": { office: "HB", sect: "1401" },
  "田美段": { office: "HB", sect: "1501" },
  // 獅潭鄉
  "獅潭段": { office: "HA", sect: "2701" },
  "新店段": { office: "HA", sect: "2702" },
  // 卓蘭鎮
  "卓蘭段": { office: "HA", sect: "2801" },
  "內灣段": { office: "HA", sect: "2802" },
  // 泰安鄉
  "泰安段": { office: "HA", sect: "2901" },
  "錦水段": { office: "HA", sect: "2902" },
};

// Parse land parcel string to extract section name and parcel number
// Format examples: "苑裡鎮苑東段203地號", "苗栗市中正段123-1地號"
function parseLandParcel(landParcel: string): { section: string; landno: string } | null {
  // Extract section name (ends with 段) and land number
  const patterns = [
    // Pattern: 鄉鎮市 + 段名 + 地號
    /(?:[\u4e00-\u9fa5]+[鄉鎮市區])?([一二三四五六七八九十\u4e00-\u9fa5]+段)(\d+(?:-\d+)?)\s*(?:地號)?/,
    // Pattern: just 段名 + 地號
    /([一二三四五六七八九十\u4e00-\u9fa5]+段)(\d+(?:-\d+)?)\s*(?:地號)?/,
  ];

  for (const pattern of patterns) {
    const match = landParcel.match(pattern);
    if (match) {
      return {
        section: match[1],
        landno: match[2].replace("-", "-"),
      };
    }
  }

  return null;
}

// Format land number for API (e.g., "203" -> "02030000", "123-1" -> "01230001")
function formatLandNo(landno: string): string {
  const parts = landno.split("-");
  const mainNo = parts[0].padStart(4, "0");
  const subNo = parts[1] ? parts[1].padStart(4, "0") : "0000";
  return mainNo + subNo;
}

// Lookup coordinates from NLSC API
async function lookupNLSC(landParcel: string): Promise<CoordinateResult | null> {
  const parsed = parseLandParcel(landParcel);
  if (!parsed) {
    console.log(`Failed to parse land parcel: ${landParcel}`);
    return null;
  }

  const sectionInfo = MIAOLI_SECTIONS[parsed.section];
  if (!sectionInfo) {
    console.log(`Section not found in mapping: ${parsed.section}`);
    return null;
  }

  const formattedLandNo = formatLandNo(parsed.landno);
  
  // NLSC API endpoint
  const url = `https://landmaps.nlsc.gov.tw/S_Maps/qryTileMapIndex?flag=2&office=${sectionInfo.office}&sect=${sectionInfo.sect}&landno=${formattedLandNo}`;
  
  console.log(`Querying NLSC API: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://maps.nlsc.gov.tw/",
      },
    });

    if (!response.ok) {
      console.log(`NLSC API returned status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // The API returns an array, the coordinate info is in the second element
    if (Array.isArray(data) && data.length >= 2 && data[1] && data[1].cx && data[1].cy) {
      const coords = data[1];
      console.log(`NLSC API returned coordinates: cx=${coords.cx}, cy=${coords.cy}`);
      return {
        longitude: coords.cx,
        latitude: coords.cy,
        source: "NLSC",
      };
    }

    console.log(`NLSC API response did not contain coordinates:`, JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error) {
    console.error(`NLSC API error:`, error);
    return null;
  }
}

// Alternative: try to lookup using another endpoint format
async function lookupNLSCAlt(landParcel: string): Promise<CoordinateResult | null> {
  const parsed = parseLandParcel(landParcel);
  if (!parsed) return null;

  const sectionInfo = MIAOLI_SECTIONS[parsed.section];
  if (!sectionInfo) return null;

  const formattedLandNo = formatLandNo(parsed.landno);
  
  // Alternative NLSC endpoint format
  const landCode = sectionInfo.office + sectionInfo.sect + formattedLandNo;
  const url = `https://easymap.land.moi.gov.tw/W09Map/setLocateByCadastre?cadasno=${landCode}`;
  
  console.log(`Trying alternative NLSC endpoint: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data && data.X && data.Y) {
      console.log(`Alternative API returned coordinates: X=${data.X}, Y=${data.Y}`);
      return {
        longitude: data.X,
        latitude: data.Y,
        source: "NLSC EasyMap",
      };
    }

    return null;
  } catch (error) {
    console.error(`Alternative NLSC API error:`, error);
    return null;
  }
}

// Main coordinate lookup function - tries multiple sources
export async function lookupCoordinates(landParcel: string): Promise<CoordinateResult | null> {
  console.log(`Looking up coordinates for: ${landParcel}`);
  
  // Try NLSC first
  let result = await lookupNLSC(landParcel);
  if (result) return result;

  // Try alternative endpoint
  result = await lookupNLSCAlt(landParcel);
  if (result) return result;

  console.log(`No coordinates found for: ${landParcel}`);
  return null;
}

// Process coordinate lookup for a case (async, updates database)
export async function processCoordinateLookup(caseId: string): Promise<void> {
  try {
    const surveyCase = await storage.getCase(caseId);
    if (!surveyCase) {
      console.error(`Case ${caseId} not found`);
      return;
    }

    // Mark as processing
    await storage.updateCaseCoordinates(caseId, null, null, "processing");

    // Attempt coordinate lookup
    const result = await lookupCoordinates(surveyCase.landParcel);

    if (result) {
      await storage.updateCaseCoordinates(
        caseId,
        result.longitude,
        result.latitude,
        "success",
        result.source
      );
      console.log(`Coordinates found for case ${caseId}: ${result.longitude}, ${result.latitude} (${result.source})`);
    } else {
      await storage.updateCaseCoordinates(caseId, null, null, "failed");
      console.log(`No coordinates found for case ${caseId}`);
    }
  } catch (error) {
    console.error(`Error processing coordinates for case ${caseId}:`, error);
    await storage.updateCaseCoordinates(caseId, null, null, "failed");
  }
}
