
    const schema = {
  "asyncapi": "3.0.0",
  "id": "urn:formforge:websocket-api",
  "info": {
    "title": "FormForge RAG WebSocket API",
    "version": "1.0.0",
    "description": "\n# FormForge RAG WebSocket API Documentation\n\nThis WebSocket API provides real-time communication capabilities for the FormForge RAG Server.\nIt uses Socket.IO as the underlying transport protocol for bidirectional, event-based communication.\n\n## Main Features\n\n* Real-time upload progress tracking\n* Upload completion notifications\n* Error reporting for failed uploads\n* Room-based communication for isolating upload events\n\n## Socket.IO Room Pattern\n\nThe server uses a room-based pattern for delivering targeted events:\n* When joining a room, clients are subscribed to `upload:{uploadId}`\n* All progress events are emitted only to clients in the appropriate room\n* This ensures clients only receive events relevant to their uploads\n\n## Client Integration Example\n\n```javascript\nimport { io } from 'socket.io-client';\n\n// Connect to the WebSocket server\nconst socket = io('http://localhost:3000');\n\n// After starting a file upload and receiving uploadId from the response\nconst uploadId = \"upload-123\";\n\n// Join a specific upload room to receive updates\nsocket.emit('joinUploadRoom', uploadId);\n\n// Listen for progress updates\nsocket.on('uploadProgress', (data) => {\n  console.log(`Upload ${data.uploadId} progress: ${data.percent}%`);\n  updateProgressBar(data.percent);\n});\n\n// Listen for completion\nsocket.on('uploadComplete', (data) => {\n  console.log(`Upload completed: ${data.chunks} chunks created`);\n  showCompletionMessage(data);\n});\n\n// Listen for errors\nsocket.on('uploadError', (data) => {\n  console.error(`Upload error: ${data.error}`);\n  showErrorMessage(data.error);\n});\n\n// Leave the room when done\nfunction cleanup() {\n  socket.emit('leaveUploadRoom', uploadId);\n}\n```\n",
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
  "servers": {
    "production": {
      "host": "api.formforgerag.example.com",
      "protocol": "ws",
      "protocolVersion": "socket.io",
      "description": "Production Socket.IO server"
    },
    "development": {
      "host": "localhost:3000",
      "protocol": "ws",
      "protocolVersion": "socket.io",
      "description": "Development Socket.IO server"
    }
  },
  "defaultContentType": "application/json",
  "channels": {
    "joinUploadRoom": {
      "address": "joinUploadRoom",
      "description": "Channel for joining an upload room to receive notifications for a specific upload. Server creates a room named 'upload:{uploadId}'.",
      "messages": {
        "joinUploadRoomMessage": {
          "name": "JoinUploadRoom Message",
          "description": "The unique upload ID string that identifies which upload room to join",
          "payload": {
            "type": "object",
            "description": "The unique upload ID (server will prepend 'upload:' to create the room name)",
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
      "description": "Channel for leaving an upload room to stop receiving notifications. Leaves the room named 'upload:{uploadId}'.",
      "messages": {
        "leaveUploadRoomMessage": {
          "name": "LeaveUploadRoom Message",
          "description": "The unique upload ID string that identifies which upload room to leave",
          "payload": {
            "type": "object",
            "description": "The unique upload ID (server will prepend 'upload:' to match the room name)",
            "example": "upload-123e4567-e89b-12d3-a456-426614174000",
            "x-parser-schema-id": "<anonymous-schema-2>"
          },
          "x-parser-unique-object-id": "leaveUploadRoomMessage"
        }
      },
      "x-parser-unique-object-id": "leaveUploadRoom"
    },
    "disconnect": {
      "address": "disconnect",
      "description": "Channel for the disconnect event.",
      "messages": {
        "disconnectMessage": {
          "name": "Disconnect Message",
          "description": "Message for the disconnect event.",
          "payload": {
            "type": "object",
            "description": "Payload for the disconnect event.",
            "example": "upload-123e4567-e89b-12d3-a456-426614174000",
            "x-parser-schema-id": "<anonymous-schema-3>"
          },
          "x-parser-unique-object-id": "disconnectMessage"
        }
      },
      "x-parser-unique-object-id": "disconnect"
    },
    "uploadProgress": {
      "address": "uploadProgress",
      "description": "Channel for receiving real-time upload progress updates. Events are emitted to the 'upload:{uploadId}' room.",
      "messages": {
        "uploadProgressMessage": {
          "name": "UploadProgress Message",
          "description": "Contains information about the current progress of an upload",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-5>"
              },
              "bytesReceived": {
                "type": "integer",
                "description": "Number of bytes received so far",
                "example": 1048576,
                "x-parser-schema-id": "<anonymous-schema-6>"
              },
              "bytesExpected": {
                "type": "integer",
                "description": "Total number of bytes expected for the complete upload",
                "example": 5242880,
                "x-parser-schema-id": "<anonymous-schema-7>"
              },
              "percent": {
                "type": "integer",
                "description": "Percentage of upload completed (0-100)",
                "minimum": 0,
                "maximum": 100,
                "example": 20,
                "x-parser-schema-id": "<anonymous-schema-8>"
              },
              "completed": {
                "type": "boolean",
                "description": "Whether the upload has completed (will be false during progress events)",
                "example": false,
                "x-parser-schema-id": "<anonymous-schema-9>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-4>"
          },
          "x-parser-unique-object-id": "uploadProgressMessage"
        }
      },
      "x-parser-unique-object-id": "uploadProgress"
    },
    "uploadComplete": {
      "address": "uploadComplete",
      "description": "Channel for receiving upload completion notifications. Events are emitted to the 'upload:{uploadId}' room.",
      "messages": {
        "uploadCompleteMessage": {
          "name": "UploadComplete Message",
          "description": "Contains information about a completed upload including processing results",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-11>"
              },
              "message": {
                "type": "string",
                "description": "Success message",
                "example": "File processed successfully",
                "x-parser-schema-id": "<anonymous-schema-12>"
              },
              "filename": {
                "type": "string",
                "description": "Original filename",
                "example": "document.pdf",
                "x-parser-schema-id": "<anonymous-schema-13>"
              },
              "chunks": {
                "type": "integer",
                "description": "Number of chunks created during processing",
                "example": 42,
                "x-parser-schema-id": "<anonymous-schema-14>"
              },
              "totalCharacters": {
                "type": "integer",
                "description": "Total characters processed from the document",
                "example": 125000,
                "x-parser-schema-id": "<anonymous-schema-15>"
              },
              "completed": {
                "type": "boolean",
                "description": "Always true for completion events",
                "example": true,
                "x-parser-schema-id": "<anonymous-schema-16>"
              },
              "bytesReceived": {
                "type": "integer",
                "description": "Final number of bytes received",
                "example": 5242880,
                "x-parser-schema-id": "<anonymous-schema-17>"
              },
              "bytesExpected": {
                "type": "integer",
                "description": "Total bytes expected",
                "example": 5242880,
                "x-parser-schema-id": "<anonymous-schema-18>"
              },
              "percent": {
                "type": "integer",
                "description": "Final percentage (should be 100)",
                "example": 100,
                "x-parser-schema-id": "<anonymous-schema-19>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-10>"
          },
          "x-parser-unique-object-id": "uploadCompleteMessage"
        }
      },
      "x-parser-unique-object-id": "uploadComplete"
    },
    "uploadError": {
      "address": "uploadError",
      "description": "Channel for receiving upload error notifications. Events are emitted to the 'upload:{uploadId}' room.",
      "messages": {
        "uploadErrorMessage": {
          "name": "UploadError Message",
          "description": "Contains error information about a failed upload",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-21>"
              },
              "error": {
                "type": "string",
                "description": "Error message",
                "example": "File format not supported",
                "x-parser-schema-id": "<anonymous-schema-22>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-20>"
          },
          "x-parser-unique-object-id": "uploadErrorMessage"
        }
      },
      "x-parser-unique-object-id": "uploadError"
    },
    "processingStart": {
      "address": "processingStart",
      "description": "Channel for the processingStart event.",
      "messages": {
        "processingStartMessage": {
          "name": "ProcessingStart Message",
          "description": "Message for the processingStart event.",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-24>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-23>"
          },
          "x-parser-unique-object-id": "processingStartMessage"
        }
      },
      "x-parser-unique-object-id": "processingStart"
    },
    "processingProgress": {
      "address": "processingProgress",
      "description": "Channel for the processingProgress event.",
      "messages": {
        "processingProgressMessage": {
          "name": "ProcessingProgress Message",
          "description": "Message for the processingProgress event.",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-26>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-25>"
          },
          "x-parser-unique-object-id": "processingProgressMessage"
        }
      },
      "x-parser-unique-object-id": "processingProgress"
    },
    "processingComplete": {
      "address": "processingComplete",
      "description": "Channel for the processingComplete event.",
      "messages": {
        "processingCompleteMessage": {
          "name": "ProcessingComplete Message",
          "description": "Message for the processingComplete event.",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-28>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-27>"
          },
          "x-parser-unique-object-id": "processingCompleteMessage"
        }
      },
      "x-parser-unique-object-id": "processingComplete"
    },
    "processingError": {
      "address": "processingError",
      "description": "Channel for the processingError event.",
      "messages": {
        "processingErrorMessage": {
          "name": "ProcessingError Message",
          "description": "Message for the processingError event.",
          "payload": {
            "type": "object",
            "properties": {
              "uploadId": {
                "type": "string",
                "description": "Unique ID for the upload",
                "example": "upload-123e4567-e89b-12d3-a456-426614174000",
                "x-parser-schema-id": "<anonymous-schema-30>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-29>"
          },
          "x-parser-unique-object-id": "processingErrorMessage"
        }
      },
      "x-parser-unique-object-id": "processingError"
    }
  },
  "components": {
    "securitySchemes": {
      "socketIoAuth": {
        "type": "userPassword",
        "description": "Socket.IO allows connection authentication through query parameters or headers"
      }
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
  