import express from "express";
import {
  createWorkoutPlan,
  getWorkoutPlanById,
} from "../controllers/workoutPlanController";
// Correct the import to use the exported type name WorkoutPlanGenerationStatus
import { WorkoutPlanGenerationStatus } from "../types/workoutPlanTypes";

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
               default: true
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
 *     WorkoutPlanStatus: # Updated schema to include all possible states and the result
 *       type: object
 *       properties:
 *         planId:
 *           type: string
 *           description: Unique ID of the workout plan
 *         status:
 *           type: string
 *           description: Current status of the workout plan generation
 *           enum: [queued, accepted, generating, completed, failed] # Added 'accepted'
 *         progress:
 *           type: number
 *           description: Progress percentage (0-100). Only available when status is 'generating'.
 *           nullable: true # Progress might not be available in 'queued' or 'accepted'
 *         step:
 *           type: string
 *           description: Current generation step. Only available when status is 'generating'.
 *           nullable: true # Step might not be available initially
 *         message:
 *           type: string
 *           description: Additional status message
 *           nullable: true
 *         error:
 *           type: string
 *           description: Error message if status is 'failed'.
 *           nullable: true
 *         result: # Added result property to schema, contains the full plan on completion
 *            $ref: '#/components/schemas/WorkoutPlanCompleteResponse/properties/plan'
 *            description: The complete workout plan object, included when status is 'completed'.
 *            nullable: true
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
 *           description: Unique ID of the workout plan generated
 *         message:
 *           type: string
 *           description: Status message indicating initiation
 *           example: "Workout plan generation initiated. Track status via WebSocket."
 *         status:
 *           type: string
 *           description: Initial status of the workout plan generation (accepted)
 *           example: "accepted"
 *       example:
 *         planId: "plan-123"
 *         message: "Workout plan generation initiated. Track status via WebSocket."
 *         status: "accepted"
 *
 *     WorkoutPlanCompleteResponse: # Kept this schema, now used in WebSocket 'workoutPlanComplete' event
 *       type: object
 *       properties:
 *         planId:
 *           type: string
 *           description: Unique ID of the workout plan
 *         status:
 *           type: string
 *           description: Status of the workout plan generation (completed)
 *           example: "completed"
 *         plan: # This represents the full WorkoutPlan object structure
 *           type: object
 *           description: The complete workout plan object generated
 *           properties: # Define the properties matching the WorkoutPlan type
 *             program_name: { type: "string" }
 *             program_goal: { type: "string" }
 *             program_description: { type: "string" }
 *             required_gear: { type: "array", items: { type: "string" } }
 *             exercises:
 *               type: "array"
 *               items:
 *                 type: "object"
 *                 properties:
 *                   exercise_name: { type: "string" }
 *                   exercise_type: { type: "string", enum: ["Basics", "Skill", "Static Hold", "Dynamic", "Stretch", "Mobility Drill", "Cardio", "Weighted", "Freestyle", "Other"] }
 *                   description: { type: "string" }
 *                   target_muscles: { type: "array", items: { type: "string" } }
 *                   video_url: { type: "string", format: "url", nullable: true }
 *                   progressions:
 *                      type: "array"
 *                      items:
 *                         type: "object"
 *                         properties:
 *                           level_name: { type: "string" }
 *                           description: { type: "string" }
 *                         required: ["level_name", "description"]
 *                      nullable: true
 *                 required: ["exercise_name", "exercise_type", "description", "target_muscles"]
 *             workout_plan:
 *               type: "object"
 *               properties:
 *                 structure_type: { type: "string", enum: ["Weekly Split", "Circuit Based", "AMRAP", "EMOM", "Tabata", "Greasing the Groove", "Other"] }
 *                 schedule:
 *                   type: "array"
 *                   items:
 *                     type: "object"
 *                     properties:
 *                       day: { type: "string" }
 *                       focus: { type: "string" }
 *                       routines:
 *                         type: "array"
 *                         items:
 *                           type: "object"
 *                           properties:
 *                             routine_name: { type: "string" }
 *                             routine_type: { type: "string", enum: ["Standard Sets/Reps", "Circuit", "AMRAP", "EMOM", "Tabata", "Warm-up", "Cool-down", "Greasing the Groove Session", "Other"] }
 *                             duration: { type: "string", nullable: true }
 *                             notes: { type: "string", nullable: true }
 *                             exercises_in_routine:
 *                               type: "array"
 *                               items:
 *                                 type: "object"
 *                                 properties:
 *                                   exercise_name: { type: "string" }
 *                                   progression_level: { type: "string", nullable: true }
 *                                   sets: { type: ["integer", "string"], nullable: true }
 *                                   reps: { type: ["integer", "string"], nullable: true }
                                  duration: { type: ["string", "integer"], nullable: true }
                                  rest_after_exercise: { type: ["string", "integer"], nullable: true }
                                  notes: { type: "string", nullable: true }
                                 required: ["exercise_name"]
                               required: ["routine_name", "routine_type", "exercises_in_routine"]
                           required: ["day", "focus", "routines"]
                       required: ["structure_type", "schedule"]
                   nutrition_advice:
                      type: "object" # Define nutrition_advice properties if needed for documentation clarity
                      properties:
                         overview: { type: "string" }
                         key_principles: { type: "array", items: { type: "object", properties: { principle_name: { type: "string" }, description: { type: "string" } }, required: ["principle_name", "description"] }, nullable: true }
                         macronutrients_guidelines: { type: "object", properties: { calories: { type: "string" }, carbohydrates: { type: "string" }, protein: { type: "string" }, fats: { type: "string" } }, nullable: true }
                         example_meal_plans: { type: "array", items: { type: "object", properties: { plan_name: { type: "string" }, meals: { type: "array", items: { type: "object", properties: { time: { type: "string" }, meal_type: { type: "string" }, consumption: { type: "string" } }, required: ["meal_type", "consumption"] } } }, required: ["plan_name", "meals"] }, nullable: true }
                      nullable: true
                   hydration_advice:
                       type: "object" # Define hydration_advice properties if needed
                       properties:
                          overview: { type: "string" }
                          recommended_intake: { type: "string" }
                       nullable: true
                 required: # Required properties for the plan object itself
                   - program_name
                   - program_goal
                   - program_description
                   - required_gear
                   - exercises
                   - workout_plan

     ErrorResponse:
       type: object
       properties:
         error:
           type: string
           description: Error type
         message:
           type: string
           description: Error message
       example:
         error: "Bad Request"
         message: "At least one fileId is required"
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
 *     summary: Initiate generation of a new workout plan
 *     description: |
 *       Starts the generation of a personalized workout plan based on the user's query and specified knowledge sources.
 *       This endpoint initiates the process asynchronously and returns an ID (`planId`) for tracking.
 *       Clients should connect to the WebSocket server and join the room `workoutPlan:{planId}` to receive real-time progress updates and the final plan or error status.
 *
 *       **WebSocket Events:**
 *       - `workoutPlanProgress`: Emitted periodically with status updates, progress percentage, and current step.
 *       - `workoutPlanComplete`: Emitted when the generation is successful, includes the complete `plan` object.
 *       - `workoutPlanError`: Emitted if the generation fails, includes error details.
 *
 *       Example WebSocket connection and event handling:
 *       ```javascript
 *       const socket = io("http://localhost:3000"); // Replace with your server URL
 *
 *       // After getting planId from the HTTP POST response
 *       socket.emit('joinWorkoutPlanRoom', planId);
 *
 *       socket.on('workoutPlanProgress', (data) => {
 *         console.log(`Plan ID: ${data.planId}, Status: ${data.status}, Progress: ${data.progress}%, Step: ${data.step}`);
 *       });
 *
 *       socket.on('workoutPlanComplete', (data) => {
 *         console.log('Workout plan generation complete:', data.plan);
 *         // data object will match the WorkoutPlanCompleteResponse schema
 *       });
 *
 *       socket.on('workoutPlanError', (data) => {
 *         console.error('Workout plan generation failed:', data.error);
 *         // data object includes status, error, and message
 *       });
 *       ```
 *     tags: [Workout Plans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkoutPlanInput'
 *     responses:
 *       202:
 *         description: Workout plan generation process initiated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkoutPlanCreationResponse'
 *       400:
 *         description: Bad request (e.g., missing required parameters in body)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error (e.g., failure to initiate the background process)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req, res, next) => {
  try {
    await createWorkoutPlan(req, res);
  } catch (error) {
    // Pass errors to the next middleware (the global error handler)
    next(error);
  }
});

/**
 * @openapi
 * /api/workout-plans/{planId}:
 *   get:
 *     summary: Get a workout plan by ID
 *     description: |
 *       Retrieves a completed and saved workout plan by its unique ID.
 *       This endpoint only returns plans that have successfully finished the generation process and been saved to the database.
 *       For real-time status updates and the final plan during generation, use the WebSocket API and the `planId` obtained from the POST /api/workout-plans endpoint.
 *     tags: [Workout Plans]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the workout plan to retrieve
 *     responses:
 *       200:
 *         description: The complete workout plan object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkoutPlanCompleteResponse/properties/plan' # Return just the plan object structure
 *       404:
         description: Workout plan not found (either ID is incorrect or plan is not yet completed/saved)
         content:
           application/json:
             schema:
               $ref: '#/components/schemas/ErrorResponse'
       500:
         description: Server error during retrieval
         content:
           application/json:
             schema:
               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:planId", async (req, res, next) => {
  try {
    await getWorkoutPlanById(req, res);
  } catch (error) {
    // Pass errors to the next middleware
    next(error);
  }
});

export default router;
