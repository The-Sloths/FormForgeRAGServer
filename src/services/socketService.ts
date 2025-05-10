import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { Server as HttpsServer } from "https";

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
