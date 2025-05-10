import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import http from "http";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import ragRoutes from "./routes/ragRoutes";
import fileRoutes from "./routes/fileRoutes";
import { initSocketIO } from "./services/socketService";

// Load environment variables
dotenv.config();

// OpenAPI configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FormForge RAG API",
      version: "1.0.0",
      description:
        "API for Retrieval Augmented Generation using LangChain and Supabase",
      contact: {
        name: "Form Forge team",
        email: "formforgelabs@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/docs/*.ts"], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

// API Routes
app.use("/api/rag", ragRoutes);
app.use("/api/files", fileRoutes);

// OpenAPI Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
// Add raw Swagger JSON endpoint

app.get("/api-docs.json", (req, res) => {
  res.json(swaggerDocs);
});

// AsyncAPI Documentation
app.use(
  "/websocket-docs",
  express.static(path.join(__dirname, "../docs/websocket")),
);

// Serve AsyncAPI schema as JSON
app.get("/asyncapi.json", (req, res) => {
  res.sendFile(path.join(__dirname, "../asyncapi.json"));
});

// Root endpoint
app.get("/", (req, res) => {
  res.send({
    message: "FormForge RAG API Server",
    documentation: "/api-docs",
    websocket: "ws://localhost:" + PORT,
  });
});

// Make sure the uploads directory is ignored in production
if (process.env.NODE_ENV === "production") {
  app.use(
    express.static(path.resolve(__dirname, "../client/dist"), {
      index: false,
      // Exclude the uploads directory
      setHeaders: (res, path) => {
        if (path.includes("/uploads/")) {
          res.status(404).end();
        }
      },
    }),
  );
}

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  },
);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `API Documentation available at http://localhost:${PORT}/api-docs`,
  );
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

export default app;
