import prisma from '@/lib/db/prisma';
import { embedText } from '@/lib/ai';

export interface RetrievedChunk {
  id: string;
  content: string;
  pageNumber: number;
  materialId: string;
  materialName: string;
  similarity: number;
}

// Minimum similarity threshold — below this, evidence is considered insufficient
export const RETRIEVAL_THRESHOLD = 0.3;

/**
 * Retrieve relevant chunks from a project's materials using pgvector cosine similarity.
 * Strictly scoped to the given project — no cross-project leakage.
 */
export async function retrieveRelevantChunks(
  projectId: string,
  query: string,
  topK: number = 5,
  threshold: number = RETRIEVAL_THRESHOLD
): Promise<RetrievedChunk[]> {
  // Generate query embedding
  const { embedding } = await embedText(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Use raw SQL for pgvector cosine similarity search
  // CRITICAL: Always filter by projectId through the materials table
  const results = await prisma.$queryRaw<Array<{
    id: string;
    content: string;
    page_number: number;
    material_id: string;
    file_name: string;
    similarity: number;
  }>>`
    SELECT 
      c.id,
      c.content,
      c."pageNumber" as page_number,
      c."materialId" as material_id,
      m."fileName" as file_name,
      1 - (c.embedding <=> ${embeddingStr}::vector) as similarity
    FROM chunks c
    JOIN materials m ON c."materialId" = m.id
    WHERE m."projectId" = ${projectId}
      AND m.status = 'READY'
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> ${embeddingStr}::vector) > ${threshold}
    ORDER BY c.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `;

  return results.map((r) => ({
    id: r.id,
    content: r.content,
    pageNumber: r.page_number,
    materialId: r.material_id,
    materialName: r.file_name,
    similarity: r.similarity,
  }));
}

/**
 * Check if we have enough evidence to answer a question.
 * Returns true if we have at least one chunk above the threshold.
 */
export function hasEnoughEvidence(chunks: RetrievedChunk[]): boolean {
  return chunks.length > 0 && chunks.some((c) => c.similarity > 0.4);
}

/**
 * Format chunks into context for the AI prompt.
 */
export function formatChunksAsContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return 'No relevant material found.';

  return chunks
    .map((c, i) => 
      `<evidence source="${c.materialName}" page="${c.pageNumber}" chunk_id="${c.id}" index="${i + 1}">\n${c.content}\n</evidence>`
    )
    .join('\n\n');
}

/**
 * Extract citation references from chunks for structured storage.
 */
export function extractCitations(chunks: RetrievedChunk[]) {
  return chunks.map((c) => ({
    materialId: c.materialId,
    materialName: c.materialName,
    pageNumber: c.pageNumber,
    chunkId: c.id,
    excerpt: c.content.slice(0, 200),
  }));
}
