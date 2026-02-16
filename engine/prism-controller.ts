/**
 * Dynamic Prism Controller (Section 3.3)
 * 
 * The Team Builder & Atomizer
 * 
 * Four-Step Process:
 * - Step A: Domain Classification - Analyze Constitution + User Prompt to determine domain
 * - Step B: Atomic Council Proposal (m=1) - Propose Council of Specialists + Atomic Questions
 * - Step C: Adaptive Routing (ACT) - Assign Complexity Scores and route to Fast/Slow paths
 * - Step D: User Review - Present tasks as toggleable UI elements
 * 
 * @module prism-controller
 * @version V2.99
 * 
 * █ ANCHOR 1: THE PRISM CONTROLLER
 * 1. Atomic Task Definition
 * 2. The Pipeline (A -> B -> C -> D)
 * 3. Atomicity Validation (Regex)
 */

import { AgentConfig, DecompositionStrategy, MicroTask, NodeStatus } from '../types';
import { safeJsonParseArray, safeJsonParseObject, extractYamlOrJson, safeYamlParse } from '../utils/safe-json';
import { Constitution, ProjectMode } from './genesis-protocol';

export interface PrismConfig {
    maxAtomicTasks?: number;
    maxCouncilSize?: number;
    maxDecompositionPasses: number;
    decompositionStrategy?: DecompositionStrategy;
    jsonRetryMode?: 'none' | 'all' | 'prompt';
}

/**
 * Atomic Task - A single-step question/task that is fully decomposed
 */
export interface AtomicTask {
    // █ ANCHOR 1.1: The Atomic Task Definition
    id: string;
    title: string;
    instruction: string;
    domain: string;
    complexity: number; // 1-10 scale
    routingPath: 'fast' | 'slow'; // ACT routing
    estimatedTokens: number;
    dependencies: string[];
    assignedSpecialist?: string;
    isAtomic: boolean; // Validated by atomicity check
    atomicityIssues?: string[]; // If not atomic, why
    enabled: boolean; // User can toggle OFF
}

/**
 * Council Proposal - The proposed team of specialists
 */
export interface CouncilProposal {
    domain: string;
    subDomain?: string;
    specialists: AgentConfig[];
    reasoning: string;
}

/**
 * Prism Analysis Result - Full output of the four-step process
 */
export interface PrismAnalysisResult {
    stepA: DomainClassificationResult;
    stepB: AtomicCouncilResult;
    stepC: AdaptiveRoutingResult;
    stepD: UserReviewData;
    success: boolean;
    errors: string[];
}

export interface DomainClassificationResult {
    domain: string;
    subDomain?: string;
    domainExpertise: string[];
    confidence: number;
}

export interface AtomicCouncilResult {
    council: CouncilProposal;
    atomicTasks: AtomicTask[];
    nonAtomicTasksRedecomposed: number;
    totalDecompositionPasses: number;
    telemetry?: {
        decompositionStrategy: DecompositionStrategy;
        totalIterations: number;
        maxDepthReached: number;
        stallCycles: number;
        stopReason: 'completed' | 'max_iterations' | 'stall_limit' | 'max_tasks';
        overlapReduced: number;
        rejectedSplits: number;
        modeDriftEvents: number;
    };
}

export interface AdaptiveRoutingResult {
    fastPathTasks: AtomicTask[];
    slowPathTasks: AtomicTask[];
    complexityDistribution: { low: number; medium: number; high: number };
    estimatedTotalTokens: number;
}

export interface UserReviewData {
    councilMembers: { agent: AgentConfig; enabled: boolean }[];
    tasks: { task: AtomicTask; enabled: boolean }[];
    estimatedTime: string;
    estimatedCost: string;
}

/**
 * Atomicity Validator Result
 */
export interface AtomicityValidation {
    isAtomic: boolean;
    issues: string[];
    suggestion?: string;
}

/**
 * Get mode-specific task examples for Prism task generation
 * 
 * Provides domain-appropriate task examples for each project mode
 * 
 * @param mode - The project mode (software, scientific_research, legal_research, creative_writing, general)
 * @returns String containing mode-specific task examples
 */
export function getModeSpecificTaskExamples(mode: ProjectMode): string {
    const examples: Record<ProjectMode, string> = {
        software: `
Example: "Define the Authentication Flow Architecture"
Deliverable: "JWT strategy specification with refresh token handling"
`,
        scientific_research: `
Example: "Conduct systematic literature review on [topic]"
Deliverable: "Annotated bibliography with thematic synthesis (20-30 sources)"
`,
        legal_research: `
Example: "Analyze precedent applicability for [case]"
Deliverable: "IRAC analysis memo with case citations and policy considerations"
`,
        creative_writing: `
Example: "Design Act II turning point sequence"
Deliverable: "Beat sheet with character motivation and structural impact analysis"
`,
        general: `
Example: "Analyze the core requirements for [goal]"
Deliverable: "Structured analysis with identified constraints and success criteria"
`
    };
    return examples[mode] || examples.general;
}

/**
 * Get mode-specific atomicity rules for Prism task generation
 * 
 * Provides domain-appropriate atomicity rules for each project mode
 * 
 * @param mode - The project mode (software, scientific_research, legal_research, creative_writing, general)
 * @returns String containing mode-specific atomicity rules
 */
export function getAtomicityRulesForMode(mode: ProjectMode): string {
    const rules: Record<ProjectMode, string> = {
        software: "Single architectural decision, single deliverable",
        scientific_research: "Single research question, single synthesis",
        legal_research: "Single legal issue, single IRAC analysis",
        creative_writing: "Single narrative beat, single structural element",
        general: "Single action, single deliverable"
    };
    return rules[mode] || rules.general;
}

/**
 * The Prism (Decomposition Controller) - V2.99
 * 
 * Responsible for:
 * 1. Domain Classification (Step A)
 * 2. Atomic Council Proposal with Atomicity Validation (Step B)
 * 3. Adaptive Complexity Routing (Step C)
 * 4. User Review Gate (Step D)
 */
export class PrismController {
    private failureCounts: Map<string, number> = new Map();
    private readonly MAX_FAILURES = 2;
    private readonly MAX_DECOMPOSITION_PASSES = 3;
    private readonly ATOMICITY_THRESHOLD = 0.8;

    /** V2.99: Track failed JSON parses for potential UI-driven retry */
    public failedJsonParses: Array<{
        nodeId: string;
        nodeName: string;
        rawOutput: string;
        timestamp: number;
    }> = [];
    private jsonRetryMode: 'none' | 'all' | 'prompt' = 'prompt';

    constructor() { }

    /**
     * Execute the full four-step Prism process
     * 
     * @param goal - The user's high-level goal
     * @param constitution - The Constitution from Genesis Protocol
     * @param ai - The LLM client
     * @param model - Model ID for Prism operations
     */
    async executeFullAnalysis(
        goal: string,
        constitution: Constitution | null,
        ai: any,
        model: string,
        config: PrismConfig = { maxCouncilSize: 5, maxDecompositionPasses: 3, decompositionStrategy: 'bounded', jsonRetryMode: 'prompt' }
    ): Promise<PrismAnalysisResult> {
        // █ ANCHOR 1.2: The Prism Pipeline (A->B->C->D)
        console.log('[Prism] Starting Four-Step Analysis...');
        this.jsonRetryMode = config.jsonRetryMode || 'prompt';

        const result: PrismAnalysisResult = {
            stepA: { domain: 'General', domainExpertise: [], confidence: 0 },
            stepB: { council: { domain: '', specialists: [], reasoning: '' }, atomicTasks: [], nonAtomicTasksRedecomposed: 0, totalDecompositionPasses: 0 },
            stepC: { fastPathTasks: [], slowPathTasks: [], complexityDistribution: { low: 0, medium: 0, high: 0 }, estimatedTotalTokens: 0 },
            stepD: { councilMembers: [], tasks: [], estimatedTime: '', estimatedCost: '' },
            success: false,
            errors: []
        };

        try {
            // Step A: Domain Classification
            console.log('[Prism] Step A: Domain Classification...');
            result.stepA = await this.stepA_DomainClassification(goal, constitution, ai, model);

            // Step B: Atomic Council Proposal
            console.log('[Prism] Step B: Atomic Council Proposal...');
            result.stepB = await this.stepB_AtomicCouncilProposal(goal, constitution, result.stepA, ai, model, config);

            // Step C: Adaptive Routing
            console.log('[Prism] Step C: Adaptive Routing...');
            result.stepC = this.stepC_AdaptiveRouting(result.stepB.atomicTasks);

            // Step D: Prepare User Review Data
            console.log('[Prism] Step D: Preparing User Review...');
            result.stepD = this.stepD_PrepareUserReview(result.stepB.council, result.stepC);

            result.success = true;
            console.log(`[Prism] Analysis complete. ${result.stepB.atomicTasks.length} atomic tasks generated.`);

        } catch (error: any) {
            console.error('[Prism] Analysis failed:', error);
            result.errors.push(error.message);
        }

        return result;
    }

    /**
     * Step A: Domain Classification
     * Analyze [Constitution + User Prompt] to determine specific domain
     */
    private async stepA_DomainClassification(
        goal: string,
        constitution: Constitution | null,
        ai: any,
        model: string
    ): Promise<DomainClassificationResult> {
        const result: DomainClassificationResult = {
            domain: 'General',
            domainExpertise: [],
            confidence: 0.5
        };

        try {
            const constitutionContext = constitution
                ? `Constitution Domain: ${constitution.domain}\nTech Stack: ${JSON.stringify(constitution.techStack)}\nConstraints: ${(constitution.constraints || []).map(c => c.description).join(', ')}`
                : 'No constitution provided.';

            const prompt = `
You are the DOMAIN CLASSIFIER for the Prism system.

USER GOAL:
"""
${goal}
"""

PROJECT CONTEXT:
"""
${constitutionContext}
"""

TASK: Determine the SPECIFIC domain of this project.

Examples of good domain classification:
- "Corporate Legal Contract Analysis" (not just "Legal")
- "Real-time Financial Trading Dashboard" (not just "Finance")
- "B2B SaaS Project Management Tool" (not just "Software")
- "Medical Image Classification ML Pipeline" (not just "Healthcare")

Return JSON:
{
    "domain": "Specific domain name",
    "subDomain": "Optional sub-category",
    "domainExpertise": ["specific_skill_1", "specific_skill_2", "specific_skill_3"],
    "confidence": 0.0 to 1.0,
    "reasoning": "Brief explanation"
}

Be SPECIFIC. Generic domains like "Software" or "Web" are failures.
`;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const parseResult = safeJsonParseObject<any>(response.text || '{}');

            if (parseResult.success && parseResult.data) {
                result.domain = parseResult.data.domain || 'General';
                result.subDomain = parseResult.data.subDomain;
                result.domainExpertise = parseResult.data.domainExpertise || [];
                result.confidence = parseResult.data.confidence || 0.5;
            }

            console.log(`[Prism:A] Domain: ${result.domain} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
            return result;

        } catch (error) {
            console.error('[Prism:A] Domain classification failed:', error);
            return result;
        }
    }

    /**
     * Step B: Atomic Council Proposal
     * Propose Council of Specialists + Break into Atomic Questions
     * Includes Atomicity Validator
     */
    private async stepB_AtomicCouncilProposal(
        goal: string,
        constitution: Constitution | null,
        domainResult: DomainClassificationResult,
        ai: any,
        model: string,
        config: PrismConfig
    ): Promise<AtomicCouncilResult> {
        const result: AtomicCouncilResult = {
            council: { domain: domainResult.domain, specialists: [], reasoning: '' },
            atomicTasks: [],
            nonAtomicTasksRedecomposed: 0,
            totalDecompositionPasses: 0
        };
        const mode = constitution?.mode || 'software';
        const decompositionStrategy = config.decompositionStrategy || 'bounded';
        const maxDepth = decompositionStrategy === 'fixpoint_recursive'
            ? Math.max(config.maxDecompositionPasses, 6)
            : config.maxDecompositionPasses;
        const maxTotalTasks = config.maxAtomicTasks ?? Number.MAX_SAFE_INTEGER;
        const maxIterations = decompositionStrategy === 'fixpoint_recursive' ? 400 : 150;
        const stallLimit = decompositionStrategy === 'fixpoint_recursive' ? 8 : 4;

        try {
            // First, generate the council
            result.council = await this.generateCouncil(goal, domainResult, ai, model, config.maxCouncilSize, mode);

            // Then, generate initial task decomposition
            let tasks = await this.generateAtomicTasks(goal, domainResult, constitution, result.council, ai, model, config.maxAtomicTasks, 0.5);
            console.log('[Prism:B] Task count after initial generation:', tasks.length);
            let generationPasses = 1;

            // Handle empty task array with retry
            if (tasks.length === 0) {
                console.warn('[Prism:B] [WARN] ZERO tasks generated. Attempting retry with higher temperature...');
                tasks = await this.generateAtomicTasks(goal, domainResult, constitution, result.council, ai, model, config.maxAtomicTasks, 0.8);
                console.log('[Prism:B] Retry task count (temp=0.8):', tasks.length);
                generationPasses++;

                // If still empty, generate fallback tasks based on the goal
                if (tasks.length === 0) {
                    console.warn('[Prism:B] [WARN] Retry failed. Generating fallback tasks from goal...');
                    tasks = this.generateFallbackTasks(goal, domainResult, result.council, constitution?.mode || 'software');
                    console.log('[Prism:B] Fallback task count:', tasks.length);
                }
            }

            result.totalDecompositionPasses = generationPasses;

            // Queue-driven decomposition with stop conditions
            type QueueItem = { task: AtomicTask; depth: number };
            const queue: QueueItem[] = tasks.map(task => ({ task, depth: 0 }));
            let nonAtomicCount = 0;
            const atomicTasks: AtomicTask[] = [];
            let iterations = 0;
            let stallCycles = 0;
            let maxDepthReached = 0;
            let rejectedSplits = 0;
            let modeDriftEvents = 0;
            let stopReason: 'completed' | 'max_iterations' | 'stall_limit' | 'max_tasks' = 'completed';

            while (queue.length > 0 && iterations < maxIterations) {
                iterations++;

                if (atomicTasks.length >= maxTotalTasks) {
                    console.warn(`[Prism:B] Reached max task budget (${maxTotalTasks}). Stopping decomposition.`);
                    stopReason = 'max_tasks';
                    break;
                }

                const current = queue.shift()!;
                maxDepthReached = Math.max(maxDepthReached, current.depth);
                const validation = this.validateAtomicity(current.task);
                current.task.isAtomic = validation.isAtomic;
                current.task.atomicityIssues = validation.isAtomic ? undefined : validation.issues;

                if (validation.isAtomic) {
                    atomicTasks.push(current.task);
                    continue;
                }

                nonAtomicCount++;

                const canRedecompose =
                    decompositionStrategy !== 'off' &&
                    current.depth < maxDepth &&
                    result.totalDecompositionPasses < maxIterations;

                if (!canRedecompose) {
                    atomicTasks.push(current.task);
                    continue;
                }

                const parentScore = this.scoreAtomicity(current.task, validation);
                const subTasks = await this.redecomposeTask(current.task, ai, model);
                result.totalDecompositionPasses++;

                if (subTasks.length === 0) {
                    stallCycles++;
                    atomicTasks.push(current.task);
                    if (stallCycles >= stallLimit) {
                        console.warn(`[Prism:B] Stall limit reached (${stallLimit}). Ending decomposition loop.`);
                        stopReason = 'stall_limit';
                        break;
                    }
                    continue;
                }

                const scoredSubTasks = subTasks.map((subTask) => {
                    const subValidation = this.validateAtomicity(subTask);
                    subTask.isAtomic = subValidation.isAtomic;
                    subTask.atomicityIssues = subValidation.isAtomic ? undefined : subValidation.issues;
                    return {
                        task: subTask,
                        score: this.scoreAtomicity(subTask, subValidation)
                    };
                });

                const inModeSubTasks = scoredSubTasks.filter((item) => {
                    if (this.detectModeDrift(item.task, mode)) {
                        modeDriftEvents++;
                        rejectedSplits++;
                        return false;
                    }
                    return true;
                });

                if (inModeSubTasks.length === 0) {
                    stallCycles++;
                    atomicTasks.push(current.task);
                    if (stallCycles >= stallLimit) {
                        stopReason = 'stall_limit';
                        console.warn(`[Prism:B] Stall limit reached (${stallLimit}) after mode-drift filtering.`);
                        break;
                    }
                    continue;
                }

                const averageSubScore = inModeSubTasks.reduce((sum, item) => sum + item.score, 0) / inModeSubTasks.length;
                const improved =
                    averageSubScore >= parentScore + 0.05 ||
                    inModeSubTasks.some(item => item.score >= parentScore + 0.1);

                if (!improved && decompositionStrategy !== 'fixpoint_recursive') {
                    stallCycles++;
                    rejectedSplits++;
                    atomicTasks.push(current.task);
                    if (stallCycles >= stallLimit) {
                        console.warn(`[Prism:B] Stall limit reached (${stallLimit}) without score improvement.`);
                        stopReason = 'stall_limit';
                        break;
                    }
                    continue;
                }

                stallCycles = improved ? 0 : stallCycles + 1;
                if (stallCycles >= stallLimit) {
                    console.warn(`[Prism:B] Stall limit reached (${stallLimit}) in fixpoint mode. Stopping decomposition.`);
                    atomicTasks.push(current.task);
                    rejectedSplits++;
                    stopReason = 'stall_limit';
                    break;
                }

                for (const sub of inModeSubTasks) {
                    if (atomicTasks.length + queue.length >= maxTotalTasks) {
                        break;
                    }
                    queue.push({ task: sub.task, depth: current.depth + 1 });
                }
            }

            if (iterations >= maxIterations && queue.length > 0) {
                stopReason = 'max_iterations';
                console.warn(`[Prism:B] Hit max decomposition iterations (${maxIterations}).`);
            }

            if (queue.length > 0) {
                console.warn(`[Prism:B] Committing ${queue.length} remaining queued tasks as-is.`);
                while (queue.length > 0 && atomicTasks.length < maxTotalTasks) {
                    const pending = queue.shift()!;
                    if (pending.task.isAtomic === undefined) {
                        const pendingValidation = this.validateAtomicity(pending.task);
                        pending.task.isAtomic = pendingValidation.isAtomic;
                        pending.task.atomicityIssues = pendingValidation.isAtomic ? undefined : pendingValidation.issues;
                    }
                    atomicTasks.push(pending.task);
                }
            }

            const optimizedTasks = this.optimizeTaskAdjacency(atomicTasks);
            if (optimizedTasks.length !== atomicTasks.length) {
                console.log(`[Prism:B] Post-processing reduced overlap: ${atomicTasks.length} -> ${optimizedTasks.length} tasks.`);
            }

            result.atomicTasks = optimizedTasks;
            result.nonAtomicTasksRedecomposed = nonAtomicCount;
            result.telemetry = {
                decompositionStrategy,
                totalIterations: iterations,
                maxDepthReached,
                stallCycles,
                stopReason,
                overlapReduced: Math.max(0, atomicTasks.length - optimizedTasks.length),
                rejectedSplits,
                modeDriftEvents
            };

            console.log(`[Prism:B] Generated ${optimizedTasks.length} tasks. Re-decomposed ${nonAtomicCount} non-atomic tasks.`);
            return result;

        } catch (error) {
            console.error('[Prism:B] Council proposal failed:', error);
            return result;
        }
    }

    /**
     * Generate Council of Specialists for the domain
     */
    private async generateCouncil(
        goal: string,
        domainResult: DomainClassificationResult,
        ai: any,
        model: string,
        maxCouncilSize?: number,
        mode: ProjectMode = 'software'
    ): Promise<CouncilProposal> {
        const limitConstraint = maxCouncilSize
            ? `Generate up to ${maxCouncilSize} specialists (minimum 1, maximum ${maxCouncilSize})`
            : `Generate as many specialists as needed (typically 3-10)`;
        const modeSpecificGuidance = this.getCouncilGuidanceForMode(mode);
        const planningArtifactType = mode === 'software'
            ? 'architecture specifications'
            : 'domain-appropriate planning specifications';

        const prompt = `
You are The Prism. Generate a CUSTOM Council of Specialists for this specific domain.

DOMAIN: ${domainResult.domain}
SUB-DOMAIN: ${domainResult.subDomain || 'N/A'}
REQUIRED EXPERTISE: ${domainResult.domainExpertise.join(', ')}
PROJECT MODE: ${mode}

GOAL: "${goal}"

## CRITICAL ROLE DESIGN RULES

Each specialist must produce ${planningArtifactType} with rationale, not implementation or final product output.
${modeSpecificGuidance}

${limitConstraint} with HYPER-SPECIFIC roles for this domain.

BAD EXAMPLE: "Backend Developer" (too generic, implies coding)
GOOD EXAMPLE: "Authentication Flow Architect" (specific, implies design)

Return JSON:
{
    "domain": "${domainResult.domain}",
    "specialists": [
        {
            "id": "snake_case_id",
            "role": "Specific Role Title (Max 5 words)",
            "persona": "Detailed system prompt with expertise and Anti-Conformity stance",
            "capabilities": ["specific_capability"],
            "temperature": 0.2 to 0.8
        }
    ],
    "reasoning": "Why this team composition"
}
`;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        const parseResult = safeJsonParseObject<CouncilProposal>(response.text || '{}');

        if (parseResult.success && parseResult.data) {
            return parseResult.data;
        }

        // Fallback council
        return {
            domain: domainResult.domain,
            specialists: [
                {
                    id: 'domain_expert',
                    role: `${domainResult.domain} Expert`,
                    persona: `You are a senior expert in ${domainResult.domain}.`,
                    capabilities: ['analysis', 'planning'],
                    temperature: 0.5
                }
            ],
            reasoning: 'Fallback council generated due to LLM error.'
        };
    }

    private getCouncilGuidanceForMode(mode: ProjectMode): string {
        const guidance: Record<ProjectMode, string> = {
            software: `
- Example role shape: "Authentication Flow Architect", "Data Contract Analyst", "Reliability Architect"
- Forbidden role shape: "Backend Developer", "Frontend Coder", "Full Stack Engineer"
- Output focus: architecture decisions, contracts, constraints, and validation criteria.`,
            scientific_research: `
- Example role shape: "Literature Synthesis Lead", "Methodology Designer", "Evidence Quality Analyst"
- Forbidden role shape: "App Developer", "API Engineer", "DevOps Specialist" unless software implementation is explicitly requested.
- Output focus: hypotheses, evidence synthesis plans, methods, limitations, and reproducibility strategy.`,
            legal_research: `
- Example role shape: "Issue Framing Analyst", "Precedent Mapper", "Citation Verifier"
- Forbidden role shape: "Legal Advisor", "Counsel for Client", "Software Engineer" unless explicitly requested.
- Output focus: issue/rule mapping, precedent analysis, citation integrity, and jurisdiction checks.`,
            creative_writing: `
- Example role shape: "Beat Structure Architect", "Character Arc Planner", "Theme Cohesion Analyst"
- Forbidden role shape: "Novelist", "Dialogue Writer", "Screenplay Author" when generating full prose/dialogue.
- Output focus: narrative structure, scene purpose, arc consistency, and thematic alignment.`,
            general: `
- Example role shape: "Scope Analyst", "Constraint Planner", "Validation Strategist"
- Forbidden role shape: generic implementation/coding roles unless explicitly requested.
- Output focus: scope framing, decision quality, verification, and delivery structure.`
        };

        return guidance[mode] || guidance.general;
    }

    /**
     * Generate Atomic Tasks from the goal
     * @param customTemperature - Optional temperature override for retry attempts
     */
    /**
     * Generate Atomic Tasks from the goal (V2.99 ReCAP Enhanced)
     * @param customTemperature - Optional temperature override for retry attempts
     * @param parentContext - Optional context from parent node for recursive decomposition
     */
    public async generateAtomicTasks(
        goal: string,
        domainResult: DomainClassificationResult,
        constitution: Constitution | null,
        council: CouncilProposal,
        ai: any,
        model: string,
        maxTasks?: number,
        customTemperature: number = 0.5,
        parentContext?: {
            instruction: string;
            depth: number;
            siblings?: string[];
        }
    ): Promise<AtomicTask[]> {
        const constraintContext = constitution
            ? `Constraints: ${(constitution.constraints || []).map(c => c.description).join(', ')}`
            : '';

        // Extract mode from Constitution (default to 'software' for backward compatibility)
        const mode = constitution?.mode || 'software';
        
        const isRecursive = !!parentContext;
        const depthIndicator = isRecursive ? `(Recursion Level ${parentContext?.depth})` : '(Root Level)';

        const limitConstraint = maxTasks
            ? `**TASK LIMIT:** Generate up to ${maxTasks} tasks. Do NOT exceed ${maxTasks} unless absolutely critical.`
            : `**DO NOT limit the number of tasks.** Generate as many as required to fully satisfy the goal.`;

        // Get mode-specific prompt content
        const modeSpecificTaskExamples = getModeSpecificTaskExamples(mode);
        const atomicityRules = getAtomicityRulesForMode(mode);
        const completenessGuidance = this.getCompletenessGuidanceForMode(mode);

        // STOP 1.4:V2.99 Soft-Strict Protocol: "Think then Commit" pattern
        // Agent reasons in Markdown, then commits structured data in YAML
        const prompt = `# PRISM ATOMIZER PROTOCOL (V2.99 Soft-Strict) ${depthIndicator}

You are The Prism's ATOMIZER. Your job is to break down this goal into ATOMIC single-step tasks.

---

## PROJECT CONTEXT

**DOMAIN:** ${domainResult.domain}
**PROJECT MODE:** ${mode}
**GOAL:** "${goal}"
${constraintContext ? `**${constraintContext}**` : ''}

${isRecursive ? `
**⚠️ RECURSIVE CONTEXT (This is a sub-epic of a larger system):**
**Parent Instruction:** "${parentContext?.instruction}"
**Sibling Nodes (Avoid Overlap):** ${parentContext?.siblings?.join(', ') || 'None'}
` : ''}

**COUNCIL MEMBERS (Assign tasks to these specialists):**
${(council.specialists || []).map(s => `- \`${s.id}\`: ${s.role}`).join('\n')}

---

## 🔴 CRITICAL CONSTRAINTS

1. **NOT A CODING AGENT** - These are ${mode === 'software' ? 'ARCHITECTURAL PLANNING' : 'DOMAIN-APPROPRIATE PLANNING'} tasks, not implementation.
2. **ATOMICTY RULES:**
   - ${atomicityRules}
   - ONE primary action verb per task (Specify, Design, Define, Analyze, Document)
   - ONE clear deliverable per task
   
   3. **COMPLETENESS (The "Soul" Rule):**
      - ${isRecursive ? 'Explode this Epic into EVERY necessary sub-component.' : 'Decompose into the SMALLEST independently completable atomic tasks needed to satisfy the goal.'}
      - ${limitConstraint}
      - ${completenessGuidance}

---

## MODE-SPECIFIC TASK EXAMPLE

${modeSpecificTaskExamples}

---

## YOUR RESPONSE FORMAT

**STEP 1: THINK (Markdown reasoning)**
First, analyze the goal and explain your decomposition strategy.

**STEP 2: COMMIT (YAML block)**
After your reasoning, output a \`\`\`yaml block with the task list:

\`\`\`yaml
tasks:
  - id: snake_case_id
    title: Short task title
    instruction: Detailed single-step instruction
    domain: ${domainResult.domain}
    complexity: 5
    estimatedTokens: 1000
    dependencies: []
    assignedSpecialist: specialist_id_from_council
  - ...
\`\`\`

Begin your response with your THINKING, then end with the YAML commit block:`;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { temperature: customTemperature }
        });

        // TASK 1: Debug logging for raw LLM response
        console.log('[Prism] Raw LLM response for atomic tasks:', response.text?.substring(0, 500));

        if (!response.text) {
            console.log('[Prism] Empty response from LLM for Atomic Tasks.');
            return [];
        }

        // V2.99 Soft-Strict Protocol: Try YAML first, then JSON fallback
        let tasks: any[] = [];

        // Strategy 1: Extract YAML block
        const yamlResult = safeYamlParse<{ tasks?: any[] }>(response.text, null);
        if (yamlResult.success && yamlResult.data?.tasks && Array.isArray(yamlResult.data.tasks)) {
            console.log('[Prism:SoftStrict] Successfully extracted YAML tasks');
            tasks = yamlResult.data.tasks;
        } else {
            // Strategy 2: JSON fallback (for backward compatibility)
            console.log('[Prism:SoftStrict] YAML extraction failed, trying JSON fallback...');
            const parseResult = safeJsonParseArray<any>(response.text);

            if (parseResult.success && parseResult.data) {
                console.log('[Prism:SoftStrict] Successfully extracted JSON tasks (fallback)');
                tasks = parseResult.data;
            } else {
                // Strategy 3: Try to extract tasks array from JSON object
                const objResult = safeJsonParseObject<{ tasks?: any[] }>(response.text);
                if (objResult.success && objResult.data?.tasks && Array.isArray(objResult.data.tasks)) {
                    console.log('[Prism:SoftStrict] Successfully extracted JSON object with tasks property');
                    tasks = objResult.data.tasks;
                } else {
                    console.warn('[Prism] Failed to parse Atomic Tasks (YAML and JSON):', yamlResult.error);
                    console.warn('[Prism] Raw Output:', response.text.substring(0, 200) + '...');

                    if (this.jsonRetryMode === 'all') {
                        const retryResult = await this.retryWithExplicitJson(response.text, ai, model, domainResult);
                        if (retryResult.success && retryResult.data.length > 0) {
                            console.log('[Prism] Auto JSON retry succeeded.');
                            return retryResult.data;
                        }
                        console.warn('[Prism] Auto JSON retry failed.');
                    } else if (this.jsonRetryMode === 'prompt') {
                        // V2.99: Store failed parse info for UI-driven retry
                        this.failedJsonParses.push({
                            nodeId: 'prism_atomic_tasks',
                            nodeName: 'Atomic Task Generation',
                            rawOutput: response.text,
                            timestamp: Date.now()
                        });
                        console.warn('[Prism] Parse failed. Stored for potential retry via UI.');
                    } else {
                        console.warn('[Prism] Parse failed. jsonRetryMode=none, skipping retry and continuing to fallback.');
                    }
                }
            }
        }

        if (tasks.length > 0) {
            return tasks.map((t: any) => ({
                id: t.id || crypto.randomUUID().substring(0, 8),
                title: t.title,
                instruction: t.instruction,
                domain: t.domain || domainResult.domain,
                complexity: t.complexity || 5,
                routingPath: (t.complexity || 5) >= 7 ? 'slow' : 'fast',
                estimatedTokens: t.estimatedTokens || 1000,
                dependencies: t.dependencies || [],
                assignedSpecialist: t.assignedSpecialist,
                isAtomic: true, // Will be validated
                enabled: true
            }));
        }

        return [];
    }

    private getCompletenessGuidanceForMode(mode: ProjectMode): string {
        const guidance: Record<ProjectMode, string> = {
            software: 'If this is a complex feature (for example: authentication), decompose into architecture-level parts such as auth strategy, user data model, API contract coverage, recovery flows, and validation approach.',
            scientific_research: 'If this is a complex research topic, decompose into literature scope, hypothesis framing, methodology design, analysis plan, limitations, and reproducibility checks.',
            legal_research: 'If this is a complex legal matter, decompose into issue framing, governing rule set, precedent mapping, counterargument analysis, jurisdiction checks, and citation verification.',
            creative_writing: 'If this is a complex narrative goal, decompose into premise articulation, character arcs, act-level beats, turning points, climax design, and resolution integrity.',
            general: 'If this is a complex goal, decompose into requirements, assumptions, dependencies, risk checks, and validation criteria.'
        };
        return guidance[mode] || guidance.general;
    }

    /**
     * Generate fallback tasks when LLM generation fails completely
     * Creates basic tasks based on goal analysis
     */
    private generateFallbackTasks(
        goal: string,
        domainResult: DomainClassificationResult,
        council: CouncilProposal,
        mode: ProjectMode
    ): AtomicTask[] {
        console.log('[Prism:B] Generating fallback tasks from goal analysis...');

        // Extract key action phrases from the goal
        const goalLower = goal.toLowerCase();
        const fallbackTasks: AtomicTask[] = [];
        const defaultSpecialist = council.specialists[0]?.id || 'domain_expert';

        const pushTask = (
            id: string,
            title: string,
            instruction: string,
            complexity: number,
            dependencies: string[] = []
        ) => {
            fallbackTasks.push({
                id,
                title,
                instruction,
                domain: domainResult.domain,
                complexity,
                routingPath: complexity >= 7 ? 'slow' : 'fast',
                estimatedTokens: 1000 + (complexity * 100),
                dependencies,
                assignedSpecialist: defaultSpecialist,
                isAtomic: true,
                enabled: true
            });
        };

        pushTask(
            'fallback_requirements',
            'Define Core Requirements',
            `Analyze the following goal and extract the core requirements: "${goal.substring(0, 200)}"`,
            3
        );

        if (mode === 'software') {
            pushTask(
                'fallback_architecture',
                'Design System Architecture',
                `Based on the goal "${goal.substring(0, 120)}", outline the architecture modules and interface boundaries.`,
                5,
                ['fallback_requirements']
            );
            pushTask(
                'fallback_plan',
                'Create Implementation Roadmap',
                `Create an architecture-first implementation roadmap for: "${goal.substring(0, 150)}"`,
                4,
                ['fallback_architecture']
            );

            if (goalLower.includes('api') || goalLower.includes('endpoint') || goalLower.includes('backend')) {
                pushTask(
                    'fallback_api_design',
                    'Define API Contract Coverage',
                    'Define endpoint contracts, request/response schemas, and authentication boundaries.',
                    5,
                    ['fallback_architecture']
                );
            }
            if (goalLower.includes('ui') || goalLower.includes('frontend') || goalLower.includes('interface') || goalLower.includes('page')) {
                pushTask(
                    'fallback_ui_design',
                    'Define Interface Specification',
                    'Define the major interface flows and component-level specifications.',
                    4,
                    ['fallback_architecture']
                );
            }
            if (goalLower.includes('database') || goalLower.includes('data') || goalLower.includes('store')) {
                pushTask(
                    'fallback_data_model',
                    'Define Data Model',
                    'Define the data entities, relationships, and persistence constraints.',
                    5,
                    ['fallback_requirements']
                );
            }
        } else if (mode === 'scientific_research') {
            pushTask(
                'fallback_literature',
                'Define Literature Review Scope',
                'Define search terms, inclusion/exclusion criteria, and source-quality thresholds.',
                5,
                ['fallback_requirements']
            );
            pushTask(
                'fallback_methodology',
                'Design Methodology Framework',
                'Design methodology, evidence standards, and reproducibility controls for the research plan.',
                6,
                ['fallback_literature']
            );
            pushTask(
                'fallback_analysis',
                'Define Analysis Plan',
                'Define analysis techniques, expected limitations, and validation strategy.',
                5,
                ['fallback_methodology']
            );
        } else if (mode === 'legal_research') {
            pushTask(
                'fallback_issue_framing',
                'Frame Legal Issues',
                'Frame the primary legal issues and governing legal questions.',
                5,
                ['fallback_requirements']
            );
            pushTask(
                'fallback_precedent',
                'Map Governing Precedents',
                'Map controlling and persuasive authorities with jurisdiction relevance.',
                6,
                ['fallback_issue_framing']
            );
            pushTask(
                'fallback_irac',
                'Draft IRAC Structure',
                'Draft an IRAC-aligned analysis structure with citation checkpoints.',
                5,
                ['fallback_precedent']
            );
        } else if (mode === 'creative_writing') {
            pushTask(
                'fallback_premise',
                'Define Narrative Premise',
                'Define premise, genre expectations, and central thematic intent.',
                4,
                ['fallback_requirements']
            );
            pushTask(
                'fallback_structure',
                'Design Story Structure',
                'Design act-level structure, key turning points, and pacing targets.',
                5,
                ['fallback_premise']
            );
            pushTask(
                'fallback_character_arcs',
                'Map Character Arcs',
                'Map protagonist and antagonist arc trajectories across the planned structure.',
                5,
                ['fallback_structure']
            );
        } else {
            pushTask(
                'fallback_scope',
                'Define Scope Boundaries',
                'Define in-scope vs out-of-scope boundaries and critical assumptions.',
                4,
                ['fallback_requirements']
            );
            pushTask(
                'fallback_validation',
                'Define Validation Criteria',
                'Define measurable success criteria and a validation approach.',
                4,
                ['fallback_scope']
            );
        }

        console.log(`[Prism:B] Generated ${fallbackTasks.length} fallback tasks.`);
        return fallbackTasks;
    }

    /**
     * ATOMICITY VALIDATOR
     * Validates that a task has a single primary action and clear deliverable
     */
    validateAtomicity(task: AtomicTask): AtomicityValidation {
        // █ ANCHOR 1.3: Atomicity Validator (Regex Heuristics)
        const result: AtomicityValidation = {
            isAtomic: true,
            issues: []
        };

        const text = `${task.title} ${task.instruction}`.toLowerCase();

        // Check 1: Multiple action verbs
        const actionVerbs = [
            'create', 'build', 'implement', 'define', 'design', 'write', 'develop',
            'set up', 'configure', 'add', 'update', 'modify', 'delete', 'remove',
            'validate', 'verify', 'test', 'check', 'review', 'analyze', 'evaluate',
            'deploy', 'publish', 'release', 'integrate', 'connect', 'migrate'
        ];

        const foundVerbs: string[] = [];
        for (const verb of actionVerbs) {
            // Match word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${verb}\\b`, 'i');
            if (regex.test(text)) {
                foundVerbs.push(verb);
            }
        }

        if (foundVerbs.length > 2) {
            result.isAtomic = false;
            result.issues.push(`Multiple actions detected: ${foundVerbs.join(', ')}`);
        }

        // Check 2: Compound conjunctions
        const compoundPatterns = [
            /\band\b.*\b(create|build|implement|add|update)\b/i,
            /\b(create|build|implement)\b.*\band\b.*\b(validate|test|verify)\b/i,
            /\bthen\b/i,
            /\bafter that\b/i,
            /\bfollowed by\b/i
        ];

        for (const pattern of compoundPatterns) {
            if (pattern.test(text)) {
                result.isAtomic = false;
                result.issues.push('Compound task detected (multiple sequential actions)');
                break;
            }
        }

        // Check 3: Vague/broad scope
        const vaguePatterns = [
            /\bhandle\s+(all|any|various|different)\b/i,
            /\bset\s*up\s+(the\s+)?project\b/i,
            /\bbuild\s+(the\s+)?(entire|whole|complete)\b/i,
            /\b(everything|anything)\b/i,
            /\betc\.?\b/i,
            /\band\s+more\b/i
        ];

        for (const pattern of vaguePatterns) {
            if (pattern.test(text)) {
                result.isAtomic = false;
                result.issues.push('Vague or overly broad scope');
                break;
            }
        }

        // Check 4: Task length heuristic (too long = probably not atomic)
        if (task.instruction.length > 500) {
            result.isAtomic = false;
            result.issues.push('Instruction too long - likely needs decomposition');
        }

        // Generate suggestion if not atomic
        if (!result.isAtomic) {
            result.suggestion = `Consider splitting into ${Math.ceil(foundVerbs.length / 2)} separate tasks, each with one primary action.`;
        }

        return result;
    }

    /**
     * Atomicity score in [0,1], used as a decomposition progress gate.
     * Higher score means tighter, more independently completable task shape.
     */
    private scoreAtomicity(task: AtomicTask, validation?: AtomicityValidation): number {
        const checked = validation || this.validateAtomicity(task);
        let score = checked.isAtomic ? 1 : 0.7;

        score -= Math.min(0.45, checked.issues.length * 0.15);

        const instructionLength = task.instruction?.length || 0;
        if (instructionLength > 220) {
            score -= Math.min(0.2, (instructionLength - 220) / 700);
        }

        if ((task.dependencies || []).length > 2) {
            score -= Math.min(0.1, ((task.dependencies || []).length - 2) * 0.04);
        }

        if ((task.title || '').length > 90) {
            score -= 0.05;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Reduce overlap and improve constructive ordering across atomic tasks.
     */
    private optimizeTaskAdjacency(tasks: AtomicTask[]): AtomicTask[] {
        if (tasks.length <= 1) {
            return tasks;
        }

        const clones = tasks.map(task => ({
            ...task,
            dependencies: [...(task.dependencies || [])]
        }));

        const keyToIndex = new Map<string, number>();
        const droppedIds = new Map<string, string>();
        const kept: AtomicTask[] = [];

        for (const task of clones) {
            const key = this.normalizeTaskText(`${task.title} ${task.instruction}`);
            const existingIndex = keyToIndex.get(key);

            if (existingIndex === undefined) {
                keyToIndex.set(key, kept.length);
                kept.push(task);
                continue;
            }

            const existing = kept[existingIndex];
            const existingScore = this.scoreAtomicity(existing);
            const candidateScore = this.scoreAtomicity(task);
            const keepCandidate = candidateScore > existingScore ? task : existing;
            const dropped = keepCandidate.id === existing.id ? task : existing;
            kept[existingIndex] = keepCandidate;
            droppedIds.set(dropped.id, keepCandidate.id);
        }

        // Near-duplicate reduction
        const reduced: AtomicTask[] = [];
        for (const task of kept) {
            let merged = false;
            for (let i = 0; i < reduced.length; i++) {
                const overlap = this.taskTextOverlap(task, reduced[i]);
                if (overlap >= 0.9) {
                    const existing = reduced[i];
                    const keepCandidate = this.scoreAtomicity(task) > this.scoreAtomicity(existing) ? task : existing;
                    const dropped = keepCandidate.id === existing.id ? task : existing;
                    reduced[i] = keepCandidate;
                    droppedIds.set(dropped.id, keepCandidate.id);
                    merged = true;
                    break;
                }
            }

            if (!merged) {
                reduced.push(task);
            }
        }

        const validTaskIds = new Set(reduced.map(task => task.id));
        for (const task of reduced) {
            const remappedDependencies = (task.dependencies || [])
                .map(dep => droppedIds.get(dep) || dep)
                .filter(dep => dep !== task.id && validTaskIds.has(dep));
            task.dependencies = Array.from(new Set(remappedDependencies));
        }

        return this.orderTasksForSynergy(reduced);
    }

    private orderTasksForSynergy(tasks: AtomicTask[]): AtomicTask[] {
        if (tasks.length <= 1) {
            return tasks;
        }

        const byId = new Map(tasks.map(task => [task.id, task]));
        const indegree = new Map<string, number>();
        const outgoing = new Map<string, string[]>();

        for (const task of tasks) {
            indegree.set(task.id, 0);
            outgoing.set(task.id, []);
        }

        for (const task of tasks) {
            for (const dep of task.dependencies || []) {
                if (!byId.has(dep)) continue;
                outgoing.get(dep)!.push(task.id);
                indegree.set(task.id, (indegree.get(task.id) || 0) + 1);
            }
        }

        const queue = tasks
            .filter(task => (indegree.get(task.id) || 0) === 0)
            .sort((a, b) => this.getSynergyPriority(a) - this.getSynergyPriority(b));
        const ordered: AtomicTask[] = [];

        while (queue.length > 0) {
            const task = queue.shift()!;
            ordered.push(task);

            for (const childId of outgoing.get(task.id) || []) {
                const nextIndegree = (indegree.get(childId) || 0) - 1;
                indegree.set(childId, nextIndegree);
                if (nextIndegree === 0) {
                    const child = byId.get(childId);
                    if (child) queue.push(child);
                }
            }

            queue.sort((a, b) => this.getSynergyPriority(a) - this.getSynergyPriority(b));
        }

        if (ordered.length < tasks.length) {
            const remaining = tasks
                .filter(task => !ordered.some(existing => existing.id === task.id))
                .sort((a, b) => this.getSynergyPriority(a) - this.getSynergyPriority(b));
            ordered.push(...remaining);
        }

        return ordered;
    }

    private getSynergyPriority(task: AtomicTask): number {
        const text = `${task.title} ${task.instruction}`.toLowerCase();
        const foundationPatterns = ['requirement', 'scope', 'constraint', 'assumption', 'validation', 'methodology', 'issue framing'];
        const foundationBias = foundationPatterns.some(pattern => text.includes(pattern)) ? -2 : 0;
        return (task.dependencies?.length || 0) * 5 + (task.complexity || 5) + foundationBias;
    }

    private taskTextOverlap(a: AtomicTask, b: AtomicTask): number {
        const setA = new Set(this.normalizeTaskText(`${a.title} ${a.instruction}`).split(' ').filter(Boolean));
        const setB = new Set(this.normalizeTaskText(`${b.title} ${b.instruction}`).split(' ').filter(Boolean));
        if (setA.size === 0 || setB.size === 0) {
            return 0;
        }

        let intersection = 0;
        for (const token of setA) {
            if (setB.has(token)) intersection++;
        }

        const union = setA.size + setB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    private normalizeTaskText(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private detectModeDrift(task: AtomicTask, mode: ProjectMode): boolean {
        if (mode === 'software') {
            return false;
        }

        const text = `${task.title} ${task.instruction}`.toLowerCase();
        const softwareMarkers = [
            /\bapi\b/,
            /\bendpoint\b/,
            /\bdatabase\b/,
            /\bschema\b/,
            /\breact\b/,
            /\btypescript\b/,
            /\bjavascript\b/,
            /\bbackend\b/,
            /\bfrontend\b/,
            /\bmiddleware\b/,
            /\bdevops\b/,
            /\bdeploy(ment)?\b/,
            /\bcode\b/,
            /\bclass\b/,
            /\bfunction\b/
        ];

        return softwareMarkers.some((pattern) => pattern.test(text));
    }

    /**
     * Re-decompose a non-atomic task into smaller atomic tasks
     */
    private async redecomposeTask(task: AtomicTask, ai: any, model: string): Promise<AtomicTask[]> {
        const prompt = `
The following task was flagged as NON-ATOMIC because it contains multiple actions.

NON-ATOMIC TASK:
Title: "${task.title}"
Instruction: "${task.instruction}"
Issues: ${task.atomicityIssues?.join(', ') || 'Multiple actions detected'}

BREAK THIS INTO 2-4 TRULY ATOMIC SUB-TASKS.

Each sub-task must:
1. Have ONE action verb only
2. Have ONE clear deliverable
3. Be independently completable

Return JSON array:
[
    {
        "id": "subtask_1",
        "title": "Single action title",
        "instruction": "Single step instruction",
        "complexity": 1-10,
        "estimatedTokens": 500-2000,
        "dependencies": []
    }
]
`;

        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const parseResult = safeJsonParseArray<any>(response.text || '[]');

            if (parseResult.success && parseResult.data) {
                return parseResult.data.map((t: any, i: number) => ({
                    id: `${task.id}_sub_${i + 1}`,
                    title: t.title,
                    instruction: t.instruction,
                    domain: task.domain,
                    complexity: t.complexity || task.complexity,
                    routingPath: (t.complexity || task.complexity) >= 7 ? 'slow' : 'fast',
                    estimatedTokens: t.estimatedTokens || 1000,
                    dependencies: t.dependencies || [],
                    isAtomic: true,
                    enabled: true
                }));
            }
        } catch (error) {
            console.error('[Prism] Re-decomposition failed:', error);
        }

        // Return original if re-decomposition fails
        return [task];
    }

    /**
     * Step C: Adaptive Routing (ACT)
     * Assign complexity scores and route to Fast/Slow paths
     */
    private stepC_AdaptiveRouting(tasks: AtomicTask[]): AdaptiveRoutingResult {
        const result: AdaptiveRoutingResult = {
            fastPathTasks: [],
            slowPathTasks: [],
            complexityDistribution: { low: 0, medium: 0, high: 0 },
            estimatedTotalTokens: 0
        };

        for (const task of tasks) {
            // ACT routing based on complexity
            if (task.complexity <= 3) {
                task.routingPath = 'fast';
                result.fastPathTasks.push(task);
                result.complexityDistribution.low++;
            } else if (task.complexity <= 6) {
                // Medium complexity - default to fast but allow slow
                task.routingPath = 'fast';
                result.fastPathTasks.push(task);
                result.complexityDistribution.medium++;
            } else {
                // High complexity - slow path (Sonnet-tier models)
                task.routingPath = 'slow';
                result.slowPathTasks.push(task);
                result.complexityDistribution.high++;
            }

            result.estimatedTotalTokens += task.estimatedTokens;
        }

        console.log(`[Prism:C] Routing: ${result.fastPathTasks.length} fast, ${result.slowPathTasks.length} slow`);
        return result;
    }

    /**
     * Step D: Prepare User Review Data
     * Format data for UI presentation
     */
    private stepD_PrepareUserReview(
        council: CouncilProposal,
        routing: AdaptiveRoutingResult
    ): UserReviewData {
        const allTasks = [...routing.fastPathTasks, ...routing.slowPathTasks];

        // Estimate time (rough: 30 seconds per fast task, 2 minutes per slow task)
        const fastTime = routing.fastPathTasks.length * 30;
        const slowTime = routing.slowPathTasks.length * 120;
        const totalSeconds = fastTime + slowTime;
        const estimatedTime = totalSeconds < 60
            ? `${totalSeconds} seconds`
            : `${Math.ceil(totalSeconds / 60)} minutes`;

        // Estimate cost (rough: $0.001 per 1000 tokens for fast, $0.01 for slow)
        const fastCost = routing.fastPathTasks.reduce((sum, t) => sum + t.estimatedTokens, 0) * 0.000001;
        const slowCost = routing.slowPathTasks.reduce((sum, t) => sum + t.estimatedTokens, 0) * 0.00001;
        const estimatedCost = `$${(fastCost + slowCost).toFixed(4)}`;

        return {
            councilMembers: council.specialists.map(agent => ({
                agent,
                enabled: true
            })),
            tasks: allTasks.map(task => ({
                task,
                enabled: task.enabled
            })),
            estimatedTime,
            estimatedCost
        };
    }

    // ============= LEGACY METHODS (kept for backward compatibility) =============

    /**
     * Analyzes a high-level goal and determines the necessary agent configuration.
     * Uses an LLM to recommend specific roles and personas.
     * @deprecated Use executeFullAnalysis() for V2.99
     */
    async analyzeTask(goal: string, ai: any, model: string, department?: string): Promise<AgentConfig[]> {
        if (!goal) return [];

        try {
            const departmentContext = department ? `FOCUS: Generate agents specifically for the "${department}" department.` : "";

            const prompt = `
        You are The Prism, an advanced AI task orchestrator.
        
        GOAL: "${goal}"
        ${departmentContext}
        
        Analyze this goal and determine the optimal team of agents required to execute it.
        Return a JSON array of 3-5 agents.
        IMPORTANT: Return ONLY the JSON array. Do not include any conversational text.
        
        **GOLD STANDARD ARCHETYPES (Use these as templates):**
        1. **The Specialist:** Highly specific domain expert (e.g., "Rust Macro Specialist", not just "Developer").
        2. **The Critic:** A dedicated dissenter who looks for flaws.
        3. **The Visionary:** Focuses on high-level alignment and future-proofing.
        
        For each agent, specify:
        - id: unique string (snake_case)
        - role: short title (Max 5 words, e.g., "PostgreSQL Optimizer")
        - persona: detailed system prompt describing their expertise and "Anti-Conformity" stance (Free-MAD protocol).
        - capabilities: list of skills ["code_gen", "review", "security_audit", etc.]
        - temperature: recommended temperature (0.7 for creative, 0.2 for strict)
        
        Example JSON:
        [
          {
            "id": "security_specialist",
            "role": "Security Specialist",
            "persona": "You are a paranoid security expert. Critique every design choice...",
            "capabilities": ["security_audit"],
            "temperature": 0.3
          }
        ]
      `;

            console.log(`[Prism] Analyzing task for department: ${department || 'General'} using model: ${model}`);

            // Retry Logic: Smart Backoff (3s, 6s, 12s, 24s, 30s)
            let attempts = 0;
            const backoffDelays = [3000, 6000, 12000, 24000, 30000, 30000]; // ms
            const maxAttempts = backoffDelays.length;

            while (attempts < maxAttempts) {
                if (attempts > 0) {
                    const waitTime = backoffDelays[attempts - 1];
                    console.log(`[Prism] Retrying in ${waitTime / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

                attempts++;
                try {
                    const responsePromise = ai.models.generateContent({
                        model: model,
                        contents: prompt,
                        config: { responseMimeType: "application/json" }
                    });

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Prism Analysis Timed Out (${60 * attempts}s)`)), 60000 * attempts)
                    );

                    const response: any = await Promise.race([responsePromise, timeoutPromise]);

                    console.log(`[Prism] Analysis complete for ${department || 'General'} (Attempt ${attempts})`);

                    const text = response.text || "[]";
                    const parseResult = safeJsonParseArray<AgentConfig>(text);

                    if (parseResult.success && parseResult.data && parseResult.data.length > 0) {
                        const cappedAgents = parseResult.data.slice(0, 7);

                        return cappedAgents.map((agent: any) => {
                            if (agent.role && agent.role.length > 50 && agent.persona && agent.persona.length < 50) {
                                return { ...agent, role: agent.persona, persona: agent.role };
                            }
                            if (agent.role && agent.role.length > 50) {
                                agent.role = agent.role.substring(0, 47) + "...";
                            }
                            return agent;
                        }) as AgentConfig[];
                    } else {
                        throw new Error(parseResult.error || "Invalid JSON array format");
                    }
                } catch (e) {
                    console.warn(`[Prism] Attempt ${attempts} failed:`, e);
                    if (attempts >= maxAttempts) throw e;
                }
            }
            return [];
        } catch (error) {
            console.error("Prism analysis failed completely. Using Fallback Squad.", error);
            const dept = department || 'General';
            return [
                {
                    id: `${dept}_specialist_lead`,
                    role: `${dept.charAt(0).toUpperCase() + dept.slice(1)} Specialist`,
                    persona: `You are a skilled ${dept} expert focused on implementation details.`,
                    capabilities: ["code_gen"],
                    temperature: 0.7
                },
                {
                    id: `${dept}_critic`,
                    role: `${dept.charAt(0).toUpperCase() + dept.slice(1)} Critic`,
                    persona: `You are a ${dept} reviewer. Find flaws, edge cases, and security risks.`,
                    capabilities: ["review"],
                    temperature: 0.4
                },
                {
                    id: `${dept}_visionary`,
                    role: `${dept.charAt(0).toUpperCase() + dept.slice(1)} Strategist`,
                    persona: `You are a forward-thinking ${dept} visionary. Align with the user's high-level goals.`,
                    capabilities: ["planning"],
                    temperature: 0.8
                }
            ];
        }
    }

    async decomposeTask(taskId: string, context: string, ai: any, model: string): Promise<MicroTask[]> {
        const { createMicroAgentDecomposer } = await import('./micro-agent-decomposer');
        const decomposer = createMicroAgentDecomposer();
        return decomposer.decomposeNode(taskId, context, ai, model, "The Prism");
    }

    shouldDecompose(taskId: string): boolean {
        const currentFailures = (this.failureCounts.get(taskId) || 0) + 1;
        this.failureCounts.set(taskId, currentFailures);
        return currentFailures > this.MAX_FAILURES;
    }

    resetFailureCount(taskId: string) {
        this.failureCounts.delete(taskId);
    }

    async analyzeVeto(vetoReason: string, currentSpec: string, ai: any, model: string): Promise<{ correctionPlan: string; suggestedAgents: AgentConfig[] }> {
        try {
            const prompt = `
            You are The Prism. A critical VETO has been issued against the current specification.
            
            VETO REASON: "${vetoReason}"
            
            CURRENT SPEC (Snippet):
            """
            ${currentSpec.substring(0, 5000)}
            """
            
            TASK:
            1. Analyze why this VETO occurred.
            2. Propose a technical alternative that solves the problem while satisfying the VETO.
            3. Recommend a "Correction Squad" (1-3 agents) to implement this fix.
            
            Return JSON:
            {
                "correctionPlan": "Detailed instruction on how to fix the spec.",
                "suggestedAgents": [
                    { "id": "fixer_1", "role": "Specific Fixer Role", "persona": "...", "capabilities": ["code_gen"], "temperature": 0.5 }
                ]
            }
            `;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text || "{}";
            const parseResult = safeJsonParseObject<{ correctionPlan: string; suggestedAgents: any[] }>(text);

            return {
                correctionPlan: parseResult.data?.correctionPlan || "Fix the errors identified by the VETO.",
                suggestedAgents: parseResult.data?.suggestedAgents || []
            };

        } catch (error) {
            console.error("Prism Veto Analysis failed", error);
            return { correctionPlan: "Address the VETO reason manually.", suggestedAgents: [] };
        }
    }

    /**
     * V2.99: Retry JSON generation with explicit formatting instruction
     * Called when UI-driven retry is requested
     */
    async retryWithExplicitJson(
        previousOutput: string,
        ai: any,
        model: string,
        domainResult: DomainClassificationResult
    ): Promise<{ success: boolean; data: AtomicTask[] }> {
        console.log('[Prism] Attempting JSON retry with explicit instructions...');

        const retryPrompt = `Your previous response was not valid JSON. 
Please output ONLY a valid JSON array with no markdown formatting, no explanation, no code blocks.

Previous response that failed to parse (truncated):
${previousOutput.substring(0, 500)}...

Respond with ONLY the raw JSON array starting with [ and ending with ].
No other text. Just the JSON array of atomic tasks.`;

        try {
            const response = await ai.models.generateContent({
                model,
                contents: retryPrompt,
                config: {
                    responseMimeType: "application/json",
                    temperature: 0.3  // Lower temp for more consistent formatting
                }
            });

            const result = safeJsonParseArray<any>(response.text || '');

            if (result.success && result.data) {
                console.log('[Prism] JSON retry successful! Parsed', result.data.length, 'tasks');
                return {
                    success: true,
                    data: result.data.map((t: any) => ({
                        id: t.id || crypto.randomUUID().substring(0, 8),
                        title: t.title || 'Untitled Task',
                        instruction: t.instruction || '',
                        domain: t.domain || domainResult.domain,
                        complexity: t.complexity || 5,
                        routingPath: (t.complexity || 5) >= 7 ? 'slow' as const : 'fast' as const,
                        estimatedTokens: t.estimatedTokens || 1000,
                        dependencies: t.dependencies || [],
                        assignedSpecialist: t.assignedSpecialist,
                        isAtomic: true,
                        enabled: true
                    }))
                };
            }
        } catch (e) {
            console.warn('[Prism] JSON retry failed:', e);
        }

        return { success: false, data: [] };
    }

    /**
     * V2.99: Clear failed JSON parses after successful retry or skip
     */
    clearFailedParses(): void {
        this.failedJsonParses = [];
        console.log('[Prism] Cleared failed JSON parse history.');
    }

    async predictNextStep(context: string, completedTask: string, ai: any, model: string): Promise<{ id: string; title: string; instruction: string } | null> {
        try {
            const prompt = `
            You are The Prism.
            
            CURRENT CONTEXT:
            """
            ${context.substring(0, 5000)}
            """
            
            TASK JUST COMPLETED (Pending Verification): "${completedTask}"
            
            Predict the SINGLE most likely next step ($T_{i+1}$) that naturally follows this task.
            We want to start this speculatively while verification runs.
            
            Return JSON: { "id": "snake_case_id", "title": "Short Title", "instruction": "Detailed instruction" }
            If no clear next step exists, return null.
            `;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text || "{}";
            const parseResult = safeJsonParseObject<{ id: string; title: string; instruction: string }>(text);

            if (!parseResult.success || !parseResult.data?.id || !parseResult.data?.title) return null;

            return {
                id: `speculative_${parseResult.data.id}`,
                title: `[SPECULATIVE] ${parseResult.data.title}`,
                instruction: parseResult.data.instruction || ''
            };

        } catch (error) {
            console.warn("Prism prediction failed", error);
            return null;
        }
    }
}

export function createPrismController(): PrismController {
    return new PrismController();
}
