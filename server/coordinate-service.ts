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
// Data source: https://github.com/g0v/posland/blob/master/section.json
// Format: { "section_name": { office: "office_code", sect: "section_code" } }
const MIAOLI_SECTIONS: Record<string, { office: string; sect: string }> = {
  // 苑裡鎮 (K02) - Office: KC (通霄地政事務所)
  "苑裡段北勢小段": { office: "KC", sect: "0300" },
  "苑裡段苑裡小段": { office: "KC", sect: "0301" },
  "苑裡坑段水柳坡小段": { office: "KC", sect: "0306" },
  "貓盂段貓盂小段": { office: "KC", sect: "0308" },
  "田寮段": { office: "KC", sect: "0309" },
  "舊社段": { office: "KC", sect: "0310" },
  "山腳段": { office: "KC", sect: "0311" },
  "大埔段青埔小段": { office: "KC", sect: "0312" },
  "大埔段大埔小段": { office: "KC", sect: "0313" },
  "芎蕉坑段": { office: "KC", sect: "0314" },
  "石頭坑段石頭坑小段": { office: "KC", sect: "0315" },
  "石頭坑段新厝子小段": { office: "KC", sect: "0316" },
  "南勢林段": { office: "KC", sect: "0317" },
  "社苓段公館子小段": { office: "KC", sect: "0318" },
  "社苓段社苓小段": { office: "KC", sect: "0319" },
  "山柑段山柑小段": { office: "KC", sect: "0320" },
  "山柑段山柑尾小段": { office: "KC", sect: "0321" },
  "房裡段": { office: "KC", sect: "0322" },
  "苑港段": { office: "KC", sect: "0354" },
  "西海段": { office: "KC", sect: "0355" },
  "房南段": { office: "KC", sect: "0356" },
  "苑東段": { office: "KC", sect: "0357" },
  "苑西段": { office: "KC", sect: "0358" },
  "苑南段": { office: "KC", sect: "0359" },
  "苑北段": { office: "KC", sect: "0360" },
  "苑中段": { office: "KC", sect: "0361" },
  "新興段": { office: "KC", sect: "0362" },
  "福田段": { office: "KC", sect: "0363" },
  "中正段": { office: "KC", sect: "0364" },
  "房北段": { office: "KC", sect: "0365" },
  "泰田段": { office: "KC", sect: "0366" },
  "社柑段": { office: "KC", sect: "0367" },
  "田中段": { office: "KC", sect: "0368" },
  "田心段": { office: "KC", sect: "0369" },
  "鎮安段": { office: "KC", sect: "0370" },
  "玉山段": { office: "KC", sect: "0375" },
  "玉豐段": { office: "KC", sect: "0376" },
  "文山段": { office: "KC", sect: "0377" },
  "新復北段": { office: "KC", sect: "0378" },
  "新復南段": { office: "KC", sect: "0379" },
  "新復東段": { office: "KC", sect: "0380" },
  "啟心段": { office: "KC", sect: "0387" },
  "上館段": { office: "KC", sect: "0388" },
  "火炎山段": { office: "KC", sect: "0389" },
  "慈護段": { office: "KC", sect: "0390" },
  "致民段": { office: "KC", sect: "0391" },
  "十股段": { office: "KC", sect: "0392" },
  "蕉埔段": { office: "KC", sect: "0393" },
  "藍田段": { office: "KC", sect: "0397" },
  "興隆段": { office: "KC", sect: "0399" },
  "苑坑段": { office: "KC", sect: "1100" },
  "中溝段": { office: "KC", sect: "1101" },
  "南山段": { office: "KC", sect: "1102" },
  "順天段": { office: "KC", sect: "1103" },
  
  // 通霄鎮 (K03) - Office: KC (通霄地政事務所)
  "白沙屯段": { office: "KC", sect: "0323" },
  "內湖島段": { office: "KC", sect: "0324" },
  "新埔段": { office: "KC", sect: "0325" },
  "北勢窩段": { office: "KC", sect: "0327" },
  "烏眉坑段": { office: "KC", sect: "0328" },
  "楓樹窩段": { office: "KC", sect: "0329" },
  "內湖段": { office: "KC", sect: "0330" },
  "圳頭段": { office: "KC", sect: "0331" },
  "北勢段": { office: "KC", sect: "0332" },
  "梅樹腳段": { office: "KC", sect: "0335" },
  "土城段": { office: "KC", sect: "0336" },
  "南和段": { office: "KC", sect: "0337" },
  "福興段": { office: "KC", sect: "0338" },
  "大坪頂段": { office: "KC", sect: "0339" },
  "五里牌段隘口寮小段": { office: "KC", sect: "0341" },
  "五里牌段五里牌小段": { office: "KC", sect: "0343" },
  "五里牌段羊寮小段": { office: "KC", sect: "0344" },
  "五里牌段五福小段": { office: "KC", sect: "0345" },
  "通東段": { office: "KC", sect: "0346" },
  "通西段": { office: "KC", sect: "0347" },
  "通南段": { office: "KC", sect: "0348" },
  "通北段": { office: "KC", sect: "0349" },
  "竹林段": { office: "KC", sect: "0350" },
  "平元段": { office: "KC", sect: "0351" },
  "海濱段": { office: "KC", sect: "0352" },
  "南華段": { office: "KC", sect: "0353" },
  "白沙段": { office: "KC", sect: "0381" },
  "白東段": { office: "KC", sect: "0382" },
  "內島段": { office: "KC", sect: "0383" },
  "雲天段": { office: "KC", sect: "0384" },
  "通灣段": { office: "KC", sect: "0385" },
  "通平段": { office: "KC", sect: "0386" },
  "保安林段": { office: "KC", sect: "0394" },
  "內湖東段": { office: "KC", sect: "0395" },
  "內湖西段": { office: "KC", sect: "0396" },
  "北梅段": { office: "KC", sect: "0398" },
  "中山段": { office: "KC", sect: "1104" },
  "五南段": { office: "KC", sect: "1105" },
  
  // 苗栗市 (K01) - Office: KA (苗栗地政事務所)
  "嘉盛段": { office: "KA", sect: "0100" },
  "維祥段": { office: "KA", sect: "0101" },
  "建功段": { office: "KA", sect: "0102" },
  "玉清段": { office: "KA", sect: "0103" },
  "福星段": { office: "KA", sect: "0104" },
  "恭敬段": { office: "KA", sect: "0105" },
  "新英段": { office: "KA", sect: "0106" },
};

// Parse land parcel string to extract section name and parcel number
// Format examples: "苑裡鎮苑東段203地號", "苗栗市中正段123-1地號"
function parseLandParcel(landParcel: string): { section: string; landno: string } | null {
  // Extract section name (ends with 段) and land number
  const patterns = [
    // Pattern: 鄉鎮市 + 段名 + 地號
    /(?:[\u4e00-\u9fa5]+[鄉鎮市區])?([一二三四五六七八九十\u4e00-\u9fa5]+段(?:[一二三四五六七八九十\u4e00-\u9fa5]*小段)?)(\d+(?:-\d+)?)\s*(?:地號)?/,
    // Pattern: just 段名 + 地號
    /([一二三四五六七八九十\u4e00-\u9fa5]+段(?:[一二三四五六七八九十\u4e00-\u9fa5]*小段)?)(\d+(?:-\d+)?)\s*(?:地號)?/,
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
    console.log(`Available sections: ${Object.keys(MIAOLI_SECTIONS).slice(0, 10).join(", ")}...`);
    return null;
  }

  const formattedLandNo = formatLandNo(parsed.landno);
  
  // NLSC API endpoint - using the S_Maps service
  const url = `https://landmaps.nlsc.gov.tw/S_Maps/qryTileMapIndex?flag=2&office=${sectionInfo.office}&sect=${sectionInfo.sect}&landno=${formattedLandNo}`;
  
  console.log(`Querying NLSC API: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Referer": "https://maps.nlsc.gov.tw/",
        "Origin": "https://maps.nlsc.gov.tw",
      },
    });

    if (!response.ok) {
      console.log(`NLSC API returned status: ${response.status}`);
      return null;
    }

    const text = await response.text();
    console.log(`NLSC API raw response: ${text.substring(0, 500)}`);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log(`Failed to parse JSON response`);
      return null;
    }
    
    // The API returns an array - check first element for coordinates
    if (Array.isArray(data) && data.length >= 1 && data[0]) {
      const firstItem = data[0];
      
      // Check if it contains coordinates (cx, cy)
      if (firstItem.cx !== undefined && firstItem.cy !== undefined) {
        console.log(`NLSC API returned coordinates: cx=${firstItem.cx}, cy=${firstItem.cy}`);
        return {
          longitude: firstItem.cx,
          latitude: firstItem.cy,
          source: "NLSC",
        };
      }
      
      // Check for error message
      if (firstItem.msg) {
        console.log(`NLSC API error: ${firstItem.msg}`);
      }
    }

    console.log(`NLSC API response did not contain valid coordinates`);
    return null;
  } catch (error) {
    console.error(`NLSC API error:`, error);
    return null;
  }
}

// Main coordinate lookup function - tries multiple sources
export async function lookupCoordinates(landParcel: string): Promise<CoordinateResult | null> {
  console.log(`Looking up coordinates for: ${landParcel}`);
  
  // Try NLSC first
  const result = await lookupNLSC(landParcel);
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
