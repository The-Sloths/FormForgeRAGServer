import { Request, Response } from "express";
import { processFileAndAddToVectorStore } from "../services/fileService";
import { FileDocument, FileUploadOptions } from "../types/ragTypes";
import {
  completeUpload,
  failUpload,
  cleanupUploadProgress,
} from "../services/uploadProgressService";

/**
 * Handle file upload, process and add to vector store
 */
export async function uploadFile(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Bad Request",
        message: "No file uploaded",
      });
    }

    const file = req.file;
    const uploadId = req.uploadId;

    // Parse options from fields if they exist
    const optionsField = req.formFields?.options?.[0];
    const options = optionsField
      ? (JSON.parse(optionsField.toString()) as FileUploadOptions)
      : {};

    // Determine if this is a PDF or Markdown file
    const fileType =
      file.mimetype === "application/pdf"
        ? "application/pdf"
        : file.originalname.endsWith(".md")
          ? "text/markdown"
          : file.mimetype;

    // Validate file type
    if (fileType !== "application/pdf" && fileType !== "text/markdown") {
      if (uploadId) {
        failUpload(uploadId, "Only PDF and Markdown files are supported");
      }
      return res.status(400).json({
        error: "Bad Request",
        message: "Only PDF and Markdown files are supported",
        uploadId,
      });
    }

    const fileDoc: FileDocument = {
      filePath: file.path,
      fileType: fileType,
      originalName: file.originalname,
      metadata: options.metadata || {
        source: "file-upload",
        uploadDate: new Date().toISOString(),
      },
    };

    const result = await processFileAndAddToVectorStore(fileDoc);

    // Mark upload as complete with result data
    if (uploadId) {
      completeUpload(uploadId, {
        message: "File processed and added to knowledge base successfully",
        filename: result.filename,
        chunks: result.chunks,
        totalCharacters: result.totalCharacters,
      });

      // Schedule cleanup of progress data
      cleanupUploadProgress(uploadId);
    }

    return res.status(200).json({
      message: "File processed and added to knowledge base successfully",
      filename: result.filename,
      chunks: result.chunks,
      totalCharacters: result.totalCharacters,
      uploadId,
    });
  } catch (error) {
    console.error("Error in uploadFile controller:", error);

    // Mark upload as failed
    if (req.uploadId) {
      failUpload(
        req.uploadId,
        error instanceof Error ? error.message : "Unknown error occurred",
      );
      cleanupUploadProgress(req.uploadId);
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      uploadId: req.uploadId,
    });
  }
}
