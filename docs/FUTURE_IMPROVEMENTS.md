# Future Improvements & Strategic Roadmap

This roadmap outlines high-impact architectural enhancements planned for subsequent versions of the AI Study Companion.

---

## 1. Advanced Retrieval & Search Enhancements
- **Hybrid Sparse-Dense Retrieval (BM25 + pgvector)**: Combine traditional lexical search (BM25) with dense semantic embeddings via Reciprocal Rank Fusion (RRF) to excel at both conceptual queries and exact symbol lookups.
- **Cross-Encoder Re-ranking**: Add a second-stage re-ranking pass (e.g., Cohere Rerank or BGE-Reranker) to evaluate the top 20 candidate chunks before prompt assembly, boosting citation precision.
- **Hierarchical Document Trees**: Implement Parent-Document retrieval where small chunks are indexed for high similarity matching, but their larger parent sections are passed to the LLM for broader contextual grounding.

---

## 2. Spaced Repetition & Adaptive Scheduling
- **SuperMemo (SM-2) / FSRS Flashcards**: Automatically distill key concepts into digital flashcards with adaptive interval scheduling (review in 1 day, 3 days, 1 week, 1 month) based on recall difficulty.
- **Calendar & Learning Habit Integration**: Sync recommended review sessions with Google Calendar / Outlook to nudge learners when concepts show declining mastery trends.

---

## 3. Real-Time Collaboration & Multimodality
- **Shared Spaces & Peer Study**: Enable collaborative study spaces with multi-user permissions, shared document annotations, and group quiz leaderboards.
- **Voice-First AI Tutor**: Integrate real-time audio input/output (e.g., WebRTC + Whisper/ElevenLabs or Gemini Live) for conversational, hands-free study sessions while commuting or exercising.
- **Multimodal Visual Grounding**: Allow students to upload diagrams, architectural charts, and handwritten problem sets using vision models (`claude-3-5-sonnet` / `gemini-1.5-pro`) to critique visual sketches.

---

## 4. Performance & Cost Optimizations
- **Anthropic Prompt Caching**: Cache unchanging document context blocks and system instructions across tutor messages to cut response latency by 50% and token costs by up to 90%.
- **Streaming WebSockets**: Transition from HTTP polling to WebSockets for instant document processing status, background recommendation notifications, and real-time collaborative activity.
