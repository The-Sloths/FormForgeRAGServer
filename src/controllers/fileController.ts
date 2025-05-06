import { Request, Response } from 'express';
import { processFileAndAddToVectorStore } from '../services/fileService';
import { FileDocument, FileUploadOptions } from '../types/ragTypes';

/**
 * Handle file upload, process and add to vector store
 */
export async function uploadFile(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No file uploaded',
      });
    }

    const file = req.file;
    const options = req.body.options ? JSON.parse(req.body.options) as FileUploadOptions : {};
    
    // Determine if this is a PDF or Markdown file
    const fileType = file.mimetype === 'application/pdf' ? 'application/pdf' : 
                     (file.originalname.endsWith('.md') ? 'text/markdown' : file.mimetype);
    
    // Validate file type
    if (fileType !== 'application/pdf' && fileType !== 'text/markdown') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only PDF and Markdown files are supported',
      });
    }
    
    const fileDoc: FileDocument = {
      filePath: file.path,
      fileType: fileType,
      originalName: file.originalname,
      metadata: options.metadata || {
        source: 'file-upload',
        uploadDate: new Date().toISOString(),
      },
    };
    
    const result = await processFileAndAddToVectorStore(fileDoc);
    
    return res.status(200).json({
      message: 'File processed and added to knowledge base successfully',
      filename: result.filename,
      chunks: result.chunks,
      totalCharacters: result.totalCharacters,
    });
  } catch (error) {
    console.error('Error in uploadFile controller:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}