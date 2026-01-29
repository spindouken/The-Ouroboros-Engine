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
 */

import { extractWithPreference } from '../utils/safe-json';
import { AtomicTask, CouncilProposal } from '../prism-controller';
import { Constitution } from './genesis-protocol';

/**
 * Gap identified by the Saboteur
 */
export interface IdentifiedGap {
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
            const domainGaps = this.runDomainCompletenessCheck(tasks, constitution);
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
        const taskList = tasks.map((t, i) => `${i + 1}. [${t.id}] ${t.title}: ${t.instruction}`).join('\n');
        const constraintContext = constitution
            ? `Constraints: ${constitution.constraints.map(c => c.description).join(', ')}`
            : '';

        const prompt = `
You are THE SABOTEUR - a hostile Red Team agent. Your job is to BREAK this plan by finding what's missing.

USER'S ORIGINAL GOAL:
"""
${userGoal}
"""

PROJECT CONSTITUTION:
"""
Domain: ${constitution?.domain || 'Unknown'}
${constraintContext}
"""

PROPOSED TASK LIST:
"""
${taskList}
"""

YOUR MISSION: Find the GAPS. What's missing? What will cause this project to FAIL?

Think like an attacker:
1. What requirements did they forget?
2. What edge cases are unhandled?
3. What security holes exist?
4. What dependencies are assumed but not created?
5. What happens when things go wrong?

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
        constitution: Constitution | null
    ): IdentifiedGap[] {
        const gaps: IdentifiedGap[] = [];
        const domain = constitution?.domain?.toLowerCase() || 'general';

        // Determine which checklist to use
        let checklist = DOMAIN_CHECKLISTS['general'];
        for (const [key, items] of Object.entries(DOMAIN_CHECKLISTS)) {
            if (domain.includes(key) || key === 'general') {
                checklist = items;
                break;
            }
        }

        // Check which aspects are covered
        const taskText = tasks.map(t => `${t.title} ${t.instruction}`).join(' ').toLowerCase();

        for (const aspect of checklist) {
            const aspectPatterns = this.getAspectPatterns(aspect);
            const isCovered = aspectPatterns.some(pattern => taskText.includes(pattern));

            if (!isCovered) {
                gaps.push({
                    id: `domain_gap_${aspect.replace(/\s+/g, '_')}`,
                    severity: aspect === 'error handling' || aspect === 'security' ? 'major' : 'minor',
                    category: 'missing_requirement',
                    title: `Missing: ${aspect.charAt(0).toUpperCase() + aspect.slice(1)}`,
                    description: `The task list does not appear to cover "${aspect}" which is typically required for ${domain} projects.`,
                    affectedTasks: [],
                    suggestedFix: `Add a task to handle ${aspect}`
                });
            }
        }

        return gaps;
    }

    /**
     * Get search patterns for domain aspects
     */
    private getAspectPatterns(aspect: string): string[] {
        const patterns: Record<string, string[]> = {
            'authentication': ['auth', 'login', 'sign in', 'password', 'credential', 'jwt', 'oauth', 'session'],
            'authorization': ['permission', 'role', 'access control', 'rbac', 'authorize'],
            'error handling': ['error', 'exception', 'catch', 'try', 'failure', 'fallback'],
            'input validation': ['validat', 'sanitiz', 'schema', 'zod', 'yup', 'check input'],
            'logging': ['log', 'trace', 'debug', 'monitor', 'audit'],
            'testing': ['test', 'spec', 'jest', 'vitest', 'unit', 'integration', 'e2e'],
            'security': ['secur', 'encrypt', 'hash', 'csrf', 'xss', 'injection', 'https'],
            'documentation': ['document', 'readme', 'api doc', 'swagger', 'openapi'],
            'deployment': ['deploy', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'vercel', 'netlify'],
            'database': ['database', 'db', 'sql', 'postgres', 'mongo', 'redis', 'schema'],
            'api': ['api', 'endpoint', 'rest', 'graphql', 'route'],
            'frontend': ['ui', 'component', 'page', 'view', 'style', 'css', 'react', 'vue'],
            'rate limiting': ['rate limit', 'throttl', 'quota'],
            'monitoring': ['monitor', 'metric', 'alert', 'health check']
        };

        return patterns[aspect] || [aspect];
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

        // Filter to critical and major gaps only
        const significantGaps = gaps.filter(g => g.severity === 'critical' || g.severity === 'major');

        if (significantGaps.length === 0) {
            console.log('[Saboteur] No significant gaps - no bricks to inject.');
            return bricks;
        }

        // Generate bricks for each gap
        const prompt = `
You are THE SABOTEUR. You've identified gaps in a project plan. Now generate the MISSING TASKS to fill them.

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
                for (const brick of data) {
                    bricks.push({
                        ...brick,
                        id: brick.id || `missing_brick_${crypto.randomUUID().substring(0, 8)}`
                    });
                }
            }
        } catch (error) {
            console.error('[Saboteur] Failed to generate missing bricks:', error);

            // Fallback: generate simple bricks from gap suggestions
            for (const gap of significantGaps) {
                bricks.push({
                    id: `missing_brick_${gap.id}`,
                    title: gap.suggestedFix.substring(0, 50),
                    instruction: gap.suggestedFix,
                    priority: gap.severity === 'critical' ? 'critical' : 'high',
                    reason: gap.description,
                    complexity: 5
                });
            }
        }

        return bricks;
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
