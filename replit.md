# Overview

This is a Mastra-based automation framework deployed on Replit. Mastra is a TypeScript framework for building AI-powered agents and workflows with support for durable execution via Inngest. The project enables users to create time-based (cron) and webhook-triggered automations that leverage LLMs, custom tools, and multi-step workflows.

The application includes an electoral analysis agent with a corresponding workflow, along with Telegram webhook integration for bot interactions. It's designed to run autonomously with built-in durability, retry mechanisms, and real-time monitoring through Inngest's dashboard.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Agent & Workflow Framework

**Core Framework**: Mastra (`@mastra/core`) provides the foundation for building AI agents and workflows. Agents use LLMs for reasoning and can execute tools, while workflows orchestrate multi-step processes with explicit control flow.

**Rationale**: Mastra was chosen for its TypeScript-first design, built-in orchestration capabilities, and production-ready features like memory management and observability. It bridges the gap between prototyping and production deployment.

**Key Components**:
- **Agents**: LLM-powered entities that reason about tasks and decide which tools to use (`electoralAgent`)
- **Workflows**: Graph-based execution flows with steps, branching, and error handling (`electoralWorkflow`)
- **Tools**: Reusable functions that agents can invoke to perform specific operations
- **Memory**: Conversation history and semantic recall using vector embeddings

## Durable Execution with Inngest

**Integration Pattern**: Inngest provides step-by-step memoization and durable execution for Mastra workflows. Custom integration code lives in `src/mastra/inngest/` with the client exported from `src/mastra/inngest/client`.

**Rationale**: Without Inngest, workflows would restart from scratch on failure. Inngest ensures each completed step is memoized, allowing workflows to resume from the exact failure point. This is critical for production reliability, especially with long-running or expensive LLM operations.

**Architecture**:
- Workflows are registered as Inngest functions via `inngestServe`
- Each workflow step maps to an Inngest step with automatic state persistence
- Real-time monitoring available through Inngest dev server (port 3000)
- Supports both time-based (cron) and event-based (webhook) triggers

**Alternatives Considered**: Native workflow execution without durability would be simpler but unreliable for production use cases involving external API calls or multi-step LLM interactions.

## Trigger System

**Webhook Triggers**: Located in `src/triggers/`, these modules create HTTP endpoints that receive external events and start workflows. The pattern uses `registerApiRoute` to create Express-style handlers.

**Time-Based Triggers**: Cron expressions schedule workflows without external input using `registerCronTrigger`. Unlike webhooks, these are registered directly (not spread into apiRoutes array).

**Implemented Triggers**:
- Telegram webhooks (`telegramTriggers.ts`) - Bot message handling
- Slack webhooks (`slackTriggers.ts`) - Channel message processing
- Example connector pattern (`exampleConnectorTrigger.ts`) - Template for adding new integrations

**Rationale**: Separating trigger logic from workflow logic maintains clean separation of concerns. Triggers handle HTTP/event routing while workflows focus on business logic.

## AI Model Integration

**Model Router**: Supports 40+ LLM providers through a unified interface via AI SDK. Configured providers include OpenAI (`@ai-sdk/openai`), Google (`@ai-sdk/google`), and OpenRouter (`@openrouter/ai-sdk-provider`).

**Rationale**: Multi-provider support enables fallback strategies, cost optimization, and experimentation without workflow code changes. The abstraction layer prevents vendor lock-in.

**Streaming**: Both agents and workflows support real-time streaming responses via `.stream()` and `.streamLegacy()` methods for backward compatibility with different AI SDK versions.

## Memory & Context Management

**Memory Types**:
1. **Conversation History**: Recent messages (configurable window)
2. **Semantic Recall**: RAG-based vector search for retrieving relevant past context
3. **Working Memory**: Persistent agent "scratchpad" for maintaining user preferences and state

**Storage Adapters**: Pluggable architecture supporting LibSQL (`@mastra/libsql`), PostgreSQL (`@mastra/pg`), and potentially Upstash. Storage is configured at the Mastra instance level and shared across all agents.

**Scoping**: Memory can be thread-scoped (per conversation) or resource-scoped (per user across all conversations).

**Rationale**: Multi-tier memory enables agents to maintain both short-term conversational context and long-term semantic knowledge. Vector-based recall scales better than storing all messages in context windows.

## Logging & Observability

**Logger**: Custom `ProductionPinoLogger` extends Mastra's base logger with structured JSON logging via Pino. Configured with configurable log levels and ISO timestamp formatting.

**Rationale**: Structured logging is essential for debugging distributed workflows and analyzing LLM interactions in production. Pino provides high-performance JSON logging with minimal overhead.

**Error Handling**: Non-retriable errors use Inngest's `NonRetriableError` to prevent infinite retry loops. Workflow-level and step-level retry configuration available.

## TypeScript Configuration

**Module System**: ES2022 modules with bundler resolution for maximum compatibility. Strict mode enabled for type safety.

**Rationale**: Modern ES modules align with Mastra's design and enable tree-shaking. Bundler resolution provides flexibility for different deployment targets.

# External Dependencies

## LLM Providers

- **OpenAI** (`@ai-sdk/openai`): Primary LLM provider for agents
- **Google AI** (`@ai-sdk/google`): Alternative provider for experimentation
- **OpenRouter** (`@openrouter/ai-sdk-provider`): Access to multiple models through single API
- **Vercel AI SDK** (`ai`): Unified interface for LLM interactions with streaming support

## Workflow Orchestration

- **Inngest** (`inngest`, `@inngest/realtime`): Durable workflow execution with step memoization and real-time monitoring
- **Mastra Inngest Integration** (`@mastra/inngest`): Bridge between Mastra workflows and Inngest functions

## Storage & Memory

- **LibSQL** (`@mastra/libsql`): SQLite-compatible database for local/remote storage
- **PostgreSQL** (`@mastra/pg`, `@types/pg`): Vector-enabled database with pgvector support
- **Mastra Memory** (`@mastra/memory`): Memory management system with vector embeddings

## External Service Integrations

- **Slack** (`@slack/web-api`): Webhook integration for Slack bot functionality
- **Telegram**: Webhook-based bot integration (using environment variables for API access)
- **Exa Search** (`exa-js`): Search API integration for information retrieval

## Document Processing

- **PDF Processing** (`pdf-lib`, `@pdf-lib/fontkit`, `pdf-parse`): PDF generation and parsing capabilities for document handling workflows

## Logging & Utilities

- **Pino** (`pino`): High-performance JSON logger
- **Zod** (`zod`): Runtime schema validation for type-safe data flows
- **Dotenv** (`dotenv`): Environment variable management

## Development Tools

- **TypeScript** (`typescript`): Type system and compilation
- **TSX** (`tsx`): TypeScript execution for development
- **Mastra CLI** (`mastra`): Development server and build tooling
- **Prettier** (`prettier`): Code formatting
- **Node Types** (`@types/node`): TypeScript definitions for Node.js

## Environment Requirements

- **Node.js**: >=20.9.0 (specified in engines)
- **Package Manager**: npm with ES module support