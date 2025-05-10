import fs from "fs";
import path from "path";
import { promisify } from "util";
import pdf from "pdf-parse";
import MarkdownIt from "markdown-it";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { addDocumentToVectorStore } from "./ragService";
import { FileDocument } from "../types/ragTypes";

// Convert fs.readFile to Promise-based
const readFile = promisify(fs.readFile);

// Initialize Markdown parser
const md = new MarkdownIt();

/**
 * Extract text from a PDF file
 * @param filePath Path to the PDF file
 * @returns Extracted text content
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await readFile(filePath);
    const pdfData = await pdf(dataBuffer);
    return pdfData.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Extract text from a Markdown file
 * @param filePath Path to the Markdown file
 * @returns Extracted text content
 */
async function extractTextFromMarkdown(filePath: string): Promise<string> {
  try {
    const dataBuffer = await readFile(filePath);
    const markdownText = dataBuffer.toString("utf8");

    // Convert markdown to HTML and then strip HTML tags to get plain text
    const htmlContent = md.render(markdownText);
    const plainText = htmlContent.replace(/<[^>]*>/g, " ");

    return plainText;
  } catch (error) {
    console.error("Error extracting text from Markdown:", error);
    throw new Error("Failed to extract text from Markdown");
  }
}

/**
 * Process a file and extract text based on file type
 * @param filePath Path to the file
 * @param fileType The MIME type of the file
 * @returns Extracted text content
 */
export async function processFile(
  filePath: string,
  fileType: string,
): Promise<string> {
  try {
    if (fileType === "application/pdf") {
      return await extractTextFromPDF(filePath);
    } else if (
      fileType === "text/markdown" ||
      path.extname(filePath) === ".md"
    ) {
      return await extractTextFromMarkdown(filePath);
    } else {
      throw new Error("Unsupported file type");
    }
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
}

/**
 * Split text into chunks appropriate for embedding
 * @param text The text to split
 * @param options Options for text splitting
 * @returns Array of text chunks
 */
export async function splitTextIntoChunks(
  text: string,
  options?: { chunkSize?: number; chunkOverlap?: number },
): Promise<string[]> {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options?.chunkSize || 1000,
      chunkOverlap: options?.chunkOverlap || 200,
    });

    const docs = await splitter.createDocuments([text]);
    return docs.map((doc) => doc.pageContent);
  } catch (error) {
    console.error("Error splitting text into chunks:", error);
    throw new Error("Failed to split text into chunks");
  }
}

/**
 * Prepare file for processing (validate and extract text) without storing in vector database
 * @param fileDoc The file document information
 * @returns Extracted text and file info
 */
export async function prepareFileForProcessing(fileDoc: FileDocument): Promise<{
  text: string;
  fileInfo: {
    filename: string;
    totalCharacters: number;
  };
}> {
  try {
    const { filePath, fileType, originalName } = fileDoc;

    // Extract text from the file
    const extractedText = await processFile(filePath, fileType);

    return {
      text: extractedText,
      fileInfo: {
        filename: originalName,
        totalCharacters: extractedText.length,
      },
    };
  } catch (error) {
    console.error("Error preparing file for processing:", error);
    throw error;
  }
}

/**
 * Process a file and add its content to the vector store
 * @param fileDoc The file document information
 * @returns Information about the processed document
 */
export async function processFileAndAddToVectorStore(
  fileDoc: FileDocument,
): Promise<{
  filename: string;
  chunks: number;
  totalCharacters: number;
}> {
  try {
    const { filePath, fileType, originalName, metadata = {} } = fileDoc;

    // Extract text from the file
    const extractedText = await processFile(filePath, fileType);

    // Split the text into manageable chunks
    const textChunks = await splitTextIntoChunks(extractedText);

    // Add file metadata
    const fileMetadata = {
      ...metadata,
      filename: originalName,
      fileType,
      extractedAt: new Date().toISOString(),
      fileId: fileDoc.id,
    };

    // Process each chunk and add to vector store
    for (let i = 0; i < textChunks.length; i++) {
      const chunkMetadata = {
        ...fileMetadata,
        chunk: i + 1,
        totalChunks: textChunks.length,
      };

      await addDocumentToVectorStore({
        text: textChunks[i],
        metadata: chunkMetadata,
      });
    }

    // Clean up temporary file if needed
    if (fs.existsSync(filePath)) {
      // Only delete if we're sure the file exists
      fs.unlinkSync(filePath);
    }

    return {
      filename: originalName,
      chunks: textChunks.length,
      totalCharacters: extractedText.length,
    };
  } catch (error) {
    console.error("Error processing file and adding to vector store:", error);
    throw error;
  }
}
