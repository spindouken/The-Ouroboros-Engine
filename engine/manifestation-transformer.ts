/**
 * Manifestation Transformer (Post-Compiler Prose Generator)
 * 
 * Purpose: Convert structured JSON output from the Lossless Compiler into
 * flowing, human-readable prose. This is the final stage when using small
 * models in JSON-only mode throughout the pipeline.
 * 
 * The Lossless Compiler preserves all data perfectly in JSON format.
 * This transformer takes that JSON and weaves it into natural documentation.
 * 
 * Use Cases:
 * 1. Convert JSON Manifestation → Readable Markdown Documentation
 * 2. Transform brick artifacts into narrative prose
 * 3. Generate executive summaries from structured data
 * 
 * @module engine/manifestation-transformer
 * @version V3.0
 */

import { LLMResponse } from './UnifiedLLMClient';
import { VerifiedBrick } from './blackboard-delta';

// ============================================================================
// TYPES
// ============================================================================

export interface TransformInput {
    /** The JSON manifestation (output from Lossless Compiler in 'json' mode) */
    jsonManifestation: string | object;

    /** Target format for transformation */
    targetFormat: 'narrative' | 'documentation' | 'executive_summary' | 'technical_spec';

    /** Project context for narrative flow */
    context?: {
        projectName?: string;
        domain?: string;
        audience?: 'technical' | 'business' | 'mixed';
    };
}

export interface TransformOutput {
    /** The transformed prose content */
    prose: string;

    /** Metadata about the transformation */
    meta: {
        sourceFormat: 'json';
        targetFormat: string;
        brickCount: number;
        wordCount: number;
        transformedAt: number;
    };
}

export interface TransformConfig {
    /** Model to use for prose generation */
    model?: string;

    /** Whether to use LLM for prose transformation (if false, uses template-based approach) */
    useLLM?: boolean;

    /** Writing style */
    style?: 'formal' | 'conversational' | 'technical';

    /** Maximum output length (in tokens) */
    maxOutputTokens?: number;
}

// ============================================================================
// MANIFESTATION TRANSFORMER
// ============================================================================

export class ManifestationTransformer {
    private config: TransformConfig;
    private llmClient?: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    constructor(
        config: TransformConfig,
        llmClient?: {
            generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
        }
    ) {
        this.config = {
            model: config.model,
            useLLM: config.useLLM ?? true,
            style: config.style || 'technical',
            maxOutputTokens: config.maxOutputTokens || 4096
        };
        this.llmClient = llmClient;
    }

    /**
     * Transform JSON manifestation into human-readable prose
     */
    async transform(input: TransformInput): Promise<TransformOutput> {
        // Parse JSON if string
        let data: any;
        if (typeof input.jsonManifestation === 'string') {
            try {
                data = JSON.parse(input.jsonManifestation);
            } catch (e) {
                throw new Error('Invalid JSON manifestation input');
            }
        } else {
            data = input.jsonManifestation;
        }

        // Extract bricks and metadata
        const bricks: VerifiedBrick[] = data.bricks || [];
        const metadata = data.metadata || {};
        const securityAddendum = data.securityAddendum || null;

        let prose: string;

        if (this.config.useLLM && this.llmClient && this.config.model) {
            // LLM-powered transformation
            prose = await this.transformWithLLM(bricks, metadata, securityAddendum, input);
        } else {
            // Template-based transformation (no LLM needed)
            prose = this.transformWithTemplates(bricks, metadata, securityAddendum, input);
        }

        // Calculate word count
        const wordCount = prose.split(/\s+/).filter(w => w.length > 0).length;

        return {
            prose,
            meta: {
                sourceFormat: 'json',
                targetFormat: input.targetFormat,
                brickCount: bricks.length,
                wordCount,
                transformedAt: Date.now()
            }
        };
    }

    /**
     * Template-based transformation (no LLM - faster, deterministic)
     */
    private transformWithTemplates(
        bricks: VerifiedBrick[],
        metadata: any,
        securityAddendum: any,
        input: TransformInput
    ): string {
        const lines: string[] = [];
        const projectName = input.context?.projectName || metadata.name || 'Project';
        const domain = input.context?.domain || metadata.domain || 'Software Development';

        switch (input.targetFormat) {
            case 'executive_summary':
                return this.generateExecutiveSummary(bricks, metadata, projectName, domain);

            case 'technical_spec':
                return this.generateTechnicalSpec(bricks, metadata, securityAddendum, projectName);

            case 'documentation':
                return this.generateDocumentation(bricks, metadata, securityAddendum, projectName, domain);

            case 'narrative':
            default:
                return this.generateNarrative(bricks, metadata, securityAddendum, projectName, domain);
        }
    }

    /**
     * Generate Executive Summary (concise, business-focused)
     */
    private generateExecutiveSummary(
        bricks: VerifiedBrick[],
        metadata: any,
        projectName: string,
        domain: string
    ): string {
        const lines: string[] = [];

        lines.push(`# ${projectName} - Executive Summary`);
        lines.push('');
        lines.push(`## Overview`);
        lines.push('');
        lines.push(`This document provides a high-level summary of **${projectName}**, a project in the **${domain}** domain.`);
        if (metadata.originalPrompt) {
            lines.push(`The project was initiated to: "${metadata.originalPrompt}"`);
        }
        lines.push('');

        // Key Decisions
        const decisions = metadata.decisions || [];
        if (decisions.length > 0) {
            lines.push(`## Key Decisions`);
            lines.push('');
            decisions.slice(0, 5).forEach((d: string, i: number) => {
                lines.push(`${i + 1}. ${this.cleanText(d)}`);
            });
            lines.push('');
        }

        // Tech Stack
        const techStack = metadata.techStack || [];
        if (techStack.length > 0) {
            lines.push(`## Technology Stack`);
            lines.push('');
            lines.push(techStack.filter((t: string) => t && t !== 'Unknown').join(', '));
            lines.push('');
        }

        // Warnings/Risks
        const warnings = metadata.warnings || [];
        if (warnings.length > 0) {
            lines.push(`## Identified Risks`);
            lines.push('');
            warnings.slice(0, 3).forEach((w: string) => {
                lines.push(`- ⚠️ ${this.cleanText(w)}`);
            });
            lines.push('');
        }

        // Key Deliverables
        lines.push(`## Deliverables`);
        lines.push('');
        lines.push(`This project specification contains **${bricks.length} verified components**, each reviewed and approved by specialized AI agents.`);
        lines.push('');

        // Timestamp
        lines.push('---');
        lines.push(`*Generated: ${new Date().toISOString()}*`);

        return lines.join('\n');
    }

    /**
     * Generate Technical Specification (detailed, developer-focused)
     */
    private generateTechnicalSpec(
        bricks: VerifiedBrick[],
        metadata: any,
        securityAddendum: any,
        projectName: string
    ): string {
        const lines: string[] = [];

        lines.push(`# ${projectName} - Technical Specification`);
        lines.push('');
        lines.push(`> Compiled by Ouroboros Engine V2.99 - Lossless Compiler`);
        lines.push('');

        // Constraints
        const constraints = metadata.constraints || [];
        if (constraints.length > 0) {
            lines.push(`## Architectural Constraints`);
            lines.push('');
            constraints.forEach((c: string) => {
                lines.push(`- ${c}`);
            });
            lines.push('');
        }

        // Group bricks by category
        const categories = this.categorizeBricks(bricks);

        for (const [category, categoryBricks] of Object.entries(categories)) {
            if (categoryBricks.length === 0) continue;

            lines.push(`## ${category}`);
            lines.push('');

            categoryBricks.forEach((brick: VerifiedBrick, i: number) => {
                lines.push(`### ${brick.instruction}`);
                lines.push('');
                lines.push(`**Specialist:** ${this.extractRole(brick.persona)}`);
                lines.push(`**Confidence:** ${brick.confidence}%`);
                lines.push('');
                lines.push(brick.artifact);
                lines.push('');
                lines.push('---');
                lines.push('');
            });
        }

        // Security
        if (securityAddendum) {
            lines.push(`## Security Considerations`);
            lines.push('');
            lines.push(securityAddendum.content);
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Generate Documentation (balanced, reader-friendly)
     */
    private generateDocumentation(
        bricks: VerifiedBrick[],
        metadata: any,
        securityAddendum: any,
        projectName: string,
        domain: string
    ): string {
        const lines: string[] = [];

        lines.push(`# ${projectName}`);
        lines.push('');
        lines.push(`## Introduction`);
        lines.push('');
        lines.push(`Welcome to the ${projectName} documentation. This document outlines the complete architectural specification for this ${domain} project.`);
        lines.push('');

        if (metadata.originalPrompt) {
            lines.push(`### Project Vision`);
            lines.push('');
            lines.push(`"${metadata.originalPrompt}"`);
            lines.push('');
        }

        // Table of Contents
        lines.push(`## Table of Contents`);
        lines.push('');
        bricks.forEach((brick, i) => {
            const slug = this.slugify(brick.instruction);
            lines.push(`${i + 1}. [${this.truncate(brick.instruction, 50)}](#${slug})`);
        });
        lines.push('');

        // Each Brick
        bricks.forEach((brick, i) => {
            const slug = this.slugify(brick.instruction);
            lines.push(`<a id="${slug}"></a>`);
            lines.push(`## ${i + 1}. ${brick.instruction}`);
            lines.push('');
            lines.push(`*Authored by: ${this.extractRole(brick.persona)}*`);
            lines.push('');
            lines.push(brick.artifact);
            lines.push('');
            lines.push('---');
            lines.push('');
        });

        // Security
        if (securityAddendum) {
            lines.push(`## Security Guidelines`);
            lines.push('');
            lines.push(securityAddendum.content);
            lines.push('');
        }

        // Footer
        lines.push(`## Appendix`);
        lines.push('');
        lines.push(`- **Total Sections:** ${bricks.length}`);
        lines.push(`- **Generated:** ${new Date().toISOString()}`);
        lines.push(`- **Engine:** Ouroboros V2.99`);

        return lines.join('\n');
    }

    /**
     * Generate Narrative (storytelling format)
     */
    private generateNarrative(
        bricks: VerifiedBrick[],
        metadata: any,
        securityAddendum: any,
        projectName: string,
        domain: string
    ): string {
        const lines: string[] = [];

        lines.push(`# The ${projectName} Vision`);
        lines.push('');
        lines.push(`## Chapter 1: The Beginning`);
        lines.push('');

        if (metadata.originalPrompt) {
            lines.push(`It started with a simple question: "${metadata.originalPrompt}"`);
            lines.push('');
            lines.push(`From this seed, grew a comprehensive vision for a ${domain} solution.`);
        } else {
            lines.push(`This is the story of ${projectName}, a ${domain} project brought to life through collaborative AI intelligence.`);
        }
        lines.push('');

        // Foundation
        const constraints = metadata.constraints || [];
        if (constraints.length > 0) {
            lines.push(`## Chapter 2: The Foundation`);
            lines.push('');
            lines.push(`Before building, we established immutable truths:`);
            lines.push('');
            constraints.forEach((c: string) => {
                lines.push(`> "${c}"`);
            });
            lines.push('');
        }

        // The Work
        lines.push(`## Chapter 3: The Assembly`);
        lines.push('');
        lines.push(`${bricks.length} specialists contributed their expertise:`);
        lines.push('');

        bricks.forEach((brick, i) => {
            const role = this.extractRole(brick.persona);
            lines.push(`### ${role}'s Contribution: ${brick.instruction}`);
            lines.push('');
            lines.push(brick.artifact);
            lines.push('');
        });

        // Conclusion
        lines.push(`## Epilogue: The Manifestation`);
        lines.push('');
        lines.push(`And so, ${projectName} was born - not through chaos, but through structured collaboration.`);
        lines.push(`${bricks.length} verified contributions, assembled without loss, forming a complete vision.`);
        lines.push('');
        lines.push(`*The End.*`);
        lines.push('');
        lines.push(`---`);
        lines.push(`*Compiled: ${new Date().toISOString()}*`);

        return lines.join('\n');
    }

    /**
     * LLM-powered transformation for higher quality prose
     */
    private async transformWithLLM(
        bricks: VerifiedBrick[],
        metadata: any,
        securityAddendum: any,
        input: TransformInput
    ): Promise<string> {
        if (!this.llmClient || !this.config.model) {
            return this.transformWithTemplates(bricks, metadata, securityAddendum, input);
        }

        const projectName = input.context?.projectName || metadata.name || 'Project';
        const audience = input.context?.audience || 'technical';

        const prompt = `# MANIFESTATION TRANSFORMER

You are a technical writer transforming structured JSON data into flowing prose.

## INPUT DATA

**Project:** ${projectName}
**Domain:** ${input.context?.domain || metadata.domain || 'Software Development'}
**Audience:** ${audience}
**Target Format:** ${input.targetFormat}
**Style:** ${this.config.style}

## BRICKS TO TRANSFORM (${bricks.length} total)

${bricks.map((b, i) => `
### Brick ${i + 1}: ${b.instruction}
**Specialist:** ${b.persona}
**Confidence:** ${b.confidence}%

${b.artifact}
`).join('\n---\n')}

${securityAddendum ? `
## SECURITY ADDENDUM
${securityAddendum.content}
` : ''}

## TRANSFORMATION RULES

1. **Preserve all technical details** - Do not lose any named entities, functions, or specific requirements
2. **Write in ${this.config.style} style** - ${this.getStyleGuide()}
3. **Target ${input.targetFormat} format** - ${this.getFormatGuide(input.targetFormat)}
4. **Audience: ${audience}** - Adjust language complexity accordingly

## OUTPUT

Generate a well-structured, flowing document that transforms the above JSON bricks into readable prose.
The document should have clear sections, smooth transitions, and maintain all technical accuracy.

START YOUR OUTPUT NOW:`;

        try {
            const response = await this.llmClient.generateContent({
                model: this.config.model,
                contents: prompt,
                config: {
                    temperature: 0.3,
                    maxOutputTokens: this.config.maxOutputTokens
                }
            });

            return response.text || this.transformWithTemplates(bricks, metadata, securityAddendum, input);
        } catch (e) {
            console.warn('[Transformer] LLM transformation failed, falling back to templates:', e);
            return this.transformWithTemplates(bricks, metadata, securityAddendum, input);
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private cleanText(text: string): string {
        return text
            .replace(/^\[.*?\]\s*/, '') // Remove [Persona] prefix
            .replace(/^You are.*?\.\s*/i, '') // Remove "You are a..." prefix
            .trim();
    }

    private extractRole(persona: string): string {
        const match = persona.match(/^(?:You are|I am) (?:a|an)\s+([^.]+)/i);
        if (match) {
            return match[1].trim().split(' ').slice(0, 3).join(' ');
        }
        return persona.split('.')[0].substring(0, 40);
    }

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
    }

    private truncate(text: string, length: number): string {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    private categorizeBricks(bricks: VerifiedBrick[]): Record<string, VerifiedBrick[]> {
        const categories: Record<string, VerifiedBrick[]> = {
            'Architecture': [],
            'Security': [],
            'Data & Storage': [],
            'API & Interfaces': [],
            'Business Logic': [],
            'Testing': [],
            'Infrastructure': [],
            'Other': []
        };

        for (const brick of bricks) {
            const text = (brick.persona + ' ' + brick.instruction).toLowerCase();

            if (/security|auth|access/i.test(text)) {
                categories['Security'].push(brick);
            } else if (/architect|structure|system design/i.test(text)) {
                categories['Architecture'].push(brick);
            } else if (/data|database|storage|model/i.test(text)) {
                categories['Data & Storage'].push(brick);
            } else if (/api|endpoint|interface/i.test(text)) {
                categories['API & Interfaces'].push(brick);
            } else if (/test|qa|quality/i.test(text)) {
                categories['Testing'].push(brick);
            } else if (/infra|deploy|devops/i.test(text)) {
                categories['Infrastructure'].push(brick);
            } else if (/logic|algorithm|business/i.test(text)) {
                categories['Business Logic'].push(brick);
            } else {
                categories['Other'].push(brick);
            }
        }

        return categories;
    }

    private getStyleGuide(): string {
        switch (this.config.style) {
            case 'formal':
                return 'Use formal, professional language. Avoid contractions. Third person perspective.';
            case 'conversational':
                return 'Use friendly, approachable language. Contractions are okay. Second person (you) where appropriate.';
            case 'technical':
            default:
                return 'Use precise technical language. Be direct and clear. Include specific details.';
        }
    }

    private getFormatGuide(format: string): string {
        switch (format) {
            case 'executive_summary':
                return 'Brief, high-level overview. Focus on decisions, risks, and key takeaways. 1-2 pages max.';
            case 'technical_spec':
                return 'Detailed technical specification. Include all implementation details. Developer-focused.';
            case 'documentation':
                return 'Complete documentation. Include table of contents, clear sections, and appendix.';
            case 'narrative':
            default:
                return 'Story-like flow. Introduce concepts progressively. Engaging and readable.';
        }
    }
}

// ============================================================================
// QUICK TRANSFORM (Template-based, no LLM)
// ============================================================================

/**
 * Quick transform JSON manifestation to prose without LLM
 */
export function quickTransform(
    jsonManifestation: string | object,
    targetFormat: 'narrative' | 'documentation' | 'executive_summary' | 'technical_spec' = 'documentation',
    projectName?: string
): string {
    const transformer = new ManifestationTransformer({ useLLM: false });

    // Synchronous wrapper (transformWithTemplates is sync)
    let data: any;
    if (typeof jsonManifestation === 'string') {
        data = JSON.parse(jsonManifestation);
    } else {
        data = jsonManifestation;
    }

    const input: TransformInput = {
        jsonManifestation: data,
        targetFormat,
        context: {
            projectName: projectName || data.metadata?.name || 'Project',
            domain: data.metadata?.domain || 'Software Development'
        }
    };

    // Direct call to template method (bypasses async)
    return (transformer as any).transformWithTemplates(
        data.bricks || [],
        data.metadata || {},
        data.securityAddendum || null,
        input
    );
}
