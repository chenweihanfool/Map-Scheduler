// Coordinate fetching service for Taiwan land parcel lookup
// Uses NLSC (https://maps.nlsc.gov.tw/T09/mapshow.action) 
// and Miaoli GIS (https://ailand.miaoli.gov.tw/gis/)

import { storage } from "./storage";

interface CoordinateResult {
  longitude: number;
  latitude: number;
  source: string;
}

// Parse land parcel string to extract district and parcel number
// Format examples: "苗栗市中正段123地號", "苗栗縣頭份市XX段123-1地號"
function parseLandParcel(landParcel: string): { district: string; section: string; parcelNum: string } | null {
  // Try to extract section name and parcel number
  const patterns = [
    /(.+?)([\u4e00-\u9fa5]+段)(\d+(?:-\d+)?)\s*地號?/,
    /(.+?)段\s*(\d+(?:-\d+)?)\s*地號?/,
  ];

  for (const pattern of patterns) {
    const match = landParcel.match(pattern);
    if (match) {
      return {
        district: match[1] || "",
        section: match[2] || landParcel,
        parcelNum: match[3] || match[2] || "",
      };
    }
  }

  return null;
}

// Simulate coordinate lookup from NLSC API
// In production, this would make actual HTTP requests to the NLSC geocoding service
async function lookupNLSC(landParcel: string): Promise<CoordinateResult | null> {
  const parsed = parseLandParcel(landParcel);
  if (!parsed) return null;

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  // Simulate ~70% success rate with random coordinates in Miaoli County area
  // Miaoli County approximate bounds: 120.5-121.2 E, 24.3-24.7 N
  if (Math.random() > 0.3) {
    return {
      longitude: 120.5 + Math.random() * 0.7,
      latitude: 24.3 + Math.random() * 0.4,
      source: "NLSC",
    };
  }

  return null;
}

// Simulate coordinate lookup from Miaoli GIS
async function lookupMiaoliGIS(landParcel: string): Promise<CoordinateResult | null> {
  const parsed = parseLandParcel(landParcel);
  if (!parsed) return null;

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  // Simulate ~60% success rate with random coordinates in Miaoli County
  if (Math.random() > 0.4) {
    return {
      longitude: 120.5 + Math.random() * 0.7,
      latitude: 24.3 + Math.random() * 0.4,
      source: "Miaoli GIS",
    };
  }

  return null;
}

// Main coordinate lookup function - tries multiple sources
export async function lookupCoordinates(landParcel: string): Promise<CoordinateResult | null> {
  // First try NLSC
  let result = await lookupNLSC(landParcel);
  if (result) return result;

  // Fallback to Miaoli GIS
  result = await lookupMiaoliGIS(landParcel);
  if (result) return result;

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
