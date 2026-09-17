import prisma from '@/lib/db/prisma';
import { GeminiProvider, DEFAULT_GEMINI_MODEL } from './providers/gemini';
import { GeminiEmbeddingProvider, DEFAULT_GEMINI_EMBEDDING_MODEL } from './providers/gemini-embeddings';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIEmbeddingProvider } from './providers/openai-embeddings';
import { LLMMessage, LLMOptions, LLMResponse, estimateCost, EmbeddingResponse, LLMProvider, EmbeddingProvider } from './providers/types';

// Singleton instances
let llmProvider: LLMProvider | null = null;
let embeddingProvider: EmbeddingProvider | null = null;

function getLLMProvider(): LLMProvider {
  if (!llmProvider) {
    // Prefer Gemini if GEMINI_API_KEY is present or as default free tier
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      llmProvider = new GeminiProvider();
    } else if (process.env.ANTHROPIC_API_KEY && !process.env.USE_GEMINI) {
      llmProvider = new AnthropicProvider();
    } else {
      llmProvider = new GeminiProvider();
    }
  }
  return llmProvider;
}

function getEmbeddingProvider(): EmbeddingProvider {
  if (!embeddingProvider) {
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      embeddingProvider = new GeminiEmbeddingProvider();
    } else if (process.env.OPENAI_API_KEY) {
      embeddingProvider = new OpenAIEmbeddingProvider();
    } else {
      embeddingProvider = new GeminiEmbeddingProvider();
    }
  }
  return embeddingProvider;
}

/**
 * Shared LLM call wrapper with observability logging, retry, and error handling.
 * Every AI call in the app should go through this function.
 */
export async function callLLM(
  feature: string,
  messages: LLMMessage[],
  options?: LLMOptions & { userId?: string; projectId?: string; retries?: number }
): Promise<LLMResponse> {
  const maxRetries = options?.retries ?? 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const provider = getLLMProvider();
      const response = await provider.generateText(messages, options);

      // Log successful call
      await logAiUsage({
        feature,
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        latencyMs: response.latencyMs,
        costUsd: estimateCost(response.model, response.promptTokens, response.completionTokens),
        success: true,
        userId: options?.userId,
        projectId: options?.projectId,
      });

      return response;
    } catch (error: any) {
      lastError = error;
      const latencyMs = Date.now() - start;

      // Log failed call
      await logAiUsage({
        feature,
        model: options?.model || DEFAULT_GEMINI_MODEL,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs,
        costUsd: 0,
        success: false,
        errorMessage: error.message,
        userId: options?.userId,
        projectId: options?.projectId,
      });

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error('LLM call failed after retries');
}

/**
 * Structured LLM call with JSON parsing and validation.
 */
export async function callLLMStructured<T>(
  feature: string,
  messages: LLMMessage[],
  schema: any,
  options?: LLMOptions & { userId?: string; projectId?: string }
): Promise<{ data: T } & LLMResponse> {
  const start = Date.now();
  try {
    const provider = getLLMProvider();
    const response = await provider.generateStructured<T>(messages, schema, options);

    await logAiUsage({
      feature,
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      latencyMs: response.latencyMs,
      costUsd: estimateCost(response.model, response.promptTokens, response.completionTokens),
      success: true,
      userId: options?.userId,
      projectId: options?.projectId,
    });

    return response;
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    await logAiUsage({
      feature,
      model: options?.model || DEFAULT_GEMINI_MODEL,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs,
      costUsd: 0,
      success: false,
      errorMessage: error.message,
      userId: options?.userId,
      projectId: options?.projectId,
    });
    throw error;
  }
}

/**
 * Streaming LLM call — returns the stream directly.
 * Caller is responsible for consuming the stream and logging.
 */
export async function* callLLMStream(
  feature: string,
  messages: LLMMessage[],
  options?: LLMOptions & { userId?: string; projectId?: string }
) {
  const start = Date.now();
  try {
    const provider = getLLMProvider();
    let fullContent = '';

    for await (const chunk of provider.generateStream(messages, options)) {
      fullContent += chunk.content;
      yield chunk;
    }

    // Rough token estimation for streaming (since we don't get exact counts)
    const promptTokens = Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4);
    const completionTokens = Math.ceil(fullContent.length / 4);
    const model = options?.model || DEFAULT_GEMINI_MODEL;

    await logAiUsage({
      feature,
      model,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - start,
      costUsd: estimateCost(model, promptTokens, completionTokens),
      success: true,
      userId: options?.userId,
      projectId: options?.projectId,
    });
  } catch (error: any) {
    await logAiUsage({
      feature,
      model: options?.model || DEFAULT_GEMINI_MODEL,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - start,
      costUsd: 0,
      success: false,
      errorMessage: error.message,
      userId: options?.userId,
      projectId: options?.projectId,
    });
    throw error;
  }
}

/**
 * Embed text using the embedding provider.
 */
export async function embedText(
  text: string,
  options?: { userId?: string; projectId?: string }
): Promise<EmbeddingResponse> {
  const start = Date.now();
  try {
    const provider = getEmbeddingProvider();
    const response = await provider.embed(text);

    await logAiUsage({
      feature: 'embedding',
      model: response.model,
      promptTokens: response.promptTokens,
      completionTokens: 0,
      latencyMs: response.latencyMs,
      costUsd: estimateCost(response.model, response.promptTokens, 0),
      success: true,
      userId: options?.userId,
      projectId: options?.projectId,
    });

    return response;
  } catch (error: any) {
    await logAiUsage({
      feature: 'embedding',
      model: DEFAULT_GEMINI_EMBEDDING_MODEL,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - start,
      costUsd: 0,
      success: false,
      errorMessage: error.message,
      userId: options?.userId,
      projectId: options?.projectId,
    });
    throw error;
  }
}

/**
 * Batch embed texts.
 */
export async function embedBatch(
  texts: string[],
  options?: { userId?: string; projectId?: string }
): Promise<EmbeddingResponse[]> {
  const provider = getEmbeddingProvider();
  const responses = await provider.embedBatch(texts);

  // Log batch embedding
  const totalTokens = responses.reduce((s, r) => s + r.promptTokens, 0);
  await logAiUsage({
    feature: 'embedding_batch',
    model: DEFAULT_GEMINI_EMBEDDING_MODEL,
    promptTokens: totalTokens,
    completionTokens: 0,
    latencyMs: responses[0]?.latencyMs || 0,
    costUsd: estimateCost(DEFAULT_GEMINI_EMBEDDING_MODEL, totalTokens, 0),
    success: true,
    userId: options?.userId,
    projectId: options?.projectId,
  });

  return responses;
}

// ─── Internal Helpers ─────────────────────────────────────

async function logAiUsage(data: {
  feature: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
  success: boolean;
  errorMessage?: string;
  userId?: string;
  projectId?: string;
}) {
  try {
    await prisma.aiUsageLog.create({ data });
  } catch (e) {
    // Don't let logging failures break the main flow
    console.error('Failed to log AI usage:', e);
  }
}
