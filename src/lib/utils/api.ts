/**
 * Shared validation and error utilities for API routes.
 */

// ─── AI error handling ────────────────────────────────────────────────────────

/**
 * Normalise any thrown error into a user-facing message and an HTTP status code.
 */
export function normaliseAiError(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof Error) {
    const msg = error.message;

    if (msg.includes("GROQ_API_KEY is not set")) {
      return {
        message:
          "GROQ_API_KEY is not configured. Please add it to your .env file.",
        status: 503,
      };
    }

    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return {
        message: "Invalid GROQ_API_KEY. Please check your API key.",
        status: 503,
      };
    }

    if (msg.includes("429") || msg.includes("rate limit")) {
      return {
        message: "Groq API rate limit reached. Please wait a moment and retry.",
        status: 429,
      };
    }

    if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      return {
        message: "The AI request timed out. Please try again.",
        status: 504,
      };
    }

    if (msg.includes("model") && msg.includes("not found")) {
      return {
        message: `The configured model (${process.env.GROQ_MODEL}) is not available. Check GROQ_MODEL in .env.`,
        status: 503,
      };
    }

    if (msg.includes("not valid JSON")) {
      return {
        message:
          "The AI returned an unexpected response format. Please try again.",
        status: 502,
      };
    }

    return { message: msg, status: 500 };
  }

  return { message: "An unexpected error occurred.", status: 500 };
}

// ─── Input validation ─────────────────────────────────────────────────────────

export function requireString(
  value: unknown,
  fieldName: string,
  maxLength = 50000
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required and must be a string.`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${maxLength} characters.`
    );
  }
  return value.trim();
}

export function optionalString(
  value: unknown,
  fallback = "",
  maxLength = 50000
): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return fallback;
  if (value.length > maxLength) return value.slice(0, maxLength);
  return value.trim();
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
