import fs from "fs";
import path from "path";

/**
 * AsyncAPI specification documentation
 * This specification provides detailed documentation for all WebSocket events
 * used in the FormForge RAG Server with Socket.IO
 */
const asyncApiSpec = {
  asyncapi: "3.0.0",
  id: "urn:formforge:websocket-api",
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
  servers: {
    production: {
      host: "api.formforgerag.example.com",
      protocol: "wss",
      description: "Production WebSocket server",
    },
    development: {
      host: "localhost:3000",
      protocol: "ws",
      description: "Development WebSocket server",
    },
  },
  defaultContentType: "application/json",
  channels: {
    joinUploadRoom: {
      address: "joinUploadRoom",
      description:
        "Channel for joining an upload room to receive notifications",
      messages: {
        joinUploadRoomMessage: {
          name: "Join Upload Room Message",
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
      address: "leaveUploadRoom",
      description:
        "Channel for leaving an upload room to stop receiving notifications",
      messages: {
        leaveUploadRoomMessage: {
          name: "Leave Upload Room Message",
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
      address: "uploadProgress",
      description: "Channel for receiving real-time upload progress updates",
      messages: {
        uploadProgressMessage: {
          name: "Upload Progress Message",
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
          },
        },
      },
    },
    uploadComplete: {
      address: "uploadComplete",
      description: "Channel for receiving upload completion notifications",
      messages: {
        uploadCompleteMessage: {
          name: "Upload Complete Message",
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
          },
        },
      },
    },
    uploadError: {
      address: "uploadError",
      description: "Channel for receiving upload error notifications",
      messages: {
        uploadErrorMessage: {
          name: "Upload Error Message",
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
          },
        },
      },
    },
  },
};

// Write the AsyncAPI spec directly as JSON
const asyncApiJson = JSON.stringify(asyncApiSpec, null, 2);
fs.writeFileSync(path.join(__dirname, "../../asyncapi.json"), asyncApiJson);

// Add an endpoint to serve the AsyncAPI specification
console.log("AsyncAPI specification generated at asyncapi.json");
