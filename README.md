# AI Study Companion

> An intelligent, full-stack AI learning workspace designed to help users understand, practice, measure, and continuously improve in any subject.

[![Tests](https://img.shields.io/badge/tests-25%20passed-brightgreen.svg)](#testing--evaluation)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#)

---

## 📚 Project Documentation

Detailed design documents, prompt logs, and evaluation reports are available in the [`/docs`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs) directory:

- 🏛️ [**ARCHITECTURE.md**](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/ARCHITECTURE.md) — System architecture diagram, design decisions, trade-offs, and data flows.
- 🤖 [**AI_USAGE.md**](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/AI_USAGE.md) — Breakdown of AI used at runtime by the product vs. AI used to build the product.
- 💬 [**DEVELOPMENT_PROMPTS.md**](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/DEVELOPMENT_PROMPTS.md) — Prompts used with the coding agent across architecture, frontend, backend, database, and testing.
- 🧪 [**EVALUATION.md**](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/EVALUATION.md) — Evaluation framework, grounding assertions, injection defense, and quality benchmarks.
- ⚠️ [**KNOWN_LIMITATIONS.md**](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/KNOWN_LIMITATIONS.md) — Candid analysis of current document processing, AI cost, and scaling constraints.
- 🚀 [**FUTURE_IMPROVEMENTS.md**](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/FUTURE_IMPROVEMENTS.md) — Strategic roadmap including hybrid search, spaced repetition, and prompt caching.

---

## 🛠️ Quickstart & Local Setup

### Prerequisites
- Node.js 18+ & npm/pnpm
- PostgreSQL with `pgvector` extension
- Redis (for BullMQ job queues)
- Anthropic API Key & OpenAI API Key

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your connection strings:

```bash
cp .env.example .env
```

Key environment variables:
```env
# Database & Auth
DATABASE_URL="postgresql://user:password@localhost:5432/ai_study_companion?schema=public"
NEXTAUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# AI Models
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# Storage & Queues
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Migration & Seed
Initialize the PostgreSQL schema and seed the default accounts:
```bash
npm run db:push
npm run db:seed
```

**Default Test Credentials:**
- **Learner Account**: `demo@studycompanion.ai` / `password123`
- **Superadmin Account**: `admin@studycompanion.ai` / `admin123`

### 4. Start Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Start Background Job Worker (Separate Terminal)
```bash
npm run worker
```

---

## 🧪 Testing & Evaluation

### Run Unit & Integration Tests (Vitest)
```bash
npm test
```
Executes 25 unit tests across 6 suites:
- Concept mastery mathematics (`0.7*old + 0.3*quiz`), boundary clamping, and trend detection
- Adaptive question selection prioritizing low mastery and recent mistakes
- Cross-tenant data isolation and space/project ownership enforcement
- Event and workflow idempotency (preventing duplicate mastery updates)
- Prompt injection defense and document chunk sandboxing
- Sliding-window token bucket rate limiting

### Run End-to-End Tests (Playwright)
```bash
npm run test:e2e
```
Validates the complete 3-stage user flow:
- Flow A: Learner registration $\to$ Space creation $\to$ Project initialization $\to$ Material upload
- Flow B: Grounded AI Tutor queries with citations $\to$ Insufficient evidence refusal
- Flow C: Adaptive assessment completion $\to$ Dashboard concept mastery updates

### Run AI Quality Benchmark Harness
```bash
npm run eval
```
Runs automated assertions for factual grounding, refusal fidelity, injection resistance, and grading accuracy, logging results to the `EvalResult` database table.
