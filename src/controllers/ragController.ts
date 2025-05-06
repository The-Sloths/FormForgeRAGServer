import { Request, Response } from 'express';
import { queryRagSystem, addDocumentToVectorStore, getSimilarDocuments } from '../services/ragService';
import { QueryInput, DocumentInput } from '../types/ragTypes';

export async function query(req: Request, res: Response) {
  try {
    const { query, options } = req.body as QueryInput;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required and must be a string',
      });
    }
    
    const result = await queryRagSystem({ query, options });
    
    return res.status(200).json({
      answer: result,
    });
  } catch (error) {
    console.error('Error in query controller:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

export async function addDocument(req: Request, res: Response) {
  try {
    const { text, metadata } = req.body as DocumentInput;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Document text is required and must be a string',
      });
    }
    
    await addDocumentToVectorStore({ text, metadata });
    
    return res.status(201).json({
      message: 'Document added successfully',
    });
  } catch (error) {
    console.error('Error in addDocument controller:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

export async function similarDocuments(req: Request, res: Response) {
  try {
    const { query, options } = req.body as QueryInput;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required and must be a string',
      });
    }
    
    const documents = await getSimilarDocuments({ query, options });
    
    return res.status(200).json({
      count: documents.length,
      documents: documents.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      })),
    });
  } catch (error) {
    console.error('Error in similarDocuments controller:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}