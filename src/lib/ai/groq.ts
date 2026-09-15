/**
 * Groq AI client singleton.
 * The API key is read from GROQ_API_KEY (server-side only).
 * The model is read from GROQ_MODEL, defaulting to qwen/qwen3-32b.
 */

import Groq from "groq-sdk";

let _client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env file and restart the server."
    );
  }

  if (!_client) {
    _client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return _client;
}

export function getModel(): string {
  return process.env.GROQ_MODEL || "qwen/qwen3-32b";
}

/**
 * Fallback model used by the recovery engine's model_fallback strategy.
 * Read from GROQ_FALLBACK_MODEL; defaults to a second reachable model so a
 * dead/unavailable primary model can be recovered from.
 */
export function getFallbackModel(): string {
  return process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
}
