/**
 * The Lossless Compiler (Assembly) - Section 5.3
 * 
 * Role: The Stitcher
 * Philosophy: "Assembly, not Synthesis."
 * 
 * This REPLACES the old Alchemist which "rewrote" and "synthesized" content,
 * causing information loss. The Lossless Compiler NEVER rewrites - it only stitches.
 * 
 * Key Principles:
 * 1. **Artifact Passthrough:** Receive raw JSON array of artifacts, bypass summarization
 * 2. **Chain of Density:** Retain all Named Entities exactly as they appear
 * 3. **Strict Prohibition:** "DO NOT CHANGE A SINGLE WORD OF THE ARTIFACT CONTENT"
 * 4. **Truth Preservation:** Preserve the specific, verified "Truth" from specialists
 * 
 * Input: Array of VerifiedBricks + SecurityAddendum
 * Output: Assembled document (the "Manifestation")
 */

import { LLMResponse } from './UnifiedLLMClient';
import { VerifiedBrick } from './blackboard-delta';
import { SecurityAddendum } from './security-patcher';

// ============================================================================
// TYPES
// ============================================================================

export interface CompilerInput {
    /** Array of verified bricks (already passed Antagonist audit) */
    verifiedBricks: VerifiedBrick[];

    /** Security addendum (if any issues were found) */
    securityAddendum?: SecurityAddendum;

    /** Project metadata for header */
    projectMetadata: {
        name: string;
        domain: string;
        generatedAt: number;
        brickCount: number;
        techStack: string[];
        constraints?: string[];
        decisions?: string[];
        warnings?: string[];
        originalPrompt?: string;
    };
}

export interface CompilerOutput {
    /** The assembled manifestation document */
    manifestation: string;

    /** Verification that all bricks were included */
    includedBricks: string[];

    /** Any bricks that were skipped (should be empty) */
    skippedBricks: string[];

    /** Character count of original vs assembled (for verification) */
    verification: {
        originalCharCount: number;
        assembledCharCount: number;
        preservationRatio: number;
    };

    /** Compilation timestamp */
    compiledAt: number;
}

export interface CompilerConfig {
    /** Model to use for final assembly (if needed for formatting) */
    model?: string;

    /** Whether to use LLM for formatting (default: false - pure stitching) */
    useLLMFormatting?: boolean;

    /** Output format */
    outputFormat: 'markdown' | 'json' | 'structured';
}

// ============================================================================
// LOSSLESS COMPILER CLASS
// ============================================================================

export class LosslessCompiler {
    private config: CompilerConfig;
    private llmClient?: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    constructor(
        config: CompilerConfig,
        llmClient?: {
            generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
        }
    ) {
        this.config = {
            model: config.model,
            useLLMFormatting: config.useLLMFormatting ?? false,
            outputFormat: config.outputFormat || 'markdown'
        };
        this.llmClient = llmClient;
    }

    /**
     * Compile verified bricks into a final manifestation
     * This is ASSEMBLY, NOT SYNTHESIS - no rewriting allowed
     * 
     * @param input - The compiler input with bricks and metadata
     * @returns CompilerOutput with the assembled manifestation
     */
    async compile(input: CompilerInput): Promise<CompilerOutput> {
        const { verifiedBricks, securityAddendum, projectMetadata } = input;

        // Track original content for verification
        const originalCharCount = verifiedBricks.reduce(
            (sum, brick) => sum + brick.artifact.length,
            0
        ) + (securityAddendum?.content.length || 0);

        // SMART SCRAPER: If tech stack is missing, try to find it in the artifacts
        if (!projectMetadata.techStack || projectMetadata.techStack.length === 0) {
            const techStack = this.scrapeTechStack(verifiedBricks);
            if (techStack.length > 0) {
                projectMetadata.techStack = techStack;
            }
        }

        // SMART SCRAPER: If domain is 'Unknown', try to guess it
        if (!projectMetadata.domain || projectMetadata.domain === 'Unknown') {
            projectMetadata.domain = this.scrapeDomain(verifiedBricks);
        }

        // Phase 1: Pure Stitching (Lossless)
        let manifestation: string;

        if (this.config.outputFormat === 'json') {
            manifestation = this.assembleAsJson(verifiedBricks, securityAddendum, projectMetadata);
        } else if (this.config.outputFormat === 'structured') {
            manifestation = this.assembleStructured(verifiedBricks, securityAddendum, projectMetadata);
        } else {
            manifestation = this.assembleAsMarkdown(verifiedBricks, securityAddendum, projectMetadata);
        }

        // Phase 2: Optional LLM Formatting (with strict preservation rules)
        if (this.config.useLLMFormatting && this.llmClient && this.config.model) {
            manifestation = await this.formatWithLLM(manifestation, verifiedBricks);
        }

        // Verification
        const assembledCharCount = manifestation.length;
        const preservationRatio = originalCharCount > 0
            ? assembledCharCount / originalCharCount
            : 1;

        return {
            manifestation,
            includedBricks: verifiedBricks.map(b => b.id),
            skippedBricks: [], // Should always be empty - we include all
            verification: {
                originalCharCount,
                assembledCharCount,
                preservationRatio
            },
            compiledAt: Date.now()
        };
    }

    /**
     * Assemble as Markdown (default)
     * Pure stitching with minimal formatting
     */
    private assembleAsMarkdown(
        bricks: VerifiedBrick[],
        addendum: SecurityAddendum | undefined,
        metadata: CompilerInput['projectMetadata']
    ): string {
        const lines: string[] = [];

        // Header
        lines.push(`# ${metadata.name || 'Project Manifestation'}`);
        lines.push('');
        lines.push(`**Domain:** ${metadata.domain}`);
        if (metadata.originalPrompt) {
            lines.push(`**Original Request:** "${metadata.originalPrompt}"`);
        }
        lines.push(`**Generated:** ${new Date(metadata.generatedAt).toISOString()}`);
        lines.push(`**Verified Bricks:** ${metadata.brickCount}`);

        const cleanTechStack = (metadata.techStack || [])
            .filter(t => typeof t === 'string' && t && t !== 'None' && t !== 'null' && t.toLowerCase() !== 'unknown')
            .filter((item, index, self) => self.indexOf(item) === index); // Dedupe

        lines.push(`**Tech Stack:** ${cleanTechStack.length > 0 ? cleanTechStack.join(', ') : 'None'}`);
        lines.push('');
        lines.push('---');
        lines.push('');

        // Table of Contents
        lines.push('## Table of Contents');
        lines.push('');
        bricks.forEach((brick, i) => {
            lines.push(`${i + 1}. [${this.sanitizeForTOC(brick.instruction)}](#brick-${i + 1})`);
        });
        if (addendum) {
            lines.push(`${bricks.length + 1}. [Security Addendum](#security-addendum)`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');

        // Bricks (LOSSLESS - exact artifact content)
        bricks.forEach((brick, i) => {
            lines.push(`<a id="brick-${i + 1}"></a>`);
            lines.push(`## ${i + 1}. ${brick.instruction}`);
            lines.push('');
            lines.push(`**Specialist:** ${brick.persona}`);
            lines.push(`**Confidence:** ${brick.confidence}%`);
            lines.push(`**Verified:** ${new Date(brick.verifiedAt).toISOString()}`);
            lines.push('');

            // THE CRITICAL PART: Artifact content is UNCHANGED
            // "DO NOT CHANGE A SINGLE WORD OF THE ARTIFACT CONTENT"
            lines.push(brick.artifact);

            lines.push('');
            lines.push('---');
            lines.push('');
        });

        // Security Addendum (if present)
        if (addendum) {
            lines.push('<a id="security-addendum"></a>');
            lines.push(addendum.content);
            lines.push('');
        }

        // Footer
        lines.push('---');
        lines.push('');
        lines.push('*This document was assembled by the Lossless Compiler.*');
        lines.push('*All artifact content has been preserved exactly as verified.*');
        lines.push(`*Compilation timestamp: ${new Date().toISOString()}*`);

        return lines.join('\n');
    }

    /**
     * Assemble as JSON (for programmatic use)
     */
    private assembleAsJson(
        bricks: VerifiedBrick[],
        addendum: SecurityAddendum | undefined,
        metadata: CompilerInput['projectMetadata']
    ): string {
        const output = {
            metadata: {
                ...metadata,
                compiledAt: Date.now(),
                compiler: 'LosslessCompiler v2.99'
            },
            bricks: bricks.map(brick => ({
                id: brick.id,
                persona: brick.persona,
                instruction: brick.instruction,
                confidence: brick.confidence,
                verifiedAt: brick.verifiedAt,
                // ARTIFACT IS PRESERVED EXACTLY
                artifact: brick.artifact
            })),
            securityAddendum: addendum ? {
                id: addendum.id,
                title: addendum.title,
                content: addendum.content,
                generatedAt: addendum.generatedAt
            } : null
        };

        return JSON.stringify(output, null, 2);
    }

    /**
     * Remove the [Persona Description] prefix from strings if present
     */
    private cleanPersonaPrefix(text: string): string {
        // Regex matches [Anything] followed by optional whitespace at start of string
        return text.replace(/^\[.*?\]\s*/, '');
    }

    /**
     * Assemble as structured sections (grouped by category)
     */
    private assembleStructured(
        bricks: VerifiedBrick[],
        addendum: SecurityAddendum | undefined,
        metadata: CompilerInput['projectMetadata']
    ): string {
        const lines: string[] = [];

        // Header
        lines.push(`# ${metadata.name || 'Project Manifestation'}`);
        lines.push('');
        lines.push(`> Generated by **Ouroboros Engine V2.99** - Structured Mode`);
        lines.push('');

        // Executive Summary / Metadata
        lines.push('## Executive Summary');
        lines.push('');
        lines.push(`**Domain:** ${metadata.domain || 'Not Specified'}`);
        if (metadata.originalPrompt) {
            lines.push(`**Original Request:** "${metadata.originalPrompt}"`);
        }
        lines.push(`**Verified Bricks:** ${metadata.brickCount}`);

        const cleanTechStack = (metadata.techStack || [])
            .filter(t => typeof t === 'string' && t && t !== 'None' && t !== 'null' && t.toLowerCase() !== 'unknown')
            .filter((item, index, self) => self.indexOf(item) === index); // Dedupe

        lines.push(`**Tech Stack:** ${cleanTechStack.length > 0 ? cleanTechStack.join(', ') : 'Not Specified'}`);
        lines.push(`**Compilation Timestamp:** ${new Date(metadata.generatedAt).toISOString()}`);
        lines.push('');
        lines.push('This document represents the compiled architectural "Bible" for the project. It defines the core axioms, structural requirements, and security invariants that must be preserved throughout the project\'s lifecycle.');
        lines.push('');

        // Living Constitution Sections
        if (metadata.constraints && metadata.constraints.length > 0) {
            lines.push('### Core Constraints & Axioms');
            metadata.constraints.forEach(c => lines.push(`- ${c}`));
            lines.push('');
        }

        if (metadata.decisions && metadata.decisions.length > 0) {
            lines.push('### Decisions Made');
            metadata.decisions.forEach(d => lines.push(`- ${this.cleanPersonaPrefix(d)}`));
            lines.push('');
        }

        if (metadata.warnings && metadata.warnings.length > 0) {
            lines.push('### Warnings & Risks');
            metadata.warnings.forEach(w => lines.push(`- ${this.cleanPersonaPrefix(w)}`));
            lines.push('');
        }

        lines.push('---');
        lines.push('');

        // 1. Group bricks by Category
        const groupedByCategory: Record<string, VerifiedBrick[]> = {};
        bricks.forEach(brick => {
            const category = this.extractCategory(brick.persona, brick.instruction);
            if (!groupedByCategory[category]) {
                groupedByCategory[category] = [];
            }
            groupedByCategory[category].push(brick);
        });

        // 2. Define Category Order
        const categoryOrder = [
            'Architecture',
            'Security',
            'Data & Storage',
            'API & Interfaces',
            'Algorithm & Logic',
            'Testing & QA',
            'Infrastructure & DevOps',
            'Frontend & UI',
            'Backend & Services',
            'General'
        ];

        // 3. Process categories in order
        categoryOrder.forEach(category => {
            const categoryBricks = groupedByCategory[category];
            if (!categoryBricks || categoryBricks.length === 0) return;

            lines.push(`## ${category}`);
            lines.push('');

            // 4. Group by Instruction (De-duplication)
            const groupedByInstruction: Record<string, VerifiedBrick[]> = {};
            categoryBricks.forEach(brick => {
                // Normalize instruction to group similar ones
                const key = brick.instruction.toLowerCase().trim();
                if (!groupedByInstruction[key]) {
                    groupedByInstruction[key] = [];
                }
                groupedByInstruction[key].push(brick);
            });

            // 5. Output Bricks
            Object.values(groupedByInstruction).forEach(instructionGroup => {
                // Use the instruction from the first brick as the header
                const instructionTitle = instructionGroup[0].instruction;
                lines.push(`### ${instructionTitle}`);
                lines.push('');

                instructionGroup.forEach((brick, index) => {
                    const sanePersona = this.sanitizePersona(brick.persona);

                    // If multiple bricks for same instruction, label them
                    const perspectiveLabel = instructionGroup.length > 1
                        ? `Perspective ${index + 1}`
                        : '';

                    lines.push(`*${sanePersona}${perspectiveLabel ? ` - ${perspectiveLabel}` : ''} | Confidence: ${brick.confidence}%*`);
                    lines.push('');

                    // Sanitize artifact (remove formatting noise)
                    lines.push(this.sanitizeArtifact(brick.artifact));
                    lines.push('');
                    lines.push('---');
                    lines.push('');
                });
            });
        });

        // Security Addendum
        if (addendum) {
            lines.push('## Security Addendum');
            lines.push('');
            lines.push(addendum.content);
            lines.push('');
        }

        // Footer
        lines.push('*This document was assembled by the Lossless Compiler (Structured Mode).*');
        lines.push(`*Compilation timestamp: ${new Date().toISOString()}*`);

        return lines.join('\n');
    }

    /**
     * Format with LLM (WITH STRICT PRESERVATION RULES)
     */
    private async formatWithLLM(
        rawAssembly: string,
        bricks: VerifiedBrick[]
    ): Promise<string> {
        if (!this.llmClient || !this.config.model) {
            return rawAssembly;
        }

        const prompt = this.buildFormatPrompt(rawAssembly, bricks);

        try {
            const response = await this.llmClient.generateContent({
                model: this.config.model,
                contents: prompt,
                config: {
                    temperature: 0.1, // Very low temp for consistency
                    maxOutputTokens: 8192
                }
            });

            const formatted = response.text || rawAssembly;

            // Verify preservation
            if (!this.verifyPreservation(formatted, bricks)) {
                console.warn('[Compiler] LLM formatting failed preservation check, using raw assembly');
                return rawAssembly;
            }

            return formatted;
        } catch (e) {
            console.warn('[Compiler] LLM formatting failed:', e);
            return rawAssembly;
        }
    }

    /**
     * Build the formatting prompt with strict preservation rules
     */
    private buildFormatPrompt(rawAssembly: string, bricks: VerifiedBrick[]): string {
        return `# LOSSLESS COMPILER - FORMATTING ONLY

**Your Role:** The Stitcher
**Philosophy:** "Assembly, not Synthesis."

You will receive a raw assembly of verified artifacts. Your ONLY job is to:
1. Add section headers if missing
2. Ensure consistent formatting
3. Add transitions if absolutely necessary

## CRITICAL RULES - READ CAREFULLY

⚠️ **DO NOT CHANGE A SINGLE WORD OF THE ARTIFACT CONTENT**

- You are ASSEMBLING, not SYNTHESIZING
- You must PRESERVE every named entity (functions, variables, concepts)
- You must PRESERVE all technical details
- You must NOT summarize
- You must NOT paraphrase
- You must NOT "improve" the content
- You must NOT add your own ideas

If you cannot preserve the content EXACTLY, return the input UNCHANGED.

## CHAIN OF DENSITY RULE

"Retain all Named Entities (functions, variables, concepts) exactly as they appear."

## VERIFICATION

The following ${bricks.length} artifacts MUST appear in your output UNCHANGED:
${bricks.map((b, i) => `${i + 1}. "${b.artifact.substring(0, 50)}..."`).join('\n')}

## RAW ASSEMBLY (Apply formatting only - preserve ALL content)

${rawAssembly}

## OUTPUT

Return the formatted document. Remember: ASSEMBLY, NOT SYNTHESIS.`;
    }

    /**
     * Verify that all artifact content is preserved in the output
     */
    private verifyPreservation(formatted: string, bricks: VerifiedBrick[]): boolean {
        // Check that key content from each brick appears in the output
        for (const brick of bricks) {
            // Extract significant phrases from artifact (first 100 chars, ignoring whitespace)
            const significantContent = brick.artifact
                .substring(0, 200)
                .replace(/\s+/g, ' ')
                .trim();

            const formattedNormalized = formatted.replace(/\s+/g, ' ');

            // At least the first significant portion should be preserved
            const firstWords = significantContent.split(' ').slice(0, 10).join(' ');
            if (firstWords.length > 20 && !formattedNormalized.includes(firstWords)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Extract category from persona name or instruction
     */
    private extractCategory(persona: string, instruction: string): string {
        const textToScan = (persona + ' ' + instruction).toLowerCase();

        const categoryPatterns: Record<string, RegExp> = {
            'Security': /security|auth|access|hardware|isolation|rust safety|risk assessment/i,
            'Algorithm & Logic': /algorithm|recursive|logic|intelligence density|halting problem/i,
            'Testing & QA': /test|qa|quality|adversarial|verification|fuzzing|validation/i,
            'Architecture': /architect|structure|system|design|pattern/i,
            'Data & Storage': /data|database|schema|storage|model/i,
            'API & Interfaces': /api|endpoint|interface|contract/i,
            'Infrastructure & DevOps': /infrastructure|deploy|cloud|devops|docker|kubernetes|container|rollback|recovery/i,
            'Frontend & UI': /frontend|ui|ux|interface|react|component/i,
            'Backend & Services': /backend|server|service|microservice/i
        };

        for (const [category, pattern] of Object.entries(categoryPatterns)) {
            if (pattern.test(textToScan)) {
                return category;
            }
        }

        return 'General';
    }

    /**
     * Sanitize persona string to remove system prompt noise
     */
    private sanitizePersona(fullPersona: string): string {
        // Pattern 1: "You are a/an [ROLE]" or "I am a/an [ROLE]" - extract the role
        const youAreMatch = fullPersona.match(/^(?:You are|I am) (?:a|an)\s+([^.]+?)(?:\s+specializing|\s+with\s+|\s+who\s+|\.|$)/i);
        if (youAreMatch) {
            let role = youAreMatch[1].trim();
            // Capitalize each word
            role = role.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            return role;
        }

        // Pattern 2: Already clean - just return as-is but trimmed
        if (fullPersona.length < 100) {
            return fullPersona.trim();
        }

        // Fallback: Take first sentence up to 80 chars
        const firstSentence = fullPersona.split('.')[0];
        if (firstSentence.length <= 80) {
            return firstSentence.trim();
        }

        return firstSentence.substring(0, 77).trim() + '...';
    }

    /**
     * Sanitize artifact content to remove internal markers
     */
    private sanitizeArtifact(artifact: string): string {
        let clean = artifact;

        // Remove triple-quote wrappers that leaked through
        clean = clean.replace(/^"""\s*/gm, '');
        clean = clean.replace(/\s*"""$/gm, '');

        // Remove any leaked system instructions
        clean = clean.replace(/\[You must.*?\]/gs, '');
        clean = clean.replace(/\[CRITICAL:.*?\]/gs, '');

        // Normalize excessive blank lines (more than 2 -> 2)
        clean = clean.replace(/\n{4,}/g, '\n\n\n');

        return clean.trim();
    }

    /**
     * Sanitize text for table of contents anchor
     */
    private sanitizeForTOC(text: string): string {
        return text.substring(0, 60) + (text.length > 60 ? '...' : '');
    }

    /**
     * Scrape tech stack from verified artifacts if missing in metadata
     */
    private scrapeTechStack(bricks: VerifiedBrick[]): string[] {
        const technologyKeywords = ['Tech Stack', 'Technologies', 'Technology Stack', 'Core Technologies'];
        const stack: Set<string> = new Set();
        // Regex to match list items like "- React" or "* React: UI Library"
        const specificTechRegex = /[-*]\s+([A-Za-z0-9\s.+/#]+?)(?::|\n|$)/g;

        // 1. Scan for explicit sections
        for (const brick of bricks) {
            const content = brick.artifact;
            for (const keyword of technologyKeywords) {
                // Find section header
                const headerRegex = new RegExp(`(?:##|###|\\*\\*)\\s*${keyword}`, 'i');
                const matchIndex = content.search(headerRegex);

                if (matchIndex !== -1) {
                    // Extract the section content (up to next double newline or header)
                    const sectionStart = matchIndex;
                    let sectionEnd = content.indexOf('\n##', sectionStart + 10);
                    if (sectionEnd === -1) sectionEnd = content.length;

                    const sectionContent = content.substring(sectionStart, sectionEnd);

                    // Parse list items in this section
                    let itemMatch;
                    while ((itemMatch = specificTechRegex.exec(sectionContent)) !== null) {
                        const tech = itemMatch[1].trim();
                        if (tech.length > 1 && tech.length < 40 && !tech.includes('http')) {
                            stack.add(tech);
                        }
                    }
                }
            }
        }

        // 2. Scan for specific "constitution" style list if found
        if (stack.size === 0) {
            // Fallback: look for common key milestones/tech in ANY artifact
            const constitution = bricks.find(b => /constitution|foundation|tech|stack/i.test(b.instruction));
            if (constitution) {
                let itemMatch;
                while ((itemMatch = specificTechRegex.exec(constitution.artifact)) !== null) {
                    const tech = itemMatch[1].trim();
                    // Filter out non-tech terms
                    if (tech.length > 2 && tech.length < 30 && /^[A-Z]/.test(tech)) {
                        stack.add(tech);
                    }
                }
            }
        }

        return Array.from(stack);
    }

    /**
     * Scrape domain from verified artifacts if missing in metadata
     */
    private scrapeDomain(bricks: VerifiedBrick[]): string {
        for (const brick of bricks) {
            const content = brick.artifact;
            const match = content.match(/(?:Domain|Industry|Sector):\s*(.+?)(?:\n|$)/i);
            if (match) {
                return match[1].trim();
            }
        }
        return 'Unknown';
    }
}

// ============================================================================
// QUICK COMPILE (Pure stitching, no LLM)
// ============================================================================

/**
 * Quick compile without LLM - pure lossless stitching
 */
export function quickCompile(
    bricks: VerifiedBrick[],
    projectName: string = 'Project'
): string {
    const compiler = new LosslessCompiler({ outputFormat: 'markdown' });

    // Synchronous compile (no LLM)
    const lines: string[] = [];

    lines.push(`# ${projectName}`);
    lines.push('');
    lines.push(`*Assembled: ${new Date().toISOString()}*`);
    lines.push('');

    bricks.forEach((brick, i) => {
        lines.push(`## ${i + 1}. ${brick.instruction}`);
        lines.push('');
        lines.push(`*${brick.persona}*`);
        lines.push('');
        lines.push(brick.artifact);
        lines.push('');
        lines.push('---');
        lines.push('');
    });

    return lines.join('\n');
}

// ============================================================================
// VERIFICATION UTILITIES
// ============================================================================

/**
 * Verify that a manifestation contains all brick artifacts
 */
export function verifyCompilation(
    manifestation: string,
    bricks: VerifiedBrick[]
): {
    allPreserved: boolean;
    preservedCount: number;
    missingBricks: string[];
} {
    const missingBricks: string[] = [];

    for (const brick of bricks) {
        // Check if a significant portion of the artifact is present
        const firstChunk = brick.artifact.substring(0, 100).trim();
        if (firstChunk.length > 20 && !manifestation.includes(firstChunk)) {
            missingBricks.push(brick.id);
        }
    }

    return {
        allPreserved: missingBricks.length === 0,
        preservedCount: bricks.length - missingBricks.length,
        missingBricks
    };
}
