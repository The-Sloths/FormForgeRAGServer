# FormForge RAG WebSocket Documentation

This project uses AsyncAPI to document the WebSocket events used in the FormForge RAG Server.

## Generated Documentation

The WebSocket documentation has been generated using the AsyncAPI CLI and can be found in the `websocket-docs` directory. Open the `index.html` file in that directory to view the documentation in your browser.

## WebSocket Events Documentation

The documentation covers the following WebSocket events:

### Client to Server Events
- `joinUploadRoom`: Join a room to receive updates for a specific upload
- `leaveUploadRoom`: Leave a room to stop receiving updates for a specific upload

### Server to Client Events
- `uploadProgress`: Sent when an upload progress is updated
- `uploadComplete`: Sent when an upload is completed and processed
- `uploadError`: Sent when an upload encounters an error

## Updating the Documentation

If you need to update the WebSocket documentation:

1. Modify the `enhanced-asyncapi.ts` file
2. Run `node generate-asyncapi-docs.js` to generate the updated documentation

## Integration Example

See the documentation for a full integration example showing how to connect to the WebSocket server, join rooms, and handle events.
