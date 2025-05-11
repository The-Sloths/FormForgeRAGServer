import { Request, Response } from "express";
import {
  generateWorkoutPlan,
  getWorkoutPlanStatus,
} from "../services/workoutPlanService";
import { WorkoutPlanInput } from "../types/workoutPlanTypes";

/**
 * Generate a new workout plan
 * @param req Request object containing workout plan parameters
 * @param res Response object
 */
export async function createWorkoutPlan(req: Request, res: Response) {
  try {
    const input = req.body as WorkoutPlanInput;

    // Validate input
    if (!input.query || typeof input.query !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "Query is required and must be a string",
      });
    }

    if (
      !input.fileIds ||
      !Array.isArray(input.fileIds) ||
      input.fileIds.length === 0
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "At least one fileId is required",
      });
    }

    // Generate the workout plan
    const result = await generateWorkoutPlan(input);

    return res.status(201).json({
      planId: result.planId,
      message: "Workout plan generation initiated",
      status: "queued",
      plan: result.plan,
    });
  } catch (error) {
    console.error("Error in createWorkoutPlan controller:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Get the status or result of a workout plan generation
 * @param req Request object containing the plan ID
 * @param res Response object
 */
export async function getWorkoutPlanById(req: Request, res: Response) {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Plan ID is required",
      });
    }

    // Get the workout plan status
    const planStatus = getWorkoutPlanStatus(planId);

    if (!planStatus) {
      return res.status(404).json({
        error: "Not Found",
        message: "Workout plan not found",
      });
    }

    // If the plan is completed, return the result
    if (planStatus.status === "completed" && planStatus.result) {
      return res.status(200).json({
        planId,
        status: planStatus.status,
        plan: planStatus.result,
      });
    }

    // Otherwise, return the current status
    return res.status(200).json({
      planId,
      status: planStatus.status,
      progress: planStatus.progress,
      step: planStatus.step,
      message: planStatus.message,
      error: planStatus.error,
    });
  } catch (error) {
    console.error("Error in getWorkoutPlanById controller:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
