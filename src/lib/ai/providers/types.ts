/**
 * AI Provider Interface — abstracts LLM calls behind a common interface
 * so the provider (Anthropic/OpenAI/etc.) can be swapped without changing business logic.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  promptTokens: number;
  latencyMs: number;
}

export interface LLMProvider {
  generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  generateStructured<T>(messages: LLMMessage[], schema: any, options?: LLMOptions): Promise<{ data: T } & LLMResponse>;
  generateStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<LLMStreamChunk>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingResponse>;
  embedBatch(texts: string[]): Promise<EmbeddingResponse[]>;
}

// Cost estimation helpers
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash-lite': { input: 0, output: 0 },
  'gemini-3.5-flash': { input: 0, output: 0 },
  'gemini-3-flash-preview': { input: 0, output: 0 },
  'gemini-flash-latest': { input: 0, output: 0 },
  'gemini-3.6-flash': { input: 0, output: 0 },
  'gemini-2.0-flash': { input: 0, output: 0 },
  'gemini-embedding-2': { input: 0, output: 0 },
  'text-embedding-004': { input: 0, output: 0 },
  'claude-sonnet-4-20250514': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  'claude-haiku-3-20250310': { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
  'text-embedding-3-small': { input: 0.02 / 1_000_000, output: 0 },
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const cost = MODEL_COSTS[model];
  if (!cost) return 0;
  return promptTokens * cost.input + completionTokens * cost.output;
}
