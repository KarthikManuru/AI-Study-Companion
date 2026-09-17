import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import pdfParse from 'pdf-parse';
import { embedBatch, callLLMStructured } from '@/lib/ai';

const CHUNK_SIZE = 500; // ~500 tokens per chunk
const CHUNK_OVERLAP = 50; // 50 token overlap between chunks

interface ProcessMaterialData {
  materialId: string;
  projectId: string;
  userId: string;
  fileName: string;
  fileContent: string; // base64
}

export async function processMaterialJob(job: Job<ProcessMaterialData>, prisma: PrismaClient) {
  const { materialId, projectId, userId, fileName, fileContent } = job.data;

  // Update status to PROCESSING
  await prisma.material.update({
    where: { id: materialId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Step 1: Extract text from PDF
    console.log(`  📖 Extracting text from ${fileName}...`);
    const pdfBuffer = Buffer.from(fileContent, 'base64');
    const pdfData = await pdfParse(pdfBuffer);
    const fullText = pdfData.text;
    const pageCount = pdfData.numpages;

    if (!fullText || fullText.trim().length < 10) {
      throw new Error('No extractable text found in PDF');
    }

    // Update page count
    await prisma.material.update({
      where: { id: materialId },
      data: { pageCount },
    });

    // Step 2: Split into pages and chunk
    console.log(`  📃 Chunking ${pageCount} pages...`);
    
    // Simple page-based chunking: split by form feeds or estimate page boundaries
    const pages = splitIntoPages(fullText, pageCount);
    const chunks: { content: string; pageNumber: number; chunkIndex: number }[] = [];

    let globalChunkIndex = 0;
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx];
      const pageChunks = chunkText(pageText, CHUNK_SIZE, CHUNK_OVERLAP);
      for (const chunk of pageChunks) {
        if (chunk.trim().length > 20) { // Skip very short chunks
          chunks.push({
            content: chunk,
            pageNumber: pageIdx + 1,
            chunkIndex: globalChunkIndex++,
          });
        }
      }
    }

    console.log(`  🧩 Created ${chunks.length} chunks`);

    // Step 3: Generate embeddings
    console.log(`  🔢 Generating embeddings...`);
    const batchSize = 20;
    const embeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const responses = await embedBatch(
        batch.map((c) => c.content.slice(0, 8000)),
        { userId, projectId }
      );
      embeddings.push(...responses.map((r) => r.embedding));
      job.updateProgress(Math.round(((i + batchSize) / chunks.length) * 60));
    }

    // Step 4: Delete existing chunks for this material (idempotency)
    await prisma.chunk.deleteMany({ where: { materialId } });

    // Step 5: Store chunks with embeddings
    console.log(`  💾 Storing chunks with embeddings...`);
    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = `[${embeddings[i].join(',')}]`;
      await prisma.$executeRaw`
        INSERT INTO chunks (id, "materialId", "pageNumber", content, embedding, "chunkIndex", "createdAt")
        VALUES (
          ${`chunk_${materialId}_${i}`},
          ${materialId},
          ${chunks[i].pageNumber},
          ${chunks[i].content},
          ${embeddingStr}::vector,
          ${chunks[i].chunkIndex},
          NOW()
        )
      `;
    }

    job.updateProgress(80);

    // Step 6: Extract concepts using LLM
    console.log(`  🧠 Extracting concepts...`);
    const sampleText = fullText.slice(0, 8000);
    let concepts: { name: string; description: string }[] = [];

    try {
      const conceptResult = await callLLMStructured<{ name: string; description: string }[]>(
        'concept_extraction',
        [
          {
            role: 'user',
            content: `Extract key concepts from this study material:\n\n${sampleText}`,
          },
        ],
        null,
        {
          systemPrompt: `You are a learning assistant. Extract the key concepts and topics from the following study material.
Return a JSON array of objects with "name" and "description" fields.
Extract 5-15 important concepts that a student would need to learn.`,
          temperature: 0.3,
          maxTokens: 2000,
          userId,
          projectId,
        }
      );
      concepts = Array.isArray(conceptResult.data) ? conceptResult.data : [];
    } catch (err) {
      console.warn('  ⚠️ Failed to extract concepts with LLM:', err);
    }

    // Upsert concepts
    for (const concept of concepts) {
      if (!concept.name || concept.name.length < 2) continue;
      
      await prisma.concept.upsert({
        where: {
          projectId_name: { projectId, name: concept.name },
        },
        update: { description: concept.description || '' },
        create: {
          projectId,
          name: concept.name,
          description: concept.description || '',
        },
      });

      // Ensure ConceptMastery exists
      const existingConcept = await prisma.concept.findUnique({
        where: { projectId_name: { projectId, name: concept.name } },
      });
      if (existingConcept) {
        await prisma.conceptMastery.upsert({
          where: {
            projectId_conceptId: { projectId, conceptId: existingConcept.id },
          },
          update: {},
          create: {
            projectId,
            conceptId: existingConcept.id,
            masteryScore: 50, // Start at 50%
            trend: 'STABLE',
          },
        });
      }
    }

    job.updateProgress(95);

    // Step 7: Update material status to READY
    await prisma.material.update({
      where: { id: materialId },
      data: { status: 'READY', storageUrl: 'processed' },
    });

    // Step 8: Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId,
        projectId,
        type: 'material.processed',
        payload: {
          materialId,
          fileName,
          pageCount,
          chunkCount: chunks.length,
          conceptCount: concepts.length,
        },
        idempotencyKey: `material.processed:${materialId}`,
      },
    });

    console.log(`  ✅ Material processed: ${chunks.length} chunks, ${concepts.length} concepts`);
    job.updateProgress(100);
  } catch (error: any) {
    console.error(`  ❌ Material processing failed:`, error.message);

    await prisma.material.update({
      where: { id: materialId },
      data: {
        status: 'FAILED',
        failureReason: error.message?.slice(0, 500) || 'Unknown error',
      },
    });

    throw error; // Let BullMQ retry
  }
}

// ─── Helpers ──────────────────────────────────────────────

function splitIntoPages(text: string, pageCount: number): string[] {
  // Try to split by form feeds first
  const ffSplit = text.split('\f').filter((p) => p.trim().length > 0);
  if (ffSplit.length >= pageCount * 0.5) {
    return ffSplit;
  }

  // Fall back to splitting by estimated page length
  const avgPageLength = Math.ceil(text.length / Math.max(pageCount, 1));
  const pages: string[] = [];
  for (let i = 0; i < text.length; i += avgPageLength) {
    pages.push(text.slice(i, i + avgPageLength));
  }
  return pages;
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start += chunkSize - overlap;
  }

  return chunks;
}
