/**
 * The Security Patcher (The Additive Judge) - Section 5.2
 * 
 * Role: Red Team Consultant & Composition Discriminator
 * 
 * Timing: Runs AFTER all Bricks are verified but BEFORE final assembly
 * (This is a critical timing requirement)
 * 
 * Mechanism:
 * - Reads the entire collection of Verified Bricks
 * - Checks for Security Gaps and Dropped Warnings
 * - Also validates that this is NOT implementation code (NOT a coding agent)
 * 
 * Actions:
 * - If CRITICAL issues found → Reject back to Masonry
 * - If MINOR issues found → Append a "Security Addendum" brick
 * 
 * Security Focus:
 * 1. Missing input validation
 * 2. Unsafe operations (eval, innerHTML, etc.)
 * 3. Architectural vulnerabilities
 * 4. Dropped warnings from previous agents
 */

import { LLMResponse } from './UnifiedLLMClient';
import { VerifiedBrick } from './blackboard-delta';

// ============================================================================
// TYPES
// ============================================================================

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityIssue {
    /** Unique identifier */
    id: string;

    /** Severity level */
    severity: SecuritySeverity;

    /** Category of issue */
    category: 'input_validation' | 'unsafe_operation' | 'architectural' | 'dropped_warning' | 'code_generation' | 'other';

    /** Description of the issue */
    description: string;

    /** Which brick(s) this issue appears in */
    affectedBricks: string[];

    /** Recommended fix */
    recommendation: string;
}

export interface SecurityScanResult {
    /** Whether all bricks passed security review */
    passed: boolean;

    /** Overall security score (0-100) */
    score: number;

    /** List of issues found */
    issues: SecurityIssue[];

    /** Categorized issue counts */
    issueCounts: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };

    /** Recommendation: 'proceed', 'add_addendum', 'reject' */
    recommendation: 'proceed' | 'add_addendum' | 'reject';

    /** Security addendum content (if needed) */
    addendum?: SecurityAddendum;

    /** Raw LLM response (if used) */
    rawResponse?: string;
}

export interface SecurityAddendum {
    /** Unique identifier */
    id: string;

    /** Title */
    title: string;

    /** The addendum content */
    content: string;

    /** Issues this addendum addresses */
    addressedIssues: string[];

    /** When this was generated */
    generatedAt: number;
}

export interface SecurityPatcherConfig {
    /** Model to use for security review */
    model: string;

    /** Temperature for analysis */
    temperature?: number;

    /** Whether to perform LLM-based deep analysis (vs. regex only) */
    deepAnalysis?: boolean;

    /** V2.99 Experimental: Allow implementation code generation */
    allowCodeGeneration?: boolean;
}

// ============================================================================
// SECURITY PATTERNS (Regex-based quick scan)
// ============================================================================

const UNSAFE_PATTERNS: Array<{
    pattern: RegExp;
    category: SecurityIssue['category'];
    severity: SecuritySeverity;
    message: string;
}> = [
        // Unsafe operations
        { pattern: /\beval\s*\(/gi, category: 'unsafe_operation', severity: 'critical', message: 'Use of eval() is dangerous and allows code injection' },
        { pattern: /\binnerHTML\s*=/gi, category: 'unsafe_operation', severity: 'high', message: 'innerHTML can lead to XSS vulnerabilities' },
        { pattern: /\bdocument\.write\s*\(/gi, category: 'unsafe_operation', severity: 'high', message: 'document.write() can be exploited for XSS' },
        { pattern: /new\s+Function\s*\(/gi, category: 'unsafe_operation', severity: 'critical', message: 'new Function() is similar to eval() and equally dangerous' },
        { pattern: /\bsetTimeout\s*\(\s*['"`]/gi, category: 'unsafe_operation', severity: 'medium', message: 'setTimeout with string argument is like eval()' },
        { pattern: /\bsetInterval\s*\(\s*['"`]/gi, category: 'unsafe_operation', severity: 'medium', message: 'setInterval with string argument is like eval()' },

        // Missing validation patterns (indicators)
        { pattern: /user\s*[.\[].*without.*valid/gi, category: 'input_validation', severity: 'high', message: 'User input may lack validation' },
        { pattern: /no\s+(?:input\s+)?validation/gi, category: 'input_validation', severity: 'high', message: 'Explicit mention of missing validation' },
        { pattern: /trust.*user.*input/gi, category: 'input_validation', severity: 'critical', message: 'Trusting user input without sanitization' },

        // SQL Injection indicators
        { pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/gi, category: 'unsafe_operation', severity: 'critical', message: 'Potential SQL injection via string interpolation' },
        { pattern: /['"`]\s*\+\s*.*\+\s*['"`].*(?:SELECT|INSERT|UPDATE|DELETE)/gi, category: 'unsafe_operation', severity: 'critical', message: 'SQL query built with string concatenation' },

        // Secrets/credentials
        { pattern: /(?:password|secret|api_?key|token)\s*[:=]\s*['"`][^'"]+['"`]/gi, category: 'architectural', severity: 'critical', message: 'Hardcoded secret or credential detected' },

        // This system should NOT generate implementation code
        { pattern: /```(?:javascript|typescript|python|java|csharp)\s*\n(?:[^\n]+\n){20,}/gi, category: 'code_generation', severity: 'medium', message: 'Large code block detected - this should be architecture/plans only, not implementation' },
    ];

// ============================================================================
// SECURITY PATCHER CLASS
// ============================================================================

export class SecurityPatcher {
    private config: SecurityPatcherConfig;
    private llmClient?: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    constructor(
        config: SecurityPatcherConfig,
        llmClient?: {
            generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
        }
    ) {
        this.config = {
            model: config.model,
            temperature: config.temperature ?? 0.3,
            deepAnalysis: config.deepAnalysis ?? true,
            allowCodeGeneration: config.allowCodeGeneration ?? false
        };
        this.llmClient = llmClient;
    }

    /**
     * Perform security scan on all verified bricks
     * This should run AFTER all bricks are verified but BEFORE Compiler
     * 
     * @param bricks - Array of verified bricks to scan
     * @param droppedWarnings - Any warnings that were raised but not addressed
     * @returns SecurityScanResult with issues and recommendation
     */
    async scan(
        bricks: VerifiedBrick[],
        droppedWarnings: string[] = []
    ): Promise<SecurityScanResult> {
        const issues: SecurityIssue[] = [];

        // Phase 1: Regex-based quick scan (zero LLM cost)
        for (const brick of bricks) {
            const regexIssues = this.regexScan(brick.artifact, brick.id);
            issues.push(...regexIssues);
        }

        // Phase 2: Check for dropped warnings
        if (droppedWarnings.length > 0) {
            droppedWarnings.forEach((warning, i) => {
                issues.push({
                    id: `dropped_warning_${i}`,
                    severity: 'medium',
                    category: 'dropped_warning',
                    description: `Warning was raised but not addressed: "${warning}"`,
                    affectedBricks: [],
                    recommendation: 'Review and address this warning before proceeding'
                });
            });
        }

        // Phase 3: LLM-based deep analysis (if enabled and no critical issues yet)
        if (this.config.deepAnalysis && this.llmClient) {
            const criticalCount = issues.filter(i => i.severity === 'critical').length;

            // Only do deep analysis if no critical issues found in regex scan
            // (saves tokens if we're already going to reject)
            if (criticalCount === 0) {
                const deepIssues = await this.deepScan(bricks);
                issues.push(...deepIssues);
            }
        }

        // Calculate score and recommendation
        const result = this.calculateResult(issues);

        // Generate addendum if needed
        if (result.recommendation === 'add_addendum' && this.llmClient) {
            result.addendum = await this.generateAddendum(bricks, issues);
        }

        return result;
    }

    /**
     * Regex-based quick scan of an artifact
     */
    private regexScan(artifact: string, brickId: string): SecurityIssue[] {
        const issues: SecurityIssue[] = [];

        for (const { pattern, category, severity, message } of UNSAFE_PATTERNS) {
            // Reset regex
            pattern.lastIndex = 0;

            if (pattern.test(artifact)) {
                issues.push({
                    id: `regex_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    severity,
                    category,
                    description: message,
                    affectedBricks: [brickId],
                    recommendation: `Review and fix: ${message}`
                });
            }
        }

        return issues;
    }

    /**
     * LLM-based deep security analysis
     */
    private async deepScan(bricks: VerifiedBrick[]): Promise<SecurityIssue[]> {
        if (!this.llmClient) return [];

        const combinedArtifacts = bricks.map(b =>
            `### Brick: ${b.id}\n**Persona:** ${b.persona}\n**Instruction:** ${b.instruction}\n\n${b.artifact}`
        ).join('\n\n---\n\n');

        const prompt = this.buildDeepScanPrompt(combinedArtifacts);

        try {
            const response = await this.llmClient.generateContent({
                model: this.config.model,
                contents: prompt,
                config: {
                    temperature: this.config.temperature,
                    maxOutputTokens: 2048
                }
            });

            return this.parseDeepScanResponse(response.text || '');
        } catch (e) {
            console.warn('[SecurityPatcher] Deep scan failed:', e);
            return [];
        }
    }

    /**
     * Build the prompt for deep security analysis
     */
    private buildDeepScanPrompt(combinedArtifacts: string): string {
        const allowCode = this.config.allowCodeGeneration;

        return `# SECURITY PATCHER PROTOCOL

**Your Role:** Red Team Consultant & Security Auditor

Analyze the following verified artifacts for security issues.

**IMPORTANT CONTEXT:**
${allowCode ? '- This system generates ARCHITECTURE and/or IMPLEMENTATION code.' : '- This system generates "Project Soul" (Architecture, Strategy, Plans) - NOT implementation code\n- If you find substantial implementation code, flag it as a violation'}
- Focus on architectural security${allowCode ? ' AND implementation security' : ', not code-level bugs'}

## ARTIFACTS TO ANALYZE
"""
${combinedArtifacts}
"""

## SECURITY CHECK CATEGORIES

1. **Input Validation:** Is user input properly sanitized/validated?
2. **Unsafe Operations:** Are there mentions of eval(), innerHTML, or similar?
3. **Architectural Vulnerabilities:** Authentication, authorization, data exposure issues?
4. **Secrets Management:** Hardcoded credentials or improper secret handling?
${allowCode ? '5. **Code Practices:** Bad patterns (if code is present)' : '5. **Code Generation Violation:** Is this generating implementation code (not allowed)?'}

## OUTPUT FORMAT

Return ONLY this JSON:
\`\`\`json
{
  "issues": [
    {
      "severity": "critical|high|medium|low|info",
      "category": "input_validation|unsafe_operation|architectural|code_generation|other",
      "description": "What is wrong",
      "affectedBricks": ["brick_id_1"],
      "recommendation": "How to fix"
    }
  ]
}
\`\`\`

If no issues found, return: \`{"issues": []}\``;
    }

    /**
     * Parse the deep scan response
     */
    private parseDeepScanResponse(response: string): SecurityIssue[] {
        try {
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : response;
            const parsed = JSON.parse(jsonStr);

            return (parsed.issues || []).map((issue: any, i: number) => ({
                id: `deep_${issue.category || 'other'}_${i}`,
                severity: this.normalizeSeverity(issue.severity),
                category: issue.category || 'other',
                description: issue.description || 'Unspecified issue',
                affectedBricks: issue.affectedBricks || [],
                recommendation: issue.recommendation || 'Review and address'
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Calculate the final result from issues
     */
    private calculateResult(issues: SecurityIssue[]): SecurityScanResult {
        const counts = {
            critical: issues.filter(i => i.severity === 'critical').length,
            high: issues.filter(i => i.severity === 'high').length,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length,
            info: issues.filter(i => i.severity === 'info').length
        };

        // Calculate score (100 - weighted deductions)
        const score = Math.max(0, 100
            - (counts.critical * 30)
            - (counts.high * 15)
            - (counts.medium * 5)
            - (counts.low * 2)
        );

        // Determine recommendation
        let recommendation: 'proceed' | 'add_addendum' | 'reject';
        if (counts.critical > 0) {
            recommendation = 'reject';
        } else if (counts.high > 0 || counts.medium > 1) {
            recommendation = 'add_addendum';
        } else {
            recommendation = 'proceed';
        }

        return {
            passed: recommendation !== 'reject',
            score,
            issues,
            issueCounts: counts,
            recommendation
        };
    }

    /**
     * Generate a Security Addendum brick
     */
    private async generateAddendum(
        bricks: VerifiedBrick[],
        issues: SecurityIssue[]
    ): Promise<SecurityAddendum> {
        const issuesList = issues
            .filter(i => i.severity !== 'info')
            .map(i => `- [${i.severity.toUpperCase()}] ${i.description}\n  Recommendation: ${i.recommendation}`)
            .join('\n');

        const content = `# SECURITY ADDENDUM

**Generated:** ${new Date().toISOString()}
**Reviewed Bricks:** ${bricks.length}
**Issues Found:** ${issues.length - issues.filter(i => i.severity === 'info').length}

## SECURITY CONSIDERATIONS

The following security considerations should be addressed during implementation:

${issuesList}

## RECOMMENDATIONS

1. Address all HIGH and CRITICAL issues before proceeding
2. Include security review in the implementation phase
3. Apply defense-in-depth principles
4. Follow OWASP guidelines for web security

## DISCLAIMER

This addendum is advisory. A full security audit should be performed
on any implementation derived from these architectural plans.`;

        return {
            id: `security_addendum_${Date.now()}`,
            title: 'Security Addendum',
            content,
            addressedIssues: issues.map(i => i.id),
            generatedAt: Date.now()
        };
    }

    /**
     * Normalize severity string
     */
    private normalizeSeverity(severity: string): SecuritySeverity {
        const normalized = (severity || '').toLowerCase();
        if (['critical', 'high', 'medium', 'low', 'info'].includes(normalized)) {
            return normalized as SecuritySeverity;
        }
        return 'medium';
    }

    /**
     * Update the security patcher configuration (allows dynamic model changes)
     */
    updateConfig(config: Partial<SecurityPatcherConfig>): void {
        if (config.model !== undefined) {
            this.config.model = config.model;
        }
        if (config.temperature !== undefined) {
            this.config.temperature = config.temperature;
        }
        if (config.deepAnalysis !== undefined) {
            this.config.deepAnalysis = config.deepAnalysis;
        }
    }

    /**
     * Get the current model being used
     */
    getModel(): string {
        return this.config.model || 'unknown';
    }
}

// ============================================================================
// QUICK SECURITY CHECK (Zero-cost regex only)
// ============================================================================

/**
 * Quick security check without LLM calls
 * Useful for pre-checks before full scan
 */
export function quickSecurityCheck(artifacts: string[]): {
    hasCritical: boolean;
    issueCount: number;
    issues: SecurityIssue[];
} {
    const issues: SecurityIssue[] = [];

    artifacts.forEach((artifact, i) => {
        for (const { pattern, category, severity, message } of UNSAFE_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(artifact)) {
                issues.push({
                    id: `quick_${category}_${i}`,
                    severity,
                    category,
                    description: message,
                    affectedBricks: [`artifact_${i}`],
                    recommendation: `Review and fix: ${message}`
                });
            }
        }
    });

    return {
        hasCritical: issues.some(i => i.severity === 'critical'),
        issueCount: issues.length,
        issues
    };
}

// ============================================================================
// RESULT FORMATTER
// ============================================================================

/**
 * Format security scan result for logging/display
 */
export function formatSecurityScanResult(result: SecurityScanResult): string {
    const emoji = result.passed ? '✅' : '❌';
    const status = result.recommendation === 'reject' ? 'REJECTED' :
        result.recommendation === 'add_addendum' ? 'PASSED WITH ADDENDUM' :
            'PASSED';

    let output = `## Security Scan Result: ${emoji} ${status}\n\n`;
    output += `**Score:** ${result.score}/100\n`;
    output += `**Issues:** ${result.issues.length} found\n\n`;

    if (result.issues.length > 0) {
        output += `### Issue Breakdown\n`;
        output += `- Critical: ${result.issueCounts.critical}\n`;
        output += `- High: ${result.issueCounts.high}\n`;
        output += `- Medium: ${result.issueCounts.medium}\n`;
        output += `- Low: ${result.issueCounts.low}\n`;
        output += `- Info: ${result.issueCounts.info}\n\n`;

        output += `### Details\n`;
        result.issues.forEach((issue, i) => {
            output += `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.description}\n`;
            output += `   Recommendation: ${issue.recommendation}\n\n`;
        });
    }

    return output;
}
