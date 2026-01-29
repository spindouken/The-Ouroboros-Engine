/**
 * Red-Flagging System
 * 
 * Implements automatic detection and handling of suspicious agent outputs
 * to ensure only high-quality responses proceed to voting.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import type {
  RedFlag,
  RedFlagType,
  RedFlagSeverity,
  ValidationResult,
  RedFlagValidator
} from './types';

/**
 * Red-Flag Validation Rules
 * 
 * These rules detect structurally suspicious outputs:
 * - Too short: Less than 50 characters
 * - Too generic: Contains placeholder text
 * - Contradictory: Excessive discourse markers
 * - Low confidence: Confidence score below 40
 */
export const RED_FLAG_RULES = {
  tooShort: (output: string): boolean => {
    return output.trim().length < 50;
  },

  tooGeneric: (output: string): boolean => {
    const genericPatterns = [
      /TODO/i,
      /placeholder/i,
      /example/i,
      /lorem ipsum/i,
      /\[insert .+?\]/i,
      /\{.+?\}/,
      /xxx+/i,
      /tbd/i,
      /to be determined/i,
      /coming soon/i
    ];

    return genericPatterns.some(pattern => pattern.test(output));
  },

  contradictory: (output: string): boolean => {
    const discourseMarkers = output.match(
      /\b(but|however|on the other hand|conversely|although|though|yet|nevertheless|nonetheless)\b/gi
    );

    // Flag if more than 3 contradictory markers
    return discourseMarkers !== null && discourseMarkers.length > 3;
  },

  lowConfidence: (score: number): boolean => {
    return score < 40;
  },

  excessiveHedging: (output: string): boolean => {
    const hedgingPatterns = [
      /\b(I think|I believe|maybe|perhaps|possibly|it seems|it appears|might|could be)\b/gi,
      /\b(not sure|uncertain|unclear|guess)\b/gi
    ];

    let count = 0;
    hedgingPatterns.forEach(pattern => {
      const matches = output.match(pattern);
      if (matches) count += matches.length;
    });

    return count > 3; // Flag if more than 3 hedging phrases
  }
};

/**
 * Implementation of the Red-Flag Validation System
 * 
 * This class provides methods to:
 * 1. Validate agent outputs against red-flag rules
 * 2. Retry failed validations with adjusted temperature
 * 3. Escalate to human review after 3 failures
 */
export class RedFlagValidatorImpl implements RedFlagValidator {
  private retryAttempts: Map<string, number> = new Map();
  private flagHistory: Map<string, RedFlag[]> = new Map();

  /**
   * Validates agent output against all red-flag rules
   * 
   * @param output - The agent's output text
   * @param confidence - The agent's confidence score (0-100)
   * @returns ValidationResult - Contains pass/fail status, flags, and retry suggestions
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  validate(output: string, confidence: number, turboMode: boolean = false, disabledFlags: RedFlagType[] = []): ValidationResult {
    const flags: RedFlag[] = [];

    // Check for too short output (Skipped in Turbo Mode or if disabled)
    if (!disabledFlags.includes('too_short') && !turboMode && RED_FLAG_RULES.tooShort(output)) {
      flags.push({
        type: 'too_short',
        severity: 'high',
        message: `Output is too short (${output.trim().length} characters). Minimum 50 characters required.`,
        pattern: 'length < 50'
      });
    }

    // Check for generic placeholder text (Skipped in Turbo Mode or if disabled)
    if (!disabledFlags.includes('too_generic') && !turboMode && RED_FLAG_RULES.tooGeneric(output)) {
      flags.push({
        type: 'too_generic',
        severity: 'high',
        message: 'Output contains generic placeholder text (TODO, placeholder, example, etc.)',
        pattern: 'generic_patterns'
      });
    }

    // Check for contradictory statements
    if (!disabledFlags.includes('contradictory') && RED_FLAG_RULES.contradictory(output)) {
      const markers = output.match(
        /\b(but|however|on the other hand|conversely|although|though|yet|nevertheless|nonetheless)\b/gi
      );
      flags.push({
        type: 'contradictory',
        severity: 'medium',
        message: `Output contains excessive contradictory statements (${markers?.length} discourse markers found)`,
        pattern: 'discourse_markers > 3'
      });
    }

    // Check for low confidence
    if (!disabledFlags.includes('low_confidence') && RED_FLAG_RULES.lowConfidence(confidence)) {
      flags.push({
        type: 'low_confidence',
        severity: 'medium',
        message: `Confidence score is too low (${confidence}%). Minimum 40% required.`,
        pattern: 'confidence < 40'
      });
    }

    // Check for excessive hedging
    if (RED_FLAG_RULES.excessiveHedging(output)) {
      flags.push({
        type: 'low_confidence', // Reusing low_confidence type or add new one? Let's stick to low_confidence or add 'hedging'
        severity: 'medium',
        message: 'Output contains excessive hedging (I think, maybe, perhaps). Be more decisive.',
        pattern: 'hedging > 3'
      });
    }

    // Determine if retry is needed
    const passed = flags.length === 0;
    const shouldRetry = !passed;

    // Calculate suggested temperature adjustment
    let suggestedTemperature: number | undefined;
    if (shouldRetry) {
      // Increase temperature for too short or too generic (need more creativity)
      if (flags.some(f => f.type === 'too_short' || f.type === 'too_generic')) {
        suggestedTemperature = 0.9;
      }
      // Decrease temperature for contradictory (need more focus)
      else if (flags.some(f => f.type === 'contradictory')) {
        suggestedTemperature = 0.3;
      }
      // Moderate temperature for low confidence
      else {
        suggestedTemperature = 0.7;
      }
    }

    return {
      passed,
      flags,
      shouldRetry,
      suggestedTemperature
    };
  }

  /**
   * Retries agent execution with adjusted temperature
   * 
   * Implements retry mechanism with:
   * - Temperature adjustment based on flag type
   * - Retry attempt tracking
   * - Escalation to human review after 3 failures
   * 
   * @param nodeId - The ID of the node being retried
   * @param temperature - The suggested temperature for retry
   * @returns Promise<string> - Status message about retry or escalation
   * 
   * Requirements: 2.5, 2.6, 2.7
   */
  async retry(nodeId: string, temperature: number): Promise<string> {
    // Get current retry count
    const currentAttempts = this.retryAttempts.get(nodeId) || 0;
    const newAttempts = currentAttempts + 1;

    // Update retry count
    this.retryAttempts.set(nodeId, newAttempts);

    // Check if escalation is needed (after 3 failures)
    if (newAttempts >= 3) {
      const message = `Node ${nodeId} has failed validation 3 times. ESCALATED to human review.`;

      // Log escalation
      this.logRetry(nodeId, newAttempts, temperature, 'ESCALATED_TO_HUMAN');

      // Clear retry history for this node
      this.retryAttempts.delete(nodeId);

      return message;
    }

    // Log retry attempt
    this.logRetry(nodeId, newAttempts, temperature, 'RETRY_SCHEDULED');

    return `Retry attempt ${newAttempts}/3 scheduled with temperature ${temperature}`;
  }

  /**
   * Logs retry attempts with flag reasons
   * 
   * @param nodeId - The ID of the node
   * @param attempt - The retry attempt number
   * @param temperature - The temperature used for retry
   * @param status - The status of the retry
   * 
   * Requirements: 2.6
   */
  private logRetry(
    nodeId: string,
    attempt: number,
    temperature: number,
    status: string
  ): void {
    const timestamp = new Date().toISOString();
    const flags = this.flagHistory.get(nodeId) || [];

    const logEntry = {
      timestamp,
      nodeId,
      attempt,
      temperature,
      status,
      flags: flags.map(f => ({
        type: f.type,
        severity: f.severity,
        message: f.message
      }))
    };

    // In a real implementation, this would write to a log file or database
    console.log('[RED-FLAG-RETRY]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Stores flag history for a node
   * 
   * @param nodeId - The ID of the node
   * @param flags - The flags detected for this node
   */
  storeFlagHistory(nodeId: string, flags: RedFlag[]): void {
    this.flagHistory.set(nodeId, flags);
  }

  /**
   * Gets the retry count for a node
   * 
   * @param nodeId - The ID of the node
   * @returns number - The number of retry attempts
   */
  getRetryCount(nodeId: string): number {
    return this.retryAttempts.get(nodeId) || 0;
  }

  /**
   * Resets retry tracking for a node
   * 
   * @param nodeId - The ID of the node
   */
  resetRetryCount(nodeId: string): void {
    this.retryAttempts.delete(nodeId);
    this.flagHistory.delete(nodeId);
  }

  /**
   * Gets all nodes that need human review
   * 
   * @returns string[] - Array of node IDs that have been escalated
   */
  getEscalatedNodes(): string[] {
    const escalated: string[] = [];

    this.retryAttempts.forEach((attempts, nodeId) => {
      if (attempts >= 3) {
        escalated.push(nodeId);
      }
    });

    return escalated;
  }
}

/**
 * Factory function to create a new RedFlagValidator instance
 */
export function createRedFlagValidator(): RedFlagValidator {
  return new RedFlagValidatorImpl();
}

/**
 * Helper function to format validation results for display
 * 
 * @param result - The validation result
 * @returns string - Formatted message for logging
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.passed) {
    return '✓ Validation passed - No red flags detected';
  }

  const flagMessages = result.flags.map(flag => {
    const severityIcon = flag.severity === 'high' ? '🔴' :
      flag.severity === 'medium' ? '🟡' : '🟢';
    return `${severityIcon} [${flag.type.toUpperCase()}] ${flag.message}`;
  }).join('\n');

  let message = `✗ Validation failed - ${result.flags.length} red flag(s) detected:\n${flagMessages}`;

  if (result.shouldRetry && result.suggestedTemperature) {
    message += `\n\n→ Retry suggested with temperature: ${result.suggestedTemperature}`;
  }

  return message;
}

