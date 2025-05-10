/**
 * @openapi
 * components:
 *   schemas:
 *     UploadProgressData:
 *       type: object
 *       properties:
 *         uploadId:
 *           type: string
 *           description: Unique ID for the upload
 *         bytesReceived:
 *           type: integer
 *           description: Number of bytes received
 *         bytesExpected:
 *           type: integer
 *           description: Total number of bytes expected
 *         percent:
 *           type: integer
 *           description: Percentage of upload completed (0-100)
 *         completed:
 *           type: boolean
 *           description: Whether the upload part is completed
 *
 *     UploadCompleteData:
 *       type: object
 *       properties:
 *         uploadId:
 *           type: string
 *           description: Unique ID for the upload
 *         message:
 *           type: string
 *           description: Success message
 *         filename:
 *           type: string
 *           description: Original filename
 *         chunks:
 *           type: integer
 *           description: Number of chunks created
 *         totalCharacters:
 *           type: integer
 *           description: Total characters processed
 *         completed:
 *           type: boolean
 *           description: Always true for completion events
 *
 *     UploadErrorData:
 *       type: object
 *       properties:
 *         uploadId:
 *           type: string
 *           description: Unique ID for the upload
 *         error:
 *           type: string
 *           description: Error message
 *
 * tags:
 *   - name: WebSockets
 *     description: WebSocket API for real-time communication
 *
 * /websocket:
 *   get:
 *     summary: WebSocket Connection Endpoint
 *     description: |
 *       Connect to the WebSocket server using Socket.IO.
 *
 *       **Client side connection example:**
 *       ```javascript
 *       import { io } from 'socket.io-client';
 *       const socket = io('http://localhost:3000');
 *       ```
 *     tags: [WebSockets]
 *
 * /socket.io/:
 *   get:
 *     summary: Socket.IO Connection Endpoint
 *     description: Socket.IO connection endpoint (handled automatically by Socket.IO client libraries)
 *     tags: [WebSockets]
 *
 * /websocket/events:
 *   post:
 *     summary: WebSocket Events Documentation
 *     description: |
 *       This is documentation for the WebSocket events used in the application.
 *
 *       ## Client to Server Events
 *
 *       ### joinUploadRoom
 *       Join a room to receive updates for a specific upload.
 *       ```javascript
 *       socket.emit('joinUploadRoom', uploadId);
 *       ```
 *
 *       ### leaveUploadRoom
 *       Leave a room to stop receiving updates for a specific upload.
 *       ```javascript
 *       socket.emit('leaveUploadRoom', uploadId);
 *       ```
 *
 *       ## Server to Client Events
 *
 *       ### uploadProgress
 *       Sent when an upload progress is updated.
 *       ```javascript
 *       socket.on('uploadProgress', (data) => {
 *         console.log(`Upload ${data.uploadId} progress: ${data.percent}%`);
 *       });
 *       ```
 *
 *       ### uploadComplete
 *       Sent when an upload is completed and processed.
 *       ```javascript
 *       socket.on('uploadComplete', (data) => {
 *         console.log(`Upload ${data.uploadId} completed with ${data.chunks} chunks`);
 *       });
 *       ```
 *
 *       ### uploadError
 *       Sent when an upload encounters an error.
 *       ```javascript
 *       socket.on('uploadError', (data) => {
 *         console.error(`Upload ${data.uploadId} error: ${data.error}`);
 *       });
 *       ```
 *     tags: [WebSockets]
 *     responses:
 *       200:
 *         description: This is a documentation endpoint and doesn't perform any action
 */
