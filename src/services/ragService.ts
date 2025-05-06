import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { vectorStore, model } from "../config/langchain";
import { QueryInput, DocumentInput } from "../types/ragTypes";

/**
 * Query the RAG system with a user question
 * @param params The query parameters
 * @returns The answer from the RAG system
 */
export async function queryRagSystem(params: QueryInput): Promise<string> {
  try {
    const { query, options } = params;

    // Create a retriever from the vector store
    const retriever = vectorStore.asRetriever({
      k: options?.topK || 4,
      filter: undefined,
      searchType: "similarity",
    });

    // Create a prompt template
    const prompt = ChatPromptTemplate.fromTemplate(`
       Answer the following question based on the provided context.
       If you don't know the answer based on the context, just say that you don't know.

       Context: {context}
       Question: {question}
     `);

    // Create a chain to combine documents
    const combineDocsChain = await createStuffDocumentsChain({
      llm: model,
      prompt,
    });

    // Create the retrieval chain
    const retrievalChain = await createRetrievalChain({
      combineDocsChain,
      retriever,
    });

    // Execute the chain
    const response = await retrievalChain.invoke({
      input: query,
    });

    return response.answer;
  } catch (error) {
    console.error("Error in RAG query:", error);
    throw new Error("Failed to process your query");
  }
}

/**
 * Add a document to the vector store
 * @param document The document to add
 */
export async function addDocumentToVectorStore(
  document: DocumentInput,
): Promise<void> {
  try {
    const { text, metadata = {} } = document;

    const doc = new Document({
      pageContent: text,
      metadata,
    });

    await vectorStore.addDocuments([doc]);
    console.log("Document added successfully");
  } catch (error) {
    console.error("Error adding document to vector store:", error);
    throw new Error("Failed to add document to vector store");
  }
}

/**
 * Get similar documents from the vector store
 * @param params The search parameters
 * @returns Array of similar documents
 */
export async function getSimilarDocuments(
  params: QueryInput,
): Promise<Document[]> {
  try {
    const { query, options } = params;

    const documents = await vectorStore.similaritySearch(
      query,
      options?.topK || 4,
    );

    return documents;
  } catch (error) {
    console.error("Error finding similar documents:", error);
    throw new Error("Failed to find similar documents");
  }
}
