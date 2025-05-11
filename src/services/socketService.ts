import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { Server as HttpsServer } from "https";
import { getUploadProgress } from "./uploadProgressService";

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

  io.to(`upload:${uploadId}`).emit("uploadError", {
    uploadId,
    error,
  });
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

  console.log(`Emitting processingProgress to room upload:${uploadId}`, {
    event: "processingProgress",
    roomName: `upload:${uploadId}`,
    data: {
      uploadId,
      ...data,
    },
  });

  io.to(`upload:${uploadId}`).emit("processingProgress", {
    uploadId,
    ...data,
  });
};

/**
 * Emit processing complete event
 * @param uploadId Upload ID
 * @param data Completion data
 */
export const emitProcessingComplete = (uploadId: string, data: any) => {
  if (!io) return;

  io.to(`upload:${uploadId}`).emit("processingComplete", {
    uploadId,
    ...data,
  });
};

/**
 * Emit processing error event
 * @param uploadId Upload ID
 * @param error Error message or object
 */
export const emitProcessingError = (uploadId: string, error: any) => {
  if (!io) return;

  io.to(`upload:${uploadId}`).emit("processingError", {
    uploadId,
    ...error,
  });
};
