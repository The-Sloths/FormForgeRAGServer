import express from "express";
import { uploadFile } from "../controllers/fileController";
import upload from "../middleware/uploadMiddleware";

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
 *     description: Upload a PDF or Markdown file to extract text, generate embeddings, and add to the vector store
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
 *       400:
 *         description: Bad request or invalid file
 *       500:
 *         description: Server error
 */
router.post("/upload", upload.single("file"), (req, res, next) => {
  uploadFile(req, res).catch(next);
});

export default router;
