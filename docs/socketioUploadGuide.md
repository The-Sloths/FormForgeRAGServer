# Socket.IO Real-time Upload Progress Guide

This guide explains how to work with the Socket.IO-based real-time upload progress tracking in FormForge RAG Server.

## Overview

FormForge uses Socket.IO for real-time communication during file uploads. This approach provides a better user experience than traditional polling methods.

## How It Works

1. When a client uploads a file through the `/api/files/upload` endpoint, they receive an `uploadId` in the response.
2. The client connects to the Socket.IO server and joins a specific room using this `uploadId`.
3. The server emits events to this room during the upload and processing.
4. The client receives real-time updates about the upload progress, completion, or errors.

## Room Structure

All Socket.IO rooms for uploads use the pattern `upload:{uploadId}` where `{uploadId}` is the UUID assigned to the upload. This namespace isolation ensures clients only receive events relevant to their uploads.

## Event Types

### Client to Server Events

| Event Name | Payload | Description |
|------------|---------|-------------|
| `joinUploadRoom` | String (uploadId) | Join a room to receive updates for a specific upload |
| `leaveUploadRoom` | String (uploadId) | Leave a room to stop receiving updates |

### Server to Client Events

| Event Name | Payload | Description |
|------------|---------|-------------|
| `uploadProgress` | Object (progress data) | Sent when an upload progress is updated |
| `uploadComplete` | Object (completion data) | Sent when an upload is completed and processed |
| `uploadError` | Object (error data) | Sent when an upload encounters an error |

## Complete Flow Example

1. Client uploads a file to `/api/files/upload` and receives `uploadId` in response
2. Client connects to Socket.IO server using `io('http://localhost:3000')`
3. Client joins the upload room with `socket.emit('joinUploadRoom', uploadId)`
4. Client listens for events with:
   - `socket.on('uploadProgress', (data) => {...})`
   - `socket.on('uploadComplete', (data) => {...})`
   - `socket.on('uploadError', (data) => {...})`
5. When the upload is complete, client can leave the room with `socket.emit('leaveUploadRoom', uploadId)`

See the full code example in the AsyncAPI documentation.
