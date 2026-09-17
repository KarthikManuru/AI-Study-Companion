# 🧠 AI Study Companion

<div align="center">

**An intelligent, production-grade AI learning workspace that helps learners comprehend complex materials, practice adaptively, track conceptual mastery, and eliminate knowledge gaps.**

[![Next.js](https://img.shields.io/badge/Next.js-14.2.29-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?style=for-the-badge&logo=redis)](https://upstash.com/)
[![Tests](https://img.shields.io/badge/Tests-25%20Passed-brightgreen?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

[Features](#-key-features) • [System Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [Dual-Auth Security](#-dual-auth-security--isolation) • [Documentation & PDFs](#-documentation--specifications) • [Evaluation Suite](#-testing--evaluation-framework)

---

</div>

## 🌟 Key Features

### 1. 📚 Hierarchical Knowledge Organization
- **Spaces & Projects**: Organize study domains hierarchically (e.g., *Computer Science* $\to$ *Distributed Systems* $\to$ *Consensus Protocols*).
- **Asynchronous Ingestion**: Upload multi-page lecture notes, textbooks, and PDF slides processed in the background without blocking the UI.
- **Automated Concept Extraction**: Extracts key conceptual primitives and terminology from uploaded materials to build individualized knowledge graphs.

### 2. 💬 Factional-Grounded RAG AI Tutor
- **Chunk-Level Citations**: Every response cites exact sources, document names, and page numbers.
- **Strict Anti-Hallucination Guardrails**: Refuses out-of-context queries with honest disclaimers when context evidence is insufficient.
- **Prompt Injection Hardening**: Implements structured delimiter isolation and sanitization to neutralize jailbreaks within study documents.
- **Streaming UI**: Low-latency token streaming with dynamic viewport height adaptation for mobile and desktop viewports.

### 3. 🎯 Diagnostic & Adaptive Quiz Engine
- **Multi-Modal Assessments**: Deterministic Multiple Choice Questions (MCQ) combined with open-ended conceptual reasoning questions.
- **AI-Powered Semantic Grading**: Open-ended student answers are graded against strict rubric criteria by LLMs, pinpointing missing concepts and misconceptions.
- **Dynamic Difficulty Calibration**: Questions adaptively scale in difficulty (1–5) based on real-time mastery scores and prior mistakes.

### 4. 📈 Concept Mastery Tracking (EWMA)
- **Mathematical Retention Modeling**: Calculates retention using an Exponentially Weighted Moving Average:
  $$\text{Mastery}_{\text{new}} = 0.70 \times \text{Mastery}_{\text{previous}} + 0.30 \times \text{QuizScore}$$
- **Trend Detection**: Flags emerging strengths and downward trends across topics.
- **Targeted Actionable Recommendations**: Proactively suggests remedial review topics based on weak concept clusters.

### 5. ⚙️ Real-Time Admin Telemetry & Observability
- **Token & Cost Auditing**: Tracks prompt/completion token consumption and monetary cost per feature (`TUTOR`, `QUIZ_GENERATION`, `QUIZ_GRADING`, `CONCEPT_EXTRACTION`).
- **P95 Latency Telemetry**: Live performance monitoring across all LLM inference providers.
- **Job Queue Health**: Real-time worker monitoring for BullMQ queues (active, completed, delayed, and failed jobs).
- **User Governance**: Searchable user directory with role-based activity audit logs.

---

## 🏛 System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Frontend & Client Layer (Next.js 14 App Router)"]
        UI["Responsive Web Application\n(Tailwind CSS + Lucide)"]
        LearnerApp["🎓 Learner Portal\n(/dashboard, /tutor, /quiz)"]
        AdminApp["⚙️ Admin Telemetry Console\n(/admin)"]
        UI --> LearnerApp
        UI --> AdminApp
    end

    subgraph AuthLayer["🛡️ Dual Session & Isolation Layer"]
        LearnerAuth["NextAuth Session Cookie\n(Learners)"]
        AdminAuth["Secure HttpOnly Admin Cookie\n(Superadmins)"]
        Middleware["Edge Middleware\nRoute Guarding & RBAC"]
        LearnerApp -.-> LearnerAuth
        AdminApp -.-> AdminAuth
        LearnerAuth --> Middleware
        AdminAuth --> Middleware
    end

    subgraph APILayer["⚡ API Gateway & Server Actions"]
        TutorAPI["/api/tutor (RAG Streaming)"]
        QuizAPI["/api/quiz (Adaptive Engine)"]
        UploadAPI["/api/materials/upload"]
        AdminAPI["/api/admin (Telemetry & Health)"]
        Middleware --> APILayer
    end

    subgraph AIProviderLayer["🧠 Multi-Model AI Gateway"]
        Claude["Anthropic Claude 3.5 Sonnet / Haiku\n(Tutor & Open Grading)"]
        OpenAI["OpenAI text-embedding-3-small\n(Vector Embeddings)"]
        Gemini["Google Gemini 1.5 Flash\n(Fallback & Fast Extraction)"]
        APILayer --> AIProviderLayer
    end

    subgraph AsyncWorkerLayer["🔄 Background Processing (BullMQ + Redis)"]
        RedisQueue[("Upstash Redis\nMessage Broker")]
        Worker["Background Worker Process\n(PDF Parse • Chunking • Vector Store)"]
        UploadAPI --> RedisQueue
        RedisQueue --> Worker
    end

    subgraph DataLayer["💾 Persistence Layer (PostgreSQL + pgvector)"]
        Prisma["Prisma ORM Client\n(Parallelized Pool)"]
        DB[("Neon Serverless PostgreSQL\n• pgvector Cosine Similarity\n• Tenant Isolated Relational Tables")]
        APILayer --> Prisma
        Worker --> Prisma
        Prisma --> DB
    end
```

---

## 🔐 Dual-Auth Security & Isolation

To prevent privilege escalation and account collision, the application enforces **complete physical separation** between Learner accounts and Administrator accounts:

| Property | Learner Portal | Superadmin Console |
| :--- | :--- | :--- |
| **Route Prefix** | `/auth/login`, `/dashboard` | `/admin/login`, `/admin` |
| **Session Cookie** | `next-auth.session-token` | `next-auth.admin-session-token` |
| **Storage Mechanism** | NextAuth JWT Session | Signed HttpOnly Secure Cookie |
| **Role Requirement** | `LEARNER` or `ADMIN` | Strictly `ADMIN` |
| **Creation Requirement** | Standard Email & Password | Requires Server `ADMIN_SECRET_KEY` |
| **Concurrent Sessions** | Supported in parallel | Supported in parallel without logout |

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: `v18.17.0+` or `v20.0.0+`
- **Package Manager**: `npm` or `pnpm`
- **PostgreSQL**: PostgreSQL with `pgvector` enabled (e.g., [Neon](https://neon.tech))
- **Redis**: Redis instance for background queues (e.g., [Upstash](https://upstash.com))
- **API Keys**: Anthropic and OpenAI API keys

---

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/<YOUR_USERNAME>/ai-study-companion.git
cd ai-study-companion
npm install
```

---

### 2. Configure Environment Variables

Create your local configuration by copying `.env.example`:

```bash
cp .env.example .env
```

Populate the required configuration values in `.env`:

```env
# Database (PostgreSQL with pgvector extension)
DATABASE_URL="postgresql://user:password@host:5432/neondb?sslmode=require"

# NextAuth Secrets
NEXTAUTH_SECRET="your-32-char-random-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI Model Providers
ANTHROPIC_API_KEY="sk-ant-api03-..."
OPENAI_API_KEY="sk-proj-..."
GEMINI_API_KEY="AIzaSy..."

# Distributed Queue & Cache (Redis)
REDIS_URL="rediss://default:password@your-redis-host:6379"

# Administrative Provisioning Secret
ADMIN_SECRET_KEY="generate-a-secure-32-char-random-admin-secret"
```

---

### 3. Database Migration & Seed

Initialize the database schema and seed default demo accounts:

```bash
# Push schema to database
npm run db:push

# Seed database with demo spaces, materials, and users
npm run db:seed
```

#### Pre-Configured Demo Credentials:
- **🎓 Learner Account**:
  - **Email**: `demo@studycompanion.ai`
  - **Password**: `password123`
- **⚙️ Superadmin Account**:
  - **Email**: `admin@studycompanion.ai`
  - **Password**: `admin123`

---

### 4. Run the Application

You need two terminal windows running concurrently:

**Terminal 1 — Next.js Application Server**:
```bash
npm run dev
```
*Access web interface at: [http://localhost:3000](http://localhost:3000)*

**Terminal 2 — Background Asynchronous Worker**:
```bash
npm run worker
```
*Monitors BullMQ queues for document extraction, chunking, and embedding generation.*

---

## 🧪 Testing & Evaluation Framework

The project includes an enterprise-grade automated testing suite covering unit math, security boundaries, end-to-end user flows, and LLM factual grounding assertions.

```bash
# 1. Run Unit & Integration Tests (Vitest)
npm test

# 2. Run End-to-End User Journeys (Playwright)
npm run test:e2e

# 3. Run AI Grounding & Hallucination Benchmark Harness
npm run eval

# 4. Verify TypeScript Static Types
npx tsc --noEmit
```

### Test Coverage Highlights:
- **Mastery Math Verification**: Validates EWMA updates, trend direction heuristics, and score clamping between 0 and 100.
- **Adaptive Selection**: Confirms question generation targets lower-mastery concepts and recent student mistakes.
- **Cross-Tenant Isolation**: Proves users cannot read or modify spaces or projects belonging to other accounts.
- **Anti-Hallucination & Refusal Assertions**: Validates that questions with missing source chunks return honest refusals rather than fabricated answers.
- **Prompt Injection Defense**: Validates sandboxed delimiters against malicious instructions embedded inside uploaded PDFs.

---

## 📚 Documentation & Specifications

Complete, submission-ready architectural specifications, prompt logs, and evaluation reports are available in the [`/docs`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs) directory, along with pre-rendered publication PDFs:

| Topic | Markdown Document | Publication PDF |
| :--- | :--- | :--- |
| **System Architecture** | [`ARCHITECTURE.md`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/ARCHITECTURE.md) | [📥 `ARCHITECTURE.pdf`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/pdf/ARCHITECTURE.pdf) |
| **AI Usage & Prompts** | [`AI_USAGE.md`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/AI_USAGE.md) | [📥 `AI_USAGE.pdf`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/pdf/AI_USAGE.pdf) |
| **Development Prompts** | [`DEVELOPMENT_PROMPTS.md`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/DEVELOPMENT_PROMPTS.md) | [📥 `DEVELOPMENT_PROMPTS.pdf`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/pdf/DEVELOPMENT_PROMPTS.pdf) |
| **Evaluation Suite** | [`EVALUATION.md`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/EVALUATION.md) | [📥 `EVALUATION.pdf`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/pdf/EVALUATION.pdf) |
| **Known Limitations** | [`KNOWN_LIMITATIONS.md`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/KNOWN_LIMITATIONS.md) | [📥 `KNOWN_LIMITATIONS.pdf`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/pdf/KNOWN_LIMITATIONS.pdf) |
| **Future Roadmap** | [`FUTURE_IMPROVEMENTS.md`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/FUTURE_IMPROVEMENTS.md) | [📥 `FUTURE_IMPROVEMENTS.pdf`](file:///c:/Users/Karth/Desktop/AI%20Study%20Companion/docs/pdf/FUTURE_IMPROVEMENTS.pdf) |

---

## 📁 Repository Structure

```
ai-study-companion/
├── docs/                      # Architectural specifications & design docs
│   ├── pdf/                   # Publication-ready A4 PDF documents
│   ├── ARCHITECTURE.md        # Technical design & data flows
│   ├── AI_USAGE.md            # AI prompt strategies & runtime telemetry
│   └── EVALUATION.md          # Benchmark test harness specification
├── prisma/
│   ├── schema.prisma          # PostgreSQL schema with pgvector & models
│   └── seed.ts                # Database seeder with sample spaces & users
├── src/
│   ├── app/
│   │   ├── admin/             # Superadmin telemetry, user governance & logs
│   │   ├── auth/              # Learner authentication (login & signup)
│   │   ├── dashboard/         # Main learner portal
│   │   │   ├── spaces/        # Hierarchical subject spaces
│   │   │   ├── projects/      # Project dashboard, RAG tutor & adaptive quiz
│   │   │   └── analytics/     # Personal learning analytics
│   │   └── api/               # Next.js Serverless Route Handlers
│   ├── lib/
│   │   ├── ai/                # LLM providers (Anthropic, OpenAI, Gemini)
│   │   ├── auth/              # Dual-session authentication helpers & cookies
│   │   ├── db/                # Prisma client with connection pre-warming
│   │   └── jobs/              # BullMQ queue producers
│   └── middleware.ts          # Edge routing & role-based access control
├── tests/                     # Vitest unit & integration test suites
├── worker/                    # Asynchronous BullMQ background worker
└── .env.example               # Clean environment template without secrets
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
