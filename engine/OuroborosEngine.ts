import { UnifiedLLMClient, LLMResponse } from './UnifiedLLMClient';
import { Graph, LogEntry, PlanItem, Node, NodeStatus, AppSettings, AppMode, OracleMessage } from '../types';
import { createPrismController } from '../prism-controller';
import { createMultiRoundVotingSystem, formatVotingResult } from '../multi-round-voting';
import { createKnowledgeGraphManager } from '../knowledge-graph';
import { createAgentMemoryManager } from '../agent-memory-manager';
import { createRedFlagValidator } from '../red-flag-validator';
import { createRateLimiter } from '../rate-limiter';
import { db, DBProject } from '../db/ouroborosDB';
import { useOuroborosStore } from '../store/ouroborosStore';
import { MODEL_TIERS } from '../constants';
import { PenaltyBoxRegistry } from './PenaltyBoxRegistry';
import { AllHeadsSeveredError } from './UnifiedLLMClient';
import { Node as FlowNode, Edge as FlowEdge } from 'reactflow';

export class OuroborosEngine {
    private static instance: OuroborosEngine;

    // Subsystems
    private prismController;
    private votingSystem;
    private knowledgeGraphManager;
    private memoryManager;
    private redFlagValidator;
    private rateLimiter;
    private penaltyBox: PenaltyBoxRegistry;

    // API
    private ai: UnifiedLLMClient;
    private abortController: AbortController | null = null;

    private constructor() {
        this.prismController = createPrismController();
        this.votingSystem = createMultiRoundVotingSystem();
        this.knowledgeGraphManager = createKnowledgeGraphManager();
        this.memoryManager = createAgentMemoryManager();
        this.redFlagValidator = createRedFlagValidator();
        this.rateLimiter = createRateLimiter({ rpm: 60, rpd: 10000, enabled: true });
        this.penaltyBox = new PenaltyBoxRegistry();
        this.ai = new UnifiedLLMClient(
            process.env.API_KEY || "",
            process.env.OPENAI_API_KEY || "",
            process.env.OPENROUTER_API_KEY || ""
        );
        this.apiSemaphore.max = useOuroborosStore.getState().settings.concurrency;
    }

    public static getInstance(): OuroborosEngine {
        if (!OuroborosEngine.instance) {
            OuroborosEngine.instance = new OuroborosEngine();
        }
        return OuroborosEngine.instance;
    }

    public setAIClient(apiKey: string) {
        this.ai.updateKeys(apiKey);
    }

    public updateKeys(googleKey?: string, openaiKey?: string, openRouterKey?: string, localBaseUrl?: string, localModelId?: string) {
        this.ai.updateKeys(googleKey, openaiKey, openRouterKey, localBaseUrl, localModelId);
    }

    public async updateSettings(newSettings: Partial<AppSettings>) {
        // Update Store
        useOuroborosStore.getState().updateSettings(newSettings);

        // Update DB
        // We assume there is only one settings record, ID 1
        const currentSettings = await db.settings.get(1) || {} as AppSettings;
        await db.settings.put({ ...currentSettings, ...newSettings, id: 1 });

        const settings = useOuroborosStore.getState().settings;
        this.rateLimiter.updateConfig({
            rpm: settings.rpm,
            rpd: settings.rpd,
            enabled: true
        });
        this.apiSemaphore.max = settings.concurrency;
    }

    public setDocumentContent(content: string) {
        useOuroborosStore.getState().setDocumentContent(content);
    }

    public abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.addLog('warn', 'Execution aborted by user.');
            useOuroborosStore.getState().setStatus('idle');
            this.abortController = null;
        }
    }

    // --- SESSION MANAGEMENT ---

    // --- SESSION CODEX & MANAGEMENT ---

    public async saveToCodex(name: string, overwriteId?: string): Promise<string> {
        const store = useOuroborosStore.getState();
        const id = overwriteId || crypto.randomUUID();

        // Gather Workbench State
        const nodes = await db.nodes.toArray();
        const edges = await db.edges.toArray();
        const logs = await db.logs.toArray();

        // Pack Session
        const session: DBProject = {
            id,
            name,
            createdAt: overwriteId ? (await db.projects.get(overwriteId))?.createdAt || Date.now() : Date.now(),
            updatedAt: Date.now(),

            // Store State
            documentContent: store.documentContent,
            projectPlan: store.projectPlan,
            manifestation: store.manifestation,
            council: store.council,
            oracle: {
                history: store.oracleChatHistory,
                clarityScore: store.clarityScore,
                isActive: store.isOracleActive,
                fusedContext: store.fusedContext
            },

            // Graph State
            nodes,
            edges,
            logs
        };

        await db.projects.put(session);
        store.setCurrentSession(id, name);
        this.addLog('system', `Session "${name}" saved to Codex.`);
        return id;
    }

    public async loadFromCodex(sessionId: string) {
        const session = await db.projects.get(sessionId);
        if (!session) {
            this.addLog('error', `Session ${sessionId} not found in Codex.`);
            return;
        }

        // Wipe Workbench
        await db.nodes.clear();
        await db.edges.clear();
        await db.logs.clear();

        // Restore Workbench
        if (session.nodes) await db.nodes.bulkAdd(session.nodes);
        if (session.edges) await db.edges.bulkAdd(session.edges);
        if (session.logs) await db.logs.bulkAdd(session.logs);

        // Update Store
        const store = useOuroborosStore.getState();
        store.setDocumentContent(session.documentContent || "");
        store.setProjectPlan(session.projectPlan || []);
        store.setManifestation(session.manifestation || null);

        // Update specific state directly
        useOuroborosStore.setState({
            council: session.council || store.council,
            oracleChatHistory: session.oracle?.history || [],
            clarityScore: session.oracle?.clarityScore || 0,
            isOracleActive: session.oracle?.isActive || false,
            fusedContext: session.oracle?.fusedContext || null,
            currentSessionId: session.id,
            currentSessionName: session.name
        });

        // Trigger Graph Refresh
        this.updateGraph(
            (session.nodes || []).reduce((acc, n) => ({ ...acc, [n.id]: n }), {}),
            (session.edges || []).map(e => ({ source: e.source, target: e.target }))
        );

        this.addLog('system', `Session "${session.name}" loaded from Codex.`);
    }

    public async deleteFromCodex(sessionId: string) {
        await db.projects.delete(sessionId);
        this.addLog('system', `Session deleted from Codex.`);
    }

    public async listSessions() {
        return await db.projects.toArray();
    }

    public async exportCodexItem(sessionId: string): Promise<string> {
        const session = await db.projects.get(sessionId);
        if (!session) throw new Error("Session not found");
        return JSON.stringify(session, null, 2);
    }

    public async importCodexItem(jsonString: string) {
        try {
            const data = JSON.parse(jsonString) as DBProject;
            // Validate basic structure
            if (!data.name || !data.nodes) throw new Error("Invalid Session File");

            // Generate new ID to avoid collision
            data.id = crypto.randomUUID();
            data.name = data.name + " (Imported)";
            data.updatedAt = Date.now();

            await db.projects.put(data);
            this.addLog('success', `Session "${data.name}" imported to Codex.`);
            return data.id;
        } catch (e) {
            this.addLog('error', "Import failed: " + e.message);
        }
    }

    // --- LEGACY / COMPATIBILITY ---

    public async saveSession(sessionId: string = 'current_session') {
        // We treat 'current_session' as a special codex entry for autosave
        return this.saveToCodex('Current Session', sessionId);
    }

    public async loadSession(sessionId: string = 'current_session') {
        // 1. Load Settings first to ensure engine is configured
        const settings = await db.settings.get(1);
        if (settings) {
            useOuroborosStore.getState().updateSettings(settings);
            this.rateLimiter.updateConfig({
                rpm: settings.rpm,
                rpd: settings.rpd,
                enabled: true
            });
            this.apiSemaphore.max = settings.concurrency;
            this.ai.updateKeys(
                settings.apiKey,
                settings.openaiApiKey,
                settings.openRouterApiKey,
                settings.localBaseUrl,
                settings.localModelId
            );
        }

        const exists = await db.projects.get(sessionId);
        if (exists) {
            return this.loadFromCodex(sessionId);
        }

        this.addLog('system', 'No previous session found (Tabula Rasa).');
        // Initial state is naturally handled by fresh store/db
    }

    public async clearLogs() {
        await db.logs.clear();
        // We add a new log so it's not completely empty, verifying the action
        await this.addLog('system', 'Logs manually cleared.');
    }

    public async clearSession() {
        // Clear DB
        await db.nodes.clear();
        await db.edges.clear();
        await db.logs.clear();
        await db.memories.clear();
        await db.knowledge_graph.clear();

        // Reset Store
        useOuroborosStore.getState().resetSession();
        useOuroborosStore.getState().setCurrentSession(null, null);

        this.addLog('system', 'Session wiped. Tabula Rasa.');
    }

    // Keep Full DB Import/Export if needed, or remove. 
    // Implementing basic version re-using dexie export if we wanted, but for now removing to cleanup code as Codex supersedes it for sessions.
    // If user asked for full DB backup, we'd keep it. 
    // The previous implementation had exportDatabase logic. I'll leave a stub or removal.
    // I will simply not include it in this replacement block, effectively removing it.

    public async exportDatabase(): Promise<string> {
        // Re-implementing lightly to avoid breaking calls if any
        const projects = await db.projects.toArray();
        return JSON.stringify({ version: '2.6', projects }, null, 2);
    }

    public async importDatabase(jsonString: string) {
        // Deprecated in favor of importCodexItem, but supporting bulk import if needed
        this.addLog('warn', 'Full Database Import is deprecated. Use Session Import.');
    }



    public async runOracle(userMessage: string, history: OracleMessage[], isSilentContext: boolean = false): Promise<number> {
        const settings = useOuroborosStore.getState().settings;
        const oracleModel = settings.model_oracle || settings.model;

        // Only add user message if it's not a silent context (system initialization)
        if (!isSilentContext) {
            useOuroborosStore.getState().addOracleMessage({
                role: 'user',
                content: userMessage,
                timestamp: Date.now()
            });
        }

        const systemPrompt = `
        You are The Oracle, a proactive requirements analyst.
        Your goal is to interview the user to uncover "unknown unknowns" and hidden constraints.
        
        Current Conversation History:
        ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
        
        ${isSilentContext
                ? `User's Initial Context/Notes: "${userMessage}"\n\nTask:\n1. Analyze the user's initial notes.\n2. Formulate a greeting and a targeted first question to clarify the vision.`
                : `User's Latest Input: "${userMessage}"\n\nTask:\n1. Analyze the user's request for ambiguity.\n2. Identify missing information.`}
        
        3. Formulate a response that acknowledges the input and asks a targeted, high-value question.
        4. Estimate a "Clarity Score" (0-100) representing how ready this idea is for implementation.
        
        Return JSON:
        {
            "response": "Your conversational response...",
            "clarity_score": number
        }
        `;

        try {
            const resp = await this.ai.models.generateContent({
                model: oracleModel,
                contents: systemPrompt,
                config: { responseMimeType: "application/json" }
            });

            const data = this.extractJson(resp.text || "{}");

            useOuroborosStore.getState().addOracleMessage({
                role: 'oracle',
                content: data.response || "I am pondering...",
                timestamp: Date.now()
            });

            useOuroborosStore.getState().setClarityScore(data.clarity_score || 50);

            return data.clarity_score || 50;

        } catch (e) {
            console.error("Oracle failed:", e);
            return 0;
        }
    }

    public async initiateOracleInterview(initialContext: string): Promise<void> {
        // Clear existing history if any (though usually called on empty)
        // We pass the initial context as a "silent" user message so the LLM sees it but it's not logged as a chat bubble
        await this.runOracle(initialContext, [], true);
    }

    public async performContextFusion(history: OracleMessage[]): Promise<any> {
        const settings = useOuroborosStore.getState().settings;
        const oracleModel = settings.model_oracle || settings.model;

        const systemPrompt = `
        You are the Context Fusion Engine.
        Your task is to synthesize a chaotic interview transcript into a structured "Prima Materia" specification.
        
        Transcript:
        ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
        
        Output a detailed JSON specification containing:
        - Project Name
        - Core Objective
        - Key Features (List)
        - Technical Constraints
        - User Personas
        - "Unknown Unknowns" Identified
        
        This JSON will be fed into the Ouroboros Engine.
        `;

        try {
            const resp = await this.ai.models.generateContent({
                model: oracleModel,
                contents: systemPrompt,
                config: { responseMimeType: "application/json" }
            });

            const data = this.extractJson(resp.text || "{}");
            return data;
        } catch (e) {
            console.error("Context Fusion failed:", e);
            return null;
        }
    }

    // --- CORE LOGIC ---

    public async startRefinement(goal: string, activeDepts: string[] = ['strategy', 'ux', 'engineering', 'security']) {
        if (!goal.trim()) return;

        // Reset Store
        useOuroborosStore.getState().resetSession();
        useOuroborosStore.getState().setDocumentContent(goal);
        useOuroborosStore.getState().setOriginalRequirements(goal);
        useOuroborosStore.getState().setStatus('thinking');

        // Clear DB for new session (Refine Mode only)
        await this.clearNodesForMode('refine');
        await db.logs.clear(); // Maybe we want to keep logs? Or filter them too? For now, clear logs is standard behavior for new run.
        await this.saveSession(); // Save initial state

        this.addLog('system', 'Summoning the Council of Experts...');

        // BUILD THE SQUAD GRAPH
        const nodes: Record<string, Node> = {};
        const edges: { source: string; target: string }[] = [];
        const roundId = Math.random().toString(36).substr(2, 3);
        const alchemistId = `alchemist_${roundId}`;

        if (!this.ai) {
            this.ai = new UnifiedLLMClient(
                process.env.API_KEY || "",
                process.env.OPENAI_API_KEY || "",
                process.env.OPENROUTER_API_KEY || ""
            );
        }

        // Ensure keys are up to date from Settings/Env before starting Prism
        const settings = useOuroborosStore.getState().settings;
        const googleKey = this.apiKey || process.env.API_KEY || "";
        const openaiKey = this.openaiApiKey || process.env.OPENAI_API_KEY || "";
        const openRouterKey = settings.openRouterApiKey || process.env.OPENROUTER_API_KEY || "";
        this.ai.updateKeys(googleKey || undefined, openaiKey || undefined, openRouterKey || undefined);

        const ai = this.ai;
        // 1. Spawn The Squad (Dynamic via Prism)
        const domainLeadIds: string[] = [];

        // PHASE 1: Create Domain Leads (Immediate Feedback)
        for (const deptKey of activeDepts) {
            const leadId = `lead_${deptKey}_${roundId}`;
            domainLeadIds.push(leadId);

            nodes[leadId] = {
                id: leadId, type: 'domain_lead', label: `${deptKey} Lead`,
                persona: `Head of ${deptKey}`,
                department: deptKey,
                instruction: `Review the insights from your specialists.Weigh them based on their Confidence Score.Vote on the best features.Synthesize a unified ${deptKey} strategy.`,
                dependencies: [],
                status: 'pending', output: null, depth: 1,
                mode: 'refine'
            };
        }
        // Initial Render: Show Leads immediately
        this.updateGraph(nodes, edges);

        // PHASE 2: Spawn Specialists (Incremental Update)
        for (const deptKey of activeDepts) {
            const leadId = `lead_${deptKey}_${roundId}`;

            // Call Prism for this specific department
            const prismModel = settings.model_prism || settings.model;
            const isOverride = !!settings.model_prism && settings.model_prism !== settings.model;
            this.addLog('system', `Prism analyzing for ${deptKey} using model: ${prismModel}${isOverride ? ' (Tier Override)' : ''}...`);
            console.log(`[Engine] Calling Prism for ${deptKey} with model ${prismModel}`);

            let deptAgents;
            try {
                deptAgents = await this.prismController.analyzeTask(goal, this.getHydraAI(), prismModel, deptKey);
                console.log(`[Engine] Prism returned ${deptAgents.length} agents for ${deptKey}`);
            } catch (err) {
                console.error(`[Engine] Prism failed for ${deptKey}:`, err);
                this.addLog('error', `Prism failed for ${deptKey}. Using fallback.`);
                deptAgents = []; // Fallback handled inside analyzeTask usually, but just in case of timeout throw
            }

            const agentsToSpawn = deptAgents.length > 0 ? deptAgents : [{
                id: `${deptKey}_default`,
                role: `${deptKey} Specialist`,
                persona: `You are a ${deptKey} expert.`,
                temperature: 0.7,
                capabilities: []
            }];

            agentsToSpawn.forEach((agent, idx) => {
                const specId = `${deptKey}_${agent.id}_${idx}_${roundId}`;
                nodes[specId] = {
                    id: specId, type: 'specialist', label: agent.role,
                    persona: agent.persona, department: deptKey,
                    instruction: "Analyze the spec. You are a DISSENTER. Do not agree with the status quo. Find flaws, edge cases, and alternative approaches. If you agree, you fail.",
                    dependencies: [],
                    status: 'pending', output: null, depth: 2,
                    data: { temperature: agent.temperature },
                    mode: 'refine'
                };
                edges.push({ source: specId, target: leadId });
                nodes[leadId].dependencies.push(specId);
            });

            // Update Graph after EACH department is generated
            this.updateGraph(nodes, edges);
        }

        // 2. Spawn The Alchemist (Synthesizer)
        nodes[alchemistId] = {
            id: alchemistId, type: 'synthesizer', label: 'The Alchemist',
            persona: 'Grand Architect',
            instruction: 'Consume the unified domain strategies. Weave them into the Prima Materia. Ensure holistic consistency.',
            dependencies: domainLeadIds,
            status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        domainLeadIds.forEach(id => edges.push({ source: id, target: alchemistId }));

        // 3. Spawn The Tribunal (Voting Mechanism)
        const tribunalId = `tribunal_${roundId}`;
        nodes[tribunalId] = {
            id: tribunalId, type: 'gatekeeper', label: 'The Tribunal',
            persona: 'Supreme Court of Verification',
            instruction: 'Verify the Transmuted Spec against the Constitution. Vote PASS or FAIL.',
            dependencies: [alchemistId],
            status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        edges.push({ source: alchemistId, target: tribunalId });

        this.updateGraph(nodes, edges);

        // Persist initial state
        await db.transaction('rw', db.nodes, db.edges, async () => {
            await db.nodes.bulkPut(Object.values(nodes));
            // Edges need to be mapped to DB format if we store them
            // For now, we rely on updateGraph to handle DB persistence or do it here
            // updateGraph handles it.
        });

        this.processGraph();
    }

    public async startPlanning(goal: string) {
        if (!goal.trim()) return;

        useOuroborosStore.getState().resetSession();
        useOuroborosStore.getState().setDocumentContent(goal);
        useOuroborosStore.getState().setOriginalRequirements(goal);
        useOuroborosStore.getState().setStatus('thinking');

        // Clear DB for new session (Plan Mode only)
        await this.clearNodesForMode('plan');
        // await db.logs.clear(); // Keep logs from refinement?
        await this.saveSession();

        this.addLog('system', 'Initiating MANIFESTATION Sequence...');

        const rootId = 'head_of_snake';
        const initialNodes: Record<string, Node> = {
            [rootId]: {
                id: rootId, type: 'architect', label: 'Head of Ouroboros',
                persona: 'Grand Architect',
                instruction: 'Analyze the Transmuted Spec. Break it down into 3-5 distinct structural domains. Return JSON.',
                dependencies: [], status: 'pending', output: null, depth: 0,
                mode: 'plan'
            }
        };

        this.updateGraph(initialNodes, []);

        await db.nodes.put(initialNodes[rootId]);

        this.processGraph();
    }

    public async processGraph() {
        useOuroborosStore.getState().setStatus('thinking');
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let active = true;

        const checkRunnable = async () => {
            if (!active || signal.aborted) return;

            // Fetch nodes from DB
            const allNodes = await db.nodes.toArray();
            const nodesRef: Record<string, Node> = allNodes.reduce((acc, n) => ({ ...acc, [n.id]: n }), {});

            const pendingNodes = allNodes.filter(n => n.status === 'pending');
            const runningNodes = allNodes.filter(n => n.status !== 'pending' && n.status !== 'complete' && n.status !== 'error' && n.status !== 'planned');

            if (pendingNodes.length === 0 && runningNodes.length === 0) {
                const tribunalNodes = allNodes.filter(n => n.type === 'gatekeeper' && n.status === 'complete');

                if (tribunalNodes.length > 0) {
                    const lastJudge = tribunalNodes[tribunalNodes.length - 1];
                    const roundId = lastJudge.id.split('_').pop();
                    const currentRoundJudges = tribunalNodes.filter(n => n.id.endsWith(`_${roundId}`));

                    const scores = currentRoundJudges.map(n => n.score || 0);
                    const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
                    const variance = this.votingSystem.calculateVariance(scores);

                    this.addLog('system', `[Round ${roundId}] Tribunal Consensus: ${avgScore.toFixed(1)} / 100 (Variance: ${variance.toFixed(1)})`);

                    if (useOuroborosStore.getState().settings.enableMultiRoundVoting && variance > 200) {
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
                                            dependencies: [alchemist.id], status: 'pending', output: null, depth: 0,
                                            mode: 'refine'
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
                            useOuroborosStore.getState().setDocumentContent(useOuroborosStore.getState().documentContent + "\n\n> ⚠️ **SYSTEM ALERT**: Tribunal Consensus Failed. Human Review Required.");
                            useOuroborosStore.getState().setStatus('idle'); // STOP EXECUTION
                            active = false;
                            return;
                        }
                    }

                    const threshold = useOuroborosStore.getState().settings.consensusThreshold || 85;
                    if (avgScore < threshold) {
                        if (Object.keys(nodesRef).length < 20) {
                            this.addLog('warn', `Consensus weak (< ${threshold}). Triggering Prism Refinement...`);
                            // We no longer blindly expand. The Tribunal node will handle the Prism trigger.
                            // This prevents double-branching.
                            return;
                        } else {
                            this.addLog('warn', 'Consensus weak, but Cycle Limit Reached (Max Nodes). Halting.');
                            useOuroborosStore.getState().setStatus('idle');
                            active = false;
                            return;
                        }
                    }
                }

                useOuroborosStore.getState().setStatus('idle');
                this.addLog('success', 'Cycle Complete. The snake rests.');
                active = false;
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
            const activePending = await db.nodes.where('status').equals('pending').toArray();

            const runnable = activePending.filter(node => {
                return node.dependencies.every(depId => {
                    const depNode = nodesRef[depId];
                    return depNode?.status === 'complete';
                });
            });

            if (runnable.length > 0) {
                const results = await Promise.all(runnable.map(node => this.executeNode(node.id, checkRunnable, signal)));
                if (results.includes(false)) {
                    active = false;
                    useOuroborosStore.getState().setStatus('idle');
                    this.addLog('warn', 'Execution paused for Human Review.');
                    return;
                }
                checkRunnable();
            } else {
                const runningCount = Object.values(nodesRef).filter(n => n.status === 'running' || n.status === 'critiquing' || n.status === 'synthesizing' || n.status === 'evaluating' || n.status === 'planning').length;

                if (activePending.length > 0 && runningCount > 0) {
                    setTimeout(checkRunnable, 1000);
                } else if (activePending.length > 0 && runningCount === 0) {
                    this.addLog('error', 'Deadlock detected. Stopping execution.');
                    useOuroborosStore.getState().setStatus('idle');
                    active = false;
                }
            }
        };

        checkRunnable();
    }

    public async retryNode(nodeId: string, modelOverride?: string, updateGlobal: boolean = false) {
        const node = await db.nodes.get(nodeId);
        if (!node) return;

        const update: Partial<Node> = {
            status: 'pending',
            distress: false,
            failedModel: undefined,
            lastHydraLog: undefined
        };

        if (modelOverride) {
            update.data = { ...(node.data || {}), modelOverride };
            this.penaltyBox.clear(modelOverride);

            if (updateGlobal) {
                this.addLog('system', `Hydra Protocol: Updating Session Global Model to ${modelOverride}`, nodeId);
                await this.updateSettings({ model: modelOverride });
            }
        }

        await this.updateNodeState(nodeId, update);
        this.addLog('system', `Rescue Mission: Retrying ${node.label}...`, nodeId);
        this.processGraph();
    }

    private apiKey: string | null = null;
    private openaiApiKey: string | null = null;

    public setApiKey(key: string) {
        this.apiKey = key;
        this.ai.updateKeys(key, undefined);
    }

    public setOpenAIKey(key: string) {
        this.openaiApiKey = key;
        this.ai.updateKeys(undefined, key);
    }

    public setOpenRouterKey(key: string) {
        this.ai.updateKeys(undefined, undefined, key);
    }

    private async executeNode(nodeId: string, checkRunnableCallback: () => void, signal: AbortSignal, retryCount: number = 0): Promise<boolean> {
        if (signal.aborted) return false;

        const node = await db.nodes.get(nodeId);
        if (!node) return false;

        let status: NodeStatus = 'running';
        if (node.type === 'specialist') status = 'critiquing';
        if (node.type === 'domain_lead') status = 'synthesizing';
        if (node.type === 'synthesizer') status = 'synthesizing';
        if (node.type === 'gatekeeper') status = 'evaluating';
        if (['architect', 'tech_lead', 'estimator'].includes(node.type)) status = 'planning';

        await this.updateNodeState(nodeId, { status });

        const startTime = Date.now();
        let lastPrompt = "";
        let rawResponse = "";

        try {
            await this.apiSemaphore.acquire();
            if (signal.aborted) {
                this.apiSemaphore.release();
                return false;
            }

            await this.rateLimiter.waitForSlot();
            this.rateLimiter.recordRequest();

            const settings = useOuroborosStore.getState().settings;

            // Ensure keys are up to date (in case they were set via SettingsPanel but not env)
            const googleKey = this.apiKey || process.env.API_KEY || "";
            const openaiKey = this.openaiApiKey || process.env.OPENAI_API_KEY || "";
            const openRouterKey = settings.openRouterApiKey || process.env.OPENROUTER_API_KEY || "";
            this.ai.updateKeys(googleKey || undefined, openaiKey || undefined, openRouterKey || undefined, settings.localBaseUrl, settings.localModelId);

            const ai = this.ai;
            let selectedModel = settings.model;

            // Tiered Model Selection
            if (node.type === 'specialist' && settings.model_specialist) selectedModel = settings.model_specialist;
            if ((node.type === 'domain_lead' || node.type === 'tech_lead') && settings.model_lead) selectedModel = settings.model_lead;
            if (node.type === 'architect' && settings.model_architect) selectedModel = settings.model_architect;
            if (node.type === 'synthesizer' && settings.model_synthesizer) selectedModel = settings.model_synthesizer;
            if (node.type === 'gatekeeper' && settings.model_judge) selectedModel = settings.model_judge;

            // Hydra Rescue Override
            if (node.data?.modelOverride) {
                selectedModel = node.data.modelOverride;
            }
            const dependencyOutputs = await Promise.all(node.dependencies.map(async d => {
                const depNode = await db.nodes.get(d);
                if (!depNode) return "";
                const scoreStr = depNode.score ? `[Confidence: ${depNode.score}%]` : '';

                let content = depNode.output;
                if (depNode.artifacts && (depNode.artifacts.specification || depNode.artifacts.code || depNode.artifacts.proof)) {
                    content = `
                    SUMMARY: ${depNode.output}
                    
                    SPECIFICATION:
                    ${depNode.artifacts.specification || "N/A"}
                    
                    CODE:
                    ${depNode.artifacts.code || "N/A"}
                    
                    PROOF:
                    ${depNode.artifacts.proof || "N/A"}
                    `;
                }

                return `FROM [${depNode.label}] ${scoreStr}:\n${content}`;
            }));
            const dependencyOutputsStr = dependencyOutputs.join('\n\n');

            // --- MDAP: Memory Injection ---
            let instructionContext = node.instruction;
            if (settings.enableAgentMemory) {
                instructionContext = await this.memoryManager.injectMemoryContext(node.persona, instructionContext);
            }

            let resultText = "";
            let resultData: any = null;
            let score = 0;

            // --- MDAP: Retry Loop for Red Flagging ---
            let attempts = 0;
            const maxAttempts = settings.enableRedFlagging ? 3 : 1;
            let currentTemp = 0.7;
            let executionValid = false;

            while (attempts < maxAttempts && !executionValid) {
                attempts++;
                const generationConfig = {
                    temperature: node.data?.temperature || currentTemp
                };

                if (node.type === 'specialist') {
                    this.addLog('info', `${node.label} is analyzing... (Attempt ${attempts})`, nodeId);
                    lastPrompt = `You are: ${node.persona}.
                    
                    THE PRIMA MATERIA (SPEC):
                    """
                    ${useOuroborosStore.getState().documentContent}
                    """
                    
                    YOUR LENS: ${instructionContext}
                    
                    Provide specific, actionable insights.
                    CRITICAL: If proposing code, provide the COMPLETE, production-ready code. No placeholders.
                    CRITICAL: Your output must be valid JSON.
                    
                    Return JSON: { "insight": "markdown string...", "confidence": number }`;

                    const specialistConfig = {
                        ...generationConfig,
                        responseMimeType: "application/json"
                    };

                    const resp = await this.callLLM(
                        selectedModel,
                        lastPrompt,
                        specialistConfig
                    );
                    if (resp.modelUsed) selectedModel = resp.modelUsed;
                    rawResponse = resp.text || "";
                    resultData = this.extractJson(resp.text || "{}");
                    resultText = resultData?.insight || "No insights.";
                    score = resultData?.confidence || 0;

                    // Normalize Score (Handle 0-1 vs 0-100)
                    if (score > 0 && score <= 1) {
                        score = Math.round(score * 100);
                    }

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
                    lastPrompt = `You are: ${node.persona}.
                    
                    YOUR SPECIALISTS' INSIGHTS (Divergent Views):
                    ${dependencyOutputsStr}
                    
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
                    }`;

                    const resp = await this.generateWithHydra(selectedModel, lastPrompt, { responseMimeType: "application/json" });
                    if (resp.modelUsed) selectedModel = resp.modelUsed;
                    rawResponse = resp.text || "";

                    resultData = this.extractJson(resp.text || "{}");

                    // Construct full report for visibility and downstream agents
                    const summary = resultData?.summary || "No summary provided.";
                    const spec = resultData?.specification || "No specification provided.";
                    const code = resultData?.code || "No code provided.";
                    const proof = resultData?.proof || "No proof provided.";

                    resultText = `
# EXECUTIVE SUMMARY
${summary}

# SPECIFICATION
${spec}

# IMPLEMENTATION PLAN
${code}

# VERIFICATION PROOF
${proof}
`;

                    await this.updateNodeState(nodeId, {
                        artifacts: {
                            specification: spec,
                            code: code,
                            proof: proof
                        },
                        data: { ...(node.data || {}), summary: summary }
                    });

                } else if (node.type === 'synthesizer') { // The Alchemist
                    this.addLog('system', `Alchemist Transmuting...`, nodeId);
                    lastPrompt = `You are: ${node.persona}.
                    
                    THE OLD MATTER:
                    """
                    ${useOuroborosStore.getState().documentContent}
                    """
                    
                    THE COUNCIL'S DECREES (Domain Strategies):
                    ${dependencyOutputsStr}
                    
                    TASK: ${instructionContext}
                    
                    Rewrite the Prima Materia to incorporate ALL valid insights. Make it seamless.
                    Return the FULL Markdown document.
                    
                    CRITICAL: Do not summarize. Retain all technical details.
                    INTEGRITY PROTOCOL: Compare "Old Matter" vs "Council Decrees".
                    - If "Old Matter" has detailed code/logic and "Decree" is generic -> KEEP OLD MATTER.
                    - If "Decree" fixes a bug -> MERGE it specifically.
                    - NEVER replace working implementations with placeholders.
                    
                    Structure the document with:
                    1. **Architecture Overview** (Mermaid diagrams if applicable)
                    2. **Core Algorithms & Logic** (Pseudocode/Python)
                    3. **Data Structures** (JSON/Schemas)
                    4. **User Experience Flow** (Step-by-step)
                    
                    Avoid marketing fluff. Prioritize engineering density.`;

                    const resp = await this.generateWithHydra(selectedModel, lastPrompt);
                    if (resp.modelUsed) selectedModel = resp.modelUsed;
                    rawResponse = resp.text || "";
                    resultText = resp.text || useOuroborosStore.getState().documentContent;
                    useOuroborosStore.getState().setDocumentContent(resultText);
                    this.addLog('success', `Transmutation Complete`, nodeId);

                } else if (node.type === 'gatekeeper') {
                    this.addLog('system', `Tribunal is in session for ${node.label}...`, nodeId);

                    const roundMatch = nodeId.match(/_([^_]+)$/);
                    const currentRoundId = roundMatch ? roundMatch[1] : '';

                    const nodesRef = (await db.nodes.toArray()).reduce((acc, n) => ({ ...acc, [n.id]: n }), {} as Record<string, Node>);
                    const synthesizerNode = Object.values(nodesRef).find((n: Node) => n.type === 'synthesizer' && n.id.includes(currentRoundId)) as Node | undefined;
                    const artifacts = synthesizerNode?.artifacts;

                    let specToVerify = instructionContext;
                    if (artifacts && artifacts.specification) {
                        specToVerify = `
                        CODE:
                        ${artifacts.code || "N/A"}
                        
                        SPECIFICATION:
                        ${artifacts.specification}
                        
                        PROOF:
                        ${artifacts.proof || "N/A"}
                        `;
                    } else if (synthesizerNode && synthesizerNode.output) {
                        // Fallback to full output if artifacts are missing (e.g. Alchemist)
                        specToVerify = synthesizerNode.output;
                    }

                    const votingResult = await this.votingSystem.conductVoting(
                        specToVerify,
                        1,
                        ai,
                        {
                            default: selectedModel,
                            cheap: "gemini-1.5-flash",
                            advanced: "gemini-1.5-pro"
                        },
                        "Verify this artifact set. Check for Logic, Requirements, and Proof validity.",
                        useOuroborosStore.getState().originalRequirements
                    );

                    resultText = formatVotingResult(votingResult);
                    score = votingResult.averageScore;
                    resultData = votingResult;

                    const threshold = useOuroborosStore.getState().settings.consensusThreshold || 85;
                    if (votingResult.requiresHumanReview || score < threshold) {
                        // RECURSIVE DECOMPOSITION / AUTO-CORRECTION
                        if (this.prismController.shouldDecompose(nodeId)) {

                            if (votingResult.requiresHumanReview) {
                                // VETO: Trigger Auto-Correction
                                this.addLog('warn', `VETO Triggered. Initiating Recursive Auto-Correction...`, nodeId);
                                const vetoReason = votingResult.judgeOutputs.find((j: any) => j.score === 0)?.reasoning || "Unknown Veto";
                                const correction = await this.prismController.analyzeVeto(vetoReason, useOuroborosStore.getState().documentContent, this.getHydraAI(), selectedModel);

                                await this.triggerCorrectionLoop(nodeId, vetoReason, correction.correctionPlan, correction.suggestedAgents);
                                this.prismController.resetFailureCount(nodeId);
                                executionValid = true;

                            } else {
                                // Standard Decomposition (Low Score)
                                this.addLog('warn', `Verification Failed > 2 times. Triggering Recursive Decomposition...`, nodeId);
                                const subTasks = await this.prismController.decomposeTask(nodeId, useOuroborosStore.getState().documentContent, this.getHydraAI(), selectedModel);

                                if (subTasks.length > 0) {
                                    this.addLog('system', `Prism Decomposed into ${subTasks.length} agents. Spawning recursive squad...`, nodeId);

                                    // Use the new Recursive Loop instead of basic tree expansion
                                    await this.triggerPrismRefinementLoop(nodeId, subTasks);

                                    this.prismController.resetFailureCount(nodeId);
                                    executionValid = true;
                                } else {
                                    this.addLog('error', 'Decomposition failed. Escalating to human review.', nodeId);
                                }
                            }
                        }

                        // Pause execution if human review is required AND we didn't auto-correct
                        if (votingResult.requiresHumanReview && !executionValid) {
                            this.apiSemaphore.release();
                            await this.updateNodeState(nodeId, { status: 'complete', output: resultText, score: score, data: resultData });
                            return false;
                        }
                    }
                } else if (node.type === 'architect') {
                    this.addLog('system', `${node.label} is architecting the system...`, nodeId);
                    lastPrompt = `You are: ${node.persona}.
                        
                        THE SPECIFICATION:
                        """
                        ${useOuroborosStore.getState().documentContent}
                        """
                        
                        TASK: ${instructionContext}
                        Break the system down into 3-5 distinct structural domains (modules).
                        
                        Return JSON:
                        {
                            "modules": [
                                { "id": "string (unique)", "title": "string", "description": "string" }
                            ]
                        }`;

                    const resp = await this.generateWithHydra(selectedModel, lastPrompt, { responseMimeType: "application/json" });
                    if (resp.modelUsed) selectedModel = resp.modelUsed;
                    rawResponse = resp.text || "";

                    resultData = this.extractJson(resp.text || "{}");
                    resultText = "Architecture Defined.";

                    if (resultData?.modules) {
                        this.expandPlanningTree(nodeId, resultData.modules, 'modules', (node.depth || 0) + 1, 'pending', node.mode);
                    }
                } else if (node.type === 'tech_lead') {
                    this.addLog('system', `${node.label} is planning tasks...`, nodeId);
                    lastPrompt = `You are: ${node.persona}.
                        
                        THE SPECIFICATION:
                        """
                        ${useOuroborosStore.getState().documentContent}
                        """
                        
                        TASK: ${instructionContext}
                        Break this domain down into 3-5 specific, actionable development tasks.
                        
                        Return JSON:
                        {
                            "tasks": [
                                { "id": "string (unique)", "title": "string", "instruction": "string", "minimalContext": "string" }
                            ]
                        }`;

                    const resp = await this.callLLM(
                        selectedModel,
                        lastPrompt,
                        { responseMimeType: "application/json" }
                    );
                    if (resp.modelUsed) selectedModel = resp.modelUsed;
                    rawResponse = resp.text || "";

                    resultData = this.extractJson(resp.text || "{}");
                    resultText = "Domain Planning Complete.";

                    if (resultData?.tasks) {
                        this.expandPlanningTree(nodeId, resultData.tasks, 'tasks', (node.depth || 0) + 1, 'planned', node.mode);
                    }
                }

                // --- MDAP: Red Flag Validation ---
                if (settings.enableRedFlagging) {
                    const validation = this.redFlagValidator.validate(resultText, score);
                    await this.updateNodeState(nodeId, { redFlags: validation.flags });

                    if (!validation.passed) {
                        this.addLog('warn', `Red Flags: ${validation.flags.map(f => f.type).join(', ')} `, nodeId);
                        if (validation.shouldRetry && attempts < maxAttempts) {
                            const retryMsg = await this.redFlagValidator.retry(nodeId, validation.suggestedTemperature || currentTemp);
                            this.addLog('warn', retryMsg, nodeId);
                            if (retryMsg.includes("ESCALATED")) {
                                this.addLog('warn', `Red Flags Escalated. Spawning Quality Control Agent...`, nodeId);
                                console.log(`[Engine] ESCALATION: Spawning QC Agent for node ${nodeId}`);
                                const fixTask = {
                                    id: `${nodeId}_qc_fix`,
                                    title: `Fix Red Flags for ${node.label}`,
                                    instruction: `The previous output failed validation:\n${validation.flags.map(f => f.message).join('\n')}\n\nFix the output to adhere to quality standards.`,
                                    minimalContext: resultText
                                };
                                // Ensure we are passing strict 'refine' mode to ensure visibility on the graph
                                this.expandPlanningTree(nodeId, [fixTask], 'tasks', (node.depth || 0) + 1, 'pending', 'refine');
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
                        cycle: 1,
                        artifacts: node.artifacts
                    }
                );

                node.dependencies.forEach(depId => {
                    this.knowledgeGraphManager.addEdge(depId, nodeId, 'influences', 1.0);
                });
            }

            // --- MDAP: Store Memory ---
            if (settings.enableAgentMemory) {
                const memoryItem = {
                    cycle: 1,
                    feedback: resultText.substring(0, 100) + "...",
                    outcomeScore: score,
                    timestamp: Date.now(),
                    adopted: true
                };

                await this.memoryManager.storeMemory(node.persona, {
                    ...memoryItem,
                    agentId: node.persona // Ensure agentId is set for DB
                }, ai, selectedModel, settings.enableMultiRoundVoting ? this.votingSystem : undefined);

                // Update Node Memory in DB for UI
                const currentMemory = node.memory || [];
                await this.updateNodeState(nodeId, { memory: [...currentMemory, memoryItem] });
            }

            this.apiSemaphore.release();
            await this.updateNodeState(nodeId, {
                status: 'complete',
                output: resultText,
                score: score,
                data: resultData,
                debugData: {
                    lastPrompt,
                    rawResponse,
                    timestamp: Date.now(),
                    modelUsed: selectedModel,
                    executionTimeMs: Date.now() - startTime
                }
            });
            return true;

        } catch (e) {
            console.error(e);
            this.apiSemaphore.release();
            const err = e as Error;

            // HYDRA HANDLER
            if (e instanceof AllHeadsSeveredError || err.name === 'AllHeadsSeveredError') {
                this.addLog('error', `HYDRA: All heads severed for ${node.label}. Manual Intervention Required.`, nodeId);
                await this.updateNodeState(nodeId, {
                    status: 'distress',
                    failedModel: "All Tiers Exhausted",
                    lastHydraLog: err.message,
                    output: `HYDRA FAILURE: ${err.message}`
                });
                return false;
            }

            if (err.message.includes("quota") || err.message.includes("429")) {
                const waitTimeSeconds = Math.min(3 * Math.pow(2, retryCount), 30);
                const waitTimeMs = waitTimeSeconds * 1000;

                this.addLog('warn', `Quota Limit Hit (429). Pausing for ${waitTimeSeconds}s before retrying (Attempt ${retryCount + 1})...`, nodeId);
                await this.updateNodeState(nodeId, { status: 'pending' });
                await new Promise(resolve => setTimeout(resolve, waitTimeMs));

                if (signal.aborted) {
                    this.addLog('info', "Retry aborted during wait.", nodeId);
                    return false;
                }

                return this.executeNode(nodeId, checkRunnableCallback, signal, retryCount + 1);
            }

            this.addLog('error', err.message, nodeId);
            await this.updateNodeState(nodeId, { status: 'error', output: err.message });

            if (this.prismController.shouldDecompose(nodeId)) {
                this.addLog('warn', `Task ${node.label} failed repeatedly. Triggering Recursive Decomposition...`, nodeId);

                const subTasks = await this.prismController.decomposeTask(
                    nodeId,
                    useOuroborosStore.getState().documentContent,
                    this.getHydraAI(),
                    useOuroborosStore.getState().settings.model
                );

                if (subTasks.length > 0) {
                    this.addLog('system', `Decomposed into ${subTasks.length} micro-tasks. Spawning new agents...`, nodeId);
                    this.expandPlanningTree(nodeId, subTasks, 'tasks', (node.depth || 0) + 1, 'pending', node.mode);
                    this.prismController.resetFailureCount(nodeId);
                } else {
                    this.addLog('error', 'Decomposition failed. Escalating to human review.', nodeId);
                }
            }
            return false;
        }
    }
    private async addLog(level: LogEntry['level'], message: string, nodeId?: string) {
        const log = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            level,
            message,
            nodeId
        };
        await db.logs.add(log);
    }

    // --- HELPER METHODS ---

    private async updateNodeState(id: string, updates: Partial<Node>) {
        await db.nodes.update(id, updates);
        // Store update removed as we rely on DB + useLiveQuery
    }

    private async updateGraph(newNodes: Record<string, Node>, newEdges: { source: string, target: string }[]) {
        // 1. Fetch ALL existing nodes from DB to merge with newNodes for layout
        const existingNodesArr = await db.nodes.toArray();
        const existingNodes = existingNodesArr.reduce((acc, n) => ({ ...acc, [n.id]: n }), {} as Record<string, Node>);

        // 2. Merge
        const mergedNodes = { ...existingNodes, ...newNodes };

        // 3. Calculate Layout
        const layoutedNodes = this.calculateLayout(mergedNodes);

        // 4. Persist to DB
        await db.transaction('rw', db.nodes, db.edges, async () => {
            // Update all nodes with new layout
            await db.nodes.bulkPut(Object.values(layoutedNodes));

            for (const edge of newEdges) {
                const exists = await db.edges.where('source').equals(edge.source).and(e => e.target === edge.target).first();
                if (!exists) {
                    await db.edges.add({ source: edge.source, target: edge.target, type: 'dependency' });
                }
            }
        });

    }

    private async expandPlanningTree(parentId: string, items: any[], type: 'modules' | 'tasks', depth: number, initialStatus: NodeStatus = 'pending', mode: AppMode = 'plan') {
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
                status: initialStatus
            }));
            await this.updateNodeState(parentId, { microTasks });
        }

        // Fetch existing nodes to prevent duplicates
        const existingNodesArr = await db.nodes.toArray();
        const existingNodeIds = new Set(existingNodesArr.map(n => n.id));
        const existingNodeLabels = new Set(existingNodesArr.map(n => n.label));

        items.forEach((item: any) => {
            if (type === 'modules') {
                const nodeId = `lead_${item.id}`;
                if (existingNodeIds.has(nodeId)) return; // Skip if ID exists

                newNodes[nodeId] = {
                    id: nodeId, type: 'tech_lead', label: `Domain: ${item.title.substring(0, 10)}...`,
                    persona: `Domain Keeper (${item.title})`,
                    instruction: `Analyze domain: "${item.title} - ${item.description}".`,
                    dependencies: [parentId], status: 'pending', output: null, depth: depth,
                    mode: mode
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
                const label = item.minimalContext || item.title;

                // Deduplication check: ID or Label
                if (existingNodeIds.has(nodeId) || existingNodeLabels.has(label)) {
                    this.addLog('warn', `Skipping duplicate task: ${label}`, parentId);
                    return;
                }

                newNodes[nodeId] = {
                    id: nodeId,
                    type: 'specialist',
                    label: label.length > 40 ? label.substring(0, 37) + '...' : label,
                    persona: 'Micro-Agent Specialist',
                    instruction: item.instruction,
                    dependencies: [parentId],
                    status: initialStatus,
                    output: null,
                    depth: depth,
                    mode: mode
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
        const store = useOuroborosStore.getState();
        let currentPlan = store.projectPlan;

        if (type === 'modules') {
            currentPlan = [...currentPlan, ...newPlanItems];
        } else {
            // Recursive helper to find parent and add children
            const updateChildren = (items: PlanItem[]): PlanItem[] => {
                return items.map(item => {
                    // Check if this item is the parent
                    if (item.id === parentId || item.id === `lead_${parentId}` || item.id === parentId.replace('lead_', '')) {
                        return { ...item, children: [...(item.children || []), ...newPlanItems] };
                    }
                    // If not, check its children recursively
                    if (item.children && item.children.length > 0) {
                        return { ...item, children: updateChildren(item.children) };
                    }
                    return item;
                });
            };
            currentPlan = updateChildren(currentPlan);
        }

        store.setProjectPlan(currentPlan);
    }

    private async expandRefinementGraph(currentNodes: Record<string, Node>, currentDoc: string) {
        const store = useOuroborosStore.getState();
        const activeDepts = Object.keys(store.council).filter(k => store.council[k]);
        const deptsToSpawn = activeDepts.length > 0 ? activeDepts : ['strategy', 'engineering'];

        const roundId = Math.random().toString(36).substr(2, 3);
        const alchemistId = `alchemist_v2_${roundId}`;
        const newNodes: Record<string, Node> = {};
        const newEdges: { source: string; target: string }[] = [];

        const anchorNode = Object.values(currentNodes).find(n => n.type === 'synthesizer' && n.status === 'complete');
        if (!anchorNode) {
            this.addLog('error', 'Cannot expand graph: Previous Alchemist not found/complete.');
            return;
        }

        this.addLog('system', `Expanding Refinement Graph (Round ${roundId})...`);

        const domainLeadIds: string[] = [];

        deptsToSpawn.forEach(deptKey => {
            const leadId = `lead_${deptKey}_${roundId}`;
            newNodes[leadId] = {
                id: leadId, type: 'domain_lead', label: `${deptKey} Lead`,
                persona: `Head of ${deptKey}`, department: deptKey,
                instruction: `Re-evaluate the spec. Previous cycle failed consensus. Fix the issues identified by the Tribunal.`,
                dependencies: [], status: 'pending', output: null, depth: 1,
                mode: 'refine'
            };

            newEdges.push({ source: anchorNode.id, target: leadId });
            domainLeadIds.push(leadId);

            // CRITICAL FIX: Spawn Specialists for these new Leads so they have input
            const specId = `spec_${deptKey}_${roundId}`;
            newNodes[specId] = {
                id: specId, type: 'specialist', label: `${deptKey} Critical Thinker`,
                persona: `You are a critical thinker for ${deptKey}.`,
                department: deptKey,
                instruction: `Analyze the previous output. Identify why it failed consensus. Propose concrete improvements.`,
                dependencies: [anchorNode.id],
                status: 'pending', output: null, depth: 2,
                mode: 'refine'
            };
            newEdges.push({ source: anchorNode.id, target: specId });
            newEdges.push({ source: specId, target: leadId });
            newNodes[leadId].dependencies.push(specId);
        });

        // Alchemist needs all leads as dependencies
        newNodes[alchemistId] = {
            id: alchemistId, type: 'synthesizer', label: `Alchemist v${roundId}`,
            persona: 'Grand Architect',
            instruction: 'Refine the matter again. Higher density. Address Tribunal concerns.',
            dependencies: domainLeadIds, status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        domainLeadIds.forEach(id => newEdges.push({ source: id, target: alchemistId }));

        const tribunalId = `tribunal_${roundId}`;
        newNodes[tribunalId] = {
            id: tribunalId, type: 'gatekeeper', label: 'The Tribunal',
            persona: 'Supreme Court of Verification',
            instruction: 'Re-evaluate the spec. Vote PASS or FAIL.',
            dependencies: [alchemistId], status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        newEdges.push({ source: alchemistId, target: tribunalId });

        this.updateGraph(newNodes, newEdges);
        this.processGraph();
    }

    private async triggerCorrectionLoop(
        anchorNodeId: string,
        vetoReason: string,
        correctionPlan: string,
        suggestedAgents: any[]
    ) {
        const roundId = Math.random().toString(36).substr(2, 4);
        this.addLog('warn', `VETO Enforced. Spawning Correction Squad (Round ${roundId})...`, anchorNodeId);

        const newNodes: Record<string, Node> = {};
        const newEdges: { source: string; target: string }[] = [];
        const alchemistId = `alchemist_${roundId}`;
        const leadId = `lead_correction_${roundId}`;

        // 1. Create Correction Lead
        newNodes[leadId] = {
            id: leadId, type: 'domain_lead', label: `Correction Lead`,
            persona: `Correction Supervisor`,
            department: 'correction',
            instruction: `Review the correction insights. Synthesize a fix for the VETO: "${vetoReason}". Plan: ${correctionPlan}`,
            dependencies: [anchorNodeId],
            status: 'pending', output: null, depth: 1,
            mode: 'refine'
        };
        newEdges.push({ source: anchorNodeId, target: leadId });

        // 2. Spawn Correction Specialists
        const agents = suggestedAgents.length > 0 ? suggestedAgents : [{
            id: 'fixer_default', role: 'Correction Specialist', persona: 'You are a technical fixer.', temperature: 0.5
        }];

        agents.forEach((agent, idx) => {
            const specId = `correction_${agent.id}_${idx}_${roundId}`;
            newNodes[specId] = {
                id: specId, type: 'specialist', label: agent.role,
                persona: agent.persona,
                department: 'correction',
                instruction: `Implement the Correction Plan: ${correctionPlan}`,
                dependencies: [anchorNodeId],
                status: 'pending', output: null, depth: 2,
                data: { temperature: agent.temperature },
                mode: 'refine'
            };
            newEdges.push({ source: anchorNodeId, target: specId });
            newEdges.push({ source: specId, target: leadId });
            newNodes[leadId].dependencies.push(specId);
        });

        // 3. Spawn Alchemist
        newNodes[alchemistId] = {
            id: alchemistId, type: 'synthesizer', label: `Alchemist v${roundId}`,
            persona: 'Grand Architect',
            instruction: 'Integrate the correction into the Prima Materia. Ensure the VETO is resolved.',
            dependencies: [leadId], status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        newEdges.push({ source: leadId, target: alchemistId });

        // 4. Spawn Tribunal
        const tribunalId = `tribunal_correction_${roundId}`;
        newNodes[tribunalId] = {
            id: tribunalId, type: 'gatekeeper', label: 'Correction Tribunal',
            persona: 'Supreme Court of Verification',
            instruction: `Verify the correction. VETO was: "${vetoReason}". Vote 0-100.`,
            dependencies: [alchemistId], status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        newEdges.push({ source: alchemistId, target: tribunalId });

        this.updateGraph(newNodes, newEdges);
        this.processGraph();
    }

    private async triggerPrismRefinementLoop(anchorNodeId: string, subTasks: any[]) {
        const roundId = Math.random().toString(36).substr(2, 4);
        this.addLog('system', `Prism Refinement Loop Initiated (Round ${roundId})...`, anchorNodeId);

        const newNodes: Record<string, Node> = {};
        const newEdges: { source: string; target: string }[] = [];
        const specialistIds: string[] = [];

        // 1. Spawn Specialists from Prism Tasks
        subTasks.forEach((task, idx) => {
            const specId = `prism_spec_${idx}_${roundId}`;
            // Map MicroTask properties: minimalContext -> title/label
            const title = task.minimalContext || task.title || `Specialist ${idx + 1}`;

            newNodes[specId] = {
                id: specId, type: 'specialist',
                label: title,
                persona: `Specialist Agent (${title})`,
                instruction: task.instruction || task.description || "Refine the specification.",
                dependencies: [anchorNodeId],
                status: 'pending', output: null, depth: (newNodes[anchorNodeId]?.depth || 0) + 1,
                mode: 'refine'
            };
            newEdges.push({ source: anchorNodeId, target: specId });
            specialistIds.push(specId);
        });

        // 2. Spawn Alchemist
        const alchemistId = `alchemist_${roundId}`;
        newNodes[alchemistId] = {
            id: alchemistId, type: 'synthesizer', label: `Alchemist v${roundId}`,
            persona: 'Grand Architect',
            instruction: 'Synthesize the output from the specialists into a cohesive refined solution.',
            dependencies: specialistIds, status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        specialistIds.forEach(id => newEdges.push({ source: id, target: alchemistId }));

        // 3. Spawn Tribunal
        const tribunalId = `tribunal_${roundId}`;
        newNodes[tribunalId] = {
            id: tribunalId, type: 'gatekeeper', label: 'The Tribunal',
            persona: 'Supreme Court of Verification',
            instruction: 'Verify the refined solution. Vote PASS or FAIL.',
            dependencies: [alchemistId], status: 'pending', output: null, depth: 0,
            mode: 'refine'
        };
        newEdges.push({ source: alchemistId, target: tribunalId });

        this.updateGraph(newNodes, newEdges);
        this.processGraph();
    }

    // --- MANIFESTATION & EXPORT ---

    public async generateManifestation() {
        const store = useOuroborosStore.getState();
        const plan = store.projectPlan;

        if (!plan || plan.length === 0) {
            this.addLog('warn', 'No project plan to manifest.');
            return;
        }

        this.addLog('system', 'Generating Manifestation Sequence...');
        useOuroborosStore.getState().setStatus('thinking');

        try {
            const settings = await db.settings.get(1) || {} as AppSettings;
            const model = settings.model_manifestation || settings.model || 'gemini-2.0-flash-exp';

            const prompt = `
            You are the MANIFESTATION ENGINE.
            
            PROJECT:
            """
            ${store.documentContent}
            """
            
            IDENTIFIED PLAN:
            ${JSON.stringify(plan, null, 2)}
            
            TASK:
            Transform this plan into a "MANIFESTATION.md" file.
            This is a step-by-step implementation guide, ordered from foundational to advanced.
            
            FORMAT:
            # Manifestation: [Project Name]
            
            ## Phase 1: Foundation
            - [ ] Step 1...
            - [ ] Step 2...
            
            ## Phase 2: Core Logic
            ...
            
            Ensure the steps are actionable and follow the "Crystal Core" (Local-First) philosophy.
            `;

            const resp = await this.ai!.models.generateContent({
                model: model,
                contents: prompt
            });

            const manifestation = resp.text || "Failed to generate manifestation.";
            useOuroborosStore.getState().setManifestation(manifestation);
            this.addLog('success', 'Manifestation Sequence Generated.');

        } catch (e) {
            console.error(e);
            this.addLog('error', 'Failed to generate manifestation.');
        } finally {
            useOuroborosStore.getState().setStatus('idle');
        }
    }

    public async downloadProject(format: 'markdown' | 'json' = 'markdown') {
        const store = useOuroborosStore.getState();

        if (format === 'markdown') {
            const primaMateria = store.documentContent;
            const manifestation = store.manifestation || "Manifestation not generated.";

            // Recursive helper to format plan as markdown checklist
            const formatPlanToMarkdown = (items: PlanItem[], depth: number = 0): string => {
                return items.map(item => {
                    const indent = '  '.repeat(depth);
                    const checkbox = '- [ ]';
                    const title = `**${item.title}**`;
                    const desc = item.description ? ` - ${item.description}` : '';
                    let output = `${indent}${checkbox} ${title}${desc}\n`;

                    if (item.children && item.children.length > 0) {
                        output += formatPlanToMarkdown(item.children, depth + 1);
                    }
                    return output;
                }).join('');
            };

            const planMarkdown = formatPlanToMarkdown(store.projectPlan);
            const dbExport = await this.exportDatabase();

            const projectBible = `
# PROJECT BIBLE: ${new Date().toISOString().split('T')[0]}

## PRIMA MATERIA (The Vision)
${primaMateria}

---

## MANIFESTATION (The Path)
${manifestation}

---

## PROJECT PLAN (The Checklist)
${planMarkdown}
            `;

            // Download Project Bible
            const blob = new Blob([projectBible], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PROJECT_BIBLE_${new Date().toISOString().split('T')[0]}.md`;
            a.click();
        } else {
            // Download Project Plan as JSON
            const planJson = JSON.stringify(store.projectPlan, null, 2);
            const blob = new Blob([planJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_plan_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }
        // End of downloadProject
    }

    public async generateDebugReport(): Promise<string> {
        const nodes = await db.nodes.toArray();
        const logs = await db.logs.toArray();
        const settings = useOuroborosStore.getState().settings;

        let report = `# Ouroboros Debug Report
**Timestamp:** ${new Date().toLocaleString()}
**Model:** ${settings.model}
**Session ID:** Current Session

## 1. System State
*   **Document Content Length:** ${useOuroborosStore.getState().documentContent.length} chars
*   **Total Nodes:** ${nodes.length}
*   **Total Logs:** ${logs.length}

## 2. Node Execution Trace
`;

        for (const node of nodes) {
            if (!node.debugData) continue;

            report += `### [${node.id}] - ${node.label}
*   **Type:** ${node.type}
*   **Status:** ${node.status}
*   **Score:** ${node.score || 0}
*   **Red Flags:** ${node.redFlags ? node.redFlags.map(f => f.type).join(', ') : 'None'}
*   **Model:** ${node.debugData.modelUsed || 'N/A'}
*   **Execution Time:** ${node.debugData.executionTimeMs}ms
*   **Prompt Used:**
\`\`\`
${node.debugData.lastPrompt || 'N/A'}
\`\`\`
*   **Raw Output:**
\`\`\`
${node.debugData.rawResponse || 'N/A'}
\`\`\`
---
`;
        }

        return report;
    }

    public async printDebugReport() {
        const report = await this.generateDebugReport();
        console.log("=== OUROBOROS DEBUG REPORT ===");
        console.log(report);
        console.log("===============================");
        this.addLog('success', 'Debug report printed to console.');
    }

    public async downloadDebugReport() {
        const report = await this.generateDebugReport();
        const blob = new Blob([report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OUROBOROS_DEBUG_REPORT_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
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

    private async clearNodesForMode(mode: AppMode) {
        const nodesToDelete = await db.nodes.filter(n => n.mode === mode).toArray();
        const ids = nodesToDelete.map(n => n.id);

        if (ids.length > 0) {
            await db.nodes.bulkDelete(ids);

            // Delete associated edges
            const allEdges = await db.edges.toArray();
            const edgesToDelete = allEdges
                .filter(e => ids.includes(e.source) || ids.includes(e.target))
                .map(e => e.id!); // id is optional in interface but present in DB object from toArray

            if (edgesToDelete.length > 0) {
                await db.edges.bulkDelete(edgesToDelete);
            }
        }
    }

    private extractJson(text: string): any {
        try {
            // 1. Try standard parsing first (cleanest case)
            const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                return JSON.parse(clean);
            } catch (e) {
                // Continue to advanced extraction
            }

            // 2. Advanced Extraction: Find the first '{' and the last '}'
            const firstOpen = text.indexOf('{');
            const lastClose = text.lastIndexOf('}');

            if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                const jsonCandidate = text.substring(firstOpen, lastClose + 1);
                return JSON.parse(jsonCandidate);
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    private getHydraAI() {
        return {
            models: {
                generateContent: async (params: { model: string, contents: string, config?: any }) => {
                    return this.callLLM(params.model, params.contents, params.config);
                }
            }
        };
    }

    private async callLLM(model: string, prompt: string, config?: any): Promise<LLMResponse> {
        return this.generateWithHydra(model, prompt, config);
    }

    private getFailoverList(primaryModelId: string): string[] {
        const settings = useOuroborosStore.getState().settings;
        const customTiers = settings.customTiers || MODEL_TIERS;

        const S = customTiers.S_TIER || [];
        const A = customTiers.A_TIER || [];
        const B = customTiers.B_TIER || [];

        let failoverSequence: string[] = [];

        if (S.includes(primaryModelId)) {
            // If in S-Tier, cascade S -> A -> B
            failoverSequence = [...S, ...A, ...B];
        } else if (A.includes(primaryModelId)) {
            // If in A-Tier, cascade A -> B
            failoverSequence = [...A, ...B];
        } else if (B.includes(primaryModelId)) {
            // If in B-Tier, stay in B
            failoverSequence = [...B];
        } else {
            // If not in any tier, do not force other models.
            // Return only primary to respect user intent.
            return [primaryModelId];
        }

        // Ensure Primary is first, then unique others
        const unique = Array.from(new Set(failoverSequence));
        const others = unique.filter(m => m !== primaryModelId);
        return [primaryModelId, ...others];
    }

    private async generateWithHydra(primaryModelId: string, prompt: string, config?: any): Promise<LLMResponse> {
        const settings = useOuroborosStore.getState().settings;

        // Check if Hydra is enabled
        if (!settings.hydraSettings?.autoFailover) {
            const resp = await this.ai.models.generateContent({
                model: primaryModelId,
                contents: prompt,
                config: config
            });
            if (resp.usage) useOuroborosStore.getState().addUsage(primaryModelId, resp.usage);
            return resp;
        }

        const failoverList = this.getFailoverList(primaryModelId);

        // Allow Strategy sorting? (Cost vs Speed) - For now, respect tier order but put primary first.
        // If 'cost' strategy, we might want to sort the REST of the list by cost? 
        // For simplicity in Phase 1, we trust the tier order (which defaults to quality/cost balance usually).

        const resp = await this.ai.executeWithHydra(
            failoverList,
            prompt,
            config,
            this.penaltyBox,
            (model, err) => {
                this.addLog('warn', `Based on Hydra Protocol, failing over from ${model}: ${err.message}`);
            }
        );

        if (resp.modelUsed && resp.modelUsed !== primaryModelId) {
            this.addLog('warn', `Hydra Protocol: Failover Successful. Used verified model: ${resp.modelUsed}`);
        }

        if (resp.usage) {
            const usageModel = resp.modelUsed || primaryModelId;
            useOuroborosStore.getState().addUsage(usageModel, resp.usage);
        }
        return resp;
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
