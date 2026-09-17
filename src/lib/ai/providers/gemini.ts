import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, LLMMessage, LLMResponse, LLMStreamChunk, LLMOptions } from './types';

// Primary model — gemini-3.5-flash-lite is consistently available on free tier
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Fallback chain: if the primary model is 503/overloaded, try these in order
const MODEL_FALLBACK_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
];

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.client = new GoogleGenerativeAI(apiKey);
  }

  private convertMessages(messages: LLMMessage[]) {
    // Separate system prompt from conversation history
    const systemPrompt = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Build Gemini contents format
    const contents = conversationMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    return { systemPrompt, contents };
  }

  private getModelsToTry(requestedModel?: string): string[] {
    const primary = requestedModel || DEFAULT_GEMINI_MODEL;
    // Build unique list: requested model first, then fallbacks
    const models = [primary];
    for (const fb of MODEL_FALLBACK_CHAIN) {
      if (!models.includes(fb)) models.push(fb);
    }
    return models;
  }

  async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const start = Date.now();
    const { systemPrompt, contents } = this.convertMessages(messages);
    const systemInstruction = options?.systemPrompt || systemPrompt;
    const modelsToTry = this.getModelsToTry(options?.model);

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const model = this.client.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
              maxOutputTokens: options?.maxTokens || 2048,
              temperature: options?.temperature ?? 0.7,
            },
          });

          const response = await model.generateContent({
            contents,
          });

          const text = response.response.text();
          const usage = response.response.usageMetadata;

          if (modelName !== (options?.model || DEFAULT_GEMINI_MODEL)) {
            console.log(`[GeminiProvider] Used fallback model ${modelName} (primary was unavailable)`);
          }

          return {
            content: text,
            model: modelName,
            promptTokens: usage?.promptTokenCount || Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4),
            completionTokens: usage?.candidatesTokenCount || Math.ceil(text.length / 4),
            latencyMs: Date.now() - start,
          };
        } catch (error: any) {
          lastError = error;

          // Retryable errors: 503 (overloaded) or 429 (rate limit)
          if (error.status === 503 || error.status === 429) {
            const delay = (attempt + 1) * 3000 + Math.random() * 2000;
            console.warn(`[GeminiProvider] ${error.status} on ${modelName} (attempt ${attempt + 1}/3), retrying in ${Math.round(delay)}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          // 404 = model not available, or 400 = invalid argument for this model, skip to next model
          if (error.status === 404 || error.status === 400) {
            console.warn(`[GeminiProvider] Model ${modelName} returned ${error.status}, trying next model in chain...`);
            break;
          }

          // Non-retryable error — throw immediately
          console.error('\n🚨🚨🚨 [CRITICAL] Gemini LLM API Call Failed! 🚨🚨🚨');
          console.error('Error Details:', error.message || error);
          console.error('Model:', modelName, '| Status:', error.status || error.code || 'N/A');
          throw error;
        }
      }
      // All retries exhausted for this model, try next in fallback chain
      console.warn(`[GeminiProvider] All retries exhausted for ${modelName}, trying next model...`);
    }

    // All models and all retries failed
    console.error('\n🚨🚨🚨 [CRITICAL] All Gemini models exhausted! 🚨🚨🚨');
    throw lastError || new Error('Gemini call failed after all model fallbacks');
  }

  async generateStructured<T>(
    messages: LLMMessage[],
    _schema: any,
    options?: LLMOptions
  ): Promise<{ data: T } & LLMResponse> {
    const start = Date.now();
    const { systemPrompt, contents } = this.convertMessages(messages);
    const modelsToTry = this.getModelsToTry(options?.model);

    const systemInstruction = (options?.systemPrompt || systemPrompt || '') +
      '\n\nYou MUST respond with valid raw JSON only. Do not include markdown formatting, code fences (no ```json), or explanatory text.';

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const model = this.client.getGenerativeModel({
            model: modelName,
            systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
            generationConfig: {
              maxOutputTokens: options?.maxTokens || 2048,
              temperature: options?.temperature ?? 0.2,
              responseMimeType: 'application/json',
            },
          });

          const response = await model.generateContent({
            contents,
          });

          const text = response.response.text().trim();
          const usage = response.response.usageMetadata;

          let jsonStr = text;
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }

          let data: T;
          try {
            data = JSON.parse(jsonStr) as T;
          } catch (parseErr) {
            const match = jsonStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
              data = JSON.parse(match[0]) as T;
            } else {
              throw new Error(`Failed to parse structured output from Gemini: ${text}`);
            }
          }

          if (modelName !== (options?.model || DEFAULT_GEMINI_MODEL)) {
            console.log(`[GeminiProvider] Structured call used fallback model ${modelName}`);
          }

          return {
            data,
            content: text,
            model: modelName,
            promptTokens: usage?.promptTokenCount || Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4),
            completionTokens: usage?.candidatesTokenCount || Math.ceil(text.length / 4),
            latencyMs: Date.now() - start,
          };
        } catch (error: any) {
          lastError = error;

          if (error.status === 503 || error.status === 429) {
            const delay = (attempt + 1) * 3000 + Math.random() * 2000;
            console.warn(`[GeminiProvider] ${error.status} on ${modelName} structured (attempt ${attempt + 1}/3), retrying in ${Math.round(delay)}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          if (error.status === 404 || error.status === 400) {
            console.warn(`[GeminiProvider] Model ${modelName} returned ${error.status} for structured call, trying next model in chain...`);
            break;
          }

          console.error('\n🚨🚨🚨 [CRITICAL] Gemini Structured Call Failed! 🚨🚨🚨');
          console.error('Error Details:', error.message || error);
          throw error;
        }
      }
      console.warn(`[GeminiProvider] All retries exhausted for structured on ${modelName}, trying next...`);
    }

    console.error('\n🚨🚨🚨 [CRITICAL] All Gemini models exhausted for structured call! 🚨🚨🚨');
    throw lastError || new Error('Gemini structured call failed after all model fallbacks');
  }

  async *generateStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<LLMStreamChunk> {
    const { systemPrompt, contents } = this.convertMessages(messages);
    const systemInstruction = options?.systemPrompt || systemPrompt;
    const modelsToTry = this.getModelsToTry(options?.model);

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const model = this.client.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            maxOutputTokens: options?.maxTokens || 2048,
            temperature: options?.temperature ?? 0.7,
          },
        });

        const result = await model.generateContentStream({
          contents,
        });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield {
              content: text,
              done: false,
            };
          }
        }

        if (modelName !== (options?.model || DEFAULT_GEMINI_MODEL)) {
          console.log(`[GeminiProvider] Stream used fallback model ${modelName}`);
        }

        yield {
          content: '',
          done: true,
        };
        return; // Successfully streamed, exit
      } catch (error: any) {
        lastError = error;

        if (error.status === 503 || error.status === 429 || error.status === 404 || error.status === 400) {
          console.warn(`[GeminiProvider] Stream error ${error.status} on ${modelName}, trying next model...`);
          continue;
        }

        console.error('\n🚨🚨🚨 [CRITICAL] Gemini Streaming Failed! 🚨🚨🚨');
        console.error('Error Details:', error.message || error);
        throw error;
      }
    }

    console.error('\n🚨🚨🚨 [CRITICAL] All Gemini models exhausted for streaming! 🚨🚨🚨');
    throw lastError || new Error('Gemini streaming failed after all model fallbacks');
  }
}
