import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSurveyCaseSchema, updateSurveyCaseSchema } from "@shared/schema";
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

  return httpServer;
}
