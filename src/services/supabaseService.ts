import supabase from "../config/supabase";

export async function saveWorkoutPlan(workoutPlanResult: {
  planId: string;
  plan: any;
}) {
  try {
    const planData = workoutPlanResult.plan;

    const { data, error } = await supabase
      .from("workout_plans")
      .insert([
        {
          id: workoutPlanResult.planId, // Ensure the provided planId is used as the table's id
          program_name: planData.program_name,
          program_goal: planData.program_goal,
          program_description: planData.program_description,
          required_gear: planData.required_gear,
          exercises: planData.exercises,
          workout_plan: planData.workout_plan,
          nutrition_advice: planData.nutrition_advice || null,
          hydration_advice: planData.hydration_advice || null,
        },
      ])
      .select();

    if (error) {
      console.error("Error saving workout plan to Supabase:", error);
      throw new Error("Failed to save workout plan");
    }

    console.log("Workout plan saved successfully:", data);
    return data; // Return the newly inserted data (including the ID)
  } catch (error) {
    console.error("Error saving workout plan:", error);
    throw new Error("Failed to save workout plan");
  }
}

export async function getWorkoutPlanById(planId: string) {
  try {
    const { data, error } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (error) {
      console.error("Error fetching workout plan from Supabase:", error);
      // It's common for .single() to return an error if no row is found.
      // You might want to check error.code or message to distinguish "not found" from other errors.
      // For example, PostgREST error PGRST116 indicates no rows found or more than one row was found.
      if (error.code === "PGRST116") {
        return null; // Or handle as "Not Found"
      }
      throw new Error("Failed to fetch workout plan");
    }

    return data;
  } catch (error) {
    console.error("Error fetching workout plan:", error);
    throw new Error("Failed to fetch workout plan");
  }
}
