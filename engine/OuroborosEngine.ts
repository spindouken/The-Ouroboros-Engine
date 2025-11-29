import { GoogleGenAI } from "@google/genai";
import { Graph, LogEntry, PlanItem, Node, NodeStatus, AppSettings } from '../types';
import { createPrismController } from '../prism-controller';
import { createMultiRoundVotingSystem, formatVotingResult } from '../multi-round-voting';
import { createKnowledgeGraphManager } from '../knowledge-graph';
import { createAgentMemoryManager } from '../agent-memory-manager';
import { createRedFlagValidator } from '../red-flag-validator';
import { createRateLimiter } from '../rate-limiter';

// Define the Engine State interface
export interface EngineState {
    graph: Graph;
    logs: LogEntry[];
    isProcessing: boolean;
    projectPlan: PlanItem[];
    documentContent: string;
    settings: AppSettings;
    cycleCount: number;
}

// Define a listener type for state updates
export type StateListener = (state: EngineState) => void;

export class OuroborosEngine {
    private static instance: OuroborosEngine;

    // State
    private state: EngineState = {
        graph: { nodes: {}, edges: [] },
        logs: [],
        isProcessing: false,
        projectPlan: [],
        documentContent: "",
        cycleCount: 0,
        settings: {
            model: 'gemini-2.5-flash',
            concurrency: 4,
            rpm: 10,
            rpd: 250,
            autoSaveInterval: 300,
            enableRedFlagging: false,
            enableMultiRoundVoting: false,
            enableStreaming: false,
            enableWebWorkers: false,
            enableAgentMemory: false,
            maxMicroAgentDepth: 3,
            initialJudgeCount: 3,
            gitIntegration: false,
            redTeamMode: false,
            debugMode: false,
            model_specialist: '',
            model_lead: '',
            model_synthesizer: '',
            model_judge: '',
            model_architect: ''
        }
    };

    private listeners: StateListener[] = [];

    // Subsystems
    private prismController;
    private votingSystem;
    private knowledgeGraphManager;
    private memoryManager;
    private redFlagValidator;
    private rateLimiter;

    // API
    private ai: GoogleGenAI | null = null;

    private constructor() {
        this.prismController = createPrismController();
        this.votingSystem = createMultiRoundVotingSystem();
        this.knowledgeGraphManager = createKnowledgeGraphManager();
        this.memoryManager = createAgentMemoryManager();
        this.redFlagValidator = createRedFlagValidator();
        this.rateLimiter = createRateLimiter({ rpm: 60, rpd: 10000, enabled: true });
    }

    public static getInstance(): OuroborosEngine {
        if (!OuroborosEngine.instance) {
            OuroborosEngine.instance = new OuroborosEngine();
        }
        return OuroborosEngine.instance;
    }

    public setAIClient(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    public updateSettings(newSettings: Partial<AppSettings>) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.rateLimiter.updateConfig({
            rpm: this.state.settings.rpm,
            rpd: this.state.settings.rpd,
            enabled: true
        });
        this.notify();
    }

    public setDocumentContent(content: string) {
        this.state.documentContent = content;
        this.notify();
    }

    public subscribe(listener: StateListener): () => void {
        this.listeners.push(listener);
        listener(this.state); // Initial emit
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    // --- State Accessors ---
    public getState(): EngineState {
        return this.state;
    }

    // --- UTILS ---
    private generateId = () => Math.random().toString(36).substr(2, 9);

    // --- CORE LOGIC ---

    public async startRefinement(goal: string, activeDepts: string[] = ['strategy', 'ux', 'engineering', 'security']) {
        if (!goal.trim()) return;
        this.state.isProcessing = true;
        this.state.documentContent = goal;
        this.state.graph = { nodes: {}, edges: [] };
        this.state.logs = [];
        this.state.cycleCount = 1;
        this.notify();

        this.addLog('system', 'Summoning the Council of Experts...');

        // BUILD THE SQUAD GRAPH
        const nodes: Record<string, Node> = {};
        const edges: { source: string; target: string }[] = [];
        const roundId = this.generateId().substring(0, 3);
        const alchemistId = `alchemist_${roundId}`;

        if (!this.ai) {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
        }
        const ai = this.ai;

        // 1. Spawn The Squad (Dynamic via Prism)
        const prismAgents = await this.prismController.analyzeTask(goal, ai, this.state.settings.model);
        const domainLeadIds: string[] = [];

        activeDepts.forEach(deptKey => {
            const leadId = `lead_${deptKey}_${roundId}`;
            domainLeadIds.push(leadId);

            // Create Domain Lead
            nodes[leadId] = {
                id: leadId, type: 'domain_lead', label: `${deptKey} Lead`,
                persona: `Head of ${deptKey}`,
                department: deptKey,
                instruction: `Review the insights from your specialists.Weigh them based on their Confidence Score.Vote on the best features.Synthesize a unified ${deptKey} strategy.`,
                dependencies: [],
                status: 'pending', output: null, depth: 1
            };

            // Filter Prism agents that match this department
            const deptAgents = prismAgents.filter(a =>
                a.role.toLowerCase().includes(deptKey) ||
                a.capabilities.some(c => c.includes(deptKey)) ||
                (deptKey === 'strategy' && !['marketing', 'ux', 'engineering', 'security'].some(k => a.role.toLowerCase().includes(k))) // Fallback for strategy
            );

            const agentsToSpawn = deptAgents.length > 0 ? deptAgents : [{
                id: `${deptKey}_default`,
                role: `${deptKey} Specialist`,
                persona: `You are a ${deptKey} expert.`,
                temperature: 0.7
            }];

            agentsToSpawn.forEach((agent, idx) => {
                const specId = `${deptKey}_${agent.id}_${idx}_${roundId}`;
                nodes[specId] = {
                    id: specId, type: 'specialist', label: agent.role,
                    persona: agent.persona, department: deptKey,
                    instruction: "Analyze the spec. You are a DISSENTER. Do not agree with the status quo. Find flaws, edge cases, and alternative approaches. If you agree, you fail.",
                    dependencies: [],
                    status: 'pending', output: null, depth: 2,
                    data: { temperature: agent.temperature }
                };
                edges.push({ source: specId, target: leadId });
                nodes[leadId].dependencies.push(specId);
            });
        });

        // 2. Spawn The Alchemist (Synthesizer)
        nodes[alchemistId] = {
            id: alchemistId, type: 'synthesizer', label: 'The Alchemist',
            persona: 'Grand Architect',
            instruction: 'Consume the unified domain strategies. Weave them into the Prima Materia. Ensure holistic consistency.',
            dependencies: domainLeadIds,
            status: 'pending', output: null, depth: 0
        };
        domainLeadIds.forEach(id => edges.push({ source: id, target: alchemistId }));

        // 3. Spawn The Tribunal (Voting Mechanism)
        const judges = this.generateJudges(roundId, this.state.settings.initialJudgeCount || 3);

        judges.forEach(judge => {
            nodes[judge.id] = {
                id: judge.id, type: 'gatekeeper', label: judge.label,
                persona: judge.persona,
                instruction: `Evaluate the Transmuted Spec based on ${judge.focus}.Vote 0 - 100.`,
                dependencies: [alchemistId],
                status: 'pending', output: null, depth: 0
            };
            edges.push({ source: alchemistId, target: judge.id });
        });

        this.updateGraph(nodes, edges);
        this.processGraph(nodes);
    }

    public async startPlanning(goal: string) {
        if (!goal.trim()) return;
        this.state.isProcessing = true;
        this.state.documentContent = goal;
        this.state.graph = { nodes: {}, edges: [] };
        this.state.projectPlan = [];
        this.state.logs = [];
        this.notify();

        this.addLog('system', 'Initiating MANIFESTATION Sequence...');

        const rootId = 'head_of_snake';
        const initialNodes: Record<string, Node> = {
            [rootId]: {
                id: rootId, type: 'architect', label: 'Head of Ouroboros',
                persona: 'Grand Architect',
                instruction: 'Analyze the Transmuted Spec. Break it down into 3-5 distinct structural domains. Return JSON.',
                dependencies: [], status: 'pending', output: null, depth: 0
            }
        };

        this.updateGraph(initialNodes, []);
        this.processGraph(initialNodes);
    }

    public async processGraph(initialNodes: Record<string, Node>) {
        this.state.isProcessing = true;
        this.notify();

        let active = true;

        // Initial setup
        this.state.graph.nodes = { ...initialNodes };
        this.state.graph.edges = this.state.graph.edges || [];
        this.state.graph.nodes = this.calculateLayout(this.state.graph.nodes);
        this.notify();

        const checkRunnable = async () => {
            if (!active) return;

            const nodesRef = this.state.graph.nodes;
            const pendingNodes = Object.values(nodesRef).filter(n => n.status === 'pending');
            const runningNodes = Object.values(nodesRef).filter(n => n.status !== 'pending' && n.status !== 'complete' && n.status !== 'error');

            if (pendingNodes.length === 0 && runningNodes.length === 0) {
                const tribunalNodes = Object.values(nodesRef).filter(n => n.type === 'gatekeeper' && n.status === 'complete');

                if (tribunalNodes.length > 0) {
                    const lastJudge = tribunalNodes[tribunalNodes.length - 1];
                    const roundId = lastJudge.id.split('_').pop();
                    const currentRoundJudges = tribunalNodes.filter(n => n.id.endsWith(`_${roundId}`));

                    const scores = currentRoundJudges.map(n => n.score || 0);
                    const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
                    const variance = this.votingSystem.calculateVariance(scores);

                    this.addLog('system', `[Round ${roundId}] Tribunal Consensus: ${avgScore.toFixed(1)} / 100 (Variance: ${variance.toFixed(1)})`);

                    if (this.state.settings.enableMultiRoundVoting && variance > 200) {
                        const currentCount = currentRoundJudges.length;
                        let nextCount = 0;
                        if (currentCount < 5) nextCount = 5;
                        else if (currentCount < 7) nextCount = 7;

                        if (nextCount > 0) {
                            this.addLog('warn', `Variance High (${variance.toFixed(1)}). Escalating to ${nextCount} Judges...`);
                            const allJudges = this.generateJudges(roundId!, nextCount);
                            const newJudges = allJudges.filter(j => !nodesRef[j.id]);

                            if (newJudges.length > 0) {
                                const alchemist = Object.values(nodesRef).find(n => n.type === 'synthesizer' && n.id.endsWith(`_${roundId}`));
                                if (alchemist) {
                                    const newNodes: Record<string, Node> = {};
                                    const newEdges: { source: string; target: string }[] = [];

                                    newJudges.forEach(j => {
                                        newNodes[j.id] = {
                                            id: j.id, type: 'gatekeeper', label: j.label,
                                            persona: j.persona,
                                            instruction: `Re-evaluate based on ${j.focus}. Vote 0-100.`,
                                            dependencies: [alchemist.id], status: 'pending', output: null, depth: 0
                                        };
                                        newEdges.push({ source: alchemist.id, target: j.id });
                                    });

                                    this.updateGraph(newNodes, newEdges);
                                    setTimeout(checkRunnable, 1000);
                                    return;
                                }
                            }
                        } else {
                            this.addLog('error', 'Consensus impossible after 3 rounds. Human Review Required.');
                            this.state.documentContent += "\n\n> ⚠️ **SYSTEM ALERT**: Tribunal Consensus Failed. Human Review Required.";
                            this.notify();
                        }
                    }

                    if (avgScore < 85 && Object.keys(nodesRef).length < 60) {
                        this.addLog('warn', 'Consensus weak. Ouroboros devours itself for another cycle...');
                        this.expandRefinementGraph(nodesRef, this.state.documentContent);
                        return;
                    }
                }

                this.state.isProcessing = false;
                this.addLog('success', 'Cycle Complete. The snake rests.');
                active = false;
                this.notify();
                return;
            }

            // Check for dependency failures
            pendingNodes.forEach(node => {
                const dependencies = node.dependencies.map(id => nodesRef[id]);
                if (dependencies.some(d => d?.status === 'error')) {
                    this.updateNodeState(node.id, { status: 'error', output: 'Dependency failed.' });
                    this.addLog('error', `Dependency failed for ${node.label}. Aborting.`, node.id);
                }
            });

            // Re-fetch pending nodes after updates
            const activePending = Object.values(this.state.graph.nodes).filter(n => n.status === 'pending');

            const runnable = activePending.filter(node => {
                return node.dependencies.every(depId => this.state.graph.nodes[depId]?.status === 'complete');
            });

            if (runnable.length > 0) {
                await Promise.all(runnable.map(node => this.executeNode(node.id, checkRunnable)));
                checkRunnable();
            } else {
                const runningCount = Object.values(this.state.graph.nodes).filter(n => n.status === 'running' || n.status === 'critiquing' || n.status === 'synthesizing' || n.status === 'evaluating' || n.status === 'planning').length;

                if (activePending.length > 0 && runningCount > 0) {
                    setTimeout(checkRunnable, 1000);
                } else if (activePending.length > 0 && runningCount === 0) {
                    this.addLog('error', 'Deadlock detected. Stopping execution.');
                    this.state.isProcessing = false;
                    active = false;
                    this.notify();
                }
            }
        };

        checkRunnable();
    }

    private async executeNode(nodeId: string, checkRunnableCallback: () => void) {
        const node = this.state.graph.nodes[nodeId];
        if (!node) return;

        let status: NodeStatus = 'running';
        if (node.type === 'specialist') status = 'critiquing';
        if (node.type === 'domain_lead') status = 'synthesizing';
        if (node.type === 'synthesizer') status = 'synthesizing';
        if (node.type === 'gatekeeper') status = 'evaluating';
        if (['architect', 'tech_lead', 'estimator'].includes(node.type)) status = 'planning';

        this.updateNodeState(nodeId, { status });

        try {
            await this.apiSemaphore.acquire();
            await this.rateLimiter.waitForSlot();
            this.rateLimiter.recordRequest();

            if (!this.ai) {
                this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
            }
            const ai = this.ai;
            let selectedModel = this.state.settings.model;

            // Tiered Model Selection
            if (node.type === 'specialist' && this.state.settings.model_specialist) selectedModel = this.state.settings.model_specialist;
            if ((node.type === 'domain_lead' || node.type === 'tech_lead') && this.state.settings.model_lead) selectedModel = this.state.settings.model_lead;
            if (node.type === 'architect' && this.state.settings.model_architect) selectedModel = this.state.settings.model_architect;
            if (node.type === 'synthesizer' && this.state.settings.model_synthesizer) selectedModel = this.state.settings.model_synthesizer;
            if (node.type === 'gatekeeper' && this.state.settings.model_judge) selectedModel = this.state.settings.model_judge;

            const dependencyOutputs = node.dependencies.map(d => {
                const depNode = this.state.graph.nodes[d];
                const scoreStr = depNode.score ? `[Confidence: ${depNode.score}%]` : '';
                return `FROM [${depNode.label}] ${scoreStr}:\n${depNode.output}`;
            }).join('\n\n');

            // --- MDAP: Memory Injection ---
            let instructionContext = node.instruction;
            if (this.state.settings.enableAgentMemory) {
                instructionContext = this.memoryManager.injectMemoryContext(node.persona, instructionContext);
            }

            let resultText = "";
            let score = 0;
            let resultData: any = null;

            // --- MDAP: Retry Loop for Red Flagging ---
            let attempts = 0;
            const maxAttempts = this.state.settings.enableRedFlagging ? 3 : 1;
            let currentTemp = 0.7;
            let executionValid = false;

            while (attempts < maxAttempts && !executionValid) {
                attempts++;

                const generationConfig = {
                    responseMimeType: "application/json",
                    temperature: node.data?.temperature || currentTemp
                };

                if (node.type === 'specialist') {
                    this.addLog('info', `${node.label} is analyzing... (Attempt ${attempts})`, nodeId);
                    const resp = await ai.models.generateContent({
                        model: selectedModel,
                        contents: `You are: ${node.persona}.
                    
                    THE PRIMA MATERIA (SPEC):
                    """
                    ${this.state.documentContent}
                    """
                    
                    YOUR LENS: ${instructionContext}
                    
                    Provide specific, actionable insights. 
                    CRITICAL: You must rate your own confidence in these insights (0-100) based on how critical they are to the project's success.
                    
                    Return JSON: { "insight": "markdown string...", "confidence": number }`,
                        config: generationConfig
                    });
                    resultData = this.extractJson(resp.text || "{}");
                    resultText = resultData?.insight || "No insights.";
                    score = resultData?.confidence || 0;

                    // --- CERTAINTY FILTERING ---
                    const hedgingPatterns = [/I think/i, /maybe/i, /possibly/i, /it seems/i, /might be/i, /could be/i];
                    const hedgingCount = hedgingPatterns.reduce((acc, pattern) => acc + (resultText.match(pattern) ? 1 : 0), 0);

                    if (hedgingCount > 2) {
                        this.addLog('warn', `Certainty Filter: Rejected ${node.label} output due to excessive hedging (${hedgingCount} matches).`, nodeId);
                        resultText = "REJECTED: Output contained too much uncertain language. Please be more definitive.";
                        score = 0;
                    }

                } else if (node.type === 'domain_lead') {
                    this.addLog('info', `${node.label} is unifying strategy...`, nodeId);
                    const resp = await ai.models.generateContent({
                        model: selectedModel,
                        contents: `You are: ${node.persona}.
                    
                    YOUR SPECIALISTS' INSIGHTS (Divergent Views):
                    ${dependencyOutputs}
                    
                    TASK: ${instructionContext}
                    
                    Synthesize a single, cohesive strategy section for your domain.
                    You must produce THREE distinct artifacts:
                    1. **Specification**: Formal logic/requirements.
                    2. **Code**: Implementation snippets or pseudo-code.
                    3. **Proof**: Reasoning why this is correct and meets constraints.
                    
                    Return JSON:
                    {
                      "specification": "markdown string",
                      "code": "markdown string",
                      "proof": "markdown string",
                      "summary": "markdown string (for the graph)"
                    }`,
                        config: { responseMimeType: "application/json" }
                    });

                    resultData = this.extractJson(resp.text || "{}");
                    resultText = resultData?.summary || "Synthesis failed.";

                    this.updateNodeState(nodeId, {
                        artifacts: {
                            specification: resultData?.specification,
                            code: resultData?.code,
                            proof: resultData?.proof
                        }
                    });

                } else if (node.type === 'synthesizer') { // The Alchemist
                    this.addLog('system', `Alchemist Transmuting...`, nodeId);
                    const resp = await ai.models.generateContent({
                        model: selectedModel,
                        contents: `You are: ${node.persona}.
                    
                    THE OLD MATTER:
                    """
                    ${this.state.documentContent}
                    """
                    
                    THE COUNCIL'S DECREES (Domain Strategies):
                    ${dependencyOutputs}
                    
                    TASK: ${instructionContext}
                    Rewrite the Prima Materia to incorporate ALL valid insights. Make it seamless.
                    Return the FULL Markdown document.`
                    });
                    resultText = resp.text || this.state.documentContent;
                    this.state.documentContent = resultText;
                    this.notify();
                    this.addLog('success', `Transmutation Complete`, nodeId);

                } else if (node.type === 'gatekeeper') {
                    this.addLog('system', `Tribunal is in session for ${node.label}...`, nodeId);

                    const roundMatch = nodeId.match(/_([^_]+)$/);
                    const currentRoundId = roundMatch ? roundMatch[1] : '';

                    const synthesizerNode = Object.values(this.state.graph.nodes).find((n: Node) => n.type === 'synthesizer' && n.id.includes(currentRoundId)) as Node | undefined;
                    const artifacts = synthesizerNode?.artifacts;

                    let specToVerify = instructionContext;
                    if (artifacts) {
                        specToVerify = `
                        CODE:
                        ${artifacts.code}
                        
                        SPECIFICATION:
                        ${artifacts.specification}
                        
                        PROOF:
                        ${artifacts.proof}
                        `;
                    }

                    // OPTIMISTIC EXECUTION (DISABLED for Stability)
                    // User reported stalling and this feature was not in the original stable build.
                    let speculativeNodeId: string | null = null;
                    /* 
                    if (score === 0) {
                        const prediction = await this.prismController.predictNextStep(this.state.documentContent, instructionContext, ai, selectedModel);
                        if (prediction) {
                            speculativeNodeId = prediction.id;
                            this.addLog('system', `🔮 Optimistic Execution: Spawning ${prediction.title}...`, nodeId);

                            const specNode: Node = {
                                id: prediction.id,
                                type: 'tech_lead',
                                label: prediction.title,
                                persona: 'Speculative Executor',
                                instruction: prediction.instruction,
                                dependencies: [nodeId],
                                status: 'running',
                                output: null,
                                depth: (node.depth || 0) + 1
                            };

                            this.updateGraph({ [specNode.id]: specNode }, [{ source: nodeId, target: specNode.id }]);
                        }
                    }
                    */

                    const votingResult = await this.votingSystem.conductVoting(
                        specToVerify,
                        1,
                        ai,
                        {
                            default: selectedModel,
                            cheap: "gemini-1.5-flash",
                            advanced: "gemini-1.5-pro"
                        },
                        "Verify this artifact set. Check for Logic, Requirements, and Proof validity."
                    );

                    resultText = formatVotingResult(votingResult);
                    score = votingResult.averageScore;
                    resultData = votingResult;

                    if (votingResult.requiresHumanReview || score <= 70) {
                        // ROLLBACK
                        if (speculativeNodeId) {
                            this.addLog('warn', `Verification Failed. Rolling back speculative node ${speculativeNodeId}...`, nodeId);
                            const newNodes = { ...this.state.graph.nodes };
                            delete newNodes[speculativeNodeId!];
                            const newEdges = this.state.graph.edges.filter(e => e.target !== speculativeNodeId && e.source !== speculativeNodeId);
                            this.state.graph.nodes = newNodes;
                            this.state.graph.edges = newEdges;
                            this.notify();
                        }

                        // RECURSIVE DECOMPOSITION
                        if (this.prismController.shouldDecompose(nodeId)) {
                            this.addLog('warn', `Verification Failed > 2 times. Triggering Recursive Decomposition...`, nodeId);
                            const subTasks = await this.prismController.decomposeTask(nodeId, this.state.documentContent, ai, selectedModel);

                            if (subTasks.length > 0) {
                                this.addLog('system', `Decomposed into ${subTasks.length} micro-tasks. Spawning new agents...`, nodeId);
                                this.expandPlanningTree(nodeId, subTasks, 'tasks', (node.depth || 0) + 1);
                                this.prismController.resetFailureCount(nodeId);
                                executionValid = true;
                            } else {
                                this.addLog('error', 'Decomposition failed. Escalating to human review.', nodeId);
                            }
                        }
                    }
                } else if (node.type === 'architect') {
                    this.addLog('system', `${node.label} is architecting the system...`, nodeId);
                    const resp = await ai.models.generateContent({
                        model: selectedModel,
                        contents: `You are: ${node.persona}.
                        
                        THE SPECIFICATION:
                        """
                        ${this.state.documentContent}
                        """
                        
                        TASK: ${instructionContext}
                        Break the system down into 3-5 distinct structural domains (modules).
                        
                        Return JSON:
                        {
                            "modules": [
                                { "id": "string (unique)", "title": "string", "description": "string" }
                            ]
                        }`,
                        config: { responseMimeType: "application/json" }
                    });

                    resultData = this.extractJson(resp.text || "{}");
                    const modules = resultData?.modules || [];
                    resultText = `Architected ${modules.length} domains: ${modules.map((m: any) => m.title).join(', ')}`;

                    if (modules.length > 0) {
                        this.expandPlanningTree(nodeId, modules, 'modules', (node.depth || 0) + 1);
                    } else {
                        this.addLog('error', 'Architect failed to generate modules.', nodeId);
                    }
                    score = 90;

                } else if (node.type === 'tech_lead') {
                    this.addLog('system', `${node.label} is breaking down tasks...`, nodeId);
                    const resp = await ai.models.generateContent({
                        model: selectedModel,
                        contents: `You are: ${node.persona}.
                        
                        THE SPECIFICATION:
                        """
                        ${this.state.documentContent}
                        """
                        
                        TASK: ${instructionContext}
                        Break this domain down into granular, actionable tasks.
                        Tasks should be ordered by dependency (build order).
                        
                        Return JSON:
                        {
                            "tasks": [
                                { "id": "string (unique)", "title": "string", "instruction": "detailed instruction", "minimalContext": "string" }
                            ]
                        }`,
                        config: { responseMimeType: "application/json" }
                    });

                    resultData = this.extractJson(resp.text || "{}");
                    const tasks = resultData?.tasks || [];
                    resultText = `Generated ${tasks.length} tasks for ${node.label}.`;

                    if (tasks.length > 0) {
                        this.expandPlanningTree(nodeId, tasks, 'tasks', (node.depth || 0) + 1);
                    } else {
                        this.addLog('error', 'Tech Lead failed to generate tasks.', nodeId);
                    }
                    score = 85;

                } else {
                    const resp = await ai.models.generateContent({
                        model: selectedModel,
                        contents: `You are: ${node.persona}. TASK: ${instructionContext}`
                    });
                    resultText = resp.text || "";
                    score = 80;
                }

                // --- MDAP: Red Flag Validation ---
                if (this.state.settings.enableRedFlagging) {
                    const validation = this.redFlagValidator.validate(resultText, score);
                    this.updateNodeState(nodeId, { redFlags: validation.flags });

                    if (!validation.passed) {
                        this.addLog('warn', `Red Flags: ${validation.flags.map(f => f.type).join(', ')} `, nodeId);
                        if (validation.shouldRetry && attempts < maxAttempts) {
                            const retryMsg = await this.redFlagValidator.retry(nodeId, validation.suggestedTemperature || currentTemp);
                            this.addLog('warn', retryMsg, nodeId);
                            if (retryMsg.includes("ESCALATED")) {
                                executionValid = true;
                            } else {
                                currentTemp = validation.suggestedTemperature || currentTemp;
                            }
                        } else {
                            executionValid = true;
                        }
                    } else {
                        executionValid = true;
                    }
                } else {
                    executionValid = true;
                }
            } // End while loop

            // --- Knowledge Graph Integration ---
            if (resultText) {
                let layer: 'domain' | 'lexical' | 'subject' = 'lexical';
                if (node.type === 'domain_lead' || node.type === 'synthesizer' || node.type === 'tech_lead') layer = 'domain';
                if (node.type === 'architect') layer = 'subject';

                await this.knowledgeGraphManager.addNode(
                    nodeId,
                    node.label,
                    layer,
                    layer,
                    resultText,
                    ai,
                    selectedModel,
                    {
                        persona: node.persona,
                        instruction: node.instruction,
                        cycle: 1, // TODO: Pass cycle count
                        artifacts: node.artifacts
                    }
                );

                node.dependencies.forEach(depId => {
                    this.knowledgeGraphManager.addEdge(depId, nodeId, 'influences', 1.0);
                });
            }

            // --- MDAP: Store Memory ---
            if (this.state.settings.enableAgentMemory) {
                await this.memoryManager.storeMemory(node.persona, {
                    cycle: 1, // TODO: Pass cycle count
                    feedback: resultText.substring(0, 100) + "...",
                    outcomeScore: score,
                    timestamp: Date.now(),
                    adopted: true
                }, ai, selectedModel, this.state.settings.enableMultiRoundVoting ? this.votingSystem : undefined);
            }

            this.apiSemaphore.release();
            this.updateNodeState(nodeId, { status: 'complete', output: resultText, score: score, data: resultData });

        } catch (e) {
            console.error(e);
            this.apiSemaphore.release();
            const err = e as Error;

            if (err.message.includes("quota") || err.message.includes("429")) {
                this.addLog('warn', "Quota Limit Hit (429). Pausing for 60s before retrying...", nodeId);
                this.updateNodeState(nodeId, { status: 'pending' });
                await new Promise(resolve => setTimeout(resolve, 60000));
                return this.executeNode(nodeId, checkRunnableCallback);
            }

            this.addLog('error', err.message, nodeId);
            this.updateNodeState(nodeId, { status: 'error', output: err.message });

            if (this.prismController.shouldDecompose(nodeId)) {
                this.addLog('warn', `Task ${node.label} failed repeatedly. Triggering Recursive Decomposition...`, nodeId);

                const subTasks = await this.prismController.decomposeTask(
                    nodeId,
                    this.state.documentContent,
                    this.ai!,
                    this.state.settings.model
                );

                if (subTasks.length > 0) {
                    this.addLog('system', `Decomposed into ${subTasks.length} micro-tasks. Spawning new agents...`, nodeId);
                    this.expandPlanningTree(nodeId, subTasks, 'tasks', (node.depth || 0) + 1);
                    this.prismController.resetFailureCount(nodeId);
                } else {
                    this.addLog('error', 'Decomposition failed. Escalating to human review.', nodeId);
                }
            }
        }
    }

    // Helper to add logs
    private addLog(level: LogEntry['level'], message: string, nodeId?: string) {
        const newLog: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            level,
            message,
            nodeId
        };
        this.state.logs = [newLog, ...this.state.logs];
        this.notify();
    }

    // --- HELPER METHODS ---

    private updateNodeState(id: string, updates: Partial<Node>) {
        if (!this.state.graph.nodes[id]) return;
        this.state.graph.nodes[id] = { ...this.state.graph.nodes[id], ...updates };
        this.notify();
    }

    private updateGraph(newNodes: Record<string, Node>, newEdges: { source: string, target: string }[]) {
        const mergedNodes = { ...this.state.graph.nodes, ...newNodes };
        const mergedEdges = [...this.state.graph.edges, ...newEdges];
        this.state.graph.nodes = this.calculateLayout(mergedNodes);
        this.state.graph.edges = mergedEdges;
        this.notify();
    }

    private extractJson(text: string) {
        try {
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (e) {
            return null;
        }
    }

    private expandPlanningTree(parentId: string, items: any[], type: 'modules' | 'tasks', depth: number) {
        const newNodes: Record<string, Node> = {};
        const newEdges: { source: string, target: string }[] = [];
        const newPlanItems: PlanItem[] = [];

        if (type === 'tasks') {
            const microTasks = items.map((item: any) => ({
                id: item.id,
                parentId: parentId,
                instruction: item.instruction || item.title,
                minimalContext: item.minimalContext || "",
                output: null,
                confidence: 0,
                status: 'pending' as NodeStatus
            }));
            this.updateNodeState(parentId, { microTasks });
        }

        items.forEach((item: any) => {
            if (type === 'modules') {
                const nodeId = `lead_${item.id}`;
                newNodes[nodeId] = {
                    id: nodeId, type: 'tech_lead', label: `Domain: ${item.title.substring(0, 10)}...`,
                    persona: `Domain Keeper (${item.title})`,
                    instruction: `Analyze domain: "${item.title} - ${item.description}".`,
                    dependencies: [parentId], status: 'pending', output: null, depth: depth
                };
                newEdges.push({ source: parentId, target: nodeId });

                newPlanItems.push({
                    id: nodeId,
                    title: item.title,
                    description: item.description,
                    type: 'module',
                    children: []
                });

            } else if (type === 'tasks') {
                const nodeId = item.id;
                newNodes[nodeId] = {
                    id: nodeId,
                    type: 'specialist',
                    label: item.minimalContext || item.title,
                    persona: 'Micro-Agent Specialist',
                    instruction: item.instruction,
                    dependencies: [parentId],
                    status: 'pending',
                    output: null,
                    depth: depth
                };
                newEdges.push({ source: parentId, target: nodeId });

                newPlanItems.push({
                    id: nodeId,
                    title: item.title,
                    description: item.instruction,
                    type: 'task'
                });
            }
        });

        this.updateGraph(newNodes, newEdges);

        // Update Project Plan
        if (type === 'modules') {
            this.state.projectPlan = [...this.state.projectPlan, ...newPlanItems];
        } else if (type === 'tasks') {
            this.state.projectPlan = this.state.projectPlan.map(module => {
                if (module.id === parentId) {
                    return {
                        ...module,
                        children: [...(module.children || []), ...newPlanItems]
                    };
                }
                return module;
            });
        }
        this.notify();
    }

    private expandRefinementGraph(currentNodes: Record<string, Node>, currentDoc: string) {
        this.state.cycleCount++;
        const roundId = `cycle${this.state.cycleCount}`; // e.g. cycle2
        const prevAlchemist = Object.values(currentNodes).find(n => n.type === 'synthesizer' && n.status === 'complete');

        // If no alchemist found (shouldn't happen), try to find the last complete node to attach to
        const anchorNode = prevAlchemist || Object.values(currentNodes).filter(n => n.status === 'complete').pop();

        if (!anchorNode) {
            this.addLog('error', 'Critical Failure: No anchor node found for expansion.');
            return;
        }

        this.addLog('warn', `Consensus Weak. RE-SUMMONING SQUAD for Round ${roundId}...`);

        const newNodes: Record<string, Node> = {};
        const newEdges: { source: string; target: string }[] = [];
        const alchemistId = `alchemist_${roundId}`;

        // For now, we don't have 'selectedDepts' in state, so we'll just assume some defaults or reuse existing logic
        // TODO: Add selectedDepts to EngineState if needed, or pass it in.
        // For this refactor, let's assume we re-spawn based on the previous structure or a default set.
        const defaultDepts = ['strategy', 'ux', 'engineering', 'security'];

        const domainLeadIds: string[] = [];

        defaultDepts.forEach(deptKey => {
            const leadId = `lead_${deptKey}_${roundId}`;
            domainLeadIds.push(leadId);

            newNodes[leadId] = {
                id: leadId, type: 'domain_lead', label: `${deptKey} Lead`,
                persona: `Head of ${deptKey}`, department: deptKey,
                instruction: `Re-evaluate the spec. Previous cycle failed consensus. Fix the issues identified by the Tribunal.`,
                dependencies: [], status: 'pending', output: null, depth: 1
            };

            newEdges.push({ source: anchorNode.id, target: leadId });
            newNodes[leadId].dependencies.push(anchorNode.id);
        });

        newNodes[alchemistId] = {
            id: alchemistId, type: 'synthesizer', label: `Alchemist v${this.state.cycleCount}`,
            persona: 'Grand Architect',
            instruction: 'Refine the matter again. Higher density. Address Tribunal concerns.',
            dependencies: domainLeadIds, status: 'pending', output: null, depth: 0
        };
        domainLeadIds.forEach(id => newEdges.push({ source: id, target: alchemistId }));

        const judges = this.generateJudges(roundId, this.state.settings.initialJudgeCount || 3);
        judges.forEach(j => {
            newNodes[j.id] = {
                id: j.id, type: 'gatekeeper', label: j.label,
                persona: j.persona,
                instruction: `Re-evaluate based on ${j.focus}. Vote 0-100.`,
                dependencies: [alchemistId], status: 'pending', output: null, depth: 0
            };
            newEdges.push({ source: alchemistId, target: j.id });
        });

        this.updateGraph(newNodes, newEdges);

        // RESTART THE ENGINE LOOP
        this.processGraph(this.state.graph.nodes);
    }

    private generateJudges(roundId: string, count: number) {
        const base = [
            { id: 'judge_tech', label: 'Tech Judge', persona: 'Chief Engineer', focus: 'Technical Feasibility' },
            { id: 'judge_product', label: 'Value Judge', persona: 'Chief Product Officer', focus: 'User Value' },
            { id: 'judge_risk', label: 'Risk Judge', persona: 'Chief Risk Officer', focus: 'Security & Stability' },
            { id: 'judge_ux', label: 'UX Judge', persona: 'Chief Design Officer', focus: 'User Experience & Delight' },
            { id: 'judge_market', label: 'Market Judge', persona: 'Chief Marketing Officer', focus: 'Market Fit & Virality' },
        ];

        const selected = [];
        for (let i = 0; i < count; i++) {
            if (i < base.length) {
                selected.push({ ...base[i], id: `${base[i].id}_${roundId}` });
            } else {
                selected.push({
                    id: `judge_generic_${i}_${roundId}`,
                    label: `Judge #${i + 1}`,
                    persona: 'General Evaluator',
                    focus: 'Overall Quality and Consistency'
                });
            }
        }
        return selected;
    }

    private calculateLayout(nodes: Record<string, Node>): Record<string, Node> {
        const layers: Record<string, number> = {};

        const assignLayers = () => {
            let changed = true;
            while (changed) {
                changed = false;
                Object.values(nodes).forEach(node => {
                    if (node.dependencies.length === 0) {
                        if (layers[node.id] !== 0) {
                            layers[node.id] = 0;
                            changed = true;
                        }
                    } else {
                        const maxDep = Math.max(...node.dependencies.map(d => layers[d] ?? -1));
                        if (maxDep !== -1 && layers[node.id] !== maxDep + 1) {
                            layers[node.id] = maxDep + 1;
                            changed = true;
                        }
                    }
                });
            }
        };
        assignLayers();

        const layerCounts: Record<number, number> = {};
        const sortedIds = Object.keys(nodes).sort((a, b) => (layers[a] || 0) - (layers[b] || 0));

        sortedIds.forEach(id => {
            const l = layers[id] || 0;
            nodes[id].layer = l;
            layerCounts[l] = (layerCounts[l] || 0) + 1;
        });

        const layerCurrent: Record<number, number> = {};
        sortedIds.forEach(id => {
            const node = nodes[id];
            const l = node.layer || 0;
            const count = layerCounts[l];
            const idx = layerCurrent[l] || 0;

            node.x = 100 + (l * 320);
            node.y = 400 + (idx * 110) - ((count - 1) * 55);

            layerCurrent[l] = idx + 1;
        });
        return nodes;
    }

    // --- SEMAPHORE ---
    private apiSemaphore = new class {
        private tasks: (() => Promise<void>)[] = [];
        private count = 0;
        public max = 4;

        async acquire(): Promise<void> {
            if (this.count < this.max) {
                this.count++;
                return Promise.resolve();
            }
            return new Promise<void>((resolve) => {
                this.tasks.push(() => {
                    resolve();
                    return Promise.resolve();
                });
            });
        }
        release(): void {
            this.count--;
            if (this.tasks.length > 0 && this.count < this.max) {
                this.count++;
                const next = this.tasks.shift();
                if (next) next();
            }
        }
    }();
}
