# Development Prompts & Agent Trajectory

This log documents key prompts, constraints, and instructions used during the collaborative development of the AI Study Companion.

---

## 1. Architecture & System Scaffold Prompts

```text
"Review the AI Study Companion PRD (v3.0). Formulate a multi-phase implementation plan that covers:
1. Complete Prisma relational schema with pgvector support, users, spaces, projects, materials, chunks, concepts, mastery, quiz attempts, and AI usage logs.
2. NextAuth.js credentials provider with JWT sessions and bcrypt hashing.
3. Strict cross-tenant data isolation helpers (assertSpaceOwnership, assertProjectOwnership).
4. Asynchronous worker for document processing and learning workflows using BullMQ.
5. Grounded AI Tutor with citation pills and insufficient evidence handling.
6. Adaptive quiz generator and grader with deterministic MCQ scoring and LLM open-ended grading.
7. Concept mastery updating algorithm (0.7*old + 0.3*quiz) and trend assignment.
8. Per-project and global analytics dashboards.
9. Superadmin observability console for live telemetry and BullMQ queue health.
Ensure all phases are designed modularly with clean interfaces."
```

---

## 2. Database & Schema Prompts

```text
"Create the Prisma schema (prisma/schema.prisma) with all 18 models:
- User (with role enum: USER, ADMIN)
- Space (with color, icon, cascade delete)
- Project (scoped to space, with goal, materials, concepts)
- Material (status: QUEUED, PROCESSING, READY, FAILED; storageUrl, pageCount)
- Chunk (with pgvector(1536) embedding support)
- Concept and ConceptMastery (with 0-100 masteryScore, MasteryTrend enum, history array)
- Conversation and Message (with citation JSON array)
- QuizAttempt (status, totalScore, startedAt, completedAt)
- Question (MCQ and OPEN types, difficulty, choices JSON, correctAnswer)
- Answer (score, feedback, missingConcepts JSON)
- Recommendation (status, priority)
- LearningEvent (append-only audit stream with idempotencyKey)
- AiUsageLog (promptTokens, completionTokens, costUsd, latencyMs, feature, model)
- EvalResult (testCaseId, passed, score, notes)
- LearningContext (for persistent learning patterns)"
```

---

## 3. Backend & API Prompts

```text
"Create the REST endpoints under src/app/api:
1. /api/auth/signup with zod validation and password hashing.
2. /api/spaces and /api/spaces/[spaceId] with ownership validation.
3. /api/spaces/[spaceId]/projects and /api/projects/[projectId].
4. /api/materials/upload validating PDF files and enqueueing BullMQ jobs.
5. /api/tutor streaming SSE response using pgvector retrieval and citation tracking.
6. /api/quiz/start using adaptive concept selection and LLM generation.
7. /api/quiz/submit grading MCQs deterministically and open answers via LLM, then updating ConceptMastery using 0.7*old + 0.3*quiz.
8. /api/analytics and /api/projects/[projectId]/analytics for aggregated and scoped metrics.
9. /api/admin/overview and /api/admin/jobs for platform metrics and BullMQ queue depth."
```

---

## 4. Frontend & Design System Prompts

```text
"Build a cohesive, high-aesthetic web interface in Next.js 14 using modern Tailwind CSS:
- Surface-raised dark mode cards, subtle borders, and harmonious accent colors.
- Project workspace with clean tabbed navigation (Overview, Materials, Tutor, Quiz, Mastery, Analytics).
- Tutor chat UI with suggestion chips, live message streaming, and clickable citation badges.
- Quiz interface featuring setup options, active progress indicators, MCQ selectors, open response textarea with word counts, and comprehensive graded review with mastery delta indicators.
- Per-project and global analytics dashboards with KPI cards, concept mastery matrix, and activity streams."
```

---

## 5. AI Engineering & Retrieval Prompts

```text
"Implement the AI provider layer in src/lib/ai:
- Abstract LLMProvider and EmbeddingProvider interfaces.
- Claude provider with streaming and structured JSON output.
- OpenAI embedding provider (text-embedding-3-small).
- callLLM and callLLMStructured wrappers that automatically record token counts, latency, and estimated cost into AiUsageLog.
- Retrieval helper (src/lib/ai/retrieval) performing pgvector cosine similarity search scoped strictly to the current projectId, with evidence formatting and insufficient evidence thresholds."
```

---

## 6. Testing, Safety & Evaluation Prompts

```text
"Implement a comprehensive testing and evaluation framework:
1. Vitest unit tests for:
   - Ownership isolation (assertSpaceOwnership, assertProjectOwnership).
   - ConceptMastery calculation (0.7*old + 0.3*quiz, clamping at 0/100, trend boundaries).
   - Adaptive question selection algorithm (verifying lower mastery and recent errors receive higher selection weight).
   - Event idempotency (verifying duplicate event delivery does not double-apply score deltas).
   - Prompt injection defense (ensuring malicious document chunks cannot hijack tutor instructions).
   - Sliding-window token bucket rate limiter.
2. Playwright e2e tests in tests/e2e/learning-flows.spec.ts covering signup, material upload, grounded tutor chat, unanswerable question refusal, and quiz completion.
3. Evaluation harness (src/lib/ai/eval/) with automated benchmark test cases asserting factual grounding, source citations, and injection resilience."
```
