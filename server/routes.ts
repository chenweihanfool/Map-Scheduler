import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSurveyCaseSchema, 
  updateSurveyCaseSchema,
  insertSurveyorSchema,
  updateSurveyorSchema,
  updateSettingsSchema,
  insertSurveyorLeaveSchema,
  insertCaseTypeSchema,
  CASE_TYPES,
  type CoordinateStatus
} from "@shared/schema";
import { processCoordinateLookup, lookupCoordinates } from "./coordinate-service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all survey cases
  app.get("/api/cases", async (req, res) => {
    try {
      const cases = await storage.getAllCases();
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  // Search survey cases
  app.get("/api/cases/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.json([]);
      }
      const cases = await storage.searchCases(query.trim());
      res.json(cases);
    } catch (error) {
      console.error("Error searching cases:", error);
      res.status(500).json({ error: "Failed to search cases" });
    }
  });

  // Smart surveyor recommendation based on land parcel history
  app.get("/api/cases/recommend-surveyor", async (req, res) => {
    try {
      const section = req.query.section as string;
      const lotNumber = req.query.lotNumber as string;
      
      if (!section) {
        return res.json({ recommendations: [] });
      }

      const allCases = await storage.getAllCases();
      
      const extractSection = (landParcel: string): string => {
        const match = landParcel.match(/^(.+段)/);
        return match ? match[1] : landParcel;
      };

      const extractLotNumbers = (landParcel: string): number[] => {
        const sectionMatch = landParcel.match(/^.+段(.*)$/);
        if (!sectionMatch) return [];
        const lotPart = sectionMatch[1];
        const numbers: number[] = [];
        const matches = lotPart.match(/\d+/g);
        if (matches) {
          matches.forEach(m => numbers.push(parseInt(m)));
        }
        return numbers;
      };

      const inputLotNumbers: number[] = [];
      if (lotNumber) {
        const matches = lotNumber.match(/\d+/g);
        if (matches) {
          matches.forEach(m => inputLotNumbers.push(parseInt(m)));
        }
      }

      const surveyorScores: Record<string, { score: number; reasons: string[] }> = {};

      for (const c of allCases) {
        const caseSection = extractSection(c.landParcel);
        
        if (caseSection === section) {
          if (!surveyorScores[c.surveyor]) {
            surveyorScores[c.surveyor] = { score: 0, reasons: [] };
          }
          
          const caseLotNumbers = extractLotNumbers(c.landParcel);
          
          let exactMatch = false;
          let nearbyMatch = false;
          
          if (inputLotNumbers.length > 0 && caseLotNumbers.length > 0) {
            for (const inputLot of inputLotNumbers) {
              for (const caseLot of caseLotNumbers) {
                if (inputLot === caseLot) {
                  exactMatch = true;
                } else if (Math.abs(inputLot - caseLot) <= 10) {
                  nearbyMatch = true;
                }
              }
            }
          }

          if (exactMatch) {
            surveyorScores[c.surveyor].score += 10;
            const lotStr = caseLotNumbers.join('、');
            const reason = `曾辦理相同地號 ${caseSection}${lotStr}`;
            if (!surveyorScores[c.surveyor].reasons.includes(reason)) {
              surveyorScores[c.surveyor].reasons.push(reason);
            }
          } else if (nearbyMatch) {
            surveyorScores[c.surveyor].score += 5;
            const lotStr = caseLotNumbers.join('、');
            const reason = `曾辦理鄰近地號 ${caseSection}${lotStr}`;
            if (!surveyorScores[c.surveyor].reasons.includes(reason)) {
              surveyorScores[c.surveyor].reasons.push(reason);
            }
          } else {
            surveyorScores[c.surveyor].score += 1;
            const existingGenericReason = surveyorScores[c.surveyor].reasons.find(r => r.startsWith('曾辦理同段'));
            if (!existingGenericReason) {
              surveyorScores[c.surveyor].reasons.push(`曾辦理同段 ${caseSection} 案件`);
            }
          }
        }
      }

      const recommendations = Object.entries(surveyorScores)
        .map(([surveyor, data]) => ({
          surveyor,
          score: data.score,
          reasons: data.reasons,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      res.json({ recommendations });
    } catch (error) {
      console.error("Error getting surveyor recommendation:", error);
      res.status(500).json({ error: "Failed to get recommendation" });
    }
  });

  // Get single survey case
  app.get("/api/cases/:id", async (req, res) => {
    try {
      const surveyCase = await storage.getCase(req.params.id);
      if (!surveyCase) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.json(surveyCase);
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ error: "Failed to fetch case" });
    }
  });

  // Create new survey case
  app.post("/api/cases", async (req, res) => {
    try {
      const validationResult = insertSurveyCaseSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.flatten() 
        });
      }

      // Try to get coordinates, but allow case creation even without coordinates
      const landParcel = validationResult.data.landParcel;
      const coordinates = await lookupCoordinates(landParcel);
      
      // Add coordinates to the case data before saving (null if not found)
      const caseDataWithCoords = {
        ...validationResult.data,
        longitude: coordinates?.longitude ?? null,
        latitude: coordinates?.latitude ?? null,
      };

      const surveyCase = await storage.createCase(caseDataWithCoords);
      
      // Update coordinate status based on lookup result
      const coordinateStatus: CoordinateStatus = coordinates ? "success" : "not_found";
      const coordinateSource = coordinates?.source ?? null;
      
      await storage.updateCaseCoordinates(
        surveyCase.id,
        coordinates?.longitude ?? null,
        coordinates?.latitude ?? null,
        coordinateStatus,
        coordinateSource ?? undefined
      );

      res.status(201).json({
        ...surveyCase,
        longitude: coordinates?.longitude ?? null,
        latitude: coordinates?.latitude ?? null,
        coordinateStatus,
        coordinateSource,
        coordinateWarning: coordinates ? undefined : `無法取得座標，案件已儲存但無法在地圖上顯示`,
      });
    } catch (error) {
      console.error("Error creating case:", error);
      res.status(500).json({ error: "Failed to create case" });
    }
  });

  // Update survey case
  app.patch("/api/cases/:id", async (req, res) => {
    try {
      const validationResult = updateSurveyCaseSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.flatten() 
        });
      }

      const surveyCase = await storage.updateCase(req.params.id, validationResult.data);
      if (!surveyCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      // If land parcel changed, re-trigger coordinate lookup
      if (validationResult.data.landParcel) {
        processCoordinateLookup(surveyCase.id).catch(err => {
          console.error("Background coordinate lookup failed:", err);
        });
      }

      res.json(surveyCase);
    } catch (error) {
      console.error("Error updating case:", error);
      res.status(500).json({ error: "Failed to update case" });
    }
  });

  // Delete survey case
  app.delete("/api/cases/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCase(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting case:", error);
      res.status(500).json({ error: "Failed to delete case" });
    }
  });

  // Refresh coordinates for a case
  app.post("/api/cases/:id/refresh-coordinates", async (req, res) => {
    try {
      const surveyCase = await storage.getCase(req.params.id);
      if (!surveyCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Trigger async coordinate lookup
      processCoordinateLookup(req.params.id).catch(err => {
        console.error("Background coordinate lookup failed:", err);
      });

      res.json({ message: "Coordinate refresh initiated" });
    } catch (error) {
      console.error("Error refreshing coordinates:", error);
      res.status(500).json({ error: "Failed to refresh coordinates" });
    }
  });

  // ===== Surveyors API =====
  
  app.get("/api/surveyors", async (req, res) => {
    try {
      const surveyorsList = await storage.getAllSurveyors();
      res.json(surveyorsList);
    } catch (error) {
      console.error("Error fetching surveyors:", error);
      res.status(500).json({ error: "Failed to fetch surveyors" });
    }
  });

  app.get("/api/surveyors/:id", async (req, res) => {
    try {
      const surveyor = await storage.getSurveyor(req.params.id);
      if (!surveyor) {
        return res.status(404).json({ error: "Surveyor not found" });
      }
      res.json(surveyor);
    } catch (error) {
      console.error("Error fetching surveyor:", error);
      res.status(500).json({ error: "Failed to fetch surveyor" });
    }
  });

  app.post("/api/surveyors", async (req, res) => {
    try {
      const validationResult = insertSurveyorSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.flatten() 
        });
      }
      const surveyor = await storage.createSurveyor(validationResult.data);
      res.status(201).json(surveyor);
    } catch (error) {
      console.error("Error creating surveyor:", error);
      res.status(500).json({ error: "Failed to create surveyor" });
    }
  });

  app.patch("/api/surveyors/:id", async (req, res) => {
    try {
      const validationResult = updateSurveyorSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.flatten() 
        });
      }
      const surveyor = await storage.updateSurveyor(req.params.id, validationResult.data);
      if (!surveyor) {
        return res.status(404).json({ error: "Surveyor not found" });
      }
      res.json(surveyor);
    } catch (error) {
      console.error("Error updating surveyor:", error);
      res.status(500).json({ error: "Failed to update surveyor" });
    }
  });

  app.delete("/api/surveyors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSurveyor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Surveyor not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting surveyor:", error);
      res.status(500).json({ error: "Failed to delete surveyor" });
    }
  });

  // Get next suggested surveyor based on assignment mode
  // Accepts optional ?date=YYYY-MM-DD to exclude surveyors on leave
  app.get("/api/surveyors/next/suggested", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const allSurveyors = await storage.getAllSurveyors();
      const date = req.query.date as string | undefined;
      
      // Get surveyors on leave for the given date
      let surveyorIdsOnLeave: Set<string> = new Set();
      if (date) {
        const leaves = await storage.getLeavesByDate(date);
        surveyorIdsOnLeave = new Set(leaves.map(l => l.surveyorId));
      }
      
      // Filter only 複丈組 surveyors for auto-assignment, excluding those on leave
      const eligibleSurveyors = allSurveyors
        .filter(s => s.businessAttribute === "複丈組" && !surveyorIdsOnLeave.has(s.id))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      
      if (eligibleSurveyors.length === 0) {
        return res.json({ surveyor: null, mode: settings.assignmentMode });
      }

      let suggestedSurveyor;
      
      if (settings.assignmentMode === "sequential") {
        // Sequential mode: find next surveyor in order after lastAssignedSurveyorId
        const lastId = settings.lastAssignedSurveyorId;
        if (!lastId) {
          // No previous assignment, start with first surveyor
          suggestedSurveyor = eligibleSurveyors[0];
        } else {
          // Find the index of the last assigned surveyor
          const lastIndex = eligibleSurveyors.findIndex(s => s.id === lastId);
          if (lastIndex === -1) {
            // Last assigned surveyor not found in eligible list (maybe deleted, on leave, or changed attribute)
            suggestedSurveyor = eligibleSurveyors[0];
          } else {
            // Rotate to the next surveyor in the list
            const nextIndex = (lastIndex + 1) % eligibleSurveyors.length;
            suggestedSurveyor = eligibleSurveyors[nextIndex];
          }
        }
      } else {
        // Points mode: find surveyor with lowest points
        suggestedSurveyor = eligibleSurveyors.reduce((min, s) => 
          s.points < min.points ? s : min
        , eligibleSurveyors[0]);
      }

      res.json({ surveyor: suggestedSurveyor, mode: settings.assignmentMode });
    } catch (error) {
      console.error("Error getting suggested surveyor:", error);
      res.status(500).json({ error: "Failed to get suggested surveyor" });
    }
  });

  // ===== Settings API =====
  
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const validationResult = updateSettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.flatten() 
        });
      }
      const settings = await storage.updateSettings(validationResult.data);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Add points to surveyor after case assignment
  app.post("/api/surveyors/:id/add-points", async (req, res) => {
    try {
      const { points } = req.body;
      if (typeof points !== "number") {
        return res.status(400).json({ error: "Points must be a number" });
      }
      const surveyor = await storage.addPointsToSurveyor(req.params.id, points);
      if (!surveyor) {
        return res.status(404).json({ error: "Surveyor not found" });
      }
      res.json(surveyor);
    } catch (error) {
      console.error("Error adding points:", error);
      res.status(500).json({ error: "Failed to add points" });
    }
  });

  // ===== Surveyor Leaves API =====

  // Get all upcoming leaves
  app.get("/api/leaves", async (req, res) => {
    try {
      const leaves = await storage.getAllLeaves();
      res.json(leaves);
    } catch (error) {
      console.error("Error fetching leaves:", error);
      res.status(500).json({ error: "Failed to fetch leaves" });
    }
  });

  // Get leaves by date
  app.get("/api/leaves/date/:date", async (req, res) => {
    try {
      const leaves = await storage.getLeavesByDate(req.params.date);
      res.json(leaves);
    } catch (error) {
      console.error("Error fetching leaves by date:", error);
      res.status(500).json({ error: "Failed to fetch leaves" });
    }
  });

  // Create leave
  app.post("/api/leaves", async (req, res) => {
    try {
      const validationResult = insertSurveyorLeaveSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.flatten() 
        });
      }
      const leave = await storage.createLeave(validationResult.data);
      res.status(201).json(leave);
    } catch (error) {
      console.error("Error creating leave:", error);
      res.status(500).json({ error: "Failed to create leave" });
    }
  });

  // Delete leave
  app.delete("/api/leaves/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLeave(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting leave:", error);
      res.status(500).json({ error: "Failed to delete leave" });
    }
  });

  // ===== Case Types API =====

  app.get("/api/case-types", async (req, res) => {
    try {
      const types = await storage.getAllCaseTypes();
      res.json(types);
    } catch (error) {
      console.error("Error fetching case types:", error);
      res.status(500).json({ error: "Failed to fetch case types" });
    }
  });

  app.post("/api/case-types", async (req, res) => {
    try {
      const validationResult = insertCaseTypeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.flatten()
        });
      }
      const caseType = await storage.createCaseType(validationResult.data);
      res.status(201).json(caseType);
    } catch (error) {
      console.error("Error creating case type:", error);
      res.status(500).json({ error: "Failed to create case type" });
    }
  });

  app.patch("/api/case-types/:id", async (req, res) => {
    try {
      const caseType = await storage.updateCaseType(req.params.id, req.body);
      if (!caseType) {
        return res.status(404).json({ error: "Case type not found" });
      }
      res.json(caseType);
    } catch (error) {
      console.error("Error updating case type:", error);
      res.status(500).json({ error: "Failed to update case type" });
    }
  });

  app.delete("/api/case-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCaseType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Case type not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting case type:", error);
      res.status(500).json({ error: "Failed to delete case type" });
    }
  });

  // ===== Smart Surveyor Recommendation API =====
  
  // Initialize default case types on startup
  storage.initializeDefaultCaseTypes().catch(err => {
    console.error("Failed to initialize default case types:", err);
  });

  return httpServer;
}
