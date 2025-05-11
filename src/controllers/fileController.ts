import { Request, Response } from "express";
import {
  processFileAndAddToVectorStore,
  prepareFileForProcessing,
} from "../services/fileService";
import { FileDocument, FileUploadOptions } from "../types/ragTypes";
import {
  completeUpload,
  failUpload,
  cleanupUploadProgress,
  updateUploadProgress,
} from "../services/uploadProgressService";
import {
  emitProcessingStart,
  emitProcessingProgress,
  emitProcessingComplete,
  emitProcessingError,
} from "../services/socketService";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Storage for uploaded files that are pending processing
const pendingFiles = new Map<string, FileDocument[]>();
// Additional index to look up files by file ID
const fileIdToUploadId = new Map<string, string>();

/**
 * Handle file upload without immediate processing
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

    // Generate a unique ID for the file (use the actual filename from the path)
    const fileId = path.basename(file.path);

    const fileDoc: FileDocument = {
      id: fileId, // Use the filename as the ID
      filePath: file.path,
      fileType: fileType,
      originalName: file.originalname,
      metadata: options.metadata || {
        source: "file-upload",
        uploadDate: new Date().toISOString(),
      },
      status: "uploaded",
      processed: false,
    };

    // Make sure uploadId is defined before using it
    const safeUploadId =
      uploadId ||
      `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store the uploaded file in our pending files map
    if (!pendingFiles.has(safeUploadId)) {
      pendingFiles.set(safeUploadId, []);
    }

    // Now we can safely access the array
    const uploadFiles = pendingFiles.get(safeUploadId);
    if (uploadFiles) {
      uploadFiles.push(fileDoc);
    }

    // Add to our file ID index using the filename as the key
    fileIdToUploadId.set(fileId, safeUploadId);

    // Mark upload as complete but not processed
    if (uploadId) {
      completeUpload(uploadId, {
        message: "File uploaded successfully and ready for processing",
        filename: fileDoc.originalName,
        fileId: fileDoc.id, // This will now be the filename
        status: "uploaded",
      });
    }

    // Safely get files for response
    const responseFiles = pendingFiles.get(safeUploadId);

    return res.status(200).json({
      message: "File uploaded successfully and ready for processing",
      filename: fileDoc.originalName,
      fileId: fileDoc.id, // This will now be the filename
      uploadId: safeUploadId,
      status: "uploaded",
      files: responseFiles
        ? responseFiles.map((file) => ({
            fileId: file.id, // This will now be the filename
            filename: file.originalName,
            fileType: file.fileType,
            status: file.status,
            processed: file.processed,
          }))
        : [],
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

/**
 * Process uploaded files and add to vector store
 */
export async function processFiles(req: Request, res: Response) {
  try {
    // Accept either uploadId or fileId for processing
    const { uploadId, fileId, fileIds } = req.body;

    let targetUploadId = uploadId;
    let targetFileIds: string[] = fileIds || [];

    // If fileId is provided but uploadId is not, look up the uploadId
    if (!uploadId && fileId) {
      const associatedUploadId = fileIdToUploadId.get(fileId);
      if (associatedUploadId) {
        targetUploadId = associatedUploadId;
        targetFileIds = [fileId]; // Process just this file
      }
    }

    // If we don't have an uploadId at this point, we can't proceed
    if (!targetUploadId || !pendingFiles.has(targetUploadId)) {
      return res.status(404).json({
        error: "Not Found",
        message: "No uploaded files found for the given ID",
      });
    }

    // Get files to process (either all files for the uploadId or specific fileIds)
    const filesFromMap = pendingFiles.get(targetUploadId);
    if (!filesFromMap) {
      return res.status(404).json({
        error: "Not Found",
        message: "No files found for the given ID",
      });
    }

    let filesToProcess = [...filesFromMap];
    if (targetFileIds.length > 0) {
      filesToProcess = filesToProcess.filter((file) =>
        targetFileIds.includes(file.id),
      );
    }

    if (filesToProcess.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: "No matching files found for processing",
      });
    }

    // Start processing asynchronously
    const processingId = `proc-${Date.now()}-${targetUploadId}`;

    // Notify client that processing has started
    emitProcessingStart(targetUploadId, {
      processingId,
      totalFiles: filesToProcess.length,
      files: filesToProcess.map((f) => ({
        fileId: f.id,
        filename: f.originalName,
      })),
    });

    // Process files in background and return immediate response
    processFilesInBackground(targetUploadId, processingId, filesToProcess);

    return res.status(202).json({
      message: "File processing started",
      processingId,
      uploadId: targetUploadId,
      totalFiles: filesToProcess.length,
      files: filesToProcess.map((f) => ({
        fileId: f.id,
        filename: f.originalName,
      })),
    });
  } catch (error) {
    console.error("Error in processFiles controller:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Get the list of uploaded files for a specific uploadId
 */
export async function getUploadedFiles(req: Request, res: Response) {
  try {
    const { uploadId } = req.params;

    let targetUploadId = uploadId;

    // If the provided ID is a file ID, convert it to an upload ID
    if (fileIdToUploadId.has(uploadId)) {
      // Check map first
      targetUploadId = fileIdToUploadId.get(uploadId) || uploadId;
    } else if (uploadId.startsWith("file-") && fileIdToUploadId.has(uploadId)) {
      // Fallback check (should not be needed with the map check above, but keeping for safety)
      targetUploadId = fileIdToUploadId.get(uploadId) || uploadId;
    }

    if (!targetUploadId || !pendingFiles.has(targetUploadId)) {
      return res.status(404).json({
        error: "Not Found",
        message: "No uploaded files found for the given ID",
      });
    }

    const files = pendingFiles.get(targetUploadId);
    if (!files) {
      return res.status(404).json({
        error: "Not Found",
        message: "No uploaded files found for the given ID",
      });
    }

    return res.status(200).json({
      uploadId: targetUploadId,
      totalFiles: files.length,
      files: files.map((file) => ({
        fileId: file.id,
        filename: file.originalName,
        fileType: file.fileType,
        status: file.status,
        processed: file.processed,
      })),
    });
  } catch (error) {
    console.error("Error in getUploadedFiles controller:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Process files in background
 * This function runs asynchronously and updates socket events as processing proceeds
 */
async function processFilesInBackground(
  uploadId: string,
  processingId: string,
  files: FileDocument[],
) {
  try {
    const totalFiles = files.length;
    let processedFiles = 0;
    let totalChunks = 0;
    let totalCharacters = 0;
    const results = [];

    // Process each file sequentially
    for (const file of files) {
      try {
        // Emit progress update
        emitProcessingProgress(uploadId, {
          processingId,
          currentFile: file.originalName,
          fileId: file.id,
          processedFiles,
          totalFiles,
          percent: Math.round((processedFiles / totalFiles) * 100),
        });

        // Process the file
        const result = await processFileAndAddToVectorStore(file);

        // Update the file status
        file.status = "processed";
        file.processed = true;

        // Compile results
        results.push({
          fileId: file.id,
          filename: file.originalName,
          chunks: result.chunks,
          totalCharacters: result.totalCharacters,
        });

        totalChunks += result.chunks;
        totalCharacters += result.totalCharacters;
        processedFiles++;

        // Emit progress update
        emitProcessingProgress(uploadId, {
          processingId,
          currentFile: null,
          processedFiles,
          totalFiles,
          percent: Math.round((processedFiles / totalFiles) * 100),
        });
      } catch (error) {
        console.error(`Error processing file ${file.originalName}:`, error);
        file.status = "error";
        file.error = error instanceof Error ? error.message : "Unknown error";

        // Emit error for this specific file
        emitProcessingError(uploadId, {
          processingId,
          fileId: file.id,
          filename: file.originalName,
          error: file.error,
        });
      }
    }

    // Emit completion event
    emitProcessingComplete(uploadId, {
      processingId,
      processedFiles,
      totalFiles,
      totalChunks,
      totalCharacters,
      results,
    });
  } catch (error) {
    console.error("Error in background processing:", error);
    emitProcessingError(uploadId, {
      processingId,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
