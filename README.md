# FormForge RAG Server

FormForge RAG Server is a Retrieval Augmented Generation (RAG) API built with Express.js, TypeScript, LangChain.js, and Supabase vector database. It provides both REST API and WebSocket capabilities for real-time document processing and querying.

## Features

- Query API for RAG-powered question answering
- Document ingestion API to add knowledge to the system
- Similar document search API
- File upload API for PDF and Markdown documents
- Real-time upload and processing progress via WebSockets
- Comprehensive OpenAPI (Swagger) documentation for REST endpoints
- AsyncAPI documentation for WebSocket events
- Support for large file uploads (up to 20MB per file)

## Prerequisites

- Node.js (v16+)
- pnpm (recommended) or npm
- Supabase account
- OpenAI API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables:

   - Copy `.env.example` to `.env`
   - Fill in your API keys and configuration

4. Set up Supabase:
   - Create a new Supabase project
   - Enable the pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Create the documents table:

```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536)
);

-- Create a function to match documents
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

Development

Run the development server:

```bash
pnpm run dev
```

The server will start at http://localhost:3000 (or the PORT specified in your .env file).

## Documentation Systems

This project uses two separate documentation systems:

1. **Swagger/OpenAPI** for REST API documentation
2. **AsyncAPI** for WebSocket event documentation

### Setting Up AsyncAPI Documentation

Install the AsyncAPI CLI globally:

```bash
pnpm add -g @asyncapi/cli
```

Generate the AsyncAPI specification:

```bash
pnpm generate-async-spec
```

Generate the WebSocket documentation:

```bash
pnpm generate-websocket-docs-with-csp
```

The WebSocket documentation will be available in the `docs/websocket` directory.

## REST API Documentation

OpenAPI documentation is available at: http://localhost:3000/api-docs
Build for Production

Compile TypeScript to JavaScript:

```bash
pnpm run build
```

Start the production server:

```bash
pnpm start
```

## API Endpoints

- `POST /api/rag/query` - Query the RAG system with a question
- `POST /api/rag/documents` - Add documents to the knowledge base
- `POST /api/rag/similar` - Find similar documents to a query
- `POST /api/files/upload` - Upload and process PDF or Markdown files
- `POST /api/files/process` - Process previously uploaded files
- `GET /api/files/uploaded/{uploadId}` - Get list of uploaded files
- `GET /api/files/upload-status/{uploadId}` - Get upload progress status

### File Upload Endpoint

The file upload endpoint accepts PDF and Markdown files, processes them to extract text content, generates embeddings using OpenAI, and stores them in the Supabase vector database.

Example usage with cURL:

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/document.pdf" \
  -F 'options={"metadata":{"source":"company-docs","category":"technical"}}'
```

The endpoint accepts the following options as a JSON string:

- `splitByChunks` (boolean): Whether to split the document into chunks (default: true)
- `chunkSize` (number): Size of each chunk in characters (default: 1000)
- `chunkOverlap` (number): Number of characters to overlap between chunks (default: 200)
- `metadata` (object): Additional metadata to store with the document

#### File Size Limits

The server supports uploading files up to 20MB in size. This limit applies to both individual files and the total size of all files in a single request.

## WebSocket Events

The server uses WebSockets to provide real-time updates for file upload and processing progress.

### Connecting to WebSocket

```javascript
// Client-side example
const socket = io("http://localhost:3000");

// Join a specific upload room to receive updates
socket.emit("joinUploadRoom", uploadId);

// Listen for progress events
socket.on("uploadProgress", (data) => {
  console.log(`Upload progress: ${data.percent}%`);
});

// Listen for processing events
socket.on("processingStart", (data) => {
  console.log("Processing started");
});
socket.on("processingProgress", (data) => {
  console.log(`Progress: ${data.percent}%`);
});
socket.on("processingComplete", (data) => {
  console.log("Processing complete");
});
socket.on("processingError", (data) => {
  console.log("Processing error", data.error);
});
```

## Testing the API

You can test the API using tools like cURL, Postman, or the included OpenAPI UI.

### Query the RAG system

```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is RAG in AI?"}'
```

### Add a document

```bash
curl -X POST http://localhost:3000/api/rag/documents \
  -H "Content-Type: application/json" \
  -d '{"text": "RAG (Retrieval Augmented Generation) is an AI framework that enhances large language models by incorporating external knowledge.", "metadata": {"source": "AI documentation"}}'
```

### Find similar documents

```bash
curl -X POST http://localhost:3000/api/rag/similar \
  -H "Content-Type: application/json" \
  -d '{"query": "retrieval augmented generation", "options": {"topK": 3}}'
```

### Upload a file

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/document.pdf" \
  -F 'options={"metadata":{"source":"company-docs"}}'
```

### Process uploaded files

```bash
curl -X POST http://localhost:3000/api/files/process \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "your-upload-id"}'
```

## License

ISC
