# AI Engineering Platform

A unified, AI-powered software engineering workspace built as a final-year engineering project.

---

## Overview

The AI Engineering Platform provides developers with a single environment to access AI-powered software engineering capabilities — instead of switching between multiple disconnected AI tools. Users can analyse code quality, generate new code, debug bugs, generate documentation, and hold engineering conversations with an AI assistant — all from one coherent, authenticated workspace.

## Problem Statement

Developers today rely on a fragmented set of AI tools — different tools for code review, generation, debugging, and documentation — each requiring separate context and context-switching. This project integrates these capabilities into a single, modular platform with per-user history and a consistent interface.

## Key Features

| Feature | Description |
|---|---|
| 🔐 Authentication | Secure email/password login and registration with bcrypt hashing |
| 💬 AI Assistant | Conversational engineering help with persistent chat history |
| 🔍 Code Analysis | Quality scores, bug detection, and improvement suggestions |
| ⚡ Code Generation | Natural-language to production-ready code |
| 🐛 Debugging Assistant | Root-cause analysis and corrected code fixes |
| 📄 Documentation Generator | Docstrings, parameter tables, and README sections |
| 📊 Dashboard | Stats overview and quick access to all tools |
| 🕒 History | Paginated history of all AI interactions per user |

## Architecture

```
src/
├── app/
│   ├── (auth)               # Login / Register pages
│   ├── platform/            # Protected platform pages (Dashboard, Tools)
│   └── api/
│       ├── auth/            # NextAuth + registration endpoint
│       ├── ai/              # AI tool API routes (analyze, generate, debug, document, assistant)
│       ├── conversations/   # Chat conversation management
│       └── history/         # Interaction history
├── components/
│   ├── layout/              # Sidebar, PlatformShell
│   └── workspace/           # CodeBlock, LoadingState
├── lib/
│   ├── ai/                  # Groq client, prompts, AIService facade
│   ├── db/                  # Prisma client singleton
│   └── utils/               # API error handling, validation
└── types/
    └── ai.ts                # Shared TypeScript interfaces
```

### AI Service Layer

All AI calls are routed through `src/lib/ai/service.ts` (the `AIService` facade), which:
- Manages the Groq client singleton
- Uses task-specific system prompts from `src/lib/ai/prompts.ts`
- Returns strongly-typed, structured JSON results
- Reports response time and model used

### Prompt Engineering

Each tool has its own system prompt in `src/lib/ai/prompts.ts` that instructs the model to respond with a specific JSON schema. This ensures consistent, parseable output for every tool.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Custom CSS design system (dark theme) |
| AI Provider | Groq API (configurable model) |
| Database | SQLite via Prisma ORM v5 |
| Authentication | NextAuth.js v5 (JWT sessions + bcrypt) |
| Code Highlighting | react-syntax-highlighter (VS Code Dark+) |
| Icons | Lucide React |

## Prerequisites

- Node.js 18 or later
- A [Groq API key](https://console.groq.com) (free tier available)

## Installation

```bash
# 1. Clone / open the project
cd "AI Engineering Platform"

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# 4. Set up the database
npm run db:migrate

# 5. Start the development server
npm run dev
```

The application will be available at **http://localhost:3000**.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Your Groq API key from console.groq.com |
| `GROQ_MODEL` | ✅ | Model to use (default: `qwen/qwen3-32b`) |
| `NEXTAUTH_SECRET` | ✅ | Random secret for JWT signing (any long random string) |
| `NEXTAUTH_URL` | ✅ | Base URL of the app (`http://localhost:3000`) |
| `DATABASE_URL` | ✅ | SQLite path (`file:./dev.db`) |

Example `.env`:
```
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=qwen/qwen3-32b
NEXTAUTH_SECRET=some-long-random-secret-string
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
```

## How to Run

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Database management
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:migrate   # Apply new migrations
```

## Major Modules

### `src/lib/ai/service.ts`
The `AIService` facade — all AI calls go through here. Responsible for client management, prompt selection, response parsing, and error normalisation.

### `src/lib/ai/prompts.ts`
Centralised system prompts. Each tool has a task-specific prompt instructing the model to respond with a defined JSON schema.

### `src/lib/ai/groq.ts`
Groq API client singleton. Reads `GROQ_API_KEY` and `GROQ_MODEL` from environment variables. Never exposes credentials to client code.

### `src/lib/auth.ts`
NextAuth v5 configuration with Credentials provider, Prisma adapter, and JWT session strategy.

### `prisma/schema.prisma`
Database schema: `User`, `Account`, `Session`, `Conversation`, `Message`, `AIInteraction`.

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Create a new user account |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth session handler |
| `/api/ai/analyze` | POST | Code quality analysis |
| `/api/ai/generate` | POST | Code generation |
| `/api/ai/debug` | POST | Bug diagnosis |
| `/api/ai/document` | POST | Documentation generation |
| `/api/ai/assistant` | POST | AI assistant chat |
| `/api/conversations` | GET/POST | List/create conversations |
| `/api/conversations/[id]` | GET/DELETE | Get/delete conversation |
| `/api/history` | GET | Paginated AI interaction history |

## Limitations

- AI responses depend on the quality of input — vague descriptions yield less precise output.
- The SQLite database is local-only; production deployment would require PostgreSQL.
- The platform does not execute generated code — all AI output is treated as text.
- Token and rate limits apply per Groq tier.

## Future Improvements

- Streaming AI responses for faster perceived performance
- Code diff viewer for generated/fixed code
- Project workspaces grouping related files
- GitHub integration for repository-level analysis
- Export interactions to Markdown/PDF
- Light mode theme toggle
- Collaborative workspaces (multi-user)

---

*Built as a final-year engineering project demonstrating AI integration, full-stack development, secure authentication, and modular software architecture.*
