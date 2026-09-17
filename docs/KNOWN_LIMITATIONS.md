# Known Limitations

This document provides a candid, comprehensive analysis of current architectural and operational constraints in the AI Study Companion.

---

## 1. Document Processing & Ingestion Constraints
- **Scanned Image PDFs & OCR**: Current parsing relies on `pdf-parse` for digital text extraction. Documents containing scanned images or complex handwritten equations require an OCR pre-processing step (e.g. Tesseract.js or Cloud Vision), which increases worker latency.
- **Complex Multi-Column Tables**: Multi-column tabular layouts can occasionally experience interleaved text streams during linear token extraction, reducing vector search precision for dense financial or scientific tables.
- **Single-Worker Concurrency in Prototype**: The default BullMQ worker runs with a concurrency setting of 2 for document processing to avoid memory spikes in containerized environments with limited RAM.

---

## 2. Retrieval & Semantic Search Limitations
- **Fixed-Size Sliding Windows**: Text is divided into 500-token chunks with 50-token overlap. While effective for general prose, cross-page proofs or long code blocks may span chunk boundaries.
- **Single-Hop Cosine Search**: The retrieval engine uses dense cosine similarity without a secondary cross-encoder re-ranking step. Adding BM25 hybrid search would improve keyword-specific searches (e.g. looking up specific variable or theorem names).

---

## 3. AI & Context Window Economics
- **API Token Costs**: While `claude-sonnet-4` provides exceptional reasoning and grounding, heavy student conversation volume and large quizzes accumulate API fees. Token caching (Anthropic prompt caching) can be implemented to reduce repeated system prompt and document context costs by up to 90%.
- **Open-Ended Grading Subjectivity**: Although LLM rubrics are temperature-clamped (0.1), highly unconventional but mathematically valid answers can occasionally be scored slightly lower than standard textbook explanations.

---

## 4. Scaling & Background Processing
- **Queue Memory**: In-memory Redis requires persistence volume attachment (`redis-volume`) to prevent job loss during restarts.
- **WebSocket Push Notifications**: Currently, document status changes (`QUEUED` $\to$ `PROCESSING` $\to$ `READY`) use client-side polling rather than bidirectional WebSockets, which adds periodic HTTP requests.

---

## 5. Free-Tier Rate Limits & Embedding Dimensions
- **Gemini Free-Tier Rate Limits**: The Google Gemini free tier (`gemini-2.0-flash`) has a 15 Requests Per Minute (RPM) and 1,500 Requests Per Day limit on AI Studio keys. Heavy batch quiz generation or multi-user load spikes should incorporate client-side queuing or exponential backoff to avoid HTTP 429 throttling.
- **Embedding Dimension Shift (768-dim)**: Swapping from OpenAI `text-embedding-3-small` (1536-dim) to Google Gemini `text-embedding-004` (768-dim) adjusts the dense vector column in Neon PostgreSQL (`chunks.embedding`) to `vector(768)`. Chunks embedded under 1536 dimensions must be re-embedded when switching providers.
