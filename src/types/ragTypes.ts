// Document types
export interface DocumentInput {
  text: string;
  metadata?: Record<string, any>;
}

// Query types
export interface QueryInput {
  query: string;
  options?: {
    topK?: number;
    similarity?: number;
  };
}

export interface QueryResponse {
  answer: string;
  sources?: Array<{
    content: string;
    metadata?: Record<string, any>;
    similarity?: number;
  }>;
}

// Error types
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

// File document types
export interface FileDocument {
  filePath: string;
  fileType: string;
  originalName: string;
  metadata?: Record<string, any>;
}

// File upload response
export interface FileUploadResponse {
  filename: string;
  chunks: number;
  totalCharacters: number;
  message: string;
}

// File upload options
export interface FileUploadOptions {
  splitByChunks?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, any>;
}