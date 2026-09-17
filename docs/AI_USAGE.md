# AI Usage Specification

This document explicitly details two distinct dimensions of AI within the AI Study Companion:
1. **AI Used by the Product** (Runtime AI capabilities exposed to users)
2. **AI Used to Build the Product** (Agentic tooling and prompts employed during engineering)

---

## Part 1: AI Used by the Product (Runtime Systems)

The application employs a provider-agnostic, multi-model architecture. For prototype development and free-tier operation, the default runtime is **Google Gemini (free tier)**, while retaining clean swappability to Anthropic Claude or OpenAI via the unified `LLMProvider` / `EmbeddingProvider` abstraction layer.

| Feature / Subsystem | Default Provider & Model | Fallback / Alternative | Role & Implementation | Temperature / Config | Output Validation |
|---|---|---|---|---|---|
| **Semantic Embedding** | Google Gemini `text-embedding-004` | OpenAI `text-embedding-3-small` / `@xenova/transformers` | Converts document chunks and learner queries into 768-dimensional dense vectors for cosine similarity search in `pgvector`. | N/A | Strict 768 float array validation |
| **Concept Extraction** | Google Gemini `gemini-2.0-flash` | Anthropic `claude-sonnet-4-20250514` | Reads initial material text chunks in background worker to distill 5–15 atomic learning concepts per project. | 0.2, maxTokens 1000 | Structured JSON schema (`{ concepts: [{ name, description }] }`) |
| **Grounded AI Tutor** | Google Gemini `gemini-2.0-flash` | Anthropic `claude-sonnet-4-20250514` | Conversational Socratic tutor streaming grounded explanations with citations `[Material Name, Page X]` and strict refusal when evidence is absent. | 0.4, maxTokens 2000 | Streaming SSE, citation metadata extraction, prompt injection defense |
| **Adaptive Quiz Generation** | Google Gemini `gemini-2.0-flash` | Anthropic `claude-sonnet-4-20250514` | Generates mixed multiple choice (MCQ) and open-ended conceptual questions targeted at the learner's weakest concepts. | 0.5, maxTokens 1200 | Strict Zod schema validation (4 options for MCQ, explicit correct choice, explanation) |
| **Open-Ended Quiz Grading** | Google Gemini `gemini-2.0-flash` | Anthropic `claude-sonnet-4-20250514` | Evaluates learner's written explanation against model answers and evaluation rubrics. | 0.1, maxTokens 600 | Structured JSON (`{ score: 0-100, isCorrect: boolean, feedback: string, missingConcepts: string[] }`) |
| **Personalized Recommendations** | Google Gemini `gemini-2.0-flash` | Anthropic `claude-sonnet-4-20250514` | Analyzes learner mastery distribution, recent mistake patterns, and goal text to output 2–3 actionable next steps. | 0.3, maxTokens 800 | Structured JSON (`{ recommendations: [{ text, reason, priority }] }`) |

### Observability & Guardrails
- **`AiUsageLog`**: Every runtime AI call records `promptTokens`, `completionTokens`, `latencyMs`, `costUsd`, `model`, `feature`, `userId`, `projectId`, and `success`.
- **System Prompts**: System prompts explicitly enforce boundary sandboxing, source citing, and refusal when facts are not in the document context.
- **Rate Limiting**: AI endpoints enforce sliding-window token bucket limits to prevent denial-of-wallet attacks.

---

## Part 2: AI Used to Build the Product (Engineering Workflow)

During the development of the AI Study Companion, autonomous AI coding agents (DeepMind Antigravity / Gemini) were utilized across the entire software development lifecycle:

1. **System & Schema Design**:
   - Agent analyzed the PRD and drafted the complete 18-model Prisma schema with relational constraints, enums, cascades, and vector definitions.
2. **Full-Stack Implementation**:
   - Backend APIs (NextAuth, REST, SSE streaming, BullMQ queue dispatchers, ownership validation).
   - Frontend UI (Next.js App Router, Tailwind CSS design system, responsive dashboards, interactive test interfaces).
3. **Automated Testing**:
   - Agent authored Vitest unit suites for mathematics, RBAC data isolation, sliding-window rate limiters, and prompt injection defense.
   - Playwright end-to-end tests covering complete multi-step user journeys.
4. **Evaluation Harness**:
   - Agent wrote the programmatic evaluation framework (`src/lib/ai/eval/`) with test cases for factual grounding, insufficient evidence refusal, and prompt injection suppression.
