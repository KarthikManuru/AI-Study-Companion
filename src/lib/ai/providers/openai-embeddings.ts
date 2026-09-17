import OpenAI from 'openai';
import { EmbeddingProvider, EmbeddingResponse } from './types';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model = 'text-embedding-3-small';

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private generateFallbackVector(text: string): number[] {
    const vector = new Array(1536).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < 1536; i++) {
      const val = Math.sin(hash + i * 0.1) * Math.cos(i);
      vector[i] = Number(val.toFixed(6));
    }
    // Normalize vector
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => Number((v / norm).toFixed(6)));
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.slice(0, 8000),
      });

      return {
        embedding: response.data[0].embedding,
        model: this.model,
        promptTokens: response.usage.prompt_tokens,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      console.warn('OpenAI embedding API unavailable (quota/network), using normalized fallback vector:', error.message);
      return {
        embedding: this.generateFallbackVector(text),
        model: `${this.model}-fallback`,
        promptTokens: Math.ceil(text.length / 4),
        latencyMs: Date.now() - start,
      };
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    const start = Date.now();
    try {
      const truncated = texts.map((t) => t.slice(0, 8000));
      const response = await this.client.embeddings.create({
        model: this.model,
        input: truncated,
      });

      const latencyMs = Date.now() - start;
      const tokensPerItem = Math.ceil(response.usage.prompt_tokens / texts.length);

      return response.data.map((d) => ({
        embedding: d.embedding,
        model: this.model,
        promptTokens: tokensPerItem,
        latencyMs,
      }));
    } catch (error: any) {
      console.warn('OpenAI batch embedding unavailable (quota/network), using fallback vectors:', error.message);
      const latencyMs = Date.now() - start;
      return texts.map((t) => ({
        embedding: this.generateFallbackVector(t),
        model: `${this.model}-fallback`,
        promptTokens: Math.ceil(t.length / 4),
        latencyMs,
      }));
    }
  }
}
