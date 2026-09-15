/**
 * Tunable thresholds for the reliability pipeline.
 * Kept in one place so the paper's experiments can reference exact values and
 * so detection behaviour is transparent rather than magic numbers inline.
 */

export const RELIABILITY_CONFIG = {
  /** A step slower than this (ms) is flagged as a timeout. */
  latencyTimeoutMs: 30000,
  /** Evaluator overall score (0–10) below this is flagged as low quality. */
  lowQualityThreshold: 5,
  /** More worker tool steps than this in one run suggests a loop. */
  maxToolSteps: 5,
  /** The same worker step repeated more than this many times suggests a loop. */
  duplicateStepLimit: 2,
  /** Recovery bounds so self-healing can never run away. */
  recovery: {
    /** Max failures the coordinator will attempt to heal per run. */
    maxRecoveriesPerRun: 5,
    /** Max recovery attempts per failure (passed to the recover() budget). */
    maxAttemptsPerFailure: 3,
    /** Wall-clock budget per failure's recovery (ms). */
    maxTotalMsPerFailure: 60000,
    /** Base backoff between retries (ms); doubles each attempt. */
    baseBackoffMs: 500,
  },
} as const;
