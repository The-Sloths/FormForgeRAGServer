
    const schema = {
  "asyncapi": "3.0.0",
  "info": {
    "title": "FormForge RAG WebSocket API",
    "version": "1.0.0",
    "description": "# FormForge RAG WebSocket API Documentation\n\nThis WebSocket API provides real-time communication capabilities for the FormForge RAG Server.\nIt uses Socket.IO as the underlying transport protocol.\n\n## Main Features\n\n* Real-time upload progress tracking\n* Upload completion notifications\n* Error reporting for failed uploads\n* Room-based communication for isolating upload events\n\n## Client Integration Example\n\n```javascript\nimport { io } from 'socket.io-client';\n\n// Connect to the WebSocket server\nconst socket = io('http://localhost:3000');\n\n// Join a specific upload room to receive updates\nsocket.emit('joinUploadRoom', 'upload-123');\n\n// Listen for progress updates\nsocket.on('uploadProgress', (data) => {\n  console.log(`Upload ${data.uploadId} progress: ${data.percent}%`);\n  updateProgressBar(data.percent);\n});\n\n// Listen for completion\nsocket.on('uploadComplete', (data) => {\n  console.log(`Upload completed: ${data.chunks} chunks created`);\n  showCompletionMessage(data);\n});\n\n// Listen for errors\nsocket.on('uploadError', (data) => {\n  console.error(`Upload error: ${data.error}`);\n  showErrorMessage(data.error);\n});\n\n// Leave the room when done\nfunction cleanup() {\n  socket.emit('leaveUploadRoom', 'upload-123');\n}\n```\n",
    "contact": {
      "name": "FormForge Support",
      "url": "https://formforgerag.example.com/support",
      "email": "support@formforgerag.example.com"
    },
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT"
    }
  },
  "defaultContentType": "application/json",
  "servers": {
    "production": {
      "host": "api.formforgerag.example.com",
      "protocol": "wss",
      "description": "Production WebSocket server"
    },
    "development": {
      "host": "localhost:3000",
      "protocol": "ws",
      "description": "Development WebSocket server"
    }
  },
  "channels": {
    "joinUploadRoom": {
      "address": "joinUploadRoom",
      "description": "Channel for joining an upload room to receive notifications",
      "messages": {
        "joinUploadRoomMessage": {
          "name": "Join Upload Room Message",
          "description": "The unique upload ID string that identifies which upload room to join",
          "payload": {
            "type": "string",
            "description": "The unique upload ID",
            "example": "upload-123e4567-e89b-12d3-a456-426614174000",
            "x-parser-schema-id": "<anonymous-schema-1>"
          },
          "x-parser-unique-object-id": "joinUploadRoomMessage"
        }
      },
      "x-parser-unique-object-id": "joinUploadRoom"
    },
    "leaveUploadRoom": {
      "address": "leaveUploadRoom",
      "description": "Channel for leaving an upload room to stop receiving notifications",
      "messages": {
        "leaveUploadRoomMessage": {
          "name": "Leave Upload Room Message",
          "description": "The unique upload ID string that identifies which upload room to leave",
          "payload": {
            "type": "string",
            "description": "The unique upload ID",
            "example": "upload-123e4567-e89b-12d3-a456-426614174000",
            "x-parser-schema-id": "<anonymous-schema-2>"
          },
          "x-parser-unique-object-id": "leaveUploadRoomMessage"
        }
      },
      "x-parser-unique-object-id": "leaveUploadRoom"
    },
    "uploadProgress": {
      "address": "uploadProgress",
      "description": "Channel for receiving real-time upload progress updates",
      "messages": {
        "uploadProgressMessage": {
          "name": "Upload Progress Message",
          "description": "Contains information about the current progress of an upload",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "x-parser-schema-id": "<anonymous-schema-4>"
              },
              "bytesReceived": {
                "type": "integer",
                "description": "Number of bytes received so far",
                "x-parser-schema-id": "<anonymous-schema-5>"
              },
              "bytesExpected": {
                "type": "integer",
                "description": "Total number of bytes expected for the complete upload",
                "x-parser-schema-id": "<anonymous-schema-6>"
              },
              "percent": {
                "type": "integer",
                "description": "Percentage of upload completed (0-100)",
                "x-parser-schema-id": "<anonymous-schema-7>"
              },
              "completed": {
                "type": "boolean",
                "description": "Whether the upload has completed (will be false during progress events)",
                "x-parser-schema-id": "<anonymous-schema-8>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-3>"
          },
          "x-parser-unique-object-id": "uploadProgressMessage"
        }
      },
      "x-parser-unique-object-id": "uploadProgress"
    },
    "uploadComplete": {
      "address": "uploadComplete",
      "description": "Channel for receiving upload completion notifications",
      "messages": {
        "uploadCompleteMessage": {
          "name": "Upload Complete Message",
          "description": "Contains information about a completed upload including processing results",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "x-parser-schema-id": "<anonymous-schema-10>"
              },
              "message": {
                "type": "string",
                "description": "Success message",
                "x-parser-schema-id": "<anonymous-schema-11>"
              },
              "filename": {
                "type": "string",
                "description": "Original filename",
                "x-parser-schema-id": "<anonymous-schema-12>"
              },
              "chunks": {
                "type": "integer",
                "description": "Number of chunks created during processing",
                "x-parser-schema-id": "<anonymous-schema-13>"
              },
              "totalCharacters": {
                "type": "integer",
                "description": "Total characters processed from the document",
                "x-parser-schema-id": "<anonymous-schema-14>"
              },
              "completed": {
                "type": "boolean",
                "description": "Always true for completion events",
                "x-parser-schema-id": "<anonymous-schema-15>"
              },
              "bytesReceived": {
                "type": "integer",
                "description": "Final number of bytes received",
                "x-parser-schema-id": "<anonymous-schema-16>"
              },
              "bytesExpected": {
                "type": "integer",
                "description": "Total bytes expected",
                "x-parser-schema-id": "<anonymous-schema-17>"
              },
              "percent": {
                "type": "integer",
                "description": "Final percentage (should be 100)",
                "x-parser-schema-id": "<anonymous-schema-18>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-9>"
          },
          "x-parser-unique-object-id": "uploadCompleteMessage"
        }
      },
      "x-parser-unique-object-id": "uploadComplete"
    },
    "uploadError": {
      "address": "uploadError",
      "description": "Channel for receiving upload error notifications",
      "messages": {
        "uploadErrorMessage": {
          "name": "Upload Error Message",
          "description": "Contains error information about a failed upload",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "x-parser-schema-id": "<anonymous-schema-20>"
              },
              "error": {
                "type": "string",
                "description": "Error message",
                "x-parser-schema-id": "<anonymous-schema-21>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-19>"
          },
          "x-parser-unique-object-id": "uploadErrorMessage"
        }
      },
      "x-parser-unique-object-id": "uploadError"
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT token for authentication"
      }
    },
    "messages": {
      "joinUploadRoomMessage": "$ref:$.channels.joinUploadRoom.messages.joinUploadRoomMessage",
      "leaveUploadRoomMessage": "$ref:$.channels.leaveUploadRoom.messages.leaveUploadRoomMessage",
      "uploadProgressMessage": "$ref:$.channels.uploadProgress.messages.uploadProgressMessage",
      "uploadCompleteMessage": "$ref:$.channels.uploadComplete.messages.uploadCompleteMessage",
      "uploadErrorMessage": "$ref:$.channels.uploadError.messages.uploadErrorMessage"
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  