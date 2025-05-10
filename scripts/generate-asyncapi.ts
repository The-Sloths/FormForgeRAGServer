import fs from "fs";
import path from "path";
import ts from "typescript";

// Path configurations
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const SOCKET_SERVICE_PATH = path.join(SRC_DIR, "services", "socketService.ts");
const UPLOAD_PROGRESS_PATH = path.join(
  SRC_DIR,
  "services",
  "uploadProgressService.ts",
);
const OUTPUT_PATH = path.join(ROOT_DIR, "asyncapi.json");

/**
 * Parse TypeScript file to extract event names and handlers
 * @param filePath Path to the TypeScript file
 * @returns Object with client and server events
 */
function parseSocketEvents(filePath: string): {
  clientEvents: string[];
  serverEvents: { name: string; dataType: string }[];
} {
  const clientEvents: string[] = [];
  const serverEvents: { name: string; dataType: string }[] = [];

  // Read the file
  const fileContent = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  );

  // Visit each node in the AST
  function visit(node: ts.Node) {
    // Look for socket.on calls to identify client events
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.PropertyAccessExpression
    ) {
      const propAccess = node.expression as ts.PropertyAccessExpression;
      if (
        propAccess.name.text === "on" &&
        propAccess.expression.kind === ts.SyntaxKind.Identifier &&
        propAccess.expression.getText() === "socket"
      ) {
        // Extract the event name
        if (
          node.arguments.length > 0 &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          clientEvents.push(node.arguments[0].text);
        }
      }
    }

    // Look for emit functions to identify server events
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.name.text.startsWith("emit")
    ) {
      // Extract event name from function name (e.g., emitUploadProgress -> uploadProgress)
      const eventName = node.name.text.replace("emit", "");
      const eventNameCamelCase =
        eventName.charAt(0).toLowerCase() + eventName.slice(1);

      // Try to determine the data type
      let dataType = "any";
      if (node.parameters.length > 1) {
        dataType = node.parameters[1].type?.getText() || "any";
      }

      serverEvents.push({
        name: eventNameCamelCase,
        dataType,
      });
    }

    // Also check for io.to().emit() calls
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.PropertyAccessExpression
    ) {
      const propAccess = node.expression as ts.PropertyAccessExpression;
      if (propAccess.name.text === "emit") {
        // Check if we're in a chain like io.to(...).emit(...)
        const parent = propAccess.expression;
        if (
          ts.isCallExpression(parent) &&
          parent.expression.kind === ts.SyntaxKind.PropertyAccessExpression
        ) {
          const toAccess = parent.expression as ts.PropertyAccessExpression;
          if (toAccess.name.text === "to") {
            // This is an io.to().emit() call
            if (
              node.arguments.length > 0 &&
              ts.isStringLiteral(node.arguments[0])
            ) {
              serverEvents.push({
                name: node.arguments[0].text,
                dataType: "object",
              });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Remove duplicates
  return {
    clientEvents: [...new Set(clientEvents)],
    serverEvents: [...new Set(serverEvents.map((e) => JSON.stringify(e)))].map(
      (e) => JSON.parse(e),
    ),
  };
}

/**
 * Parse progress service to extract data structure
 * @param filePath Path to the upload progress service file
 * @returns Object with progress data structure
 */
function parseProgressDataStructure(filePath: string): any {
  const progressDataFields: string[] = [];

  // Read the file
  const fileContent = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  );

  // Visit each node to find uploadProgressMap type definition
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === "uploadProgressMap" &&
      node.type &&
      ts.isTypeReferenceNode(node.type) &&
      node.type.typeArguments &&
      node.type.typeArguments.length > 1
    ) {
      // Get the second type argument, which is the value type
      const valueType = node.type.typeArguments[1];

      if (ts.isTypeLiteralNode(valueType)) {
        // Extract the field names and types
        valueType.members.forEach((member) => {
          if (ts.isPropertySignature(member) && member.name) {
            progressDataFields.push(member.name.getText());
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return progressDataFields;
}

/**
 * Build AsyncAPI schema based on Socket.IO implementation
 */
function buildAsyncApiSchema() {
  // Parse the Socket.IO implementation
  const socketEvents = parseSocketEvents(SOCKET_SERVICE_PATH);
  const progressDataFields = parseProgressDataStructure(UPLOAD_PROGRESS_PATH);

  // Create channels for client events (client to server)
  const clientChannels: any = {};
  socketEvents.clientEvents.forEach((eventName) => {
    clientChannels[eventName] = {
      address: eventName,
      description: getClientEventDescription(eventName),
      messages: {
        [`${eventName}Message`]: {
          name: `${capitalizeFirstLetter(eventName)} Message`,
          description: getClientEventMessageDescription(eventName),
          payload: {
            type: eventName.includes("uploadId") ? "string" : "object",
            description: getClientEventPayloadDescription(eventName),
            example: getClientEventExample(eventName),
          },
        },
      },
    };
  });

  // Create channels for server events (server to client)
  const serverChannels: any = {};
  socketEvents.serverEvents.forEach((event) => {
    const { name: eventName, dataType } = event;
    serverChannels[eventName] = {
      address: eventName,
      description: getServerEventDescription(eventName),
      messages: {
        [`${eventName}Message`]: {
          name: `${capitalizeFirstLetter(eventName)} Message`,
          description: getServerEventMessageDescription(eventName),
          payload: {
            type: "object",
            properties: buildEventProperties(eventName, progressDataFields),
          },
        },
      },
    };
  });

  // Combine all channels
  const channels = {
    ...clientChannels,
    ...serverChannels,
  };

  // Build the AsyncAPI spec
  const asyncApiSpec = {
    asyncapi: "3.0.0",
    id: "urn:formforge:websocket-api",
    info: {
      title: "FormForge RAG WebSocket API",
      version: "1.0.0",
      description: buildMainDescription(),
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
        protocol: "ws",
        protocolVersion: "socket.io",
        description: "Production Socket.IO server",
      },
      development: {
        host: "localhost:3000",
        protocol: "ws",
        protocolVersion: "socket.io",
        description: "Development Socket.IO server",
      },
    },
    defaultContentType: "application/json",
    channels,
    components: {
      securitySchemes: {
        socketIoAuth: {
          type: "userPassword",
          description:
            "Socket.IO allows connection authentication through query parameters or headers",
        },
      },
    },
  };

  return asyncApiSpec;
}

/**
 * Helper functions for generating descriptions and examples
 */
function getClientEventDescription(eventName: string): string {
  const descriptions: Record<string, string> = {
    joinUploadRoom:
      "Channel for joining an upload room to receive notifications for a specific upload. Server creates a room named 'upload:{uploadId}'.",
    leaveUploadRoom:
      "Channel for leaving an upload room to stop receiving notifications. Leaves the room named 'upload:{uploadId}'.",
  };

  return descriptions[eventName] || `Channel for the ${eventName} event.`;
}

function getClientEventMessageDescription(eventName: string): string {
  const descriptions: Record<string, string> = {
    joinUploadRoom:
      "The unique upload ID string that identifies which upload room to join",
    leaveUploadRoom:
      "The unique upload ID string that identifies which upload room to leave",
  };

  return descriptions[eventName] || `Message for the ${eventName} event.`;
}

function getClientEventPayloadDescription(eventName: string): string {
  const descriptions: Record<string, string> = {
    joinUploadRoom:
      "The unique upload ID (server will prepend 'upload:' to create the room name)",
    leaveUploadRoom:
      "The unique upload ID (server will prepend 'upload:' to match the room name)",
  };

  return descriptions[eventName] || `Payload for the ${eventName} event.`;
}

function getClientEventExample(eventName: string): string {
  return "upload-123e4567-e89b-12d3-a456-426614174000";
}

function getServerEventDescription(eventName: string): string {
  const descriptions: Record<string, string> = {
    uploadProgress:
      "Channel for receiving real-time upload progress updates. Events are emitted to the 'upload:{uploadId}' room.",
    uploadComplete:
      "Channel for receiving upload completion notifications. Events are emitted to the 'upload:{uploadId}' room.",
    uploadError:
      "Channel for receiving upload error notifications. Events are emitted to the 'upload:{uploadId}' room.",
  };

  return descriptions[eventName] || `Channel for the ${eventName} event.`;
}

function getServerEventMessageDescription(eventName: string): string {
  const descriptions: Record<string, string> = {
    uploadProgress:
      "Contains information about the current progress of an upload",
    uploadComplete:
      "Contains information about a completed upload including processing results",
    uploadError: "Contains error information about a failed upload",
  };

  return descriptions[eventName] || `Message for the ${eventName} event.`;
}

/**
 * Build event properties based on event name and fields found in progress service
 */
function buildEventProperties(
  eventName: string,
  progressDataFields: string[],
): Record<string, any> {
  // Base properties that are common to most events
  const baseProperties: Record<string, any> = {
    uploadId: {
      type: "string",
      description: "Unique ID for the upload",
      example: "upload-123e4567-e89b-12d3-a456-426614174000",
    },
  };

  // Event-specific properties
  if (eventName === "uploadProgress") {
    return {
      ...baseProperties,
      bytesReceived: {
        type: "integer",
        description: "Number of bytes received so far",
        example: 1048576,
      },
      bytesExpected: {
        type: "integer",
        description: "Total number of bytes expected for the complete upload",
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
      ...(progressDataFields.includes("createdAt")
        ? {
            createdAt: {
              type: "integer",
              description: "Timestamp when the upload was created",
              example: Date.now(),
            },
          }
        : {}),
    };
  } else if (eventName === "uploadComplete") {
    return {
      ...baseProperties,
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
      ...(progressDataFields.includes("resultData")
        ? {
            resultData: {
              type: "object",
              description: "Additional data about the processing results",
              example: {},
            },
          }
        : {}),
    };
  } else if (eventName === "uploadError") {
    return {
      ...baseProperties,
      error: {
        type: "string",
        description: "Error message",
        example: "File format not supported",
      },
    };
  }

  // Default properties for unknown events
  return baseProperties;
}

/**
 * Build the main description for the AsyncAPI document
 */
function buildMainDescription(): string {
  return `
# FormForge RAG WebSocket API Documentation

This WebSocket API provides real-time communication capabilities for the FormForge RAG Server.
It uses Socket.IO as the underlying transport protocol for bidirectional, event-based communication.

## Main Features

* Real-time upload progress tracking
* Upload completion notifications
* Error reporting for failed uploads
* Room-based communication for isolating upload events

## Socket.IO Room Pattern

The server uses a room-based pattern for delivering targeted events:
* When joining a room, clients are subscribed to \`upload:{uploadId}\`
* All progress events are emitted only to clients in the appropriate room
* This ensures clients only receive events relevant to their uploads

## Client Integration Example

\`\`\`javascript
import { io } from 'socket.io-client';

// Connect to the WebSocket server
const socket = io('http://localhost:3000');

// After starting a file upload and receiving uploadId from the response
const uploadId = "upload-123";

// Join a specific upload room to receive updates
socket.emit('joinUploadRoom', uploadId);

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
  socket.emit('leaveUploadRoom', uploadId);
}
\`\`\`
`;
}

/**
 * Helper to capitalize the first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Build the AsyncAPI schema and write it to file
const asyncApiSpec = buildAsyncApiSchema();
const asyncApiJson = JSON.stringify(asyncApiSpec, null, 2);
fs.writeFileSync(OUTPUT_PATH, asyncApiJson);

console.log(`AsyncAPI specification generated at ${OUTPUT_PATH}`);
