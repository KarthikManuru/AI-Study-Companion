import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbeddingProvider, EmbeddingResponse } from './types';

export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(model = DEFAULT_GEMINI_EMBEDDING_MODEL) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const result = await (model as any).embedContent({
        content: { role: 'user', parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: 768,
      });
      const values = result.embedding.values;

      return {
        embedding: values,
        model: this.modelName,
        promptTokens: Math.ceil(text.length / 4),
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      console.error('\n🚨🚨🚨 [CRITICAL DEMO WARNING] Gemini Embedding Call Failed! 🚨🚨🚨');
      console.error('Error Details:', error.message || error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    const start = Date.now();
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const result = await (model as any).batchEmbedContents({
        requests: texts.map((t) => ({
          content: { role: 'user', parts: [{ text: t.slice(0, 8000) }] },
          outputDimensionality: 768,
        })),
      });

      const totalLatency = Date.now() - start;
      return (result.embeddings as any[]).map((emb: any, idx: number) => ({
        embedding: emb.values,
        model: this.modelName,
        promptTokens: Math.ceil(texts[idx].length / 4),
        latencyMs: Math.round(totalLatency / texts.length),
      }));
    } catch (error: any) {
      console.error('\n🚨🚨🚨 [CRITICAL DEMO WARNING] Gemini Batch Embedding Call Failed! 🚨🚨🚨');
      console.error('Error Details:', error.message || error);
      throw error;
    }
  }
}
