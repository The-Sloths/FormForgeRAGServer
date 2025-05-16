import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from "fs/promises";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import path from "path";
import { model, vectorStore } from "../config/langchain";
import supabase from "../config/supabase"; // Import supabase client
import { saveWorkoutPlan } from "./supabaseService"; // Import save function
import {
  WorkoutPlan,
  WorkoutPlanGenerationStatus,
  WorkoutPlanInput,
} from "../types/workoutPlanTypes";
// Correctly import socket emission functions
import {
  emitWorkoutPlanProgress,
  emitWorkoutPlanComplete,
  emitWorkoutPlanError,
  getIO,
} from "./socketService";
import { StringOutputParser } from "@langchain/core/output_parsers";
import Ajv from "ajv";
import addFormats from "ajv-formats";

// In-memory storage for tracking workout plan generation progress
// This map is still useful for getWorkoutPlanStatus if a client polls before completion
const workoutPlanProgress = new Map<string, WorkoutPlanGenerationStatus>();

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
    // This reads the markdown file. The file should contain general instructions
    // and the specific placeholder "PLACEHOLDER_FOR_JSON_SCHEMA".
    let promptContent = await fs.readFile(promptPath, "utf8");

    const schema = await getWorkoutPlanSchema();
    const rawSchemaString = JSON.stringify(schema, null, 2);

    // Escape curly braces within the schemaString for LangChain template compatibility
    const escapedSchemaString = rawSchemaString.replace(/{/g, "{{").replace(/}/g, "}}");

    // This is the specific string that should be present in your .md file.
    const placeholderToReplace = "PLACEHOLDER_FOR_JSON_SCHEMA";

    // This is the text that will replace the placeholder. It includes instructions
    // about the JSON output and the escaped schema itself.
    const schemaInjectionBlock =
      `Your output MUST be a valid JSON object conforming to the following schema. Do not include any explanatory text or markdown formatting outside of the JSON object itself. The entire response should be only the JSON content.\n\nJSON Schema:\n\`\`\`json\n${escapedSchemaString}\n\`\`\`\n\nEnsure all required fields are present and the program is consistent.`;

    // Replace the placeholder in the prompt content.
    promptContent = promptContent.replace(placeholderToReplace, schemaInjectionBlock);

    // promptContent now contains the full system message:
    // original instructions from .md (before placeholder) + schemaInjectionBlock + original instructions from .md (after placeholder, if any)
    return promptContent;
  } catch (error) {
    console.error("Error loading training prompt template:", error);
    throw new Error("Failed to load training prompt template");
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
    // Retrieve more documents initially to increase the chance of finding relevant ones within the specified fileIds
    const documents = await vectorStore.similaritySearch(query, topK * 5); // Retrieve more documents

    // 2. Then filter by fileIds in the metadata
    const filteredDocuments = documents.filter((doc) => {
      const fileId = doc.metadata?.fileId;
      // Ensure fileId exists and is in the list of fileIds
      return fileId && fileIds.includes(fileId);
    });

    // Limit to topK documents after filtering
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
    // Note: This approach doesn't leverage semantic search ranking directly,
    // but ensures documents from the correct files are retrieved.
    const { data, error } = await supabase
      .from("documents")
      .select("content, metadata") // No need to select embedding here
      .filter(
        "metadata->>fileId",
        "in",
        `(${fileIds.map((id) => `'${id}'`).join(",")})`,
      ); // Use ->> for text comparison, quote IDs

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

    // Create validator instance and add format support
    const ajv = new Ajv();
    addFormats(ajv); // Add support for standard formats like 'url'

    const validate = ajv.compile(schema);

    // Validate the plan
    const valid = validate(plan);

    if (!valid && validate.errors) {
      console.error("Workout plan validation errors:", validate.errors);
      // Store AJV errors for potential detailed reporting
      // This might require extending WorkoutPlanGenerationStatus or emitting a separate event
    }

    return !!valid;
  } catch (error) {
    console.error("Error validating workout plan against schema:", error);

    // Fallback to basic validation if schema validation fails unexpectedly
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
    if (plan[field] === undefined || plan[field] === null) {
      // Check for undefined or null
      console.error(
        `Basic validation failed: Missing required field: ${field}`,
      );
      return false;
    }
  }

  // Check workout_plan required fields
  if (
    !plan.workout_plan ||
    !plan.workout_plan.structure_type ||
    !plan.workout_plan.schedule
  ) {
    console.error(
      "Basic validation failed: Missing required workout_plan fields",
    );
    return false;
  }

  // Check schedule has at least 5 days
  if (
    !Array.isArray(plan.workout_plan.schedule) ||
    plan.workout_plan.schedule.length < 5
  ) {
    console.error(
      `Basic validation failed: Workout schedule must contain at least 5 days, but found ${plan.workout_plan.schedule.length}`,
    );
    return false;
  }

  // Check exercises array
  if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) {
    console.error(
      "Basic validation failed: Exercises must be a non-empty array",
    );
    return false;
  }

  return true;
}

/**
 * Generate a minimal valid workout plan based on the schema requirements
 * To be used as a fallback when parsing fails or validation fails critical checks
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
      {
        // Adding more exercises to meet schema requirements implicitly
        exercise_name: "Pull-up (Assisted)",
        exercise_type: "Basics",
        description:
          "Hanging from a bar, pull yourself up until your chin is over the bar, using a resistance band for assistance.",
        target_muscles: ["Back", "Biceps", "Forearms"],
        progressions: [
          {
            level_name: "Resistance Band Assisted",
            description: "Use a resistance band for help.",
          },
        ],
      },
      {
        // Adding more exercises
        exercise_name: "Lunge",
        exercise_type: "Basics",
        description:
          "Step forward with one leg, lowering your hips until both knees are bent at a roughly 90-degree angle.",
        target_muscles: ["Quadriceps", "Glutes", "Hamstrings"],
      },
    ],
    workout_plan: {
      structure_type: "Weekly Split",
      schedule: [
        {
          day: "Day 1",
          focus: "Full Body Strength",
          routines: [
            {
              routine_name: "Strength Circuit A",
              routine_type: "Circuit",
              duration: "3 rounds",
              exercises_in_routine: [
                {
                  exercise_name: "Push-up",
                  sets: "Max",
                  reps: null,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Bodyweight Squat",
                  sets: "Max",
                  reps: null,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Plank",
                  sets: "Max",
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
          routines: [], // Keep routines array, but it can be empty
        },
        {
          day: "Day 3",
          focus: "Full Body Strength",
          routines: [
            {
              routine_name: "Strength Circuit B",
              routine_type: "Circuit",
              duration: "3 rounds",
              exercises_in_routine: [
                {
                  exercise_name: "Pull-up (Assisted)",
                  progression_level: "Resistance Band Assisted",
                  sets: "Max",
                  reps: null,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Lunge",
                  sets: "Max",
                  reps: "10 per leg",
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Plank",
                  sets: "Max",
                  duration: "30 seconds",
                  rest_after_exercise: "60 seconds",
                },
              ],
            },
          ],
        },
        {
          day: "Day 4",
          focus: "Active Recovery",
          routines: [
            {
              routine_name: "Light Mobility",
              routine_type: "Other",
              exercises_in_routine: [],
            },
          ],
        },
        {
          day: "Day 5",
          focus: "Full Body Strength",
          routines: [
            {
              routine_name: "Strength Circuit A", // Repeat circuit A
              routine_type: "Circuit",
              duration: "3 rounds",
              exercises_in_routine: [
                {
                  exercise_name: "Push-up",
                  sets: "Max",
                  reps: null,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Bodyweight Squat",
                  sets: "Max",
                  reps: null,
                  rest_after_exercise: "60 seconds",
                },
                {
                  exercise_name: "Plank",
                  sets: "Max",
                  duration: "30 seconds",
                  rest_after_exercise: "60 seconds",
                },
              ],
            },
          ],
        },
        {
          day: "Day 6",
          focus: "Rest",
          routines: [],
        },
        {
          day: "Day 7",
          focus: "Rest",
          routines: [],
        },
      ],
    },
    // Include empty or minimal optional sections to match schema if needed
    nutrition_advice: {
      overview:
        "Focus on a balanced diet with sufficient protein for muscle recovery.",
    },
    hydration_advice: {
      overview:
        "Stay well-hydrated throughout the day, especially around workouts.",
      recommended_intake:
        "Aim for 2-3 liters of water daily, adjusting based on activity level.",
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
    if (jsonMatch && jsonMatch[1]) {
      // Ensure match and capture group exist
      try {
        // Attempt parsing the content inside the code block
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        console.error("Error parsing JSON inside code block:", e);
        // Fallback to cleaning and trying again if initial parsing fails
        const cleanedJson = jsonMatch[1]
          .trim()
          .replace(/,\s*}/g, "}") // Remove trailing commas before closing brace
          .replace(/,\s*]/g, "]") // Remove trailing commas before closing bracket
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:\s*/g, '"$2": '); // Ensure keys are double-quoted and followed by colon and space
        try {
          return JSON.parse(cleanedJson);
        } catch (e2) {
          console.error("Error parsing cleaned JSON inside code block:", e2);
          return null; // Cleaning also failed
        }
      }
    }

    // Strategy 2: Try parsing the entire text if no code block is found
    try {
      // Attempt parsing the entire text directly
      return JSON.parse(text.trim());
    } catch (e) {
      console.error("Error parsing entire text as JSON:", e);
      return null; // Parsing entire text failed
    }

    // Strategy 3: Fallback (less reliable) - Try to extract JSON using a simple pattern (any content between the first '{' and last '}')
    // This is commented out because it's highly prone to errors with malformed JSON or extra text
    //  const simpleJsonMatch = text.match(/({[\s\S]*})/);
    //  if (simpleJsonMatch && simpleJsonMatch[1]) {
    //    try {
    //      return JSON.parse(simpleJsonMatch[1].trim());
    //    } catch (e) {
    //       console.error("Error parsing simple JSON match:", e);
    //      return null;
    //    }
    //  }

    // If none of the strategies worked
    return null;
  } catch (e) {
    console.error("Unexpected error in extractJsonFromText:", e);
    return null;
  }
}

/**
 * Wait for the complete JSON response from the LLM
 * This handles streaming responses by ensuring we get valid and complete JSON
 * @param prompt The prompt template
 * @param context The retrieved documents context
 * @param query The user query
 * @returns Complete JSON response string (may still require parsing)
 */
async function getCompleteJsonResponse(
  prompt: ChatPromptTemplate, // This will now be a ChatPromptTemplate created fromMessages
  context: string,
  query: string,
): Promise<string> {
  // Create a direct chain with the model and a string output parser
  // The 'model' is now ChatOpenAI, and 'prompt' is ChatPromptTemplate.fromMessages
  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  // Initialize variables for streaming
  let completeResponse = "";
  // We will collect the entire response before attempting to parse/validate
  // to avoid issues with incomplete JSON chunks during streaming.

  console.log("Starting LLM stream for workout plan generation...");
  // Stream the response
  try {
    const stream = await chain.stream({
      context,
      question: query,
    });

    // Collect all chunks
    // Stream the response
    for await (const chunk of stream) {
      completeResponse += chunk;
      // Optional: Emit partial progress based on chunks received if needed,
      // but full validation/parsing only happens after stream ends.
    }
    console.log("LLM stream finished.");
  } catch (error) {
    console.error("Error during LLM streaming:", error);
    // Rethrow or handle error. Ensure the error message is informative.
    throw new Error(`Error during LLM response streaming: ${error instanceof Error ? error.message : String(error)}`);
  }

  return completeResponse; // Return the complete response string
}

/**
 * Generate a workout plan based on user input and file sources
 * This function now runs as a background task and emits progress/completion via WebSocket.
 * @param planId The unique ID for this generation task
 * @param input The workout plan input parameters
 */
export async function generateWorkoutPlan(
  planId: string, // Accept planId from controller
  input: WorkoutPlanInput,
): Promise<void> {
  // Return void as it doesn't return the plan directly anymore
  try {
    // Update progress (status is already 'accepted' in controller)
    emitWorkoutPlanProgress(planId, {
      planId: planId,
      status: "generating", // Change status to generating as soon as the background task starts
      progress: 5, // Start progress slightly above 0
      step: "Starting workout plan generation",
    });

    // Destructure input
    const { query, fileIds, options } = input;

    // Validation was done in the controller, but could add more robust validation here too.
    // For now, assume input is valid based on controller's check.

    // Update progress
    emitWorkoutPlanProgress(planId, {
      planId: planId,
      progress: 15,
      step: "Retrieving relevant documents",
    });

    // Get documents filtered by fileIds
    let documents = await getDocumentsFromFileIds(
      fileIds,
      query,
      options?.topK || 8,
    );

    // If no documents found via semantic search + filter, try direct Supabase retrieval
    if (documents.length === 0) {
      console.warn(
        "No relevant documents found via semantic search + filter. Attempting direct retrieval from Supabase.",
      );
      documents = await getDocumentsDirectlyFromSupabase(fileIds);
      if (documents.length > 0) {
        console.log(
          `Retrieved ${documents.length} documents directly from Supabase.`,
        );
        // Note: Direct retrieval doesn't guarantee relevance to the query,
        // but ensures documents from the correct files are used.
      } else {
        console.error(
          "No documents found even with direct Supabase retrieval.",
        );
      }
    }

    if (documents.length === 0) {
      const errorMsg =
        "No relevant documents found for the provided file IDs after retrieval attempts. Cannot generate plan.";
      console.error(errorMsg);
      emitWorkoutPlanError(planId, {
        planId: planId,
        error: errorMsg,
        status: "failed",
        step: "Failed to retrieve documents",
        message: errorMsg,
        progress: 0,
      });
      return; // Exit the function if no documents
    }

    // Update progress
    emitWorkoutPlanProgress(planId, {
      planId: planId,
      progress: 30,
      step: "Preparing prompt for LLM",
    });

    // Get the training prompt template with schema included
    const systemMessageContent = await getTrainingPromptTemplate();
    const humanMessageTemplate = "Context: {context}\n\nQuestion: {question}";

    // Create a chat prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemMessageContent],
      ["human", humanMessageTemplate],
    ]);

    // Update progress
    emitWorkoutPlanProgress(planId, {
      planId: planId,
      progress: 40,
      step: "Generating personalized workout plan with AI",
    });

    // Extract the content from the documents to create context
    const context = documents.map((doc) => doc.pageContent).join("\n\n");

    // Get complete response using streaming to ensure we get all the JSON
    const completeResponseText = await getCompleteJsonResponse(
      prompt,
      context,
      query,
    );

    console.log("Complete LLM response received.");
    // Log a snippet or indicators of the raw response for debugging
    console.log(
      `Raw response start: ${completeResponseText.substring(0, 200)}...`,
    );
    console.log(`Raw response length: ${completeResponseText.length}`);

    // Update progress
    emitWorkoutPlanProgress(planId, {
      planId: planId,
      progress: 70, // Increased progress after getting response, before parsing/validation
      step: "Parsing and validating workout plan response",
    });

    // Parse the response as JSON
    let parsedPlan: WorkoutPlan | null = null; 
    let parsingError: Error | null = null; 

    try {
      // Attempt to extract and parse JSON from the LLM's response
      parsedPlan = extractJsonFromText(completeResponseText); // extractJsonFromText has its own internal try/catch for JSON.parse

      if (!parsedPlan) {
        // This means extractJsonFromText returned null (e.g., couldn't find ```json ... ``` or initial parsing failed)
        parsingError = new Error(
          "Failed to extract valid JSON from the LLM response (extractJsonFromText returned null)."
        );
        console.error(parsingError.message);
        // Log the full response if extractJsonFromText itself couldn't make sense of it
        console.error("--- BEGIN RAW LLM RESPONSE THAT extractJsonFromText COULD NOT PARSE ---");
        console.error(completeResponseText);
        console.error("--- END RAW LLM RESPONSE THAT extractJsonFromText COULD NOT PARSE ---");
      } else {
        console.log("Successfully parsed JSON from LLM response via extractJsonFromText.");
        if (parsedPlan.program_name) {
           console.log("Parsed Plan Name:", parsedPlan.program_name);
        } else {
           console.log("Parsed JSON, but program_name field is missing from the parsed object.");
        }
      }
    } catch (unexpectedErrorDuringExtraction) {
      // This catch is for any unexpected errors thrown by extractJsonFromText itself,
      // though it's designed to return null rather than throw for parsing issues.
      // Or if other code within this try block failed.
      console.error("Unexpected error during or immediately after JSON extraction attempt:", unexpectedErrorDuringExtraction);
      parsingError = unexpectedErrorDuringExtraction instanceof Error 
        ? unexpectedErrorDuringExtraction 
        : new Error(String(unexpectedErrorDuringExtraction));
      parsedPlan = null; // Ensure parsedPlan is null on any error
      // Log the full response if an unexpected error occurred here
      console.error("--- BEGIN RAW LLM RESPONSE THAT CAUSED UNEXPECTED EXTRACTION ERROR ---");
      console.error(completeResponseText);
      console.error("--- END RAW LLM RESPONSE THAT CAUSED UNEXPECTED EXTRACTION ERROR ---");
    }

    // Validate the plan against the schema or use a fallback if parsing failed
    let finalPlan: WorkoutPlan;
    let validationError: Error | null = null; // Track validation error

    if (parsedPlan) {
      try {
        const isValid = await validateWorkoutPlan(parsedPlan);
        if (isValid) {
          finalPlan = parsedPlan;
          console.log("Generated workout plan validated successfully.");
        } else {
          console.warn(
            "Generated plan failed schema validation. Using fallback plan.",
          );
          // Log validation errors if available from validateWorkoutPlan's internal logging
          validationError = new Error("Schema validation failed."); // Generic error for emission
          finalPlan = await generateMinimalValidPlan();
        }
      } catch (validationErr) {
        console.error(
          "Error during workout plan schema validation:",
          validationErr,
        );
        validationError =
          validationErr instanceof Error
            ? validationErr
            : new Error(String(validationErr)); // Store the error
        console.warn("Validation process failed. Using fallback plan.");
        finalPlan = await generateMinimalValidPlan();
      }
    } else {
      console.warn(
        "Parsed plan was null (JSON extraction failed). Using fallback plan.",
      );
      finalPlan = await generateMinimalValidPlan();
    }

    // After generating and validating (or falling back), save the final plan to the database
    try {
      // Pass the planId and the finalPlan object to saveWorkoutPlan
      await saveWorkoutPlan({ planId: planId, plan: finalPlan });
      console.log(`Workout plan with ID ${planId} saved to database.`);

      // Determine the final error message to emit
      let finalErrorMessage: string | undefined;
      if (parsingError) {
        finalErrorMessage = `Parsing failed: ${parsingError.message}`;
      } else if (validationError) {
        // Ensure validationError is an Error instance before accessing message
        finalErrorMessage = `Validation failed: ${validationError instanceof Error ? validationError.message : "Unknown validation error"}`;
      }

      // Determine the final message to emit
      let finalMessage: string;
      if (!parsingError && !validationError && finalPlan === parsedPlan) {
        finalMessage = "Workout plan generated and validated successfully.";
      } else if (finalPlan !== parsedPlan) {
        finalMessage =
          "Workout plan generation had issues (parsing or validation failed), using fallback plan.";
      } else {
        finalMessage = "Workout plan generation completed with errors."; // Should not happen if using fallback?
      }

      // Emit completion event via WebSocket, including the final plan and messages/errors
      emitWorkoutPlanComplete(planId, {
        planId: planId,
        status: "completed",
        progress: 100,
        step: "Workout plan generation completed and saved",
        result: finalPlan,
        message: finalMessage,
        error: finalErrorMessage,
      });
    } catch (dbError) {
      console.error(
        `Error saving workout plan ID ${planId} to database:`,
        dbError,
      );

      // If saving fails, emit an error event via WebSocket
      emitWorkoutPlanError(planId, {
        planId: planId,
        error:
          dbError instanceof Error
            ? dbError.message
            : "Failed to save workout plan to database",
        status: "failed",
        step: "Failed to save workout plan",
        message: "An error occurred while saving the workout plan.",
        progress: 0,
      });
    }
  } catch (error) {
    // This catch block handles errors that occur during the background task BEFORE the save attempt (e.g., document retrieval fails).
    console.error(
      `Unexpected error during workout plan generation process for ID ${planId}:`,
      error,
    );

    // Update progress with error via WebSocket
    emitWorkoutPlanError(planId, {
      planId: planId,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during workout plan generation.",
      status: "failed",
      progress: 0, // Reset progress on failure
      step: "Error during generation process",
      message: "Workout plan generation failed.",
    });
  }
}
