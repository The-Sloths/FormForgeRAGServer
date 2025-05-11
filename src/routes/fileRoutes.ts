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
 *
 *     FileProcessRequest:
 *       type: object
 *       required:
 *         - uploadId
 *       properties:
 *         uploadId:
 *           type: string
 *           description: The unique identifier for the upload (received from a previous upload response)
 *         fileIds:
 *           type: array
 *           description: Optional list of specific file IDs to process (if omitted, all files in the upload will be processed)
 *           items:
 *             type: string
 *       example:
 *         uploadId: "upload-1746970014231-z0ecgk2"
 *         fileIds: ["file-1746970014231-a1b2c3"]
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
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "File uploaded successfully and ready for processing"
 *                 filename:
 *                   type: string
 *                   description: Original filename
 *                   example: "document.pdf"
 *                 fileId:
 *                   type: string
 *                   description: ID for the specific file
 *                   example: "file-1746970014231-a1b2c3"
 *                 uploadId:
 *                   type: string
 *                   description: Unique ID for tracking upload progress via WebSocket
 *                   example: "upload-1746970014231-z0ecgk2"
 *                 status:
 *                   type: string
 *                   description: Current file status
 *                   example: "uploaded"
 *                 files:
 *                   type: array
 *                   description: Array of files in this upload batch
 *                   items:
 *                     type: object
 *                     properties:
 *                       fileId:
 *                         type: string
 *                         description: ID for each file
 *                       filename:
 *                         type: string
 *                         description: Original filename
 *                       fileType:
 *                         type: string
 *                         description: MIME type of the file
 *                       status:
 *                         type: string
 *                         description: File status
 *                       processed:
 *                         type: boolean
 *                         description: Whether the file has been processed
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
 *                   example: "Bad Request"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "Only PDF and Markdown files are supported"
 *                 uploadId:
 *                   type: string
 *                   description: Unique ID for the upload
 *                   example: "upload-1746970014231-z0ecgk2"
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
 *                   example: "Internal Server Error"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "Failed to process file"
 *                 uploadId:
 *                   type: string
 *                   description: Unique ID for tracking upload progress via WebSocket
 *                   example: "upload-1746970014231-z0ecgk2"
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
 *       **Important**: You must first upload files using `/api/files/upload` which provides an `uploadId`.
 *       Then use this endpoint with that exact `uploadId` value to process those files.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FileProcessRequest'
 *     responses:
 *       202:
 *         description: File processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "File processing started"
 *                 processingId:
 *                   type: string
 *                   description: Unique processing ID for tracking via WebSocket
 *                   example: "proc-1746970021896-upload-1746970014231-z0ecgk2"
 *                 uploadId:
 *                   type: string
 *                   description: Original upload ID
 *                   example: "upload-1746970014231-z0ecgk2"
 *                 totalFiles:
 *                   type: integer
 *                   description: Total number of files to be processed
 *                   example: 1
 *                 files:
 *                   type: array
 *                   description: List of files that will be processed
 *                   items:
 *                     type: object
 *                     properties:
 *                       fileId:
 *                         type: string
 *                         description: ID for each file
 *                         example: "file-1746970014231-a1b2c3"
 *                       filename:
 *                         type: string
 *                         description: Original filename
 *                         example: "document.pdf"
 *       404:
 *         description: No files found for the given uploadId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error type
 *                   example: "Not Found"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "No uploaded files found for the given uploadId"
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
 *                   example: "Internal Server Error"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "Failed to process files"
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
 *         example: "upload-1746970014231-z0ecgk2"
 *     responses:
 *       200:
 *         description: List of uploaded files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: string
 *                   description: The upload ID requested
 *                   example: "upload-1746970014231-z0ecgk2"
 *                 totalFiles:
 *                   type: integer
 *                   description: Number of files in this upload
 *                   example: 1
 *                 files:
 *                   type: array
 *                   description: List of files in this upload
 *                   items:
 *                     type: object
 *                     properties:
 *                       fileId:
 *                         type: string
 *                         description: Unique file ID
 *                         example: "file-1746970014231-a1b2c3"
 *                       filename:
 *                         type: string
 *                         description: Original filename
 *                         example: "document.pdf"
 *                       fileType:
 *                         type: string
 *                         description: MIME type of the file
 *                         example: "application/pdf"
 *                       status:
 *                         type: string
 *                         description: Current file status
 *                         example: "uploaded"
 *                       processed:
 *                         type: boolean
 *                         description: Whether file has been processed
 *                         example: false
 *       404:
 *         description: Upload session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error type
 *                   example: "Not Found"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "No uploaded files found for the given uploadId"
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
 *                   example: "Internal Server Error"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "Failed to retrieve uploaded files"
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
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the upload session
 *         example: "upload-1746970014231-z0ecgk2"
 *     responses:
 *       200:
 *         description: Upload status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: string
 *                   description: The upload ID requested
 *                   example: "upload-1746970014231-z0ecgk2"
 *                 bytesReceived:
 *                   type: integer
 *                   description: Bytes received so far
 *                   example: 1048576
 *                 bytesExpected:
 *                   type: integer
 *                   description: Total bytes expected
 *                   example: 1048576
 *                 percent:
 *                   type: integer
 *                   description: Upload completion percentage (0-100)
 *                   example: 100
 *                 completed:
 *                   type: boolean
 *                   description: Whether the upload is complete
 *                   example: true
 *                 error:
 *                   type: string
 *                   description: Error message if upload failed
 *                   example: null
 *                 createdAt:
 *                   type: integer
 *                   description: Timestamp when upload was created
 *                   example: 1746970014231
 *                 resultData:
 *                   type: object
 *                   description: Additional data for completed uploads
 *       404:
 *         description: Upload not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Upload not found"
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
 *                   example: "Internal Server Error"
 *                 message:
 *                   type: string
 *                   description: Error message
 *                   example: "Failed to retrieve upload status"
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
