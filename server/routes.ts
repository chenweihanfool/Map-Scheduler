import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertSurveyCaseSchema, 
  updateSurveyCaseSchema,
  insertSurveyorSchema,
  updateSurveyorSchema,
  updateSettingsSchema,
  CASE_TYPES
} from "@shared/schema";
import { processCoordinateLookup } from "./coordinate-service";

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

      const surveyCase = await storage.createCase(validationResult.data);
      
      // Trigger async coordinate lookup
      processCoordinateLookup(surveyCase.id).catch(err => {
        console.error("Background coordinate lookup failed:", err);
      });

      res.status(201).json(surveyCase);
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
  app.get("/api/surveyors/next/suggested", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const allSurveyors = await storage.getAllSurveyors();
      
      // Filter only 複丈組 surveyors for auto-assignment, sorted by sortOrder
      const eligibleSurveyors = allSurveyors
        .filter(s => s.businessAttribute === "複丈組")
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
            // Last assigned surveyor not found in eligible list (maybe deleted or changed attribute)
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

  return httpServer;
}
