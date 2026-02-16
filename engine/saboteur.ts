/**
 * The Saboteur (Section 3.4)
 * 
 * Scope Stress Test - The Adversary
 * 
 * Role: A hostile agent ("The Red Team") that tries to identify missing 
 * requirements or logic gaps in the Prism's proposed Task List.
 * 
 * Outcome: Forces the Prism to inject "Missing Bricks" into the list 
 * before execution begins.
 * 
 * @module engine/saboteur
 * @version V2.99
 * 
 * █ ANCHOR 5a: THE SABOTEUR (Red Team)
 * 1. The Gap Interface
 * 2. LLM Stress Test (Phase 1)
 * 3. Domain Checklist (Phase 2)
 */

import { extractWithPreference } from '../utils/safe-json';
import { AtomicTask, CouncilProposal } from './prism-controller';
import { Constitution, ProjectMode } from './genesis-protocol';

/**
 * Gap identified by the Saboteur
 */
export interface IdentifiedGap {
    // █ ANCHOR 5.1: Defining a "Gap"
    id: string;
    severity: 'critical' | 'major' | 'minor';
    category: 'missing_requirement' | 'logic_gap' | 'security_hole' | 'edge_case' | 'dependency_missing' | 'scope_creep';
    title: string;
    description: string;
    affectedTasks: string[]; // IDs of related existing tasks
    suggestedFix: string;
    injectedBrick?: MissingBrick; // The brick to inject
}

/**
 * Missing Brick - A task that the Saboteur forces into the plan
 */
export interface MissingBrick {
    id: string;
    title: string;
    instruction: string;
    priority: 'critical' | 'high' | 'medium';
    insertAfter?: string; // Task ID to insert after
    insertBefore?: string; // Task ID to insert before
    reason: string;
    complexity: number;
}

/**
 * Saboteur Analysis Result
 */
export interface SaboteurResult {
    success: boolean;
    gapsIdentified: IdentifiedGap[];
    missingBricks: MissingBrick[];
    originalTaskCount: number;
    newTaskCount: number;
    stressTestScore: number; // 0-100, how well-covered the plan is
    analysisTime: number;
    warnings: string[];
}

/**
 * Domain completeness checklist
 */
interface DomainChecklist {
    domain: string;
    requiredAspects: string[];
}

const DOMAIN_CHECKLISTS: Record<string, string[]> = {
    'webapp': ['authentication', 'authorization', 'error handling', 'input validation', 'logging', 'database', 'api', 'frontend', 'deployment', 'testing'],
    'api': ['authentication', 'rate limiting', 'input validation', 'error responses', 'documentation', 'versioning', 'testing', 'monitoring'],
    'mobile': ['authentication', 'offline mode', 'push notifications', 'deep linking', 'app store', 'analytics', 'crash reporting'],
    'data': ['data validation', 'data transformation', 'error handling', 'logging', 'backup', 'recovery', 'security'],
    'ml': ['data preprocessing', 'model training', 'model evaluation', 'inference', 'monitoring', 'versioning', 'testing'],
    'general': ['error handling', 'logging', 'testing', 'documentation', 'security', 'performance']
};

/**
 * Mode-specific completeness checklist (Task 14.1)
 */
export const MODE_CHECKLISTS: Record<ProjectMode, string[]> = {
    software: ['authentication', 'database', 'api', 'deployment', 'error_handling', 'logging', 'testing'],
    scientific_research: ['literature_review', 'hypothesis', 'methodology', 'data_collection', 'analysis_plan', 'limitations', 'ethical_considerations', 'reproducibility'],
    legal_research: ['issue_identification', 'rule_statement', 'precedent_analysis', 'counterarguments', 'policy_considerations', 'conclusion', 'citations', 'jurisdiction_check'],
    creative_writing: ['premise', 'protagonist_arc', 'antagonist_motivation', 'theme', 'structure', 'climax', 'resolution', 'character_consistency', 'world_rules'],
    general: ['requirements', 'constraints', 'validation', 'error_handling', 'testing', 'documentation']
};

const ASPECT_PATTERNS: Record<string, string[]> = {
    authentication: ['auth', 'authentication', 'login', 'sign in', 'password', 'credential', 'jwt', 'oauth', 'session'],
    authorization: ['authorization', 'permission', 'role', 'access control', 'rbac', 'authorize'],
    error_handling: ['error handling', 'error', 'exception', 'catch', 'try', 'failure', 'fallback'],
    input_validation: ['input validation', 'validat', 'sanitiz', 'schema', 'zod', 'yup', 'check input'],
    logging: ['logging', 'log', 'trace', 'debug', 'monitor', 'audit'],
    testing: ['testing', 'test', 'spec', 'jest', 'vitest', 'unit', 'integration', 'e2e'],
    security: ['security', 'secur', 'encrypt', 'hash', 'csrf', 'xss', 'injection', 'https'],
    documentation: ['documentation', 'document', 'readme', 'api doc', 'swagger', 'openapi'],
    deployment: ['deployment', 'deploy', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'vercel', 'netlify'],
    database: ['database', 'db', 'sql', 'postgres', 'mongo', 'redis', 'schema'],
    api: ['api', 'endpoint', 'rest', 'graphql', 'route'],
    frontend: ['frontend', 'ui', 'component', 'page', 'view', 'style', 'css', 'react', 'vue'],
    rate_limiting: ['rate limiting', 'rate limit', 'throttl', 'quota'],
    monitoring: ['monitoring', 'monitor', 'metric', 'alert', 'health check'],
    literature_review: ['literature review', 'systematic review', 'bibliography', 'related work', 'sources'],
    hypothesis: ['hypothesis', 'hypotheses', 'research question'],
    methodology: ['methodology', 'methods', 'study design', 'experimental design'],
    data_collection: ['data collection', 'sampling', 'dataset gathering', 'data acquisition'],
    analysis_plan: ['analysis plan', 'statistical analysis', 'analysis strategy'],
    limitations: ['limitations', 'threats to validity', 'caveats'],
    ethical_considerations: ['ethical considerations', 'ethics', 'irb', 'consent', 'bias'],
    reproducibility: ['reproducibility', 'replication', 'reproduce', 'open data', 'code availability'],
    issue_identification: ['issue identification', 'legal issue', 'issues presented'],
    rule_statement: ['rule statement', 'legal rule', 'applicable law'],
    precedent_analysis: ['precedent analysis', 'case law', 'precedent', 'holding'],
    counterarguments: ['counterarguments', 'counterargument', 'opposing argument'],
    policy_considerations: ['policy considerations', 'policy rationale', 'public policy'],
    conclusion: ['conclusion', 'closing analysis', 'final determination'],
    citations: ['citation', 'citations', 'bluebook', 'case citation', 'statute citation'],
    jurisdiction_check: ['jurisdiction', 'venue', 'applicable jurisdiction'],
    premise: ['premise', 'story premise', 'core concept'],
    protagonist_arc: ['protagonist arc', 'character arc', 'hero arc'],
    antagonist_motivation: ['antagonist motivation', 'villain motivation', 'opposition motive'],
    theme: ['theme', 'thematic', 'message'],
    structure: ['structure', 'act structure', 'plot structure', 'beat sheet'],
    climax: ['climax', 'final confrontation', 'peak conflict'],
    resolution: ['resolution', 'denouement', 'ending'],
    character_consistency: ['character consistency', 'voice consistency', 'character continuity'],
    world_rules: ['world rules', 'worldbuilding rules', 'setting constraints'],
    requirements: ['requirements', 'requirement', 'acceptance criteria'],
    constraints: ['constraints', 'constraint', 'limitations'],
    validation: ['validation', 'verify', 'verification', 'validate'],
    performance: ['performance', 'latency', 'throughput', 'scalability']
};

function normalizeAspectKey(aspect: string): string {
    return aspect.trim().toLowerCase().replace(/\s+/g, '_');
}

export function getAspectPatternsForChecklist(aspect: string): string[] {
    const key = normalizeAspectKey(aspect);
    const patterns = ASPECT_PATTERNS[key];
    if (patterns && patterns.length > 0) {
        return patterns;
    }

    const fallback = aspect.toLowerCase().replace(/_/g, ' ');
    return [fallback];
}

/**
 * Detect missing aspects for a given mode checklist.
 * Used by property tests and Task 15 integration.
 */
export function detectMissingModeAspects(
    tasks: Array<Pick<AtomicTask, 'title' | 'instruction'>>,
    mode: ProjectMode
): string[] {
    const checklist = MODE_CHECKLISTS[mode] || MODE_CHECKLISTS.general;
    const taskText = tasks.map(t => `${t.title} ${t.instruction}`).join(' ').toLowerCase();

    return checklist.filter(aspect => {
        const patterns = getAspectPatternsForChecklist(aspect);
        return !patterns.some(pattern => taskText.includes(pattern));
    });
}

/**
 * The Saboteur - Red Team Stress Tester
 */
export class Saboteur {
    private ai: any;
    private model: string;

    constructor(ai: any, model: string) {
        this.ai = ai;
        this.model = model;
    }

    public setModel(model: string) {
        this.model = model;
    }

    /**
     * Execute Saboteur stress test on the task list
     * 
     * @param tasks - The Prism's proposed atomic tasks
     * @param council - The proposed Council of Specialists
     * @param constitution - The project Constitution
     * @param userGoal - The original user goal
     */
    async stressTest(
        tasks: AtomicTask[],
        council: CouncilProposal,
        constitution: Constitution | null,
        userGoal: string
    ): Promise<SaboteurResult> {
        console.log('[Saboteur] 🔴 Initiating Red Team stress test...');
        const startTime = Date.now();

        const result: SaboteurResult = {
            success: false,
            gapsIdentified: [],
            missingBricks: [],
            originalTaskCount: tasks.length,
            newTaskCount: tasks.length,
            stressTestScore: 100,
            analysisTime: 0,
            warnings: []
        };

        try {
            // TASK 3: Skip stress test entirely if no tasks exist (Prism failed)
            if (tasks.length === 0) {
                console.warn('[Saboteur] ⚠️ No tasks to stress test - Prism may have failed to generate tasks.');
                result.warnings.push('Prism generated 0 tasks. Saboteur cannot perform stress test on empty task list.');
                result.stressTestScore = 0; // Indicate failure
                result.analysisTime = Date.now() - startTime;
                // Return without injecting generic bricks
                return result;
            }

            // Phase 1: LLM-based gap detection (the core Saboteur)
            const llmGaps = await this.runLLMSaboteur(tasks, constitution, userGoal);
            result.gapsIdentified.push(...llmGaps);

            // Phase 2: Domain completeness check (rule-based)
            const mode: ProjectMode = constitution?.mode || 'software';
            const domainGaps = this.runDomainCompletenessCheck(tasks, mode);
            result.gapsIdentified.push(...domainGaps);

            // Phase 3: Dependency analysis (rule-based)
            const depGaps = this.runDependencyAnalysis(tasks);
            result.gapsIdentified.push(...depGaps);

            // Generate Missing Bricks from gaps
            result.missingBricks = await this.generateMissingBricks(result.gapsIdentified, tasks, constitution);
            result.newTaskCount = tasks.length + result.missingBricks.length;

            // Calculate stress test score
            result.stressTestScore = this.calculateScore(result.gapsIdentified);

            result.success = true;
            result.analysisTime = Date.now() - startTime;

            console.log(`[Saboteur] 🔴 Stress test complete. Found ${result.gapsIdentified.length} gaps, injecting ${result.missingBricks.length} bricks.`);
            console.log(`[Saboteur] 🔴 Plan coverage score: ${result.stressTestScore}/100`);

            return result;

        } catch (error: any) {
            console.error('[Saboteur] Stress test failed:', error);
            result.warnings.push(`Saboteur error: ${error.message}`);
            result.analysisTime = Date.now() - startTime;
            return result;
        }
    }

    /**
     * Phase 1: LLM-based Saboteur
     * Spawns an adversarial agent to find gaps
     */
    private async runLLMSaboteur(
        tasks: AtomicTask[],
        constitution: Constitution | null,
        userGoal: string
    ): Promise<IdentifiedGap[]> {
        // █ ANCHOR 5.2: Phase 1 - The Red Team Agent
        const taskList = tasks.map((t, i) => `${i + 1}. [${t.id}] ${t.title}: ${t.instruction}`).join('\n');
        const constraintContext = constitution
            ? `Constraints: ${constitution.constraints.map(c => c.description).join(', ')}`
            : '';
        const mode = constitution?.mode || 'software';
        const modeGapLens = this.getModeSpecificGapLens(mode);
        const modeGuardrails = this.getModePromptGuardrails(mode);

        const prompt = `
You are THE SABOTEUR - a hostile Red Team agent. Your job is to BREAK this plan by finding what's missing.

USER'S ORIGINAL GOAL:
"""
${userGoal}
"""

PROJECT CONSTITUTION:
"""
Domain: ${constitution?.domain || 'Unknown'}
Project Mode: ${mode}
${constraintContext}
"""

PROPOSED TASK LIST:
"""
${taskList}
"""

YOUR MISSION: Find the GAPS. What's missing? What will cause this project to FAIL?

Think like an attacker:
${modeGapLens}

MODE GUARDRAILS:
${modeGuardrails}

Return YAML array of 3-5 identified gaps (or fewer if plan is solid):

\`\`\`yaml
- id: gap_1
  severity: critical # or major, minor
  category: missing_requirement # or logic_gap, security_hole, edge_case, dependency_missing, scope_creep
  title: "Short title of the gap"
  description: "Description of what's missing"
  affectedTasks: 
    - "task_id_1"
  suggestedFix: "What task should be added"
\`\`\`

BE ADVERSARIAL. Find the weak points. If the plan is genuinely solid, return fewer gaps.
DO NOT make up fake gaps - only report REAL missing pieces.
`;

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: prompt,
                // Removed JSON enforcement
                config: { temperature: 0.7 }
            });

            // Use Soft-Strict extraction (YAML preferred)
            const extracted = extractWithPreference<IdentifiedGap[]>(response.text || '', 'yaml', []);
            const data = extracted.data || [];

            if (data.length > 0) {
                return data.map((gap, i) => ({
                    ...gap,
                    id: gap.id || `saboteur_gap_${i + 1}`
                }));
            }
        } catch (error) {
            console.error('[Saboteur] LLM analysis failed:', error);
        }

        return [];
    }

    /**
     * Phase 2: Domain Completeness Check (Rule-based)
     * Checks if common domain aspects are covered
     */
    private runDomainCompletenessCheck(
        tasks: AtomicTask[],
        mode: ProjectMode
    ): IdentifiedGap[] {
        // █ ANCHOR 5.3: Phase 2 - Domain Knowledge Check
        const gaps: IdentifiedGap[] = [];
        const checklist = MODE_CHECKLISTS[mode] || MODE_CHECKLISTS.general;
        const modeLabel = mode.replace(/_/g, ' ');

        // Check which aspects are covered
        const taskText = tasks.map(t => `${t.title} ${t.instruction}`).join(' ').toLowerCase();

        for (const aspect of checklist) {
            const aspectPatterns = this.getAspectPatterns(aspect);
            const isCovered = aspectPatterns.some(pattern => taskText.includes(pattern));
            const aspectLabel = aspect.replace(/_/g, ' ');
            const severity: IdentifiedGap['severity'] =
                aspect === 'error_handling' || aspect === 'citations' || aspect === 'methodology'
                    ? 'major'
                    : 'minor';

            if (!isCovered) {
                gaps.push({
                    id: `domain_gap_${aspect.replace(/\s+/g, '_')}`,
                    severity,
                    category: 'missing_requirement',
                    title: `Missing: ${aspectLabel.charAt(0).toUpperCase() + aspectLabel.slice(1)}`,
                    description: `The task list does not appear to cover "${aspectLabel}" which is typically required for ${modeLabel} projects.`,
                    affectedTasks: [],
                    suggestedFix: `Add a task to handle ${aspectLabel}`
                });
            }
        }

        return gaps;
    }

    /**
     * Get search patterns for domain aspects
     */
    private getAspectPatterns(aspect: string): string[] {
        return getAspectPatternsForChecklist(aspect);
    }

    /**
     * Phase 3: Dependency Analysis (Rule-based)
     * Checks for logical dependency issues
     */
    private runDependencyAnalysis(tasks: AtomicTask[]): IdentifiedGap[] {
        const gaps: IdentifiedGap[] = [];
        const taskIds = new Set(tasks.map(t => t.id));

        // Check for missing dependencies
        for (const task of tasks) {
            for (const dep of task.dependencies) {
                if (!taskIds.has(dep)) {
                    gaps.push({
                        id: `dep_gap_${task.id}_${dep}`,
                        severity: 'major',
                        category: 'dependency_missing',
                        title: `Missing Dependency: ${dep}`,
                        description: `Task "${task.title}" depends on "${dep}" which doesn't exist in the task list.`,
                        affectedTasks: [task.id],
                        suggestedFix: `Either add the missing task "${dep}" or remove the dependency`
                    });
                }
            }
        }

        // Check for circular dependencies (basic check)
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (taskId: string): boolean => {
            visited.add(taskId);
            recursionStack.add(taskId);

            const task = tasks.find(t => t.id === taskId);
            if (task) {
                for (const dep of task.dependencies) {
                    if (!visited.has(dep)) {
                        if (hasCycle(dep)) return true;
                    } else if (recursionStack.has(dep)) {
                        return true;
                    }
                }
            }

            recursionStack.delete(taskId);
            return false;
        };

        for (const task of tasks) {
            if (!visited.has(task.id) && hasCycle(task.id)) {
                gaps.push({
                    id: `dep_gap_circular_${task.id}`,
                    severity: 'critical',
                    category: 'logic_gap',
                    title: 'Circular Dependency Detected',
                    description: `Task "${task.title}" is involved in a circular dependency chain.`,
                    affectedTasks: [task.id],
                    suggestedFix: 'Restructure tasks to break the circular dependency'
                });
                break; // Only report once
            }
        }

        return gaps;
    }

    /**
     * Generate Missing Bricks from identified gaps
     */
    private async generateMissingBricks(
        gaps: IdentifiedGap[],
        existingTasks: AtomicTask[],
        constitution: Constitution | null
    ): Promise<MissingBrick[]> {
        const bricks: MissingBrick[] = [];
        const mode = constitution?.mode || 'software';

        // Filter to critical and major gaps only
        const significantGaps = gaps.filter(g => g.severity === 'critical' || g.severity === 'major');

        if (significantGaps.length === 0) {
            console.log('[Saboteur] No significant gaps - no bricks to inject.');
            return bricks;
        }

        // Generate bricks for each gap
        const prompt = `
You are THE SABOTEUR. You've identified gaps in a project plan. Now generate the MISSING TASKS to fill them.

PROJECT MODE: ${mode}
MODE GUARDRAILS:
${this.getModePromptGuardrails(mode)}

IDENTIFIED GAPS:
${significantGaps.map((g, i) => `${i + 1}. [${g.severity.toUpperCase()}] ${g.title}: ${g.description}`).join('\n')}

EXISTING TASKS:
${existingTasks.map(t => `- [${t.id}] ${t.title}`).join('\n')}

Generate a MISSING BRICK (new task) for each gap:

Return YAML array:

\`\`\`yaml
- id: missing_brick_1
  title: "Short task title"
  instruction: "Single-step atomic instruction"
  priority: critical # or high, medium
  insertAfter: "existing_task_id" # optional
  reason: "Which gap this fixes"
  complexity: 5 # 1-10
\`\`\`

Make tasks ATOMIC (single action, single deliverable).
`;

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: prompt,
                // Removed JSON enforcement
                config: { temperature: 0.7 }
            });

            // Use Soft-Strict extraction (YAML preferred)
            const extracted = extractWithPreference<MissingBrick[]>(response.text || '', 'yaml', []);
            const data = extracted.data || [];

            if (data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    const brick = data[i];
                    const relatedGap = significantGaps[i];
                    const safeInstruction = this.enforceModeInstruction(
                        brick.instruction,
                        brick.title,
                        mode,
                        relatedGap
                    );

                    bricks.push({
                        ...brick,
                        id: brick.id || `missing_brick_${crypto.randomUUID().substring(0, 8)}`,
                        instruction: safeInstruction
                    });
                }
            } else {
                // If parsing fails silently (no throw), inject deterministic fallback bricks.
                bricks.push(...this.buildFallbackBricks(significantGaps, mode));
            }
        } catch (error) {
            console.error('[Saboteur] Failed to generate missing bricks:', error);

            // Fallback: generate simple bricks from gap suggestions
            bricks.push(...this.buildFallbackBricks(significantGaps, mode));
        }

        return bricks;
    }

    private getModePromptGuardrails(mode: ProjectMode): string {
        const guardrails: Record<ProjectMode, string> = {
            software: '- Software architecture terms are allowed.\n- Avoid implementation code.',
            scientific_research: '- Do NOT introduce software engineering tasks unless explicitly requested.\n- Focus on evidence, methods, limitations, and reproducibility.',
            legal_research: '- Do NOT introduce software engineering tasks unless explicitly requested.\n- Focus on issues, rules, precedent, citations, and jurisdiction framing.',
            creative_writing: '- Do NOT introduce software engineering tasks unless explicitly requested.\n- Focus on narrative structure, arcs, beats, and thematic cohesion.',
            general: '- Prefer domain-neutral planning.\n- Avoid unnecessary software implementation tasks unless explicitly requested.'
        };

        return guardrails[mode] || guardrails.general;
    }

    private getModeSpecificGapLens(mode: ProjectMode): string {
        const lenses: Record<ProjectMode, string> = {
            software: `1. What requirements did they forget?
2. What edge cases are unhandled?
3. What security holes exist?
4. What dependencies are assumed but not created?
5. What happens when things go wrong?`,
            scientific_research: `1. Which evidence coverage areas are missing?
2. Which methodology or reproducibility controls are missing?
3. Which limitations or bias checks are missing?
4. Which citation/source-quality checks are missing?
5. What invalidates conclusions if unaddressed?`,
            legal_research: `1. Which legal issues are not framed clearly?
2. Which governing rules or precedent checks are missing?
3. Which citation or jurisdiction checks are missing?
4. Which counterarguments are missing?
5. What analysis failures occur if these gaps remain?`,
            creative_writing: `1. Which story structure elements are missing?
2. Which character or motivation arcs are under-defined?
3. Which thematic or world-rule consistency checks are missing?
4. Which turning points/climax/resolution steps are missing?
5. What narrative failures occur if these gaps remain?`,
            general: `1. Which requirements are missing?
2. Which assumptions and constraints are missing?
3. Which dependency and risk checks are missing?
4. Which validation criteria are missing?
5. What breaks if these are not added?`
        };

        return lenses[mode] || lenses.general;
    }

    private enforceModeInstruction(
        instruction: string,
        title: string,
        mode: ProjectMode,
        relatedGap?: IdentifiedGap
    ): string {
        if (mode === 'software') {
            return instruction;
        }

        const softwareSignal =
            /(\bapi\b|\bendpoint\b|\bdatabase\b|\bschema\b|\breact\b|\btypescript\b|\bjavascript\b|\bbackend\b|\bfrontend\b|\bmiddleware\b|\bdeploy\b|\bdevops\b|\bcode\b|\bclass\b|\bfunction\b)/i;
        const text = `${title || ''} ${instruction || ''}`;
        if (!softwareSignal.test(text)) {
            return instruction;
        }

        return this.buildModeSafeFallbackInstruction(relatedGap, mode);
    }

    private buildModeSafeFallbackInstruction(gap: IdentifiedGap | undefined, mode: ProjectMode): string {
        const fallbackTitle = gap?.title || 'address the identified gap';
        const fallbackFix = gap?.suggestedFix || 'create a single-step task that closes this gap';

        const templates: Record<ProjectMode, string> = {
            software: fallbackFix,
            scientific_research: `Define an evidence-based research task to ${fallbackTitle.toLowerCase()}, including citation standards and a reproducibility check.`,
            legal_research: `Define a legal analysis task to ${fallbackTitle.toLowerCase()}, including citation quality and jurisdiction checks.`,
            creative_writing: `Define a narrative-structure task to ${fallbackTitle.toLowerCase()}, ensuring structural clarity and arc consistency.`,
            general: `Define a domain-appropriate planning task to ${fallbackTitle.toLowerCase()} with clear validation criteria.`
        };

        return templates[mode] || templates.general;
    }

    /**
     * Deterministic fallback brick generation when LLM output is unavailable or unparsable.
     */
    private buildFallbackBricks(significantGaps: IdentifiedGap[], mode: ProjectMode): MissingBrick[] {
        return significantGaps.map((gap) => {
            const normalizedGapId = gap.id.replace(/^domain_gap_/, '');
            const inferredId = `missing_brick_${normalizedGapId}`;
            const title = gap.title.replace(/^Missing:\s*/i, '').trim() || gap.suggestedFix.substring(0, 50);

            return {
                id: inferredId,
                title,
                instruction: this.buildModeSafeFallbackInstruction(gap, mode),
                priority: gap.severity === 'critical' ? 'critical' : 'high',
                reason: gap.description,
                complexity: 5
            };
        });
    }

    /**
     * Calculate stress test score based on gaps found
     */
    private calculateScore(gaps: IdentifiedGap[]): number {
        let score = 100;

        for (const gap of gaps) {
            switch (gap.severity) {
                case 'critical':
                    score -= 20;
                    break;
                case 'major':
                    score -= 10;
                    break;
                case 'minor':
                    score -= 5;
                    break;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Inject missing bricks into the task list
     * 
     * @param originalTasks - The original task list
     * @param missingBricks - Bricks to inject
     * @param council - Optional council to assign specialists (TASK 4)
     * @returns Updated task list with injected bricks
     */
    static injectBricks(originalTasks: AtomicTask[], missingBricks: MissingBrick[], council?: CouncilProposal): AtomicTask[] {
        const result = [...originalTasks];

        // TASK 4: Determine default specialist from council
        const defaultSpecialist = council?.specialists?.[0]?.id;

        for (const brick of missingBricks) {
            const newTask: AtomicTask = {
                id: brick.id,
                title: `🔴 ${brick.title}`, // Mark as Saboteur-injected
                instruction: brick.instruction,
                domain: 'injected',
                complexity: brick.complexity,
                routingPath: brick.complexity >= 7 ? 'slow' : 'fast',
                estimatedTokens: 1500,
                dependencies: [],
                assignedSpecialist: defaultSpecialist, // TASK 4: Assign to Council Lead or undefined
                isAtomic: true,
                enabled: true
            };

            if (brick.insertAfter) {
                const insertIndex = result.findIndex(t => t.id === brick.insertAfter);
                if (insertIndex !== -1) {
                    result.splice(insertIndex + 1, 0, newTask);
                    continue;
                }
            }

            if (brick.insertBefore) {
                const insertIndex = result.findIndex(t => t.id === brick.insertBefore);
                if (insertIndex !== -1) {
                    result.splice(insertIndex, 0, newTask);
                    continue;
                }
            }

            // Default: add at end based on priority
            if (brick.priority === 'critical') {
                result.unshift(newTask); // Critical at start
            } else {
                result.push(newTask); // Others at end
            }
        }

        return result;
    }
}

/**
 * Factory function
 */
export function createSaboteur(ai: any, model: string): Saboteur {
    return new Saboteur(ai, model);
}

export default Saboteur;
