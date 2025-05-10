import fs from "fs";
import path from "path";
import YAML from "yaml";

/**
 * Enhanced AsyncAPI specification with context7 level documentation
 * This specification provides detailed documentation for all WebSocket events
 * used in the FormForge RAG Server
 */
const asyncApiSpecEnhanced = {
  asyncapi: "3.0.0", // Updated to version 3.0.0 as recommended
  id: "urn:formforge:websocket-api", // Added id field
  info: {
    title: "FormForge RAG WebSocket API",
    version: "1.0.0",
    description: `
# FormForge RAG WebSocket API Documentation

This WebSocket API provides real-time communication capabilities for the FormForge RAG Server.
It uses Socket.IO as the underlying transport protocol.

## Main Features

* Real-time upload progress tracking
* Upload completion notifications
* Error reporting for failed uploads
* Room-based communication for isolating upload events

## Client Integration Example

\`\`\`javascript
import { io } from 'socket.io-client';

// Connect to the WebSocket server
const socket = io('http://localhost:3000');

// Join a specific upload room to receive updates
socket.emit('joinUploadRoom', 'upload-123');

// Listen for progress updates
socket.on('uploadProgress', (data) => {
  console.log(\`Upload \${data.uploadId} progress: \${data.percent}%\`);
  updateProgressBar(data.percent);
});

// Listen for completion
socket.on('uploadComplete', (data) => {
  console.log(\`Upload completed: \${data.chunks} chunks created\`);
  showCompletionMessage(data);
});

// Listen for errors
socket.on('uploadError', (data) => {
  console.error(\`Upload error: \${data.error}\`);
  showErrorMessage(data.error);
});

// Leave the room when done
function cleanup() {
  socket.emit('leaveUploadRoom', 'upload-123');
}
\`\`\`
`,
    contact: {
      name: "FormForge Support",
      url: "https://formforgerag.example.com/support",
      email: "support@formforgerag.example.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  // Added root-level tags
  tags: [
    {
      name: "upload",
      description: "Upload-related operations",
    },
    {
      name: "rooms",
      description: "Room management operations",
    },
    {
      name: "notifications",
      description: "Notification events",
    },
  ],
  servers: {
    production: {
      host: "api.formforgerag.example.com",
      protocol: "wss",
      protocolVersion: "socket.io",
      description: "Production WebSocket server",
      security: [
        {
          // Reference the security scheme directly without using an array
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token for authentication",
        },
      ],
    },
    development: {
      host: "localhost:3000",
      protocol: "ws",
      protocolVersion: "socket.io",
      description: "Development WebSocket server",
    },
  },
  defaultContentType: "application/json",
  channels: {
    joinUploadRoom: {
      description:
        "Channel for joining an upload room to receive notifications for a specific upload",
      publish: {
        summary: "Join a room to receive updates for a specific upload",
        operationId: "joinUploadRoom",
        tags: [{ name: "upload" }, { name: "rooms" }],
        message: {
          // Instead of using $ref, define the message directly
          messageId: "joinUploadRoomMessage",
          name: "joinUploadRoomMessage",
          title: "Join Upload Room Message",
          contentType: "text/plain",
          description:
            "The unique upload ID string that identifies which upload room to join",
          payload: {
            type: "string",
            description: "The unique upload ID",
            example: "upload-123e4567-e89b-12d3-a456-426614174000",
          },
        },
      },
    },
    leaveUploadRoom: {
      description:
        "Channel for leaving an upload room to stop receiving notifications",
      publish: {
        summary: "Leave a room to stop receiving updates for a specific upload",
        operationId: "leaveUploadRoom",
        tags: [{ name: "upload" }, { name: "rooms" }],
        message: {
          messageId: "leaveUploadRoomMessage",
          name: "leaveUploadRoomMessage",
          title: "Leave Upload Room Message",
          contentType: "text/plain",
          description:
            "The unique upload ID string that identifies which upload room to leave",
          payload: {
            type: "string",
            description: "The unique upload ID",
            example: "upload-123e4567-e89b-12d3-a456-426614174000",
          },
        },
      },
    },
    uploadProgress: {
      description: "Channel for receiving real-time upload progress updates",
      subscribe: {
        summary: "Receive notifications when an upload progress is updated",
        operationId: "uploadProgress",
        tags: [{ name: "upload" }, { name: "notifications" }],
        message: {
          messageId: "uploadProgressMessage",
          name: "uploadProgressMessage",
          title: "Upload Progress Message",
          contentType: "application/json",
          description:
            "Contains information about the current progress of an upload",
          payload: {
            type: "object",
            properties: {
              uploadId: {
                type: "string",
                description: "Unique ID for the upload",
                example: "upload-123e4567-e89b-12d3-a456-426614174000",
              },
              bytesReceived: {
                type: "integer",
                description: "Number of bytes received so far",
                example: 1048576,
              },
              bytesExpected: {
                type: "integer",
                description:
                  "Total number of bytes expected for the complete upload",
                example: 5242880,
              },
              percent: {
                type: "integer",
                description: "Percentage of upload completed (0-100)",
                minimum: 0,
                maximum: 100,
                example: 20,
              },
              completed: {
                type: "boolean",
                description:
                  "Whether the upload has completed (will be false during progress events)",
                example: false,
              },
            },
            required: [
              "uploadId",
              "bytesReceived",
              "bytesExpected",
              "percent",
              "completed",
            ],
          },
          examples: [
            {
              name: "startProgress",
              summary: "Initial progress",
              payload: {
                uploadId: "upload-123e4567-e89b-12d3-a456-426614174000",
                bytesReceived: 0,
                bytesExpected: 5242880,
                percent: 0,
                completed: false,
              },
            },
            {
              name: "midProgress",
              summary: "Mid-upload progress",
              payload: {
                uploadId: "upload-123e4567-e89b-12d3-a456-426614174000",
                bytesReceived: 2621440,
                bytesExpected: 5242880,
                percent: 50,
                completed: false,
              },
            },
          ],
        },
      },
    },
    uploadComplete: {
      description: "Channel for receiving upload completion notifications",
      subscribe: {
        summary:
          "Receive notification when an upload is completed and processed",
        operationId: "uploadComplete",
        tags: [{ name: "upload" }, { name: "notifications" }],
        message: {
          messageId: "uploadCompleteMessage",
          name: "uploadCompleteMessage",
          title: "Upload Complete Message",
          contentType: "application/json",
          description:
            "Contains information about a completed upload including processing results",
          payload: {
            type: "object",
            properties: {
              uploadId: {
                type: "string",
                description: "Unique ID for the upload",
                example: "upload-123e4567-e89b-12d3-a456-426614174000",
              },
              message: {
                type: "string",
                description: "Success message",
                example: "File processed successfully",
              },
              filename: {
                type: "string",
                description: "Original filename",
                example: "document.pdf",
              },
              chunks: {
                type: "integer",
                description: "Number of chunks created during processing",
                example: 42,
              },
              totalCharacters: {
                type: "integer",
                description: "Total characters processed from the document",
                example: 125000,
              },
              completed: {
                type: "boolean",
                description: "Always true for completion events",
                example: true,
              },
              bytesReceived: {
                type: "integer",
                description: "Final number of bytes received",
                example: 5242880,
              },
              bytesExpected: {
                type: "integer",
                description: "Total bytes expected",
                example: 5242880,
              },
              percent: {
                type: "integer",
                description: "Final percentage (should be 100)",
                example: 100,
              },
            },
            required: ["uploadId", "completed", "percent"],
          },
          examples: [
            {
              name: "standardCompletion",
              summary: "Standard completion",
              payload: {
                uploadId: "upload-123e4567-e89b-12d3-a456-426614174000",
                message: "File processed successfully",
                filename: "document.pdf",
                chunks: 42,
                totalCharacters: 125000,
                completed: true,
                bytesReceived: 5242880,
                bytesExpected: 5242880,
                percent: 100,
              },
            },
          ],
        },
      },
    },
    uploadError: {
      description: "Channel for receiving upload error notifications",
      subscribe: {
        summary: "Receive notification when an upload encounters an error",
        operationId: "uploadError",
        tags: [{ name: "upload" }, { name: "notifications" }],
        message: {
          messageId: "uploadErrorMessage",
          name: "uploadErrorMessage",
          title: "Upload Error Message",
          contentType: "application/json",
          description: "Contains error information about a failed upload",
          payload: {
            type: "object",
            properties: {
              uploadId: {
                type: "string",
                description: "Unique ID for the upload",
                example: "upload-123e4567-e89b-12d3-a456-426614174000",
              },
              error: {
                type: "string",
                description: "Error message",
                example: "File format not supported",
              },
            },
            required: ["uploadId", "error"],
          },
          examples: [
            {
              name: "formatError",
              summary: "Format error",
              payload: {
                uploadId: "upload-123e4567-e89b-12d3-a456-426614174000",
                error: "File format not supported",
              },
            },
            {
              name: "processingError",
              summary: "Processing error",
              payload: {
                uploadId: "upload-123e4567-e89b-12d3-a456-426614174000",
                error:
                  "Error during document processing: Invalid PDF structure",
              },
            },
          ],
        },
      },
    },
  },
};

/**
 * Generate and save the AsyncAPI specification to a YAML file
 */
try {
  // Convert AsyncAPI spec to YAML
  const asyncApiYaml = YAML.stringify(asyncApiSpecEnhanced);

  // Ensure the target directory exists
  const outputDir = path.dirname(path.join(__dirname, "../../asyncapi.yaml"));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write the YAML to file
  fs.writeFileSync(path.join(__dirname, "../../asyncapi.yaml"), asyncApiYaml);

  console.log(
    "AsyncAPI specification (context7) generated successfully at asyncapi.yaml",
  );

  // Inform the user how to generate HTML documentation
  console.log("\nTo generate HTML documentation, run:");
  console.log(
    "  npx @asyncapi/cli generate fromTemplate asyncapi.yaml @asyncapi/html-template -o websocket-docs",
  );
} catch (error) {
  console.error("Error generating AsyncAPI specification:", error);
  process.exit(1);
}
