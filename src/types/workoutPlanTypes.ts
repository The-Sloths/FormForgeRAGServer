// Document types
export interface DocumentInput {
  text: string;
  metadata?: Record<string, any>;
}

// Query types
export interface QueryInput {
  query: string;
  options?: {
    topK?: number;
    similarity?: number;
  };
}

export interface QueryResponse {
  answer: string;
  sources?: Array<{
    content: string;
    metadata?: Record<string, any>;
    similarity?: number;
  }>;
}

// Error types
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

// File upload response
export interface FileUploadResponse {
  filename: string;
  chunks: number;
  totalCharacters: number;
  message: string;
}

// File upload options
export interface FileUploadOptions {
  splitByChunks?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, any>;
}

export interface FileDocument {
  id: string;
  filePath: string;
  fileType: string;
  originalName: string;
  metadata?: Record<string, any>;
  status?: "uploaded" | "processing" | "processed" | "error";
  processed?: boolean;
  error?: string;
}

// Workout Plan Schema Types

// Options for workout plan generation
export interface WorkoutPlanInputOptions {
  topK?: number;
  includeNutrition?: boolean;
  includeHydration?: boolean;
  fitnessLevel?: "beginner" | "intermediate" | "advanced";
  specificGoals?: string[];
  excludedExercises?: string[];
}

// Input for generating a workout plan
export interface WorkoutPlanInput {
  query: string;
  fileIds: string[];
  options?: WorkoutPlanInputOptions;
}

// Export the WorkoutPlanGenerationStatus interface
export interface WorkoutPlanGenerationStatus {
  planId: string;
  status: "queued" | "accepted" | "generating" | "completed" | "failed"; // Added 'accepted'
  progress: number; // 0-100
  step: string;
  message?: string;
  error?: string;
  result?: WorkoutPlan; // Make result optional as it's only present on completion
}

// Exercise Types
interface ExerciseProgression {
  level_name: string;
  description: string;
}

interface Exercise {
  exercise_name: string;
  exercise_type:
    | "Basics"
    | "Skill"
    | "Static Hold"
    | "Dynamic"
    | "Stretch"
    | "Mobility Drill"
    | "Cardio"
    | "Weighted"
    | "Freestyle"
    | "Other";
  description: string;
  target_muscles: string[];
  video_url?: string | null;
  progressions?: ExerciseProgression[] | null;
}

// Workout Plan Types
interface ExerciseInRoutine {
  exercise_name: string;
  progression_level?: string | null;
  sets?: number | string | null;
  reps?: number | string | null;
  duration?: string | number | null;
  rest_after_exercise?: string | number | null;
  notes?: string | null;
}

interface Routine {
  routine_name: string;
  routine_type:
    | "Standard Sets/Reps"
    | "Circuit"
    | "AMRAP"
    | "EMOM"
    | "Tabata"
    | "Warm-up"
    | "Cool-down"
    | "Greasing the Groove Session"
    | "Other";
  duration?: string | null;
  notes?: string | null;
  exercises_in_routine: ExerciseInRoutine[];
}

interface WorkoutDay {
  day: string;
  focus: string;
  routines: Routine[];
}

interface WorkoutPlanStructure {
  structure_type:
    | "Weekly Split"
    | "Circuit Based"
    | "AMRAP"
    | "EMOM"
    | "Tabata"
    | "Greasing the Groove"
    | "Other";
  schedule: WorkoutDay[];
}

// Nutrition Types
interface NutritionPrinciple {
  principle_name: string;
  description: string;
}

interface MacronutrientGuidelines {
  calories?: string;
  carbohydrates?: string;
  protein?: string;
  fats?: string;
}

interface Meal {
  time?: string;
  meal_type: string;
  consumption: string;
}

interface MealPlan {
  plan_name: string;
  meals: Meal[];
}

interface NutritionAdvice {
  overview: string;
  key_principles?: NutritionPrinciple[];
  macronutrients_guidelines?: MacronutrientGuidelines;
  example_meal_plans?: MealPlan[] | null;
}

interface HydrationAdvice {
  overview: string;
  recommended_intake?: string;
}

// Complete Workout Plan
export interface WorkoutPlan {
  program_name: string;
  program_goal: string;
  program_description: string;
  required_gear: string[];
  exercises: Exercise[];
  workout_plan: WorkoutPlanStructure;
  nutrition_advice?: NutritionAdvice | null;
  hydration_advice?: HydrationAdvice | null;
}

// Response types
export interface WorkoutPlanResponse {
  planId: string;
  plan: WorkoutPlan;
  sources?: Array<{
    content: string;
    metadata?: Record<string, any>;
    similarity?: number;
  }>;
  message: string;
}
