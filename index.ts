import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import ragRoutes from "./src/routes/ragRoutes";
// Routes

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(cors());
app.use(express.json());

// Routes
app.use("/api/rag", ragRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve(__dirname, "../../client/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../../client/dist/index.html"));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
