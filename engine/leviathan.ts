
/**
 * LEVIATHAN MIDDLEWARE
 * 
 * "The Doppler Sandwich" Protocol
 * 
 * Problem: Small models (4B/8B) suffer from "Context Amnesia" and "Instruction Drift".
 * They process the 5k token prompt but forget the constraints by the time they reach the end.
 * 
 * Solution: We mechanically repeat the critical constraints at the END of the prompt.
 * This ensures the instructions are fresh in the model's working memory (Attention Window).
 * 
 * Usage:
 * const enhancedPrompt = Leviathan.sandwich(originalPrompt);
 */

export class Leviathan {

    // The "Anchor" - Critical constraints that must never be ignored.
    private static readonly ANCHORS = [
        "CRITICAL: RETURN ONLY JSON.",
        "DO NOT OUTPUT MARKDOWN.",
        "NO PREAMBLE OR EXPLANATION."
    ];

    /**
     * "The Doppler Sandwich"
     * Wraps the prompt in a stiff layer of constraints.
     */
    public static sandwich(prompt: string): string {
        const head = `CRITICAL INSTRUCTIONS:\n${this.ANCHORS.join('\n')}\n\n`;
        const tail = `\n\nREMINDER: ${this.ANCHORS.join(' ')}\nRETURN JSON ONLY.`;

        return `${head}${prompt}${tail}`;
    }

    /**
     * Wraps a system prompt for small models to enforce Persona retention.
     */
    public static enforcePersona(persona: string): string {
        return `${persona}\n\n(Stay in character. Do not break the fourth wall.)`;
    }
}
