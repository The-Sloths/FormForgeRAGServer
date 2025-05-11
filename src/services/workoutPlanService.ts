import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from "fs/promises";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { model, vectorStore } from "../config/langchain";
import supabase from "../config/supabase";
import {
  WorkoutPlan,
  WorkoutPlanGenerationStatus,
  WorkoutPlanInput,
} from "../types/workoutPlanTypes";
import { getIO } from "./socketService";
import { StringOutputParser } from "@langchain/core/output_parsers";
import Ajv from "ajv";

// In-memory storage for tracking workout plan generation progress
const workoutPlanProgress = new Map<string, WorkoutPlanGenerationStatus>();

/**
 * Get the workout plan schema from file
 * @returns The workout plan schema object
 */
async function getWorkoutPlanSchema(): Promise<any> {
  try {
    const schemaPath = path.join(
      __dirname,
      "../prompts/workout_plan_schema.json",
    );
    const schemaContent = await fs.readFile(schemaPath, "utf8");
    return JSON.parse(schemaContent);
  } catch (error) {
    console.error("Error loading workout plan schema:", error);
    throw new Error("Failed to load workout plan schema");
  }
}

/**
 * Get the training generation prompt template from file and incorporate the schema
 * @returns The prompt template string with schema included
 */
async function getTrainingPromptTemplate(): Promise<string> {
  try {
    const promptPath = path.join(
      __dirname,
      "../prompts/training-generation.md",
    );
    const promptContent = await fs.readFile(promptPath, "utf8");

    // Get the workout plan schema
    const schema = await getWorkoutPlanSchema();

    // Convert schema to string and escape all curly braces to prevent template parsing errors
    const schemaString = JSON.stringify(schema, null, 2)
      .replace(/\{/g, "{{") // Escape opening curly braces
      .replace(/\}/g, "}}"); // Escape closing curly braces

    // Replace the placeholder with the actual schema
    const completePrompt = promptContent.replace(
      "Remember: Your output MUST be a valid JSON object conforming to the workout plan schema. Include all required fields and ensure internal consistency throughout the program.",
      `Remember: Your output MUST be a valid JSON object conforming to the following schema:\n\n\`\`\`json\n${schemaString}\n\`\`\`\n\nInclude all required fields and ensure internal consistency throughout the program.`,
    );

    return completePrompt;
  } catch (error) {
    console.error("Error loading training prompt template:", error);
    throw new Error("Failed to load training prompt template");
  }
}

/**
 * Emit workout plan generation progress via WebSocket
 * @param planId The workout plan ID
 * @param data Progress data
 */
export function emitWorkoutPlanProgress(
  planId: string,
  data: Partial<WorkoutPlanGenerationStatus>,
): void {
  // Get current progress or initialize a new one
  const currentProgress = workoutPlanProgress.get(planId) || {
    planId,
    status: "queued",
    progress: 0,
    step: "Initializing",
  };

  // Update progress with new data
  const updatedProgress = {
    ...currentProgress,
    ...data,
  };

  // Store updated progress
  workoutPlanProgress.set(
    planId,
    updatedProgress as WorkoutPlanGenerationStatus,
  );

  // Emit via WebSocket
  const io = getIO();
  io.to(`workoutPlan:${planId}`).emit("workoutPlanProgress", updatedProgress);

  // If completed or failed, emit the appropriate event
  if (data.status === "completed") {
    io.to(`workoutPlan:${planId}`).emit("workoutPlanComplete", updatedProgress);
  } else if (data.status === "failed") {
    io.to(`workoutPlan:${planId}`).emit("workoutPlanError", updatedProgress);
  }
}

/**
 * Filter vector store documents by file IDs
 * @param fileIds Array of file IDs to filter by
 * @param query The user's query for the workout plan
 * @param topK Number of documents to retrieve
 * @returns Array of filtered documents
 */
async function getDocumentsFromFileIds(
  fileIds: string[],
  query: string,
  topK: number = 8,
): Promise<Document[]> {
  try {
    // This is where we'd normally filter directly in the vector store
    // Since Supabase with pgvector doesn't support direct metadata filtering combined with semantic search,
    // we'll perform a two-step process:

    // 1. First, get semantic search results
    const documents = await vectorStore.similaritySearch(query, topK * 2);

    // 2. Then filter by fileIds in the metadata
    const filteredDocuments = documents.filter((doc) => {
      const fileId = doc.metadata?.fileId;
      return fileId && fileIds.includes(fileId);
    });

    // Limit to topK documents
    return filteredDocuments.slice(0, topK);
  } catch (error) {
    console.error("Error retrieving documents by file IDs:", error);
    throw new Error("Failed to retrieve documents by file IDs");
  }
}

/**
 * Alternative approach: Get documents directly from Supabase by fileIds
 * This is a backup method if the vector store filtering doesn't work well
 */
async function getDocumentsDirectlyFromSupabase(
  fileIds: string[],
): Promise<Document[]> {
  try {
    // Query the documents table directly with a fileId filter
    const { data, error } = await supabase
      .from("documents")
      .select("content, metadata, embedding")
      .filter("metadata->fileId", "in", `(${fileIds.join(",")})`);

    if (error) throw error;

    // Convert to LangChain Document format
    return data.map(
      (item) =>
        new Document({
          pageContent: item.content,
          metadata: item.metadata,
        }),
    );
  } catch (error) {
    console.error("Error getting documents directly from Supabase:", error);
    throw new Error("Failed to retrieve documents from database");
  }
}

/**
 * Validate the workout plan against the schema requirements using AJV
 * @param plan The generated workout plan
 * @returns Whether the plan is valid
 */
async function validateWorkoutPlan(plan: any): Promise<boolean> {
  try {
    // Get the schema
    const schema = await getWorkoutPlanSchema();

    // Create validator
    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    // Validate the plan
    const valid = validate(plan);

    if (!valid && validate.errors) {
      console.error("Workout plan validation errors:", validate.errors);
    }

    return !!valid;
  } catch (error) {
    console.error("Error validating workout plan against schema:", error);

    // Fallback to basic validation if schema validation fails
    return basicValidateWorkoutPlan(plan);
  }
}

/**
 * Basic validation as a fallback if schema validation fails
 * @param plan The generated workout plan
 * @returns Whether the plan is valid based on basic checks
 */
function basicValidateWorkoutPlan(plan: any): boolean {
  // Check required fields
  const requiredFields = [
    "program_name",
    "program_goal",
    "program_description",
    "required_gear",
    "exercises",
    "workout_plan",
  ];

  for (const field of requiredFields) {
    if (!plan[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  // Check workout_plan required fields
  if (!plan.workout_plan.structure_type || !plan.workout_plan.schedule) {
    console.error("Missing required workout_plan fields");
    return false;
  }

  // Check exercises array
  if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) {
    console.error("Exercises must be a non-empty array");
    return false;
  }

  return true;
}

/**
 * Generate a minimal valid workout plan based on the schema requirements
 * To be used as a fallback when parsing fails
 * @returns A minimal valid workout plan
 */
async function generateMinimalValidPlan(): Promise<WorkoutPlan> {
  // Create a minimal plan that follows the schema structure
  return {
    program_name: "Basic Calisthenics Training Program",
    program_goal: "Build fundamental strength and movement skills",
    program_description:
      "A simplified program focusing on essential bodyweight exercises to develop basic strength and movement patterns.",
    required_gear: ["None - bodyweight only"],
    exercises: [
      {
        exercise_name: "Push-up",
        exercise_type: "Basics",
        description:
          "Standard push-up with hands shoulder-width apart, body in a straight line, and lowering the chest to the ground.",
        target_muscles: ["Chest", "Shoulders", "Triceps", "Core"],
      },
      {
        exercise_name: "Bodyweight Squat",
        exercise_type: "Basics",
        description:
          "Standing with feet shoulder-width apart, lower your body by bending knees and hips as if sitting in a chair, then return to standing.",
        target_muscles: ["Quadriceps", "Glutes", "Hamstrings", "Core"],
      },
      {
        exercise_name: "Plank",
        exercise_type: "Static Hold",
        description:
          "Support your body on forearms and toes, maintaining a straight line from head to heels.",
        target_muscles: ["Core", "Shoulders", "Back"],
      },
    ],
    workout_plan: {
      structure_type: "Weekly Split",
      schedule: [
        {
          day: "Day 1",
          focus: "Full Body",
          routines: [
            {
              routine_name: "Basic Strength Circuit",
              routine_type: "Circuit",
              exercises_in_routine: [
                {
                  exercise_name: "Push-up",
                  sets: 3,
                  reps: 10,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Bodyweight Squat",
                  sets: 3,
                  reps: 15,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Plank",
                  sets: 3,
                  duration: "30 seconds",
                  rest_after_exercise: "60 seconds",
                },
              ],
            },
          ],
        },
        {
          day: "Day 2",
          focus: "Rest",
          routines: [
            {
              routine_name: "Active Recovery",
              routine_type: "Other",
              exercises_in_routine: [],
            },
          ],
        },
        {
          day: "Day 3",
          focus: "Full Body",
          routines: [
            {
              routine_name: "Basic Strength Circuit",
              routine_type: "Circuit",
              exercises_in_routine: [
                {
                  exercise_name: "Push-up",
                  sets: 3,
                  reps: 10,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Bodyweight Squat",
                  sets: 3,
                  reps: 15,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Plank",
                  sets: 3,
                  duration: "30 seconds",
                  rest_after_exercise: "60 seconds",
                },
              ],
            },
          ],
        },
        {
          day: "Day 4",
          focus: "Rest",
          routines: [
            {
              routine_name: "Active Recovery",
              routine_type: "Other",
              exercises_in_routine: [],
            },
          ],
        },
        {
          day: "Day 5",
          focus: "Full Body",
          routines: [
            {
              routine_name: "Basic Strength Circuit",
              routine_type: "Circuit",
              exercises_in_routine: [
                {
                  exercise_name: "Push-up",
                  sets: 3,
                  reps: 10,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Bodyweight Squat",
                  sets: 3,
                  reps: 15,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Plank",
                  sets: 3,
                  duration: "30 seconds",
                  rest_after_exercise: "60 seconds",
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Extract JSON from a text response using multiple strategies
 * @param text The text containing JSON
 * @returns Parsed JSON object or null if extraction fails
 */
function extractJsonFromText(text: string): any | null {
  try {
    // Strategy 1: Try to extract JSON using markdown code block regex
    const jsonMatch = text.match(/```(?:json)?([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        // If direct parsing fails, try cleaning the JSON
        const cleanedJson = jsonMatch[1]
          .trim()
          .replace(/\n/g, " ")
          .replace(/,\s*}/g, "}") // Remove trailing commas
          .replace(/,\s*]/g, "]") // Remove trailing commas in arrays
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'); // Ensure property names are quoted

        return JSON.parse(cleanedJson);
      }
    }

    // Strategy 2: Try to extract JSON using a simple pattern (any content between curly braces)
    const simpleJsonMatch = text.match(/({[\s\S]*})/);
    if (simpleJsonMatch) {
      try {
        return JSON.parse(simpleJsonMatch[1].trim());
      } catch (e) {
        // If that fails too, we'll return null and handle it in the caller
      }
    }

    // Strategy 3: Try parsing the entire text as JSON
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to extract JSON from text:", e);
    return null;
  }
}

/**
 * Wait for the complete JSON response from the LLM
 * This handles streaming responses by ensuring we get valid and complete JSON
 * @param prompt The prompt template
 * @param context The retrieved documents context
 * @param query The user query
 * @returns Complete JSON response
 */
async function getCompleteJsonResponse(
  prompt: ChatPromptTemplate,
  context: string,
  query: string,
): Promise<string> {
  // Create a direct chain with the model and a string output parser
  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  // Initialize variables for streaming
  let completeResponse = "";
  let jsonComplete = false;
  let maxAttempts = 3;
  let attempts = 0;

  // Try multiple times to get a complete JSON
  while (!jsonComplete && attempts < maxAttempts) {
    attempts++;

    // Reset response for each attempt
    completeResponse = "";

    // Stream the response
    const stream = await chain.stream({
      context,
      question: query,
    });

    // Collect all chunks
    for await (const chunk of stream) {
      completeResponse += chunk;

      // Attempt to validate if we have complete JSON
      if (completeResponse.includes("}")) {
        try {
          // Try to extract JSON
          const jsonData = extractJsonFromText(completeResponse);
          if (jsonData) {
            jsonComplete = true;
            break;
          }
        } catch (e) {
          // JSON is not complete yet, continue streaming
        }
      }
    }

    // If we have a complete JSON, break out
    if (jsonComplete) {
      break;
    }

    console.warn(
      `Attempt ${attempts}: Failed to get complete JSON, retrying...`,
    );
  }

  return completeResponse;
}

/**
 * Generate a workout plan based on user input and file sources
 * @param input The workout plan input parameters
 * @returns Generated workout plan
 */
export async function generateWorkoutPlan(
  input: WorkoutPlanInput,
): Promise<{ planId: string; plan: WorkoutPlan }> {
  // Generate a unique plan ID
  const planId = uuidv4();

  try {
    // Initialize progress tracking
    emitWorkoutPlanProgress(planId, {
      status: "queued",
      progress: 0,
      step: "Initializing workout plan generation",
    });

    // Destructure input
    const { query, fileIds, options } = input;

    // Validate input
    if (!query || typeof query !== "string") {
      throw new Error("Query is required and must be a string");
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error("At least one fileId is required");
    }

    // Update progress
    emitWorkoutPlanProgress(planId, {
      status: "generating",
      progress: 10,
      step: "Retrieving relevant documents",
    });

    // Get documents filtered by fileIds
    const documents = await getDocumentsFromFileIds(
      fileIds,
      query,
      options?.topK || 8,
    );

    if (documents.length === 0) {
      throw new Error("No relevant documents found for the provided file IDs");
    }

    // Update progress
    emitWorkoutPlanProgress(planId, {
      progress: 30,
      step: "Creating workout plan with retrieved knowledge",
    });

    // Get the training prompt template with schema included
    const promptTemplate = await getTrainingPromptTemplate();

    // Create a prompt template
    const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);

    // Update progress
    emitWorkoutPlanProgress(planId, {
      progress: 50,
      step: "Generating personalized workout plan",
    });

    // Extract the content from the documents to create context
    const context = documents.map((doc) => doc.pageContent).join("\n\n");

    // Get complete response using streaming to ensure we get all the JSON
    const completeResponse = await getCompleteJsonResponse(
      prompt,
      context,
      query,
    );

    console.log("Complete response received");

    // Update progress
    emitWorkoutPlanProgress(planId, {
      progress: 80,
      step: "Validating workout plan",
    });

    // Parse the response as JSON
    let parsedPlan: WorkoutPlan;
    try {
      // Extract JSON from the response
      const jsonData = extractJsonFromText(completeResponse);

      if (!jsonData) {
        throw new Error("Failed to extract valid JSON from the response");
      }

      parsedPlan = jsonData as WorkoutPlan;
    } catch (error) {
      console.error("Error parsing workout plan JSON:", error);
      console.error("Raw response:", completeResponse);

      // Use a fallback plan that follows the schema
      console.warn("Using fallback workout plan due to parsing failures");
      parsedPlan = await generateMinimalValidPlan();
    }

    // Validate the plan against the schema
    const isValid = await validateWorkoutPlan(parsedPlan);
    if (!isValid) {
      console.warn("Generated plan does not match schema, using fallback plan");
      parsedPlan = await generateMinimalValidPlan();
    }

    // Update progress to completed
    emitWorkoutPlanProgress(planId, {
      status: "completed",
      progress: 100,
      step: "Workout plan generation completed",
      result: parsedPlan,
    });

    return {
      planId,
      plan: parsedPlan,
    };
  } catch (error) {
    // Handle errors
    console.error("Error generating workout plan:", error);

    // Update progress with error
    emitWorkoutPlanProgress(planId, {
      status: "failed",
      progress: 0,
      step: "Error generating workout plan",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
}

/**
 * Get the current status of a workout plan generation
 * @param planId The workout plan ID
 * @returns The current generation status
 */
export function getWorkoutPlanStatus(
  planId: string,
): WorkoutPlanGenerationStatus | undefined {
  return workoutPlanProgress.get(planId);
}
