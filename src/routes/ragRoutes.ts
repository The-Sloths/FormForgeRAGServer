import express from "express";
import {
  query,
  addDocument,
  similarDocuments,
} from "../controllers/ragController";

const router = express.Router();

/**
 * @openapi
 * /api/rag/query:
 *   post:
 *     summary: Query the RAG system
 *     description: Send a question to the RAG system and get an answer
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryInput'
 *     responses:
 *       200:
 *         description: Successful query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryResponse'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/query", async (req, res) => {
  try {
    await query(req, res);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred during query processing" });
  }
});

/**
 * @openapi
 * /api/rag/documents:
 *   post:
 *     summary: Add a document to the vector store
 *     description: Add a new document to the RAG system's knowledge base
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DocumentInput'
 *     responses:
 *       201:
 *         description: Document added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Document added successfully"
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/documents", async (req, res) => {
  try {
    await addDocument(req, res);
  } catch (error) {
    res.status(500).json({ error: "An error occurred while adding document" });
  }
});

/**
 * @openapi
 * /api/rag/similar:
 *   post:
 *     summary: Find similar documents
 *     description: Find documents similar to the given query without generating an answer
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryInput'
 *     responses:
 *       200:
 *         description: Successful query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimilarDocumentsResponse'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/similar", async (req, res) => {
  try {
    await similarDocuments(req, res);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while finding similar documents" });
  }
});

export default router;
