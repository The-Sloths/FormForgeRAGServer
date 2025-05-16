import { Request, Response } from "express";
import { generateWorkoutPlan } from "../services/workoutPlanService";
import {
  saveWorkoutPlan,
  getWorkoutPlanById as getWorkoutPlanFromSupabase,
} from "../services/supabaseService";
import { v4 as uuidv4 } from "uuid";
import { emitWorkoutPlanProgress } from "../services/socketService";

export async function createWorkoutPlan(req: Request, res: Response) {
  try {
    const { query, fileIds, options } = req.body;

    if (!query || !fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Query and a non-empty array of fileIds are required.",
      });
    }

    // Generate a unique ID for this plan generation request
    const planId = uuidv4();

    // Initialize progress tracking with 'accepted' status and emit via WebSocket
    emitWorkoutPlanProgress(planId, {
      planId: planId,
      status: "accepted",
      progress: 0,
      step: "Request accepted, queueing generation...",
      message: "Workout plan generation request received.",
    });

    // Trigger the workout plan generation process in the background.
    // We do NOT await this call, allowing the HTTP response to be sent immediately.
    generateWorkoutPlan(planId, req.body) // Pass the generated planId and the input
      .catch((error) => {
        console.error(
          `Error initiating background workout plan generation for ID ${planId}:`,
          error,
        );
      });

    res.status(202).json({
      planId: planId, // Return the ID for tracking
      message: "Workout plan generation initiated. Track status via WebSocket.",
      status: "accepted", // Indicate that the request was accepted
    });
  } catch (error) {
    console.error("Error initiating workout plan generation:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while initiating workout plan generation",
    });
  }
}

export async function getWorkoutPlanById(req: Request, res: Response) {
  const { planId } = req.params;

  if (!planId) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Plan ID is required",
    });
  }

  try {
    // Call the function from the supabaseService to get the saved plan
    const workoutPlan = await getWorkoutPlanFromSupabase(planId);

    if (!workoutPlan) {
      // If the service returns null or undefined, the plan was not found in the DB
      return res.status(404).json({
        error: "Not Found",
        message: "Workout plan not found or not yet completed and saved.",
      });
    }

    // If found, return the workout plan data
    res.status(200).json(workoutPlan);
  } catch (error) {
    console.error("Error in getWorkoutPlanById controller:", error);
    // Handle potential errors during fetching from Supabase
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while retrieving the workout plan",
    });
  }
}
