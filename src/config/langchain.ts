import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai"; // Import ChatOpenAI
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
// Remove OpenAI import if only ChatOpenAI is used for this model instance
import supabase from "./supabase";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Check if OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API key in environment variables");
}

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase vector store
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
});

// Initialize ChatOpenAI model
const model = new ChatOpenAI({
  temperature: 0.2,
  openAIApiKey: process.env.OPENAI_API_KEY,
  maxTokens: 3000, // Increased max tokens for longer JSON output
  modelName: "gpt-4o-mini", // Specify the chat model name
});

export { embeddings, vectorStore, model };
