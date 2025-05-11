import express from "express";
import {
  createWorkoutPlan,
  getWorkoutPlanById,
} from "../controllers/workoutPlanController";

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     WorkoutPlanInput:
 *       type: object
 *       required:
 *         - query
 *         - fileIds
 *       properties:
 *         query:
 *           type: string
 *           description: User's request for the workout plan (e.g., "Create a beginner calisthenics program for muscle gain")
 *         fileIds:
 *           type: array
 *           description: IDs of specific files to use as knowledge sources
 *           items:
 *             type: string
 *         options:
 *           type: object
 *           properties:
 *             topK:
 *               type: integer
 *               description: Number of most relevant chunks to retrieve
 *               default: 8
 *             includeNutrition:
 *               type: boolean
 *               description: Whether to include nutrition advice
 *               default: true
 *             includeHydration:
 *               type: boolean
 *               description: Whether to include hydration advice
 *               default: true
 *             fitnessLevel:
 *               type: string
 *               description: User's fitness level
 *               enum: [beginner, intermediate, advanced]
 *             specificGoals:
 *               type: array
 *               description: Specific goals (e.g., ["muscle gain", "flexibility"])
 *               items:
 *                 type: string
 *             excludedExercises:
 *               type: array
 *               description: Exercises to exclude due to injuries or limitations
 *               items:
 *                 type: string
 *       example:
 *         query: "Create a 3-day beginner calisthenics program for building strength"
 *         fileIds: ["file-123", "file-456"]
 *         options:
 *           topK: 8
 *           fitnessLevel: "beginner"
 *           specificGoals: ["strength", "muscle gain"]
 *
 *     WorkoutPlanStatus:
 *       type: object
 *       properties:
 *         planId:
 *           type: string
 *           description: Unique ID of the workout plan
 *         status:
 *           type: string
 *           description: Current status of the workout plan generation
 *           enum: [queued, generating, completed, failed]
 *         progress:
 *           type: number
 *           description: Progress percentage (0-100)
 *         step:
 *           type: string
 *           description: Current generation step
 *         message:
 *           type: string
 *           description: Additional status message
 *         error:
 *           type: string
 *           description: Error message if status is 'failed'
 *       example:
 *         planId: "plan-123"
 *         status: "generating"
 *         progress: 45
 *         step: "Creating workout plan with retrieved knowledge"
 *         message: "Processing exercise information"
 *
 *     WorkoutPlanCreationResponse:
 *       type: object
 *       properties:
 *         planId:
 *           type: string
 *           description: Unique ID of the workout plan
 *         message:
 *           type: string
 *           description: Status message
 *         status:
 *           type: string
 *           description: Initial status of the workout plan generation
 *       example:
 *         planId: "plan-123"
 *         message: "Workout plan generation initiated"
 *         status: "queued"
 *
 *     WorkoutPlanCompleteResponse:
 *       type: object
 *       properties:
 *         planId:
 *           type: string
 *           description: Unique ID of the workout plan
 *         status:
 *           type: string
 *           description: Status of the workout plan generation (completed)
 *         plan:
 *           type: object
 *           description: The complete workout plan object
 *       example:
 *         planId: "plan-123"
 *         status: "completed"
 *         plan:
 *           program_name: "Beginner Strength Building Program"
 *           program_goal: "Build foundational strength with calisthenics"
 *           program_description: "A 3-day program designed for beginners to build strength using bodyweight exercises."
 *           required_gear: ["Pull-up bar", "Resistance band"]
 *           exercises: []
 *           workout_plan:
 *             structure_type: "Weekly Split"
 *             schedule: []
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error type
 *         message:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Bad Request"
 *         message: "At least one fileId is required"
 */

/**
 * @openapi
 * tags:
 *   name: Workout Plans
 *   description: API for generating personalized calisthenics workout plans
 */

/**
 * @openapi
 * /api/workout-plans:
 *   post:
 *     summary: Generate a new workout plan
 *     description: Starts the generation of a personalized workout plan based on the user's query and specified knowledge sources
 *     tags: [Workout Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkoutPlanInput'
 *     responses:
 *       201:
 *         description: Workout plan generation started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkoutPlanCreationResponse'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req, res) => {
  try {
    await createWorkoutPlan(req, res);
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred during workout plan generation",
    });
  }
});

/**
 * @openapi
 * /api/workout-plans/{planId}:
 *   get:
 *     summary: Get a workout plan by ID
 *     description: Retrieves the status or result of a workout plan generation
 *     tags: [Workout Plans]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the workout plan
 *     responses:
 *       200:
 *         description: Workout plan status or result
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/WorkoutPlanStatus'
 *                 - $ref: '#/components/schemas/WorkoutPlanCompleteResponse'
 *       404:
 *         description: Workout plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:planId", async (req, res) => {
  try {
    await getWorkoutPlanById(req, res);
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while retrieving the workout plan",
    });
  }
});

export default router;
