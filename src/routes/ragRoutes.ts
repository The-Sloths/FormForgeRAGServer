import express from "express";
import {
  query,
  addDocument,
  similarDocuments,
} from "../controllers/ragController";

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     QueryInput:
 *       type: object
 *       required:
 *         - query
 *       properties:
 *         query:
 *           type: string
 *           description: The question to ask the RAG system
 *         options:
 *           type: object
 *           properties:
 *             topK:
 *               type: integer
 *               description: Number of documents to retrieve
 *               default: 4
 *             similarity:
 *               type: number
 *               description: Similarity threshold for document retrieval
 *               default: 0.7
 *       example:
 *         query: "What is RAG in AI?"
 *         options:
 *           topK: 3
 *
 *     DocumentInput:
 *       type: object
 *       required:
 *         - text
 *       properties:
 *         text:
 *           type: string
 *           description: The document text content
 *         metadata:
 *           type: object
 *           description: Additional metadata for the document
 *       example:
 *         text: "RAG (Retrieval Augmented Generation) is an AI framework that enhances large language models by incorporating external knowledge."
 *         metadata:
 *           source: "AI documentation"
 *           author: "AI Research Team"
 *           date: "2023-05-20"
 */

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
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                   description: The answer to the query
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
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
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
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
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of documents found
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       content:
 *                         type: string
 *                         description: Document content
 *                       metadata:
 *                         type: object
 *                         description: Document metadata
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
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
