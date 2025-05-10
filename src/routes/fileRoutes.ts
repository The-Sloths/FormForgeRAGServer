import express from "express";
import {
  getUploadedFiles,
  processFiles,
  uploadFile,
} from "../controllers/fileController";
import uploadMiddleware from "../middleware/uploadMiddleware";
import { getUploadProgress } from "../services/uploadProgressService";

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     FileUploadOptions:
 *       type: object
 *       properties:
 *         splitByChunks:
 *           type: boolean
 *           description: Whether to split the document into chunks
 *           default: true
 *         chunkSize:
 *           type: integer
 *           description: Size of each chunk in characters
 *           default: 1000
 *         chunkOverlap:
 *           type: integer
 *           description: Number of characters to overlap between chunks
 *           default: 200
 *         metadata:
 *           type: object
 *           description: Additional metadata for the document
 *       example:
 *         splitByChunks: true
 *         chunkSize: 1500
 *         metadata:
 *           source: "company-docs"
 *           category: "technical"
 */

/**
 * @openapi
 * /api/files/upload:
 *   post:
 *     summary: Upload a file to the RAG system
 *     description: |
 *       Upload a PDF or Markdown file to extract text, generate embeddings, and add to the vector store.
 *
 *       The response includes an `uploadId` that can be used to track upload progress via WebSocket.
 *       Connect to the WebSocket server and listen for progress events by joining the upload room:
 *
 *       ```javascript
 *       // After getting uploadId from the response
 *       socket.emit('joinUploadRoom', uploadId);
 *
 *       // Listen for progress updates
 *       socket.on('uploadProgress', (data) => {
 *         console.log(`Upload progress: ${data.percent}%`);
 *       });
 *       ```
 *     tags: [Files]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The PDF or Markdown file to upload
 *               options:
 *                 type: string
 *                 description: JSON string of processing options
 *     responses:
 *       200:
 *         description: File processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 filename:
 *                   type: string
 *                   description: Original filename
 *                 chunks:
 *                   type: integer
 *                   description: Number of chunks created
 *                 totalCharacters:
 *                   type: integer
 *                   description: Total characters processed
 *                 uploadId:
 *                   type: string
 *                   description: Unique ID for tracking upload progress via WebSocket
 *       400:
 *         description: Bad request or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error type
 *                 message:
 *                   type: string
 *                   description: Error message
 *                 uploadId:
 *                   type: string
 *                   description: Unique ID for tracking upload progress via WebSocket
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error type
 *                 message:
 *                   type: string
 *                   description: Error message
 *                 uploadId:
 *                   type: string
 *                   description: Unique ID for tracking upload progress via WebSocket
 */
router.post("/upload", uploadMiddleware, (req, res, next) => {
  uploadFile(req, res).catch(next);
});

/**
 * @openapi
 * /api/files/process:
 *   post:
 *     summary: Process uploaded files and add to vector store
 *     description: |
 *       Triggers processing of previously uploaded files and adds their content to the vector store.
 *       This endpoint separates the upload and processing steps for better performance.
 *
 *       The response includes a `processingId` that can be used to track processing via WebSocket.
 *       Connect to the WebSocket server and listen for processing events:
 *
 *       ```javascript
 *       socket.on('processingStart', (data) => { console.log('Processing started'); });
 *       socket.on('processingProgress', (data) => { console.log(`Progress: ${data.percent}%`); });
 *       socket.on('processingComplete', (data) => { console.log('Processing complete'); });
 *       socket.on('processingError', (data) => { console.log('Processing error', data.error); });
 *       ```
 *     tags: [Files]
 */
router.post("/process", async (req, res, next) => {
  try {
    await processFiles(req, res);
  } catch (error) {
    next(error);
  }
});
/**
 * @openapi
 * /api/files/uploaded/{uploadId}:
 *   get:
 *     summary: Get uploaded files for a specific upload session
 *     description: |
 *       Returns the list of files that have been uploaded in a specific upload session.
 *       Use this to check the status of uploaded files before processing them.
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the upload session
 *     responses:
 *       200:
 *         description: List of uploaded files
 *       404:
 *         description: Upload session not found
 */
router.get("/uploaded/:uploadId", async (req, res, next) => {
  try {
    await getUploadedFiles(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/files/upload-status/{uploadId}:
 *   get:
 *     summary: Get upload progress status
 *     description: |
 *       Returns the current status of a file upload process by its ID.
 *
 *       This endpoint can be used as an alternative to WebSocket connections
 *       for tracking upload progress, or to retrieve the final status of a
 *       completed upload.
 */
router.get(
  "/upload-status/:uploadId",
  async (
    req: express.Request<{ uploadId: string }>,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> => {
    try {
      const { uploadId } = req.params;
      const progress = getUploadProgress(uploadId);

      if (!progress) {
        res.status(404).json({ error: "Upload not found" });
        return;
      }

      res.status(200).json({ uploadId, ...progress });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
