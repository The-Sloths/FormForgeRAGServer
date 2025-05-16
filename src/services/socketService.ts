import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { Server as HttpsServer } from "https";
import { getUploadProgress } from "./uploadProgressService";
import { getWorkoutPlanStatus } from "./workoutPlanService"; // Imports the function, not the type directly
// Import the WorkoutPlanGenerationStatus type
import { WorkoutPlanGenerationStatus } from "../types/workoutPlanTypes";

// Singleton instance of socket.io server
let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server with HTTP/HTTPS server
 * @param server HTTP or HTTPS server
 */
export const initSocketIO = (server: HttpServer | HttpsServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // In production, restrict to your frontend domain
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Upload room events
    socket.on("joinUploadRoom", (uploadId: string) => {
      socket.join(`upload:${uploadId}`);
      console.log(`Client ${socket.id} joined upload room: ${uploadId}`);

      // Send the current progress status immediately to the newly joined client
      const uploadData = getUploadProgress(uploadId);
      if (uploadData) {
        // Send current progress state to just this socket
        socket.emit("uploadProgress", {
          uploadId,
          ...uploadData,
        });

        // If already completed, send complete event too
        if (uploadData.completed) {
          socket.emit("uploadComplete", {
            uploadId,
            ...uploadData,
            ...(uploadData.resultData || {}),
          });
        } else if (uploadData.error) {
          socket.emit("uploadError", {
            uploadId,
            error: uploadData.error,
          });
        }
      }
    });

    socket.on("leaveUploadRoom", (uploadId: string) => {
      socket.leave(`upload:${uploadId}`);
      console.log(`Client ${socket.id} left upload room: ${uploadId}`);
    });

    // Workout plan room events
    socket.on("joinWorkoutPlanRoom", (planId: string) => {
      socket.join(`workoutPlan:${planId}`);
      console.log(`Client ${socket.id} joined workout plan room: ${planId}`);

      // Send the current progress status immediately to the newly joined client
      const planStatus = getWorkoutPlanStatus(planId);
      if (planStatus) {
        // Send current status to just this socket
        socket.emit("workoutPlanProgress", planStatus); // planStatus already contains planId

        // If already completed or failed, send the appropriate event
        if (planStatus.status === "completed") {
          socket.emit("workoutPlanComplete", planStatus); // planStatus contains planId and result
        } else if (planStatus.status === "failed") {
          socket.emit("workoutPlanError", planStatus); // planStatus contains planId and error
        }
      }
    });

    socket.on("leaveWorkoutPlanRoom", (planId: string) => {
      socket.leave(`workoutPlan:${planId}`);
      console.log(`Client ${socket.id} left workout plan room: ${planId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  console.log("Socket.IO server initialized");
  return io;
};

/**
 * Get the Socket.IO server instance
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocketIO first.");
  }
  return io;
};

/**
 * Emit upload progress event to clients in the upload room
 * @param uploadId Upload ID
 * @param data Progress data
 */
export const emitUploadProgress = (uploadId: string, data: any) => {
  if (!io) return;

  io.to(`upload:${uploadId}`).emit("uploadProgress", {
    uploadId,
    ...data,
  });
};

/**
 * Emit upload complete event to clients in the upload room
 * @param uploadId Upload ID
 * @param data Completion data
 */
export const emitUploadComplete = (uploadId: string, data: any) => {
  if (!io) return;

  io.to(`upload:${uploadId}`).emit("uploadComplete", {
    uploadId,
    ...data,
  });
};

/**
 * Emit upload error event to clients in the upload room
 * @param uploadId Upload ID
 * @param error Error message or object
 */
export const emitUploadError = (uploadId: string, error: any) => {
  if (!io) return;

  // If 'error' is an object, spread it, otherwise send it as is.
  // Assuming the structure from failUpload is { ...progress, error: errorMessage }
  // If error is just a string, we'd structure it as { uploadId, error: errorMessage }
  // Based on failUpload, `error` itself could be just the errorMessage string
  // Let's assume the data structure sent includes the uploadId.
  if (typeof error === "object" && error !== null && error.uploadId) {
    io.to(`upload:${uploadId}`).emit("uploadError", error);
  } else {
    io.to(`upload:${uploadId}`).emit("uploadError", {
      uploadId,
      error, // Assuming error is the message or a simple error object
    });
  }
};

/**
 * Emit processing start event
 * @param uploadId Upload ID
 * @param data Processing data
 */
export const emitProcessingStart = (uploadId: string, data: any) => {
  if (!io) return;

  io.to(`upload:${uploadId}`).emit("processingStart", {
    uploadId,
    ...data,
  });
};

/**
 * Emit processing progress event
 * @param uploadId Upload ID
 * @param data Progress data
 */
export const emitProcessingProgress = (uploadId: string, data: any) => {
  if (!io) return;

  // The data object for processingProgress already contains uploadId from the service.
  // So, we can directly emit it.
  io.to(`upload:${uploadId}`).emit("processingProgress", data);
};

/**
 * Emit processing complete event
 * @param uploadId Upload ID
 * @param data Completion data
 */
export const emitProcessingComplete = (uploadId: string, data: any) => {
  if (!io) return;

  // The data object for processingComplete already contains uploadId from the service.
  io.to(`upload:${uploadId}`).emit("processingComplete", data);
};

/**
 * Emit processing error event
 * @param uploadId Upload ID
 * @param error Error data (should already include uploadId from the service)
 */
export const emitProcessingError = (uploadId: string, error: any) => {
  if (!io) return;

  // The 'error' object from fileController/background processing already contains uploadId and other details.
  io.to(`upload:${uploadId}`).emit("processingError", error);
};

/**
 * Emit workout plan progress event
 * @param planId Workout plan ID
 * @param data Progress data (Partial<WorkoutPlanGenerationStatus>)
 *             This data object *already includes* planId.
 */
export const emitWorkoutPlanProgress = (
  planId: string,
  data: Partial<WorkoutPlanGenerationStatus>,
) => {
  if (!io) return;
  // The `data` object (Partial<WorkoutPlanGenerationStatus>) should already have the planId.
  // No need to pass planId separately if data.planId is guaranteed.
  io.to(`workoutPlan:${planId}`).emit("workoutPlanProgress", data);
};

/**
 * Emit workout plan complete event
 * @param planId Workout plan ID
 * @param data Completion data (WorkoutPlanGenerationStatus)
 *             This data object *already includes* planId and the result.
 */
export const emitWorkoutPlanComplete = (
  planId: string,
  data: WorkoutPlanGenerationStatus,
) => {
  if (!io) return;
  // The `data` object (WorkoutPlanGenerationStatus) should already have the planId and the result.
  io.to(`workoutPlan:${planId}`).emit("workoutPlanComplete", data);
};

/**
 * Emit workout plan error event
 * @param planId Workout plan ID
 * @param data Error data (WorkoutPlanGenerationStatus with error details)
 *             This data object *already includes* planId and error details.
 */
export const emitWorkoutPlanError = (
  planId: string,
  data: WorkoutPlanGenerationStatus,
) => {
  if (!io) return;
  // The `data` object (WorkoutPlanGenerationStatus) should already have the planId and error details.
  io.to(`workoutPlan:${planId}`).emit("workoutPlanError", data);
};
