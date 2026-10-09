// Coordinate fetching service for Taiwan land parcel lookup
// Uses NLSC (National Land Surveying and Mapping Center)
// API Reference: https://github.com/g0v/posland

import { storage } from "./storage";
import { LAND_SECTIONS, LAND_OFFICE_CODE, findLandSection } from "@shared/land-sections";

interface CoordinateResult {
  longitude: number;
  latitude: number;
  source: string;
}

// Section mapping for Miaoli County (苗栗縣)
// Data source: https://github.com/g0v/posland/blob/master/section.json
// Format: { "section_name": { office: "office_code", sect: "section_code" } }
const MIAOLI_SECTIONS: Record<string, { office: string; sect: string }> = {
  // 苑裡鎮、通霄鎮 (Office: KC 通霄地政事務所) 由 shared/land-sections.ts 產生
  ...Object.fromEntries(
    LAND_SECTIONS.map((s) => [s.name, { office: LAND_OFFICE_CODE, sect: s.code }]),
  ),

  // 苗栗市 (K01) - Office: KA (苗栗地政事務所)
  "嘉盛段": { office: "KA", sect: "0100" },
  "維祥段": { office: "KA", sect: "0101" },
  "建功段": { office: "KA", sect: "0102" },
  "玉清段": { office: "KA", sect: "0103" },
  "福星段": { office: "KA", sect: "0104" },
  "恭敬段": { office: "KA", sect: "0105" },
  "新英段": { office: "KA", sect: "0106" },
};

// The regex can split names like "苑裡鎮鎮安段" at the wrong 鎮, so fall back to
// matching known section names against the whole string
function resolveSection(section: string, landParcel: string): { office: string; sect: string } | undefined {
  const known = findLandSection(landParcel);
  return MIAOLI_SECTIONS[section] ?? (known ? MIAOLI_SECTIONS[known.name] : undefined);
}

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

  const sectionInfo = resolveSection(parsed.section, landParcel);
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

// Lookup coordinates from Miaoli County GIS
async function lookupMiaoliGIS(landParcel: string): Promise<CoordinateResult | null> {
  const parsed = parseLandParcel(landParcel);
  if (!parsed) {
    console.log(`Failed to parse land parcel for Miaoli GIS: ${landParcel}`);
    return null;
  }

  const sectionInfo = resolveSection(parsed.section, landParcel);
  if (!sectionInfo) {
    console.log(`Section not found for Miaoli GIS: ${parsed.section}`);
    return null;
  }

  const formattedLandNo = formatLandNo(parsed.landno);
  
  // Miaoli County GIS API
  const url = `https://gis.miaoli.gov.tw/api/land/query?office=${sectionInfo.office}&sect=${sectionInfo.sect}&landno=${formattedLandNo}`;
  
  console.log(`Querying Miaoli GIS API: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.log(`Miaoli GIS API returned status: ${response.status}`);
      return null;
    }

    const text = await response.text();
    console.log(`Miaoli GIS API raw response: ${text.substring(0, 500)}`);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log(`Failed to parse Miaoli GIS JSON response`);
      return null;
    }
    
    // Check for coordinates in response
    if (data && data.longitude !== undefined && data.latitude !== undefined) {
      console.log(`Miaoli GIS returned coordinates: ${data.longitude}, ${data.latitude}`);
      return {
        longitude: data.longitude,
        latitude: data.latitude,
        source: "MiaoliGIS",
      };
    }

    // Alternative response format
    if (data && data.x !== undefined && data.y !== undefined) {
      console.log(`Miaoli GIS returned coordinates: ${data.x}, ${data.y}`);
      return {
        longitude: data.x,
        latitude: data.y,
        source: "MiaoliGIS",
      };
    }

    console.log(`Miaoli GIS API response did not contain valid coordinates`);
    return null;
  } catch (error) {
    console.error(`Miaoli GIS API error:`, error);
    return null;
  }
}

// Helper function to add timeout to async operations
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.log(timeoutMessage);
      resolve(null);
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Main coordinate lookup function - tries multiple sources with timeout
export async function lookupCoordinates(landParcel: string): Promise<CoordinateResult | null> {
  console.log(`Looking up coordinates for: ${landParcel}`);
  
  // Try NLSC first with 10 second timeout
  const nlscResult = await withTimeout(
    lookupNLSC(landParcel),
    10000,
    "NLSC lookup timed out after 10 seconds"
  );
  if (nlscResult) return nlscResult;

  console.log(`NLSC lookup failed, trying Miaoli GIS...`);
  
  // Try Miaoli GIS as fallback with 10 second timeout
  const miaoliResult = await withTimeout(
    lookupMiaoliGIS(landParcel),
    10000,
    "Miaoli GIS lookup timed out after 10 seconds"
  );
  if (miaoliResult) return miaoliResult;

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
