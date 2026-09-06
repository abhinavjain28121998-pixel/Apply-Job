import { GoogleGenAI } from '@google/genai';

// Cascade priority for text generation models:
// Primary: gemini-3.8-flash (official recommendation for basic & structured text tasks)
// Fallback 1: gemini-3.6-flash (reliable, fast active flash model)
// Fallback 2: gemini-3.1-flash-lite (high-throughput low-latency model)
// Fallback 3: gemini-flash-latest (general alias fallback)
export const GEMINI_MODELS_CASCADE = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface GenerateGeminiOptions {
  prompt: string;
  responseMimeType?: string;
  temperature?: number;
  maxRetriesPerModel?: number;
}

/**
 * Executes a Gemini request with automatic fallback cascade across supported models
 * and transient error backoff (handles 503 high demand, 429 rate limit, and model deprecation).
 */
export async function generateWithGeminiCascade(options: GenerateGeminiOptions): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }

  const {
    prompt,
    responseMimeType,
    temperature = 0.2,
    maxRetriesPerModel = 1
  } = options;

  let lastError: any = null;

  for (const model of GEMINI_MODELS_CASCADE) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const config: any = { temperature };
        if (responseMimeType) {
          config.responseMimeType = responseMimeType;
        }

        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config
        });

        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const statusCode = err?.status || err?.code;
        const isTransient = statusCode === 503 || statusCode === 429;
        const isNotFoundOrDeprecated = statusCode === 404;

        console.warn(`Gemini call failed [model: ${model}, attempt: ${attempt + 1}]:`, err?.message || err);

        // If deprecated/not found (404), do not retry this model; jump to next model in cascade
        if (isNotFoundOrDeprecated) {
          break;
        }

        // If transient (503/429) and we have retries left, wait briefly with exponential backoff
        if (isTransient && attempt < maxRetriesPerModel) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 350));
        }
      }
    }
  }

  const friendlyMessage = lastError?.message?.includes('high demand')
    ? 'AI services are experiencing high demand right now. Please try again in a moment.'
    : (lastError?.message || 'Failed to complete AI operation across available models.');

  const error = new Error(friendlyMessage);
  (error as any).originalError = lastError;
  throw error;
}

/**
 * Safely parses JSON returned from Gemini, automatically handling markdown code blocks.
 */
export function parseGeminiJson<T = any>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  let cleaned = rawText.trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers if model returned them
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Failed to parse Gemini JSON output:', cleaned.slice(0, 200));
    return fallback;
  }
}
