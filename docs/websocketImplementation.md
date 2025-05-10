# WebSocket Implementation Guide

This document provides details on how to use the WebSocket functionality for real-time file upload progress tracking in the FormForge RAG Server.

## Overview

The server uses Socket.IO to provide real-time communication between the server and clients. This implementation is particularly useful for tracking file upload progress in real-time, providing a better user experience than traditional polling methods.

## Server-Side Implementation

### Socket.IO Setup

Socket.IO is initialized when the server starts:

```javascript
import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

// Initialize Socket.IO server with HTTP server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*", // In production, restrict to your frontend domain
    methods: ["GET", "POST"],
  },
});
