/**
 * Mode Helpers - Utility functions for mode extraction and validation
 * 
 * These helpers enable agents to extract project mode from Constitution objects
 * and ensure consistent mode handling across the system.
 * 
 * @module engine/utils/mode-helpers
 * @version V3.0 - Multi-Domain Expansion
 */

import type { Constitution, ProjectMode } from '../genesis-protocol';

/**
 * Extract mode from Constitution object or string
 * 
 * Safely extracts the project mode from a Constitution, handling both
 * object and string representations. Falls back to 'software' mode for
 * backward compatibility.
 * 
 * @param constitution - Constitution object or JSON string
 * @returns ProjectMode - The extracted mode or 'software' as fallback
 * 
 * Requirements: 1.3
 */
export function extractModeFromConstitution(
    constitution: Constitution | string | null | undefined
): ProjectMode {
    // Handle null/undefined
    if (!constitution) {
        console.warn('[ModeHelper] Constitution is null/undefined, defaulting to software mode');
        return 'software';
    }

    try {
        // Handle string (JSON) representation
        if (typeof constitution === 'string') {
            const parsed = JSON.parse(constitution);
            return validateMode(parsed.mode);
        }

        // Handle object representation
        if (typeof constitution === 'object' && 'mode' in constitution) {
            return validateMode(constitution.mode);
        }

        // Fallback if mode field doesn't exist
        console.warn('[ModeHelper] Constitution has no mode field, defaulting to software mode');
        return 'software';

    } catch (error) {
        console.error('[ModeHelper] Error extracting mode from Constitution:', error);
        return 'software';
    }
}

/**
 * Validate and sanitize mode value
 * 
 * Ensures the mode value is one of the supported ProjectMode values.
 * Falls back to 'software' for invalid modes.
 * 
 * @param mode - The mode value to validate
 * @returns ProjectMode - Valid mode or 'software' as fallback
 * 
 * Requirements: 11.1, 11.2, 11.3
 */
export function validateMode(mode: any): ProjectMode {
    const validModes: ProjectMode[] = [
        'software',
        'scientific_research',
        'legal_research',
        'creative_writing',
        'general'
    ];

    // Check if mode is valid
    if (typeof mode === 'string' && validModes.includes(mode as ProjectMode)) {
        return mode as ProjectMode;
    }

    // Invalid mode - log warning and fallback
    if (mode !== undefined && mode !== null) {
        console.warn(`[ModeHelper] Invalid mode "${mode}" detected, defaulting to "software"`);
    }

    return 'software';
}

/**
 * Get mode with fallback
 * 
 * Convenience function that extracts mode from Constitution with explicit fallback.
 * 
 * @param constitution - Constitution object or string
 * @param fallback - Fallback mode (defaults to 'software')
 * @returns ProjectMode - The extracted mode or fallback
 * 
 * Requirements: 1.3, 10.1
 */
export function getModeOrFallback(
    constitution: Constitution | string | null | undefined,
    fallback: ProjectMode = 'software'
): ProjectMode {
    const mode = extractModeFromConstitution(constitution);
    return mode || fallback;
}

/**
 * Check if mode is valid
 * 
 * Returns true if the mode is one of the supported ProjectMode values.
 * 
 * @param mode - The mode to check
 * @returns boolean - True if mode is valid
 * 
 * Requirements: 11.1
 */
export function isValidMode(mode: any): mode is ProjectMode {
    const validModes: ProjectMode[] = [
        'software',
        'scientific_research',
        'legal_research',
        'creative_writing',
        'general'
    ];

    return typeof mode === 'string' && validModes.includes(mode as ProjectMode);
}

/**
 * Get mode display name
 * 
 * Returns a human-readable display name for the mode.
 * 
 * @param mode - The project mode
 * @returns string - Display name
 */
export function getModeDisplayName(mode: ProjectMode): string {
    const displayNames: Record<ProjectMode, string> = {
        software: 'Software Architecture',
        scientific_research: 'Scientific Research',
        legal_research: 'Legal Research',
        creative_writing: 'Creative Writing',
        general: 'General Analysis'
    };

    return displayNames[mode] || 'Unknown Mode';
}

/**
 * Get mode description
 * 
 * Returns a brief description of what the mode is used for.
 * 
 * @param mode - The project mode
 * @returns string - Mode description
 */
export function getModeDescription(mode: ProjectMode): string {
    const descriptions: Record<ProjectMode, string> = {
        software: 'Architecture specs for applications, APIs, and systems (NO implementation code)',
        scientific_research: 'Academic research, literature reviews, and hypotheses (NO unsubstantiated claims)',
        legal_research: 'Legal analysis, IRAC memos, and case research (NO legal advice)',
        creative_writing: 'Narrative structure, beat sheets, and character arcs (NO full prose)',
        general: 'General analysis and synthesis for projects that don\'t fit other categories'
    };

    return descriptions[mode] || 'Unknown mode';
}
