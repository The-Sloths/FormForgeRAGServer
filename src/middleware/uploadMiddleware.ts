import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import formidable from "formidable";
import { v4 as uuidv4 } from "uuid";
import {
  initUploadProgress,
  updateUploadProgress,
  completeUpload,
  failUpload,
} from "../services/uploadProgressService";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Extend Express Request to include our file and fields
declare global {
  namespace Express {
    interface Request {
      file?: {
        path: string;
        originalname: string;
        mimetype: string;
        size: number;
      };
      formFields?: formidable.Fields;
      uploadId?: string;
    }
  }
}

/**
 * Middleware to handle file uploads using formidable
 */
const uploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate a unique ID for this upload
  const uploadId = uuidv4();
  req.uploadId = uploadId;

  // Initialize progress tracking
  initUploadProgress(uploadId);

  // Configure formidable
  const form = formidable({
    uploadDir: uploadsDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB file size limit
    multiples: false, // Only allow one file upload
    filename: (_name: string, ext: string, part: formidable.Part) => {
      // Generate unique filename
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      return `${part.name}-${uniqueSuffix}${ext}`;
    },
  });

  // Track progress
  form.on("progress", (bytesReceived, bytesExpected) => {
    updateUploadProgress(uploadId, bytesReceived, bytesExpected);
  });

  form.parse(
    req,
    (err: Error | null, fields: formidable.Fields, files: formidable.Files) => {
      if (err) {
        failUpload(uploadId, err.message);
        return res.status(400).json({
          error: "Bad Request",
          message: "Error parsing form data: " + err.message,
          uploadId,
        });
      }

      // Check if file exists in the upload
      const uploadedFile = files.file?.[0];
      if (!uploadedFile) {
        failUpload(uploadId, "No file uploaded");
        return res.status(400).json({
          error: "Bad Request",
          message: "No file uploaded",
          uploadId,
        });
      }

      const originalFilename = uploadedFile.originalFilename || "unknown";
      const fileMimetype = uploadedFile.mimetype || "";

      // Validate file type
      const isPdf = fileMimetype === "application/pdf";
      const isMarkdown =
        fileMimetype === "text/markdown" ||
        originalFilename.toLowerCase().endsWith(".md");

      if (!isPdf && !isMarkdown) {
        // Remove the file that doesn't meet the criteria
        fs.unlinkSync(uploadedFile.filepath);
        failUpload(uploadId, "Only PDF and Markdown files are allowed");
        return res.status(400).json({
          error: "Bad Request",
          message: "Only PDF and Markdown files are allowed",
          uploadId,
        });
      }

      // Add file information to the request object
      req.file = {
        path: uploadedFile.filepath,
        originalname: originalFilename,
        mimetype: fileMimetype,
        size: uploadedFile.size,
      };

      // Add fields to the request object
      req.formFields = fields;

      next();
    },
  );
};

export default uploadMiddleware;
