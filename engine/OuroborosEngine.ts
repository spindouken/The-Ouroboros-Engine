import { UnifiedLLMClient, LLMResponse } from './UnifiedLLMClient';
import { Graph, LogEntry, PlanItem, Node, NodeStatus, AppSettings, AppMode, OracleMessage, PotentialConstitution } from '../types';
import { extractJson as safeExtractJson } from '../utils/safe-json';
import { createPrismController, PrismController } from '../prism-controller';
// V2.99 Modules
import { GenesisProtocol } from './genesis-protocol';
import { Saboteur } from './saboteur';
import { Specialist, buildLivingConstitution, SpecialistInput } from './specialist';
import { ReflexionLoop } from './reflexion-loop';
import { BlackboardSurveyor } from './blackboard-surveyor';
import { AntagonistMirror } from './antagonist-mirror';
import { BlackboardDeltaManager } from './blackboard-delta';
import { SecurityPatcher } from './security-patcher';
import { LosslessCompiler } from './lossless-compiler';
import { Scaffolder, ScaffoldConfig } from './scaffolder';
import { CheckpointManager, SessionPhase } from './checkpoint';
import { ProjectInsightManager } from './project-insight-manager'; // V2.99

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
    private prismController: PrismController;
    // V2.99 Subsystems (replacing votingSystem)
    private genesisProtocol: GenesisProtocol;
    private saboteur: Saboteur;
    private specialist: Specialist;
    private reflexionLoop: ReflexionLoop;
    private blackboardSurveyor: BlackboardSurveyor;
    private antagonistMirror: AntagonistMirror;
    private deltaManager: BlackboardDeltaManager;
    private securityPatcher: SecurityPatcher;
    private losslessCompiler: LosslessCompiler;
    private checkpointManager: CheckpointManager | null = null;
    private projectInsightManager: ProjectInsightManager; // V2.99

    private knowledgeGraphManager;
    private memoryManager;
    private redFlagValidator;
    private rateLimiter;
    private penaltyBox: PenaltyBoxRegistry;

    // API
    private ai: UnifiedLLMClient;
    private abortController: AbortController | null = null;
    private apiKey: string | null = null;
    private openaiApiKey: string | null = null;
    private apiSemaphore = new class {
        private tasks: (() => Promise<void>)[] = [];
        public count = 0;
        public max = 4;

        async acquire(): Promise<void> {
            console.log(`[SEM] Acquire Requested. Count=${this.count}, Max=${this.max}`);
            if (this.count < this.max) {
                this.count++;
                console.log(`[SEM] Acquire GRANTED immediately. New Count=${this.count}`);
                return Promise.resolve();
            }
            console.log(`[SEM] Acquire BLOCKED/QUEUED. Tasks in queue: ${this.tasks.length + 1}`);
            return new Promise<void>((resolve) => {
                this.tasks.push(() => {
                    console.log(`[SEM] Acquire GRANTED from queue.`);
                    resolve();
                    return Promise.resolve();
                });
            });
        }
        release(): void {
            console.log(`[SEM] Release Requested. Count=${this.count}`);
            this.count--;
            if (this.tasks.length > 0 && this.count < this.max) {
                this.count++;
                const next = this.tasks.shift();
                if (next) next();
            }
        }
        reset(): void {
            console.log(`[SEM] RESET TRIGGERED. Old Count=${this.count}`);
            this.count = 0;
            this.tasks = [];
        }
    }();

    private constructor() {
        this.ai = new UnifiedLLMClient(
            process.env.API_KEY || "",
            process.env.OPENAI_API_KEY || "",
            process.env.OPENROUTER_API_KEY || "",
            undefined, // LocalBaseUrl default
            undefined, // LocalModelId default
            process.env.GROQ_API_KEY || "" // Groq API Key
        );

        // [V2.99] Hook up Global Token Tracking
        this.ai.setUsageCallback((model, usage) => {
            useOuroborosStore.getState().addUsage(model, usage);
        });

        // V2.99 Adapter for UnifiedLLMClient
        // Provides BOTH interface shapes for compatibility:
        // - Direct: llmAdapter.generateContent() (used by Specialist, Reflexion, etc.)
        // - Nested: llmAdapter.models.generateContent() (used by Genesis, Saboteur)
        const generateContentFn = async (params: { model: string; contents: string; config?: any }) => {
            return this.callLLM(params.model, params.contents, params.config);
        };

        const llmAdapter = {
            generateContent: generateContentFn,
            models: {
                generateContent: generateContentFn
            }
        };

        this.prismController = new PrismController();
        // V2.99: Use global default model from store, will be overridden by role-specific settings later
        const globalDefaultModel = useOuroborosStore.getState().settings.model || 'gemini-2.0-flash-exp';
        this.genesisProtocol = new GenesisProtocol(llmAdapter, globalDefaultModel);
        this.saboteur = new Saboteur(llmAdapter, globalDefaultModel);

        // V2.99 Initialization - all default to global model
        this.specialist = new Specialist(llmAdapter);
        this.reflexionLoop = new ReflexionLoop(llmAdapter);
        this.blackboardSurveyor = new BlackboardSurveyor();
        this.antagonistMirror = new AntagonistMirror(llmAdapter, { model: globalDefaultModel });
        this.deltaManager = new BlackboardDeltaManager(undefined, (ctx) => {
            useOuroborosStore.getState().updateLivingConstitution(ctx as any);
        });
        this.securityPatcher = new SecurityPatcher({ model: globalDefaultModel }, llmAdapter);
        this.losslessCompiler = new LosslessCompiler({ outputFormat: 'structured' }, llmAdapter);
        this.projectInsightManager = new ProjectInsightManager(llmAdapter, { model: globalDefaultModel }); // V2.99

        this.knowledgeGraphManager = createKnowledgeGraphManager();
        this.memoryManager = createAgentMemoryManager();
        this.redFlagValidator = createRedFlagValidator();
        this.rateLimiter = createRateLimiter({ rpm: 60, rpd: 10000, enabled: true });
        this.penaltyBox = new PenaltyBoxRegistry();
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

    public updateKeys(googleKey?: string, openaiKey?: string, openRouterKey?: string, localBaseUrl?: string, localModelId?: string, groqKey?: string, localSmallModelId?: string) {
        this.ai.updateKeys(googleKey, openaiKey, openRouterKey, localBaseUrl, localModelId, groqKey, localSmallModelId);
    }

    public setApiKey(key: string) {
        this.ai.updateKeys(key);
    }

    public setOpenAIKey(key: string) {
        this.ai.updateKeys(undefined, key);
    }

    public setOpenRouterKey(key: string) {
        this.ai.updateKeys(undefined, undefined, key);
    }

    public setLocalSmallModelId(id: string) {
        this.ai.updateKeys(undefined, undefined, undefined, undefined, undefined, undefined, id);
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

    /**
     * HARD PAUSE ("Break Glass" Intervention) - Section 2.4
     * 
     * Immediately halts the Factory at any split-second.
     * System serializes current state to disk and halts.
     * 
     * @param hard - If true, performs full state serialization (HARD PAUSE)
     *               If false, just aborts without serialization (soft abort)
     */
    public async abort(hard: boolean = true) {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // CRITICAL: Reset the semaphore to prevent deadlocks on resume/restart
        this.apiSemaphore.reset();

        if (hard) {
            // HARD PAUSE: Serialize state immediately
            const store = useOuroborosStore.getState();

            // Mark the pause timestamp and set hard pause flag
            store.setResumeState({
                pausedAt: Date.now(),
                hardPauseTriggered: true,
                isResuming: false
            });

            // Create a snapshot before pausing
            store.createSnapshot('HARD PAUSE - Manual Intervention');

            // Serialize current state to SessionCodex
            try {
                await this.saveSession('hard_pause_recovery');
                this.addLog('warn', '🛑 HARD PAUSE: Factory halted. State serialized to disk.');
            } catch (err) {
                this.addLog('error', 'HARD PAUSE: Failed to serialize state. Recovery may be incomplete.');
            }

            store.setStatus('hard_paused');
        } else {
            this.addLog('warn', 'Execution aborted by user (soft abort).');
            useOuroborosStore.getState().setStatus('idle');
        }
    }

    /**
     * Resume Factory from HARD PAUSE or browser crash (Section 2.3/2.4)
     * 
     * Resumes execution exactly at the last verified brick.
     */
    public async resumeFromPause() {
        const store = useOuroborosStore.getState();

        if (!store.resumeState.lastVerifiedNodeId && !store.resumeState.hardPauseTriggered) {
            this.addLog('warn', 'No resume point found. Starting fresh.');
            return false;
        }

        store.setResumeState({ isResuming: true });
        this.addLog('system', `🔄 Resuming Factory from last checkpoint...`);

        try {
            // Load the session if needed
            const session = await db.projects.orderBy('updatedAt').last();
            if (session) {
                await this.loadFromCodex(session.id);
            }

            store.setStatus('thinking');
            store.setResumeState({ isResuming: false, hardPauseTriggered: false });

            // Continue processing the graph
            this.processGraph();
            return true;
        } catch (err) {
            this.addLog('error', `Resume failed: ${err}`);
            store.setResumeState({ isResuming: false });
            return false;
        }
    }

    /**
     * V2.99 Checkpoint Resume: Resume from any saved checkpoint phase.
     * 
     * Uses the CheckpointManager to:
     * 1. Detect the last checkpoint phase
     * 2. Restore saved state
     * 3. Continue from where execution left off
     * 
     * @param sessionId - Optional session ID to resume. Defaults to 'current_session'
     * @returns True if resume was successful, false otherwise
     */
    public async resumeFromCheckpoint(sessionId: string = 'current_session'): Promise<boolean> {
        const store = useOuroborosStore.getState();

        // Initialize CheckpointManager
        this.checkpointManager = new CheckpointManager(sessionId);

        // Check if session is resumable
        const resumeInfo = await this.checkpointManager.canResume(sessionId);

        if (!resumeInfo.resumable) {
            this.addLog('warn', `Cannot resume: ${resumeInfo.description}`);
            return false;
        }

        this.addLog('system', `🔄 Resuming from checkpoint: ${resumeInfo.description}`);
        store.setStatus('thinking');

        try {
            // Load the session data from DB
            await this.loadFromCodex(sessionId);

            const phase = resumeInfo.phase;

            // Resume based on the checkpoint phase
            switch (phase) {
                case SessionPhase.GENESIS_STARTED:
                case SessionPhase.GENESIS_COMPLETE:
                    // Need to re-run from Prism onwards
                    this.addLog('info', '[Resume] Skipping Genesis, continuing with Prism...');
                    await this.continueFromPrism();
                    break;

                case SessionPhase.PRISM_STEP_A:
                case SessionPhase.PRISM_STEP_B:
                case SessionPhase.PRISM_STEP_C:
                    // Need to continue Prism or run Saboteur
                    this.addLog('info', '[Resume] Prism data found, continuing with Saboteur...');
                    await this.continueFromSaboteur();
                    break;

                case SessionPhase.SABOTEUR_COMPLETE:
                case SessionPhase.AWAITING_REVIEW:
                    // Most common: Just restore state and wait for user
                    this.addLog('success', '[Resume] Setup complete. Ready for user review.');
                    store.setStatus('idle');
                    break;

                case SessionPhase.EXECUTION_STARTED:
                case SessionPhase.EXECUTION_IN_PROGRESS:
                    // Resume mid-execution, skip completed nodes
                    this.addLog('info', '[Resume] Resuming execution from last completed node...');
                    await this.continueExecution();
                    break;

                default:
                    this.addLog('warn', `Unknown checkpoint phase: ${phase}. Cannot resume.`);
                    store.setStatus('idle');
                    return false;
            }

            return true;

        } catch (error: any) {
            this.addLog('error', `Resume failed: ${error.message}`);
            store.setStatus('idle');
            return false;
        }
    }

    /**
     * Continue execution from the Prism phase (skip Genesis)
     */
    private async continueFromPrism(): Promise<void> {
        const store = useOuroborosStore.getState();
        const settings = store.settings;
        const goal = store.livingConstitution?.originalRequirements || store.documentContent;

        // Reconstruct constitution from stored data
        const constitution = {
            domain: store.livingConstitution?.domain || 'General',
            techStack: store.livingConstitution?.techStack || [],
            constraints: store.livingConstitution?.constraints?.map((c: string) => ({ description: c })) || [],
            originalRequirements: goal
        };

        this.addLog('info', '[Prism] Decomposing into Atomic Tasks...');
        const prismAnalysis = await this.prismController.executeFullAnalysis(
            goal,
            constitution as any,
            this.getHydraAI(),
            settings.model_prism || settings.model,
            {
                maxAtomicTasks: settings.maxAtomicTasks,
                maxCouncilSize: settings.maxCouncilSize,
                maxDecompositionPasses: settings.maxDecompositionPasses ?? 3
            }
        );

        if (!prismAnalysis.success) {
            this.addLog('error', '[Prism] Decomposition failed.');
            store.setStatus('idle');
            return;
        }

        store.setPrismAnalysis(prismAnalysis);

        // Continue to Saboteur
        await this.continueFromSaboteur();
    }

    /**
     * Continue execution from the Saboteur phase (skip Genesis + Prism)
     */
    private async continueFromSaboteur(): Promise<void> {
        const store = useOuroborosStore.getState();
        const settings = store.settings;
        const prismAnalysis = store.prismAnalysis;
        const goal = store.livingConstitution?.originalRequirements || store.documentContent;

        if (!prismAnalysis) {
            this.addLog('error', '[Saboteur] No Prism analysis found. Cannot continue.');
            store.setStatus('idle');
            return;
        }

        // Reconstruct constitution
        const constitution = {
            domain: store.livingConstitution?.domain || 'General',
            techStack: store.livingConstitution?.techStack || [],
            constraints: store.livingConstitution?.constraints?.map((c: string) => ({ description: c })) || [],
            originalRequirements: goal
        };

        const saboteurModel = settings.model_security || settings.model || 'local-custom';
        this.saboteur.setModel(saboteurModel);

        this.addLog('info', '[Saboteur] Red-Teaming the plan for gaps...');
        const saboteurResult = await this.saboteur.stressTest(
            prismAnalysis.stepB.atomicTasks,
            prismAnalysis.stepB.council,
            constitution as any,
            goal
        );

        if (saboteurResult.missingBricks.length > 0) {
            this.addLog('warn', `[Saboteur] Identified ${saboteurResult.missingBricks.length} critical gaps.`);
            const finalTasks = Saboteur.injectBricks(prismAnalysis.stepB.atomicTasks, saboteurResult.missingBricks, prismAnalysis.stepB.council);
            prismAnalysis.stepB.atomicTasks = finalTasks;
            store.setPrismAnalysis(prismAnalysis);
        }

        this.addLog('system', '[Factory] Setup Phase Complete. Waiting for User Review.');
        store.setStatus('idle');

        // Checkpoint: Awaiting Review
        if (this.checkpointManager) {
            await this.checkpointManager.checkpointSync(SessionPhase.AWAITING_REVIEW, {
                prismAnalysis: prismAnalysis,
                livingConstitution: store.livingConstitution,
                verifiedBricks: store.verifiedBricks
            }, 'Setup complete. Awaiting user review.');
        }
    }

    /**
     * Continue execution from mid-execution (skip completed nodes)
     */
    private async continueExecution(): Promise<void> {
        const store = useOuroborosStore.getState();

        // Critical: Check for orphaned running nodes (zombies) and reset them
        const runningNodes = await db.nodes.where('status').anyOf('running', 'critiquing', 'synthesizing').toArray();
        if (runningNodes.length > 0) {
            this.addLog('system', `[Resume] Found ${runningNodes.length} orphaned nodes. Resetting to pending...`);
            await db.nodes.where('id').anyOf(runningNodes.map(n => n.id)).modify({ status: 'pending' });
        }

        // Auto-Recovery for Failed Nodes (Timeouts / Dependencies)
        await this.recoverFailedNodes();

        // Simply call processGraph - it will pick up the pending nodes
        store.setStatus('thinking');
        this.processGraph();
    }

    /**
     * Scans for nodes that failed due to transient issues (Timeout, Dependency) and resets them.
     */
    private async recoverFailedNodes(): Promise<void> {
        const nodes = await db.nodes.toArray();
        const failedNodes = nodes.filter(n => n.status === 'error');

        if (failedNodes.length === 0) return;

        let recoveredCount = 0;
        const updates: Promise<any>[] = [];

        for (const node of failedNodes) {
            // Check for recoverable errors
            const isTimeout = node.output?.includes('Timeout') || node.output?.includes('300s');
            // Check for dependency failure - effectively "Cascade Reset"
            const isDependency = node.output === 'Dependency failed.' || node.output?.includes('Dependency failed');

            if (isTimeout || isDependency) {
                // Determine reason for log
                const reason = isTimeout ? 'Execution Timeout' : 'Dependency Cascade';

                // Only log if it's a timeout (dependency resets are noisy)
                if (isTimeout) {
                    this.addLog('warn', `[Auto-Recovery] Resetting ${node.label} due to ${reason}.`);
                }

                updates.push(this.updateNodeState(node.id, {
                    status: 'pending',
                    output: null,
                    distress: false,
                    failedModel: undefined,
                    lastHydraLog: undefined
                }));
                recoveredCount++;
            }
        }

        if (recoveredCount > 0) {
            await Promise.all(updates);
            if (recoveredCount > 5) {
                this.addLog('system', `[Auto-Recovery] Batch reset ${recoveredCount} failed nodes.`);
            }
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

            // V2.99 State (Pragmatic Brick Factory)
            prismAnalysis: store.prismAnalysis,
            livingConstitution: store.livingConstitution,
            verifiedBricks: store.verifiedBricks,
            usageMetrics: store.usageMetrics, // Save Usage Usage

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
            currentSessionName: session.name,

            // V2.99 State (Pragmatic Brick Factory)
            prismAnalysis: store.prismAnalysis || null,
            livingConstitution: session.livingConstitution || store.livingConstitution,
            verifiedBricks: session.verifiedBricks || [],
            usageMetrics: session.usageMetrics || {} // Restore Usage Metrics
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
                settings.localModelId,
                settings.groqApiKey,
                settings.localSmallModelId
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
        this.apiSemaphore.reset();
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

    /**
     * Shadow-Contextualizer (V2.99)
     * Generates 3 distinct "Potential Constitutions" from a single sentence to reduce Oracle Fatigue.
     */
    public async generateShadowVibes(userPrompt: string): Promise<PotentialConstitution[]> {
        const settings = useOuroborosStore.getState().settings;
        const oracleModel = settings.model_oracle || settings.model;

        const systemPrompt = `
        You are the Shadow Contextualizer.
        Your goal is to reduce "Oracle Fatigue" by immediately proposing 3 distinct "Potential Constitutions" (Vibes) based on the user's single sentence idea.
        
        User Idea: "${userPrompt}"
        
        Generate 3 distinct project directions (Vibes):
        1. "MVP / Lean": Minimal, fast, core value only.
        2. "Scalable / Enterprise": Robust, extensive, future-proof.
        3. "Cutting Edge / Experimental": High-tech, high-risk, unique features.
        
        Return a JSON array of 3 objects matching this interface:
        {
            id: string,
            label: string, // e.g., "The Rapid Prototype"
            description: string, // 1-2 sentences marketing pitch
            preview: string, // A short snippet of the philosophy
            techStackHint: string[], // e.g., ["Next.js", "Supabase"]
            riskLevel: "safe" | "balanced" | "experimental"
        }
        `;

        try {
            const resp = await this.ai.models.generateContent({
                model: oracleModel,
                contents: systemPrompt,
                config: { responseMimeType: "application/json" }
            });

            const vibes = this.extractJson(resp.text || "[]");
            useOuroborosStore.getState().setPotentialConstitutions(vibes);
            return vibes;

        } catch (e) {
            console.error("Shadow Contextualizer failed:", e);
            return [];
        }
    }

    /**
     * Deep Prompt Refinement (V2.99)
     * Takes the user's raw idea + selected Vibe and generates a strict Technical Specification.
     * Starts the Deep Refinement Loop.
     */
    public async refineDeepPrompt(userPrompt: string, selectedVibe: PotentialConstitution): Promise<any> {
        const settings = useOuroborosStore.getState().settings;
        const oracleModel = settings.model_oracle || settings.model;

        this.addLog('system', `[Oracle] Deep Refinement: Applying "${selectedVibe.label}" lens...`);

        const systemPrompt = `
        You are the Deep Refinement Engine.
        TRANSFORM the user's ambiguous request into a IRONCLAD Technical Specification, filtered through the selected "Vibe".
        
        User Request: "${userPrompt}"
        Selected Vibe: "${selectedVibe.label}"
        Vibe Description: "${selectedVibe.description}"
        Tech Hints: ${JSON.stringify(selectedVibe.techStackHint)}
        
        CRITICAL INSTRUCTIONS:
        1. Ignore fluff. Focus on Mechanics, Data Structures, and Core Loops.
        2. If "MVP", cut ALL non-essential features.
        3. If "Enterprise", add logging, auth roles, and compliance.
        4. If "Experimental", suggest novel UI/UX patterns.
        
        Output a detailed JSON specification containing:
        - "Project Name"
        - "Core Objective"
        - "Key Features" (Array of strings)
        - "Technical Constraints" (Specific libraries/frameworks)
        - "Data Schema" (Brief overview)
        - "Unknown Unknowns Identified" (Risks)
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
            console.error("Deep Refinement failed:", e);
            return null;
        }
    }


    // --- CORE LOGIC ---

    /**
     * V2.99 Refinement Flow: Genesis -> Prism -> Saboteur -> User Review
     * Now with Incremental Checkpointing for crash recovery and pause/resume.
     */
    public async startRefinement(goal: string) {
        if (!goal.trim()) return;

        const store = useOuroborosStore.getState();
        const settings = store.settings;

        // 1. Reset & Setup
        store.resetSession();
        store.setDocumentContent(goal);
        store.setOriginalRequirements(goal);
        store.setStatus('thinking');
        await this.clearNodesForMode('refine');
        await db.logs.clear();
        await this.saveSession();

        // Initialize CheckpointManager for this session
        // FIX: Enforce 'current_session' for autosaves to protect named saves
        const sessionId = 'current_session';
        this.checkpointManager = new CheckpointManager(sessionId);

        this.addLog('system', '--- V2.99 FACTORY STARTUP: GENESIS PROTOCOL ---');

        // Ensure keys are up to date
        const googleKey = this.apiKey || process.env.API_KEY || "";
        const openaiKey = this.openaiApiKey || process.env.OPENAI_API_KEY || "";
        this.ai.updateKeys(googleKey || undefined, openaiKey || undefined);

        try {
            // ═══════════════════════════════════════════════════════════════════
            // STEP 1: GENESIS PROTOCOL (Foundation)
            // ═══════════════════════════════════════════════════════════════════
            // Checkpoint: Mark start of Genesis
            this.checkpointManager.checkpoint(SessionPhase.GENESIS_STARTED, {
                documentContent: goal,
                livingConstitution: store.livingConstitution
            });

            const genesisModel = settings.model_genesis || settings.model || 'local-custom';
            this.genesisProtocol.setModel(genesisModel);
            console.log(`[OuroborosEngine] Genesis using model: ${genesisModel}`);

            this.addLog('info', '[Genesis] Establishing Project Constitution...');
            const genesisResult = await this.genesisProtocol.execute(goal);

            if (!genesisResult.success && genesisResult.conflicts.length > 0) {
                this.addLog('warn', `[Genesis] Potential conflicts detected. Review Constitution.`);
            }

            if (genesisResult.constitution) {
                // Update Living Constitution in Store
                store.updateLivingConstitution({
                    domain: genesisResult.constitution.domain,
                    techStack: Object.values(genesisResult.constitution.techStack).flat().filter(Boolean) as string[],
                    constraints: genesisResult.constitution.constraints.map(c => c.description),
                    originalRequirements: goal
                });
                this.addLog('success', `[Genesis] Domain established: ${genesisResult.constitution.domain}`);
            }

            // ✓ Checkpoint: Genesis Complete
            this.checkpointManager.checkpoint(SessionPhase.GENESIS_COMPLETE, {
                livingConstitution: store.livingConstitution,
                genesisResult: {
                    constitution: genesisResult.constitution,
                    domain: genesisResult.constitution?.domain || 'Unknown',
                    techStack: Object.values(genesisResult.constitution?.techStack || {}).flat().filter(Boolean) as string[],
                    constraints: genesisResult.constitution?.constraints?.map(c => c.description) || []
                }
            }, `Constitution established: ${genesisResult.constitution?.domain || 'Unknown'}`);

            // ═══════════════════════════════════════════════════════════════════
            // STEP 2: DYNAMIC PRISM (Decomposition)
            // ═══════════════════════════════════════════════════════════════════
            this.addLog('info', '[Prism] Decomposing into Atomic Tasks...');
            const prismAnalysis = await this.prismController.executeFullAnalysis(
                goal,
                genesisResult.constitution,
                this.getHydraAI(),
                settings.model_prism || settings.model,
                {
                    maxAtomicTasks: settings.maxAtomicTasks ?? 10,
                    maxCouncilSize: settings.maxCouncilSize ?? 5,
                    maxDecompositionPasses: settings.maxDecompositionPasses ?? 3
                }
            );

            if (!prismAnalysis.success) {
                const errorMsg = prismAnalysis.errors.length > 0 ? prismAnalysis.errors.join(', ') : 'Unknown error';
                this.addLog('error', `[Prism] Decomposition failed: ${errorMsg}`);
                store.setStatus('idle');
                return;
            }

            // ✓ Checkpoint: Prism Complete (Tasks Generated)
            this.checkpointManager.checkpoint(SessionPhase.PRISM_STEP_B, {
                prismAnalysis: prismAnalysis,
                prismStepBResult: {
                    council: prismAnalysis.stepB?.council,
                    atomicTasks: prismAnalysis.stepB?.atomicTasks || []
                }
            }, `${prismAnalysis.stepB?.atomicTasks?.length || 0} tasks generated`);

            // ═══════════════════════════════════════════════════════════════════
            // STEP 3: SABOTEUR (Adversarial Review)
            // ═══════════════════════════════════════════════════════════════════
            const saboteurModel = settings.model_security || settings.model || 'local-custom';
            this.saboteur.setModel(saboteurModel);
            console.log(`[OuroborosEngine] Saboteur using model: ${saboteurModel}`);
            this.addLog('info', '[Saboteur] Red-Teaming the plan for gaps...');
            const saboteurResult = await this.saboteur.stressTest(
                prismAnalysis.stepB.atomicTasks,
                prismAnalysis.stepB.council,
                genesisResult.constitution,
                goal
            );

            if (saboteurResult.missingBricks.length > 0) {
                this.addLog('warn', `[Saboteur] Identified ${saboteurResult.missingBricks.length} critical gaps. Injecting missing bricks.`);
                // Inject Saboteur's missing bricks into the task list
                const finalTasks = Saboteur.injectBricks(prismAnalysis.stepB.atomicTasks, saboteurResult.missingBricks, prismAnalysis.stepB.council);
                prismAnalysis.stepB.atomicTasks = finalTasks;
            } else {
                this.addLog('success', '[Saboteur] No major gaps found. Plan is solid.');
            }

            // ✓ Checkpoint: Saboteur Complete
            this.checkpointManager.checkpoint(SessionPhase.SABOTEUR_COMPLETE, {
                prismAnalysis: prismAnalysis,
                saboteurResult: {
                    gapsInjected: saboteurResult.missingBricks.length,
                    modifiedTasks: prismAnalysis.stepB.atomicTasks
                }
            }, `Gaps identified: ${saboteurResult.missingBricks.length}`);

            // ═══════════════════════════════════════════════════════════════════
            // STEP 4: USER REVIEW GATE
            // ═══════════════════════════════════════════════════════════════════
            this.addLog('system', '[Factory] Setup Phase Complete. Waiting for User Review.');

            // Push final analysis to store for UI rendering
            store.setPrismAnalysis(prismAnalysis);

            // Clear legacy council state to prevent UI confusion
            useOuroborosStore.setState({ council: {} });

            store.setStatus('idle');
            await this.saveSession();

            // ✓ Checkpoint: Awaiting Review (Most common resume point)
            await this.checkpointManager.checkpointSync(SessionPhase.AWAITING_REVIEW, {
                prismAnalysis: prismAnalysis,
                livingConstitution: store.livingConstitution,
                verifiedBricks: store.verifiedBricks
            }, 'Setup complete. Awaiting user review.');

        } catch (error: any) {
            console.error('[Engine] Startup Flow Failed:', error);
            this.addLog('error', `Startup failed: ${error.message}`);
            store.setStatus('idle');

            // Record error in checkpoint for debugging
            if (this.checkpointManager) {
                this.checkpointManager.checkpoint(this.checkpointManager.getCurrentPhase(), {
                    // Include current state for recovery
                }, `Error: ${error.message}`);
            }
        }
    }

    /**
     * V2.99 Execution Flow: Builds the graph from verified/enabled tasks
     * Now with Incremental Checkpointing for crash recovery.
     * 
     * IMPORTANT: This method checks for existing execution nodes to prevent
     * duplication on resume. If nodes exist, we skip recreation.
     */
    /**
     * V2.99 Resume Logic: Resumes the currently loaded workbench state.
     * 
     * Handles the critical task of migrating a Named Session's state into the
     * volatile 'current_session' slot for autosaving, protecting the original file.
     */
    public async resumeCurrentWorkbench() {
        // Enforce 'current_session' for the active run
        if (!this.checkpointManager || this.checkpointManager.getSessionId() !== 'current_session') {
            this.checkpointManager = new CheckpointManager('current_session');
        }

        this.addLog('info', '[Resume] Resuming active workbench state...');
        useOuroborosStore.getState().setStatus('thinking');

        // Ensure any 'running' nodes are reset to 'pending' to avoid latching
        await this.continueExecution();
    }

    /**
     * V2.99 Execution Flow: Builds the graph from verified/enabled tasks
     * Now with Incremental Checkpointing for crash recovery.
     * 
     * IMPORTANT: This method checks for existing execution nodes to prevent
     * duplication on resume. If nodes exist, we skip recreation.
     */
    public async startExecution() {
        const store = useOuroborosStore.getState();
        const analysis = store.prismAnalysis;

        if (!analysis) {
            this.addLog('error', 'No Prism analysis found. Cannot start execution.');
            return;
        }

        // Abort any existing execution loop silently to prevent zombies
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // CRITICAL: Reset semaphore to avoid deadlocks from previous aborted runs
        this.apiSemaphore.reset();

        // Initialize CheckpointManager
        // FIX: Always use 'current_session' for autosaves to prevent overwriting named save files.
        // The user must explicitly "Save" to update the named file.
        if (!this.checkpointManager || this.checkpointManager.getSessionId() !== 'current_session') {
            this.checkpointManager = new CheckpointManager('current_session');
        }

        // FORCE FRESH START: Always clear existing execution nodes when manually starting
        // This prevents "zombie nodes" from previous sessions (or failed cleanups) from hijacking the run.
        // Resume functionality is handled exclusively via resumeFromCheckpoint / continueExecution.

        // Check for existing nodes to clean up
        const existingNodes = await db.nodes.toArray();
        const executionNodes = existingNodes.filter(n =>
            n.id.startsWith('spec_') || n.id.startsWith('compiler_')
        );

        if (executionNodes.length > 0) {
            this.addLog('system', '[Factory] Clearing previous execution data for fresh run...');
            const idsToDelete = executionNodes.map(n => n.id);
            await db.nodes.bulkDelete(idsToDelete);

            // Clean up edges associated with these nodes
            const allEdges = await db.edges.toArray();
            const edgesToDelete = allEdges
                .filter(e => idsToDelete.includes(e.source) || idsToDelete.includes(e.target))
                .map(e => e.id!);

            if (edgesToDelete.length > 0) {
                await db.edges.bulkDelete(edgesToDelete);
            }
        }

        this.addLog('system', '--- V2.99 FACTORY FLOOR: ACTIVATING SQUAD ---');
        store.setStatus('thinking');

        // ✓ Checkpoint: Execution Started
        this.checkpointManager.checkpoint(SessionPhase.EXECUTION_STARTED, {
            prismAnalysis: analysis,
            livingConstitution: store.livingConstitution,
            verifiedBricks: store.verifiedBricks
        }, 'Execution phase beginning');

        // Rehydrate Delta Manager with current Global Context
        this.deltaManager.import({
            context: store.livingConstitution as any,
            bricks: store.verifiedBricks.map(b => ({
                id: b.id,
                persona: b.persona,
                instruction: b.instruction,
                artifact: b.artifact,
                delta: b.delta || { newConstraints: [], decisions: [], warnings: [] },
                verifiedAt: b.verifiedAt,
                confidence: b.confidence
            })) as any
        });

        const nodes: Record<string, Node> = {};
        const edges: { source: string; target: string }[] = [];
        const roundId = Math.random().toString(36).substr(2, 3);
        const compilerId = `compiler_${roundId}`;

        // 1. Create Specialist Nodes from Atomic Tasks
        const enabledTasks = analysis.stepB.atomicTasks.filter((t: any) => t.enabled !== false);
        const specialistNodeIds: string[] = [];

        enabledTasks.forEach((task: any) => {
            const nodeId = `spec_${task.id}_${roundId}`;
            specialistNodeIds.push(nodeId);

            // Find the full specialist config from the council
            let specialist = analysis.stepB.council.specialists.find((s: any) => s.id === task.assignedSpecialist);

            // Fallback: If ID mismatch, use the first specialist (Council Lead) to avoid generic personas
            if (!specialist && analysis.stepB.council.specialists.length > 0) {
                this.addLog('warn', `Specialist ID '${task.assignedSpecialist}' not found. Defaulting to Council Lead.`, nodeId);
                specialist = analysis.stepB.council.specialists[0];
            }

            nodes[nodeId] = {
                id: nodeId,
                type: 'specialist',
                label: task.title,
                persona: specialist?.persona || `You are an expert in ${task.domain || 'this project'}.`,
                department: specialist?.role || task.domain || "General",
                instruction: task.instruction,
                dependencies: task.dependencies.map((dId: string) => `spec_${dId}_${roundId}`),
                status: 'pending',
                output: null,
                depth: 2,
                data: {
                    complexity: task.complexity,
                    routingPath: task.routingPath,
                    temperature: specialist?.temperature
                },
                mode: 'refine'
            };

            // Link to compiler
            edges.push({ source: nodeId, target: compilerId });
        });

        // 2. Create Lossless Compiler Node
        nodes[compilerId] = {
            id: compilerId,
            type: 'lossless_compiler',
            label: 'Lossless Compiler',
            persona: 'Grand Assembler',
            instruction: 'Assemble all verified bricks into a final manifestation without information loss.',
            dependencies: specialistNodeIds,
            status: 'pending',
            output: null,
            depth: 0,
            mode: 'refine'
        };

        this.updateGraph(nodes, edges);

        // Persist
        await db.transaction('rw', db.nodes, db.edges, async () => {
            await db.nodes.bulkPut(Object.values(nodes));
        });

        // Save the nodes state before processing begins
        const dbNodes = await db.nodes.toArray();
        this.checkpointManager.checkpoint(SessionPhase.EXECUTION_IN_PROGRESS, {
            nodes: dbNodes,
            nodeExecutionState: {
                completedNodes: [],
                failedNodes: []
            }
        }, `Processing ${enabledTasks.length} tasks`);

        this.processGraph();
    }

    /**
     * V2.99 ReCAP (Recursive Context-Aware Planning) Engine
     * 
     * Orchestrates the fractal expansion of non-atomic Epics into detailed sub-tasks.
     * 
     * @param parentNodeId - ID of the node to decompose
     * @param context - Additional context for the decomposition (e.g. parent instruction)
     */
    public async executeRecursivePrism(parentNodeId: string, context: string): Promise<void> {
        const store = useOuroborosStore.getState();
        const settings = store.settings;
        const maxDepth = settings.maxDecompositionPasses || 3;
        const maxBreadth = settings.maxAtomicTasks || 20;

        // 1. Fetch Parent Node
        const parentNode = await db.nodes.get(parentNodeId);
        if (!parentNode) {
            this.addLog('error', `ReCAP: Parent node ${parentNodeId} not found.`);
            return;
        }

        const currentDepth = parentNode.depth || 0;

        // 2. Check Termination Criteria
        if (currentDepth >= maxDepth) {
            this.addLog('warn', `ReCAP: Max depth ${maxDepth} reached for ${parentNode.label}. Marking as atomic.`);
            await this.updateNodeState(parentNodeId, { decompositionStatus: 'atomic' });
            return;
        }

        this.addLog('info', `[ReCAP] Expanding Node: ${parentNode.label} (Depth: ${currentDepth})`);
        await this.updateNodeState(parentNodeId, { decompositionStatus: 'expanded', status: 'decomposing' });

        try {
            // 3. Call Prism for Decomposition
            // We use the existing generateAtomicTasks but with enhanced context
            // Note: The prompt inside PrismController (P2-4) will need to handle this
            const constitution = store.livingConstitution ? {
                domain: store.livingConstitution.domain,
                techStack: store.livingConstitution.techStack,
                constraints: store.livingConstitution.constraints.map(c => ({ description: c })),
                originalRequirements: store.livingConstitution.originalRequirements
            } : null;

            // Use the parent's instruction as the "Goal" for this level
            const subGoal = `Sub-Goal for [${parentNode.label}]: ${parentNode.instruction}`;

            // We reuse Domain Classification from global context or parent
            // Ideally we'd re-classify, but inheriting domain is efficient
            const domainResult = {
                domain: parentNode.department || store.livingConstitution?.domain || "General",
                confidence: 1.0,
                reasoning: "Inherited from parent",
                domainExpertise: []
            };

            // Hydra Model Selection
            const model = settings.model_prism || settings.model;

            // Generate Sub-tasks
            // We pass a synthetic "council" - effectively asking Prism to form a squad for this specific Epic
            // In a full implementation, we might want a "Sub-Council Proposal" step here
            // For now, we reuse the existing council or generate a transient one.
            // Simplified: We skip explicit council generation for sub-tasks and let Prism assign roles from the main council or new ones.
            // However, generateAtomicTasks REQUIRES a council.
            // Let's use the Project Council from store.
            const projectCouncil = store.council; // This object structure might differ from CouncilProposal

            // Adapter to match CouncilProposal interface if needed, or we rely on Prism's flexibility
            // Currently Prism expects a CouncilProposal object.
            // Let's assume the store has a compatible structure or we mock it.
            // The store.council is just a Record<string, string> (id -> role) based on types?
            // Let's check DBProject interface... "council: any"
            // Let's assume we can cast it or use the one from Prism output in stepB.

            let activeCouncil = store.prismAnalysis?.stepB?.council;

            if (!activeCouncil) {
                // Fallback: Create a minimal council from the generic store if analysis is missing
                activeCouncil = { specialists: [], rationale: "Fallback" };
            }

            const subTasks = await this.prismController.generateAtomicTasks(
                subGoal,
                domainResult,
                constitution as any, // Cast to match Constitution interface
                activeCouncil,
                this.getHydraAI(),
                model,
                settings.hydraSettings.autoFailover ? 0.7 : 0.5
            );

            if (subTasks.length === 0) {
                this.addLog('warn', `[ReCAP] No sub-tasks generated for ${parentNode.label}. Marking as atomic.`);
                await this.updateNodeState(parentNodeId, { decompositionStatus: 'atomic', status: 'pending' }); // Revert to pending for execution
                return;
            }

            // P2-6: SABOTEUR INTEGRATION (Recursive Red-Teaming)
            if (this.saboteur) {
                this.addLog('info', `[Saboteur] Auditing decomposition for ${parentNode.label}...`);
                const saboteurResult = await this.saboteur.stressTest(
                    subTasks,
                    activeCouncil,
                    constitution as any,
                    subGoal
                );

                if (saboteurResult.missingBricks.length > 0) {
                    this.addLog('warn', `[Saboteur] Found ${saboteurResult.missingBricks.length} gaps. Injecting...`);
                    const augmentedTasks = Saboteur.injectBricks([], saboteurResult.missingBricks, activeCouncil);
                    augmentedTasks.forEach(task => subTasks.push(task));
                }
            }

            // 4. Spawn Child Nodes
            const childNodes: Node[] = [];
            const childIds: string[] = [];

            // Limit breadth
            const tasksToSpawn = subTasks.slice(0, maxBreadth);

            for (const task of tasksToSpawn) {
                const childId = `recap_${parentNodeId}_${task.id.substring(0, 6)}`;
                childIds.push(childId);

                const childNode: Node = {
                    id: childId,
                    type: 'specialist', // Default to specialist
                    label: task.title,
                    persona: `Specialist for ${task.domain || 'this task'}`, // Generic persona if not detailed
                    department: task.domain || parentNode.department,
                    instruction: task.instruction,
                    dependencies: [parentNodeId], // Logical dependency: Parent must be "expanded" before Children "exist"
                    status: 'pending',
                    output: null,
                    parentId: parentNodeId, // Link up
                    depth: currentDepth + 1,
                    decompositionStatus: 'pending', // Children start as pending decomposition check
                    mode: 'refine',
                    data: {
                        complexity: task.complexity,
                        estimatedTokens: task.estimatedTokens
                    }
                };
                childNodes.push(childNode);
            }

            // 5. Persist & Update Graph
            await db.transaction('rw', db.nodes, db.edges, async () => {
                await db.nodes.bulkPut(childNodes);

                // Update parent with children IDs and status
                await db.nodes.update(parentNodeId, {
                    childrenIds: childIds,
                    status: 'complete', // Parent is "complete" as a task container (it has delegated)
                    output: `Decomposed into ${childIds.length} sub-tasks.`
                });

                // Add edges from Parent -> Children (Hierarchy)
                // Note: Dependencies usually mean "A must finish before B".
                // In execution graph, Parent finishes expansion, then Children start.
                // We typically visualize this as Parent -> Children edges.
                const newEdges = childIds.map(cid => ({
                    source: parentNodeId,
                    target: cid,
                    type: 'decomposition'
                }));
                // We need to map to DBEdge type
                // await db.edges.bulkAdd(newEdges as any); // If we had decomposition edge type
            });

            this.addLog('success', `[ReCAP] Expanded ${parentNode.label} into ${childNodes.length} sub-tasks.`);

            // Trigger UI update
            const allNodes = await db.nodes.toArray();
            const allEdges = await db.edges.toArray();
            this.updateGraph(
                allNodes.reduce((acc, n) => ({ ...acc, [n.id]: n }), {}),
                allEdges.map(e => ({ source: e.source, target: e.target }))
            );

        } catch (error: any) {
            this.addLog('error', `[ReCAP] Failed to decompose ${parentNode.label}: ${error.message}`);
            await this.updateNodeState(parentNodeId, { status: 'error', output: error.message });
        }
    }
    // startPlanning has been replaced by the Genesis/Prism/Saboteur flow in startRefinement.
    // expandPlanningTree has been replaced by the specialist factory nodes.

    public async processGraph() {
        useOuroborosStore.getState().setStatus('thinking');
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let active = true;

        const checkRunnable = async () => {
            // Simple Pause Check: If status is paused, stop the loop.
            // Result: The loop dies. Resuming means just calling processGraph() again.
            if (useOuroborosStore.getState().status === 'paused') {
                this.addLog('system', '⏸️ Execution paused by user.');
                active = false;
                return;
            }

            if (!active || signal.aborted) return;

            // Fetch nodes from DB
            const allNodes = await db.nodes.toArray();
            const nodesRef: Record<string, Node> = allNodes.reduce((acc, n) => ({ ...acc, [n.id]: n }), {});

            const pendingNodes = allNodes.filter(n => n.status === 'pending');
            const runningNodes = allNodes.filter(n => ['running', 'critiquing', 'synthesizing'].includes(n.status));
            const completedNodes = allNodes.filter(n => n.status === 'complete');

            // Debug logging for resume diagnosis
            console.log(`[processGraph] Status: pending=${pendingNodes.length}, running=${runningNodes.length}, complete=${completedNodes.length}, total=${allNodes.length}`);

            if (pendingNodes.length === 0 && runningNodes.length === 0) {
                useOuroborosStore.getState().setStatus('idle');
                this.addLog('success', 'V2.99 Cycle Complete. Manifestation ready for review.');
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
                    // FAILSAFE: If dependency doesn't exist in the graph, treat it as satisfied (ignore it)
                    // This prevents deadlocks if a phantom ID is injected by a hallucinating Agent
                    if (!depNode) {
                        console.warn(`[ProcessGraph] Warning: Node ${node.id} has missing dependency ${depId}. Treating as satisfied.`);
                        return true;
                    }
                    return depNode.status === 'complete';
                });
            });

            if (runnable.length > 0) {
                console.log(`[processGraph] Found ${runnable.length} runnable nodes:`, runnable.map(n => n.id));
                this.addLog('info', `[Factory] Processing ${runnable.length} nodes...`);
                const results = await Promise.all(runnable.map(node => this.executeNode(node.id, checkRunnable, signal)));
                if (results.includes(false)) {
                    active = false;
                    useOuroborosStore.getState().setStatus('idle');
                    this.addLog('warn', 'Execution paused. Review reported errors.');
                    return;
                }
                checkRunnable();
            } else {
                console.log(`[processGraph] No runnable nodes. activePending=${activePending.length}, runningNodes=${runningNodes.length}`);
                if (activePending.length > 0 && runningNodes.length > 0) {
                    setTimeout(checkRunnable, 1000);
                } else if (activePending.length > 0 && runningNodes.length === 0) {
                    // Check why nodes can't run - log their dependencies
                    activePending.slice(0, 3).forEach(node => {
                        const unmetDeps = node.dependencies.filter(depId => nodesRef[depId]?.status !== 'complete');
                        console.log(`[processGraph] Node ${node.id} blocked by:`, unmetDeps.map(d => `${d} (${nodesRef[d]?.status || 'MISSING'})`));
                    });
                    this.addLog('error', 'Execution Deadlock: Dependencies cannot be satisfied.');
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

    private async executeNode(nodeId: string, checkRunnableCallback: () => void, signal: AbortSignal, retryCount: number = 0): Promise<boolean> {
        this.addLog('info', `▷ EXEC START: ${nodeId}`, nodeId);
        console.log(`[executeNode] START: ${nodeId}`);



        if (signal.aborted) {
            console.log(`[executeNode] ABORTED: ${nodeId}`);
            return false;
        }

        const node = await db.nodes.get(nodeId);
        if (!node) {
            console.log(`[executeNode] NODE NOT FOUND: ${nodeId}`);
            return false;
        }




        // P2-7: ReCAP Recursive Check (V2.99)
        // If the node is a specialist and hasn't been decomposed yet, try to explode it.
        if (node.type === 'specialist' && node.decompositionStatus === 'pending') {
            this.addLog('info', `[ReCAP] Assessing decomposition for ${node.label} (Depth: ${node.depth || 0})...`, nodeId);

            // Mark as analyzing to prevent race conditions
            await this.updateNodeState(nodeId, { status: 'running' });

            // Execute Recursive Prism
            // Get max depth from settings or default to 3
            const settings = useOuroborosStore.getState().settings;
            // Assuming maxRecursiveDepth might be added to settings later, default to 3 for now.
            // Or use a constant if not in settings type yet.
            const maxDepth = (settings as any).maxRecursiveDepth || 3;

            await this.executeRecursivePrism(nodeId, maxDepth);

            // Re-fetch node to check result
            const updatedNode = await db.nodes.get(nodeId);

            if (updatedNode?.decompositionStatus === 'expanded') {
                // If decomposed, this node became a container. We are done.
                // The status is already set to 'complete' inside executeRecursivePrism.
                return true;
            }

            // If updatedNode is 'atomic', we proceed to execute it NOW in this same pass.
            // We just need to make sure 'node' variable reflects the updated state if needed (though only status changed).
            // Flow continues downward...
        }

        let status: NodeStatus = 'running';
        if (node.type === 'specialist') status = 'critiquing';
        if ((node.type as string) === 'lossless_compiler') status = 'synthesizing';

        await this.updateNodeState(nodeId, { status });
        console.log(`[executeNode] Status set to '${status}': ${nodeId}`);

        const startTime = Date.now();
        let lastPrompt = "";
        let rawResponse = "";

        try {
            console.log(`[executeNode] Acquiring semaphore: ${nodeId}`);
            this.addLog('info', `⏳ SEM WAIT: ${nodeId.substring(0, 6)}`, nodeId);
            await this.apiSemaphore.acquire();
            this.addLog('info', `✅ SEM ACQ: ${nodeId.substring(0, 6)}`, nodeId);
            console.log(`[executeNode] Semaphore acquired: ${nodeId}`);

            if (signal.aborted) {
                this.apiSemaphore.release();
                return false;
            }

            console.log(`[executeNode] Waiting for rate limiter: ${nodeId}`);
            this.addLog('info', `⏳ RATE WAIT: ${nodeId.substring(0, 6)}`, nodeId);
            await this.rateLimiter.waitForSlot();
            this.addLog('info', `✅ RATE ACQ: ${nodeId.substring(0, 6)}`, nodeId);
            this.rateLimiter.recordRequest();
            console.log(`[executeNode] Rate limiter passed: ${nodeId}`);

            const settings = useOuroborosStore.getState().settings;

            // Ensure keys are up to date
            const googleKey = this.apiKey || process.env.API_KEY || "";
            const openaiKey = this.openaiApiKey || process.env.OPENAI_API_KEY || "";
            const openRouterKey = settings.openRouterApiKey || process.env.OPENROUTER_API_KEY || "";
            const groqKey = settings.groqApiKey || process.env.GROQ_API_KEY || "";
            this.ai.updateKeys(googleKey || undefined, openaiKey || undefined, openRouterKey || undefined, settings.localBaseUrl, settings.localModelId, groqKey || undefined);

            const ai = this.ai;
            let selectedModel = settings.model;

            // Tiered Model Selection
            if (node.type === 'specialist' && settings.model_specialist) selectedModel = settings.model_specialist;
            if ((node.type as string) === 'lossless_compiler' && settings.model_synthesizer) selectedModel = settings.model_synthesizer;

            // Hydra Rescue Override
            if (node.data?.modelOverride) {
                selectedModel = node.data.modelOverride;
            }

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
                    this.addLog('info', `${node.label} [V2.99 Specialist] activating... (Attempt ${attempts})`, nodeId);

                    // --- V2.99 SPECIALIST PROTOCOL ---
                    const store = useOuroborosStore.getState();
                    const deltas = store.verifiedBricks.map(b => b.delta).filter(Boolean);

                    // Convert constitution object to string for the V2.99 components
                    let livingConstitutionString = buildLivingConstitution(
                        store.documentContent || "No requirements provided.",
                        store.livingConstitution,
                        deltas
                    );

                    // [V2.99] Inject Project Insights (Mid-Term Memory)
                    if (store.projectInsights && store.projectInsights.length > 10) {
                        livingConstitutionString += `\n\n## 🔍 PROJECT INSIGHTS & ARCHITECTURAL PATTERNS\n(Synthesized from previous work - TREAT AS BINDING DECISIONS)\n${store.projectInsights}`;
                    }

                    // 2. Prepare Input
                    const input: SpecialistInput = {
                        atomicInstruction: node.instruction,
                        livingConstitution: livingConstitutionString,
                        skillInjections: [],
                        persona: node.persona,
                        complexity: 5,
                        isLiteMode: selectedModel === 'local-custom-small'
                    };

                    // [V2.99 gap] Adaptive Routing
                    if (settings.enableAdaptiveRouting) {
                        // If task is simple (low complexity), route to faster model
                        // Assumption: complexity 1-4 = Fast, 5-7 = Balanced, 8-10 = Strong
                        // Since we don't have dynamic complexity analysis yet, we use node.data.complexity or default
                        const complexity = node.data?.complexity || 5;
                        if (complexity < 5) {
                            const fastModel = settings.model_fast || settings.model_reflexion || 'gemini-2.0-flash-exp';
                            this.addLog('info', `[Adaptive Routing] Low complexity (${complexity}). Routing to Fast Model: ${fastModel}`, nodeId);
                            selectedModel = fastModel;
                        }
                    }

                    // 3. Execute Specialist (Generation)
                    const output = await this.specialist.execute(input, selectedModel);
                    if (output.modelUsed) selectedModel = output.modelUsed;
                    rawResponse = output.rawResponse;

                    // [V2.99 gap] Red Flag Validation
                    if (settings.enableRedFlagging) {
                        const validation = this.redFlagValidator.validate(
                            output.artifact,
                            90, // We assume high confidence if it generated, or we could parse it
                            settings.turboMode,
                            settings.disabledRedFlags
                        );

                        if (!validation.passed) {
                            this.addLog('warn', `Red Flag Detection: ${validation.flags.map(f => f.type).join(', ')}`, nodeId);
                            // Retry logic handled by loop
                            if (attempts < maxAttempts) {
                                this.addLog('info', `Retrying with temp adjustments...`, nodeId);
                                currentTemp = Math.min(0.9, currentTemp + 0.1); // Bump temp to break loops
                                continue;
                            }
                        }
                    }

                    // 4. Reflexion Loop (Self-Correction)
                    this.addLog('info', `[${node.label}] Entering Reflexion Loop...`, nodeId);

                    // Update Reflexion Model from Settings (Priority: Specific -> Fast -> Global)
                    const targetReflexionModel = settings.model_reflexion || settings.model_fast || settings.model;
                    this.reflexionLoop.setCritiqueModel(targetReflexionModel);

                    this.addLog('info', `[Reflexion] Critiquing with model: ${targetReflexionModel}`, nodeId);

                    const reflexionResult = await this.reflexionLoop.reflect(output, input.atomicInstruction, livingConstitutionString);

                    const finalArtifact = reflexionResult.finalOutput.artifact;

                    // 5. Blackboard Surveyor (Sanity Check)
                    const survey = this.blackboardSurveyor.survey(finalArtifact);
                    if (!survey.passed) {
                        this.addLog('warn', `Surveyor Refusal: ${survey.summary}`, nodeId);
                        resultText = `[SURVEYOR REFUSAL] ${survey.summary}`;
                        score = 0;
                    } else {
                        // 6. Antagonist Protocol (Tribunal)
                        let isVerified = true;
                        let tribunalReasoning = "Verified by default";
                        let antagonistDuel: any = undefined;

                        if (settings.enableAntagonistProtocol) {
                            // Update Antagonist Model from Settings (fallback to global default if empty)
                            const targetAntagonistModel = settings.model_antagonist || settings.model;
                            this.antagonistMirror.updateConfig({
                                model: targetAntagonistModel,
                                isLiteMode: targetAntagonistModel === 'local-custom-small'
                            });
                            this.addLog('info', `[Antagonist] Using model: ${targetAntagonistModel}`, nodeId);

                            this.addLog('info', `[${node.label}] Facing the Tribunal (Antagonist)...`, nodeId);
                            const duel = await this.antagonistMirror.conductDuel(
                                finalArtifact,
                                livingConstitutionString,
                                node.instruction
                            );
                            antagonistDuel = duel;
                            isVerified = duel.isVerified;
                            tribunalReasoning = duel.initialAudit.reasoning;

                            if (!isVerified) {
                                this.addLog('warn', `Tribunal Rejected: ${tribunalReasoning}`, nodeId);
                            } else {
                                this.addLog('success', `Tribunal Verified.`, nodeId);
                            }
                        }

                        if (isVerified) {
                            resultText = finalArtifact;
                            score = 100;

                            // V2.99: Construct Verified Brick
                            const verifiedBrick: any = {
                                id: node.id,
                                persona: node.persona,
                                instruction: node.instruction,
                                artifact: finalArtifact,
                                confidence: 100, // 100% confidence for Tribunal-Verified bricks
                                verifiedAt: Date.now(),
                                delta: output.blackboardDelta || { newConstraints: [], decisions: [], warnings: [] }
                            };

                            // V2.99: Merge into Blackboard
                            this.deltaManager.mergeDelta(verifiedBrick);
                            store.addVerifiedBrick(verifiedBrick);

                            // [V2.99] Trigger Project Insight Synthesis (Every 5 bricks)
                            // We do this AFTER adding the new brick so it's included in synthesis
                            const updatedBricks = useOuroborosStore.getState().verifiedBricks;
                            if (updatedBricks.length >= 3 && updatedBricks.length % 5 === 0) {
                                this.addLog('info', '[Project Insight] Synthesizing architectural patterns...', nodeId);
                                // Run in background to not block main thread too much, but update store when done
                                this.projectInsightManager.synthesizeInsights(
                                    updatedBricks,
                                    livingConstitutionString,
                                    store.projectInsights,
                                    settings.model_project_insight || settings.model
                                ).then(insights => {
                                    useOuroborosStore.getState().setProjectInsights(insights);
                                    this.addLog('success', '[Project Insight] Insights updated.', nodeId);
                                }).catch(err => {
                                    console.error("Insight synthesis failed:", err);
                                });
                            }

                            // Map result data for UI
                            resultData = {
                                ...resultData,
                                artifact: finalArtifact,
                                verified: true,
                                antagonistDuel
                            };
                            executionValid = true; // Loop success!
                        } else {
                            resultText = `[TRIBUNAL REJECTION] ${tribunalReasoning}`;
                            score = 0;
                            resultData = { ...resultData, verified: false };

                            // [V2.99 gap] Predictive Cost Scaling
                            if (settings.enablePredictiveCostScaling && attempts < maxAttempts) {
                                this.addLog('warn', `[Cost Scaling] Tribunal rejection. Upgrading model for retry...`, nodeId);
                                // Upgrade to S-Tier or strongest available for next attempt
                                const strongModel = settings.model_antagonist || settings.model || 'gemini-1.5-pro-001';
                                selectedModel = strongModel;
                                // Also reduce temperature to be more precise
                                currentTemp = 0.2;
                            }
                        }
                    }

                } else if ((node.type as string) === 'lossless_compiler') {
                    this.addLog('info', 'Lossless Compiler: Assembling Manifestation...', nodeId);

                    const store = useOuroborosStore.getState();
                    const verifiedBricks = store.verifiedBricks.filter(b => b.artifact && b.artifact.trim().length > 0);

                    if (verifiedBricks.length === 0) {
                        this.addLog('warn', 'No verified bricks found for assembly. Finalizing empty spec.', nodeId);
                        resultText = "No content to compile.";
                    } else {
                        // Update SecurityPatcher model from settings (fallback to global default if empty)
                        const targetSecurityModel = settings.model_security || settings.model;
                        this.securityPatcher.updateConfig({
                            model: targetSecurityModel,
                            allowCodeGeneration: settings.allowCodeGeneration
                        });
                        this.addLog('info', `Performing Final Security Scan with model: ${targetSecurityModel}...`, nodeId);

                        // [V2.99 Fix] "The Amnesia Cure"
                        // Problem: store.verifiedBricks only contains bricks from the CURRENT loaded session segment.
                        // On resume, this means previous bricks are missing from the compilation despite existing in the DB.
                        // Fix: We must re-hydrate the FULL LIST of verified bricks from the project checkpoint or node history.

                        let allVerifiedBricks = [...verifiedBricks];

                        try {
                            // 1. Fetch the full project state to get historical bricks
                            const project = await db.projects.get(this.checkpointManager ? this.checkpointManager.getSessionId() : 'current_session');

                            if (project && (project as any).verifiedBricks) {
                                const historyBricks = (project as any).verifiedBricks;

                                // 2. Merge without duplicates (ID check)
                                const currentids = new Set(allVerifiedBricks.map(b => b.id));
                                const missingBricks = historyBricks.filter((b: any) => !currentids.has(b.id));

                                if (missingBricks.length > 0) {
                                    this.addLog('info', `[Compiler] Restoring ${missingBricks.length} historical bricks from history...`, nodeId);
                                    allVerifiedBricks = [...missingBricks, ...allVerifiedBricks];
                                }
                            }

                            // 3. Fallback: Scan ALL completed nodes in the graph if direct brick list is missing
                            // This catches cases where nodes were "completed" but not added to the verifiedBricks array properly
                            if (allVerifiedBricks.length < 5) { // Heuristic check
                                this.addLog('info', `[Compiler] Deep Scan: Checking all graph nodes for artifacts...`, nodeId);
                                const allNodes = await db.nodes.toArray(); // Fallback: Get all nodes if projectId is not in store
                                const completedNodes = allNodes.filter(n => n.status === 'complete' && n.data && n.data.output);

                                // Filter out nodes we already have bricks for
                                const existingNodeIds = new Set(allVerifiedBricks.map(b => b.id)); // Assuming brick.id usually matches node.id or related

                                // Note: verifiedBrick.id might not match node.id exactly depending on implementation, 
                                // but usually verifiedBrick.id IS the node.id in this system.

                                completedNodes.forEach(node => {
                                    if (!existingNodeIds.has(node.id) && node.type === 'specialist') {
                                        // Re-construct a brick from the node data
                                        // Only if it looks like a valid output
                                        if (typeof node.data.output === 'string' && node.data.output.length > 50) {
                                            // Mock a verified brick structure
                                            allVerifiedBricks.push({
                                                id: node.id,
                                                instruction: node.instruction || "Unknown Task",
                                                persona: (node.data as any).persona || "Unknown Specialist",
                                                artifact: node.data.output,
                                                confidence: 100,
                                                verifiedAt: Date.now()
                                            } as any);
                                        }
                                    }
                                });
                            }

                            // 4. Sort by ID (usually chronological) or Node ID to ensure logical flow
                            allVerifiedBricks.sort((a, b) => {
                                // Try to extract numeric prefix if present, else lex
                                return a.id.localeCompare(b.id);
                            });

                        } catch (e) {
                            this.addLog('warn', `[Compiler] Historical hydration failed: ${e}`, nodeId);
                            // Fallback to current bricks only
                        }

                        const securityScan = await this.securityPatcher.scan(allVerifiedBricks as any);
                        if (!securityScan.passed) {
                            this.addLog('error', `Security Patcher Veto: ${securityScan.recommendation} (Issues: ${securityScan.issues.map(i => i.description).join(', ')})`, nodeId);
                        } else {
                            this.addLog('success', 'Security Scan Passed.', nodeId);
                        }

                        const assembly = await this.losslessCompiler.compile({
                            verifiedBricks: allVerifiedBricks as any,
                            projectMetadata: {
                                name: (useOuroborosStore.getState().projectPlan as any)?.overview?.name || "Ouroboros Project",
                                domain: useOuroborosStore.getState().livingConstitution.domain,
                                generatedAt: Date.now(),
                                brickCount: allVerifiedBricks.length,
                                techStack: useOuroborosStore.getState().livingConstitution.techStack,
                                constraints: useOuroborosStore.getState().livingConstitution.constraints,
                                decisions: useOuroborosStore.getState().livingConstitution.decisions,
                                warnings: useOuroborosStore.getState().livingConstitution.warnings,
                                originalPrompt: useOuroborosStore.getState().livingConstitution.originalRequirements
                            }
                        });
                        resultText = assembly.manifestation;
                        score = 100;
                        resultData = { assembly };

                        // V2.99: Save the manifestation to the store so it appears in the UI
                        useOuroborosStore.getState().setManifestation(resultText);
                        this.addLog('success', 'V.99 Cycle Complete. Manifestation ready for review.', nodeId);
                    }
                }

                if (settings.enableRedFlagging && !executionValid) {
                    // V2.99 Turbo Mode Logic
                    const complexity = node.data?.complexity || 5;
                    const isTurbo = settings.turboMode || (settings.autoTurboMode !== false && complexity < (settings.turboComplexityThreshold || 5));

                    const validation = this.redFlagValidator.validate(resultText, score, isTurbo);
                    await this.updateNodeState(nodeId, { redFlags: validation.flags });

                    if (!validation.passed) {
                        this.addLog('warn', `Red Flags: ${validation.flags.map((f: any) => f.type).join(', ')}`, nodeId);
                        if (validation.shouldRetry && attempts < maxAttempts) {
                            const retryMsg = await this.redFlagValidator.retry(nodeId, validation.suggestedTemperature || currentTemp);
                            this.addLog('warn', retryMsg, nodeId);
                            currentTemp = validation.suggestedTemperature || currentTemp;
                        } else {
                            executionValid = true;
                        }
                    } else {
                        executionValid = true;
                    }
                } else {
                    // If red flagging is disabled or already valid, ensure we exit loop
                    executionValid = true;
                }
            } // End while loop

            if (resultText) {
                let layer: 'domain' | 'lexical' | 'subject' = 'lexical';
                if ((node.type as string) === 'lossless_compiler') layer = 'domain';

                // Safeguard: Knowledge Graph update with timeout
                try {
                    const kgUpdate = this.knowledgeGraphManager.addNode(nodeId, node.label, layer, layer, resultText, ai, selectedModel, {
                        persona: node.persona,
                        instruction: node.instruction,
                        cycle: 1,
                        artifacts: (node as any).artifacts
                    });

                    // Race against 10s timeout
                    await Promise.race([
                        kgUpdate,
                        new Promise((_, reject) => setTimeout(() => reject(new Error("KG Timeout")), 10000))
                    ]);

                    node.dependencies.forEach(depId => {
                        this.knowledgeGraphManager.addEdge(depId, nodeId, 'influences', 1.0);
                    });
                } catch (kgError) {
                    this.addLog('warn', `[KnowledgeGraph] Update failed/timed out for ${node.id}. Proceeding...`, nodeId);
                    console.error("[KnowledgeGraph] Error:", kgError);
                }
            }

            if (settings.enableAgentMemory) {
                // Safeguard: Memory Store with timeout
                try {
                    const memoryItem = { cycle: 1, feedback: resultText.substring(0, 100) + "...", outcomeScore: score, timestamp: Date.now(), adopted: true };
                    const memUpdate = this.memoryManager.storeMemory(node.persona, { ...memoryItem, agentId: node.persona }, ai, selectedModel, undefined);

                    await Promise.race([
                        memUpdate,
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Memory Timeout")), 5000))
                    ]);

                    const currentMemory = (node as any).memory || [];
                    await this.updateNodeState(nodeId, { memory: [...currentMemory, memoryItem] } as any);
                } catch (memError) {
                    this.addLog('warn', `[Memory] Update failed/timed out for ${node.id}. Proceeding...`, nodeId);
                    console.error("[Memory] Error:", memError);
                }
            }

            this.apiSemaphore.release();
            this.addLog('info', `✅ EXEC COMPLETE: ${nodeId} (Score: ${score})`, nodeId);

            try {
                await this.updateNodeState(nodeId, {
                    status: 'complete',
                    output: resultText,
                    score: score,
                    data: resultData,
                    debugData: { lastPrompt, rawResponse, timestamp: Date.now(), modelUsed: selectedModel, executionTimeMs: Date.now() - startTime }
                });
            } catch (updateError) {
                console.error(`[executeNode] Final node update failed for ${nodeId}`, updateError);
                // Fallback: try one more time or just log
                this.addLog('error', `DB Update Failed for ${nodeId}: ${updateError}`, nodeId);
            }

            // V2.99 INCREMENTAL CHECKPOINT: Save progress after every node
            // This ensures "Resume" picks up exactly where we left off, not from the start.
            if (this.checkpointManager && settings.enableCheckpointing !== false) {
                // We use a microtask-like pattern by not awaiting the full DB read/write chain if possible, 
                // but for safety we'll just fire and forget.
                db.nodes.toArray().then(currentNodes => {
                    this.checkpointManager?.checkpoint(SessionPhase.EXECUTION_IN_PROGRESS, {
                        nodes: currentNodes
                    }, `Completed ${node.label}`);
                });
            }

            return true;

        } catch (e) {
            console.error(e);
            this.apiSemaphore.release();
            const err = e as Error;

            if (e instanceof AllHeadsSeveredError || err.name === 'AllHeadsSeveredError') {
                this.addLog('error', `HYDRA: All heads severed for ${node.label}.`, nodeId);
                await this.updateNodeState(nodeId, { status: 'distress', failedModel: "All Tiers Exhausted", lastHydraLog: err.message, output: `HYDRA FAILURE: ${err.message}` } as any);
                return false;
            }

            if (err.message.includes("quota") || err.message.includes("429")) {
                const waitTimeSeconds = Math.min(3 * Math.pow(2, retryCount), 30);
                this.addLog('warn', `Quota Limit Hit (429). Pausing for ${waitTimeSeconds}s...`, nodeId);
                await this.updateNodeState(nodeId, { status: 'pending' });
                await new Promise(resolve => setTimeout(resolve, waitTimeSeconds * 1000));
                if (signal.aborted) return false;
                return this.executeNode(nodeId, checkRunnableCallback, signal, retryCount + 1);
            }

            this.addLog('error', err.message, nodeId);
            await this.updateNodeState(nodeId, { status: 'error', output: err.message });
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

    public async updateNodeState(id: string, updates: Partial<Node>) {
        await db.nodes.update(id, updates);

        // Reflect in store graph immediately for UI responsiveness
        const nodes = await db.nodes.toArray();
        const edges = await db.edges.toArray();

        // Only trigger full store update if status changed effectively
        this.updateGraph(
            nodes.reduce((acc, n) => ({ ...acc, [n.id]: n }), {}),
            edges.map(e => ({ source: e.source, target: e.target }))
        );
    }

    private async updateGraph(newNodes: Record<string, Node>, newEdges: { source: string, target: string }[]) {
        // This method is critical and dangerous. It recalculates the layout and persists position.
        // PREVIOUS BUG: It was doing a bulkPut of the entire node object, which overwrote
        // concurrent status updates (like 'complete') with stale data if reading/writing raced.

        const existingNodesArr = await db.nodes.toArray();
        const existingNodes = existingNodesArr.reduce((acc, n) => ({ ...acc, [n.id]: n }), {} as Record<string, Node>);

        // Merge in the *updates* from the caller (newNodes), which might just be partials or new nodes
        const mergedNodes = { ...existingNodes, ...newNodes };

        // Calculate layout modifies the node objects in-place with x/y/layer
        const layoutedNodes = this.calculateLayout(mergedNodes);

        await db.transaction('rw', db.nodes, db.edges, async () => {
            // V2.99 FIX: Instead of bulkPut(allNodes), we only update positions for existing nodes
            // and add new nodes if they are truly new.

            const updates: Promise<any>[] = [];

            Object.values(layoutedNodes).forEach(node => {
                const existing = existingNodes[node.id];
                if (existing) {
                    // It's an update. ONLY update layout fields to avoid stomping on status/output loops
                    // UNLESS newNodes explicitly contained full data for this node (which updateNodeState passes)
                    // But updateNodeState passes a merged version effectively? 
                    // No, updateNodeState argument 'updates' is partial.
                    // But 'newNodes' passed to this function is constructed how?
                    // Caller updateNodeState does: nodes.reduce... -> effectively ALL nodes current state.

                    // The safest bet for visuals is to only update x, y, layer.
                    // The 'newNodes' passed in might have the latest status, but 'existingNodes' fetched inside
                    // this function might be slightly older or newer depending on the race.

                    // If we blindly update everything, we lose the race.
                    // If we only update x,y, layer, we preserve the DB's truth for status.
                    updates.push(db.nodes.update(node.id, { x: node.x, y: node.y, layer: node.layer }));
                } else {
                    // It's a brand new node (e.g. from decomposition), add it fully.
                    updates.push(db.nodes.put(node));
                }
            });

            await Promise.all(updates);

            for (const edge of newEdges) {
                const exists = await db.edges.where('source').equals(edge.source).and(e => e.target === edge.target).first();
                if (!exists) await db.edges.add({ source: edge.source, target: edge.target, type: 'dependency' });
            }
        });
    }

    /**
     * Download project in various formats
     * 
     * @param format - Output format:
     *   - 'markdown': Project Bible (comprehensive specification document)
     *   - 'json': Raw project data in JSON format
     *   - 'scaffold': ZIP file with ready-to-code project structure (Pillar 3)
     */
    public async downloadProject(format: 'markdown' | 'json' | 'scaffold' = 'markdown') {
        const store = useOuroborosStore.getState();

        if (format === 'scaffold') {
            // Pillar 3: Generate and download project scaffold ZIP
            await this.downloadProjectScaffold();
        } else if (format === 'markdown') {
            // Project Bible Download (v2.99)
            // The lossless_compiler node has already compiled the bricks into a manifestation.
            // We simply retrieve that output rather than re-compiling.
            const date = new Date().toISOString().split('T')[0];

            // [V2.99 Fix] "The Amnesia Cure" - Download Edition
            // Instead of trusting the potentially stale store.manifestation or a single node output,
            // we FORCE a fresh re-compilation using the Deep Hydration logic to ensure we get ALL bricks.
            this.addLog('info', '[Download] Generative Export: Re-compiling Project Bible from full history...');

            try {
                // 1. Hydrate ALL Verified Bricks (Deep Scan)
                const store = useOuroborosStore.getState();
                let allVerifiedBricks = [...store.verifiedBricks];

                // Fetch full history from DB
                const allNodes = await db.nodes.toArray();

                // [V2.99 Fix - Corrected Property Access]
                // Historical nodes store the final text in `node.output` (root) 
                // OR `node.data.artifact`. `node.data.output` does NOT exist.
                const completedNodes = allNodes.filter(n =>
                    n.status === 'complete' &&
                    (n.output || (n.data && (n.data as any).artifact))
                );

                // Reconstruct bricks from all valid completed nodes
                // (This handles cases where verifiedBricks array was lost/partial on resume)
                const existingIds = new Set(allVerifiedBricks.map(b => b.id));

                completedNodes.forEach(node => {
                    // [V2.99 Improvement] Handle both String and Object outputs
                    // and extraction of inner artifact from JSON wrappers
                    if (((node.type as string) === 'specialist' || (node.type as string) === 'custom') && !existingIds.has(node.id)) {
                        let finalArtifact = "";

                        // Priority 1: Root Output (Most reliable for text)
                        // Priority 2: Data Artifact (Redundant copy)
                        const rawOutput = node.output || (node.data as any).artifact;

                        if (typeof rawOutput === 'string') {
                            if (rawOutput.length > 50) {
                                // Try to parse if it looks like JSON wrapper
                                try {
                                    if (rawOutput.trim().startsWith('{')) {
                                        const parsed = JSON.parse(rawOutput);
                                        finalArtifact = parsed.repaired_artifact || parsed.artifact || (parsed.repairedArtifact as any)?.content || rawOutput;
                                        // Handle nested structure from debug report
                                        if (typeof finalArtifact === 'object') {
                                            // If it's still an object (e.g. schema definition), stringify it nicely
                                            if (parsed.repaired_artifact && typeof parsed.repaired_artifact === 'object') {
                                                finalArtifact = JSON.stringify(parsed.repaired_artifact, null, 2);
                                            } else {
                                                finalArtifact = JSON.stringify(finalArtifact, null, 2);
                                            }
                                        }
                                    } else {
                                        finalArtifact = rawOutput;
                                    }
                                } catch (e) {
                                    finalArtifact = rawOutput; // Treat as smooth text
                                }
                            }
                        } else if (typeof rawOutput === 'object' && rawOutput !== null) {
                            // It's already an object in DB
                            finalArtifact = (rawOutput as any).repaired_artifact || (rawOutput as any).artifact || JSON.stringify(rawOutput, null, 2);
                            if (typeof finalArtifact === 'object') {
                                finalArtifact = JSON.stringify(finalArtifact, null, 2);
                            }
                        }

                        if (finalArtifact && finalArtifact.length > 20) {
                            allVerifiedBricks.push({
                                id: node.id,
                                instruction: node.instruction || node.label || "Unknown Task",
                                persona: (node.data as any).persona || "Unknown Specialist",
                                artifact: finalArtifact,
                                confidence: 100,
                                verifiedAt: Date.now()
                            } as any);
                        }
                    }
                });

                // Sort chronologically
                allVerifiedBricks.sort((a, b) => a.id.localeCompare(b.id));

                this.addLog('info', `[Download] Assembled ${allVerifiedBricks.length} verified bricks for export.`);

                // 2. Compile Fresh Bible
                const assembly = await this.losslessCompiler.compile({
                    verifiedBricks: allVerifiedBricks as any,
                    projectMetadata: {
                        name: (store.projectPlan as any)?.overview?.name || "Ouroboros Project",
                        domain: store.livingConstitution.domain,
                        generatedAt: Date.now(),
                        brickCount: allVerifiedBricks.length,
                        techStack: store.livingConstitution.techStack,
                        constraints: store.livingConstitution.constraints,
                        decisions: store.livingConstitution.decisions,
                        warnings: store.livingConstitution.warnings,
                        originalPrompt: store.livingConstitution.originalRequirements || store.documentContent
                    }
                });

                let projectBible = assembly.manifestation;

                // [V2.99] Append Token Usage Report
                if (store.usageMetrics && Object.keys(store.usageMetrics).length > 0) {
                    projectBible += "\n\n---\n\n## 📊 Efficiency Report (Token Usage)\n\n";
                    projectBible += "| Model | Requests | Prompt | Completion | Total |\n";
                    projectBible += "| :--- | :---: | :---: | :---: | :---: |\n";

                    let grandTotal = 0;
                    Object.entries(store.usageMetrics).forEach(([model, stats]) => {
                        projectBible += `| **${model}** | ${stats.requestCount} | ${stats.promptTokens.toLocaleString()} | ${stats.completionTokens.toLocaleString()} | ${stats.totalTokens.toLocaleString()} |\n`;
                        grandTotal += stats.totalTokens;
                    });

                    projectBible += `| **TOTAL** | | | | **${grandTotal.toLocaleString()}** |\n`;
                    projectBible += `\n*Report generated at ${new Date().toISOString()}*\n`;
                }

                // 3. Download
                const blob = new Blob([projectBible], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `PROJECT_BIBLE_${date}.md`;
                a.click();
                URL.revokeObjectURL(url);

                this.addLog('success', '[Download] Project Bible (Fresh Build) downloaded.');

            } catch (error) {
                console.error("Download Compilation Failed:", error);
                this.addLog('error', `[Download] Compilation failed: ${error}`);
                alert("Failed to generate Project Bible. Check console for details.");
            }
        } else {
            // JSON format
            const data = {
                generatedAt: new Date().toISOString(),
                generator: 'Ouroboros Engine V2.99',
                vision: store.documentContent,
                manifestation: store.manifestation,
                constitution: store.livingConstitution,
                bricks: store.verifiedBricks,
                prismAnalysis: store.prismAnalysis
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_data_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Download project scaffold as a ZIP file (Pillar 3)
     * Generates a ready-to-code project structure with stub implementations
     */
    private async downloadProjectScaffold(): Promise<void> {
        const store = useOuroborosStore.getState();

        // Validate we have content to scaffold
        if (store.verifiedBricks.length === 0) {
            this.addLog('warn', '[Scaffolder] No verified bricks found. Cannot generate scaffold.');
            alert('No verified bricks found. Please run the Factory first to generate specifications.');
            return;
        }

        this.addLog('info', '[Scaffolder] Generating project scaffold...');

        try {
            const scaffolder = new Scaffolder();

            // Build scaffold config from store state
            const projectName = this.extractProjectName(store.documentContent);
            const config: ScaffoldConfig = {
                projectName,
                techStack: store.livingConstitution.techStack || [],
                bricks: store.verifiedBricks.map(b => ({
                    id: b.id,
                    persona: b.persona,
                    instruction: b.instruction,
                    artifact: b.artifact,
                    delta: b.delta || { newConstraints: [], decisions: [], warnings: [] },
                    verifiedAt: b.verifiedAt,
                    confidence: b.confidence
                })),
                constitution: {
                    originalRequirements: store.livingConstitution.originalRequirements || store.documentContent,
                    domain: store.livingConstitution.domain,
                    techStack: store.livingConstitution.techStack,
                    constraints: store.livingConstitution.constraints,
                    decisions: store.livingConstitution.decisions,
                    warnings: store.livingConstitution.warnings,
                    lastUpdated: store.livingConstitution.lastUpdated,
                    deltaCount: store.livingConstitution.deltaCount
                },
                domain: store.livingConstitution.domain
            };

            // Generate file tree
            const result = scaffolder.generate(config);
            this.addLog('info', `[Scaffolder] ${result.summary}`);

            // Generate ZIP blob
            const zipBlob = await scaffolder.generateZip(result.tree);

            // Trigger download
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.toKebabCase(projectName)}_scaffold_${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(url);

            this.addLog('success', `[Scaffolder] Downloaded scaffold ZIP with ${result.fileCount} files.`);
        } catch (error: any) {
            this.addLog('error', `[Scaffolder] Failed to generate scaffold: ${error.message}`);
            console.error('[Scaffolder] Error:', error);
            alert(`Failed to generate scaffold: ${error.message}`);
        }
    }

    /**
     * Extract a project name from the document content
     */
    private extractProjectName(content: string): string {
        // Try to find a project name from common patterns
        const patterns = [
            /(?:project|app|application|build|create|develop)[:\s]+["']?([\w\s-]+)["']?/i,
            /(?:called|named)[:\s]+["']?([\w\s-]+)["']?/i,
            /^#\s*(.+?)\s*$/m, // First heading
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim().substring(0, 50); // Limit length
                if (name.length > 2) return name;
            }
        }

        // Fallback: Use first few words
        const words = content.split(/\s+/).slice(0, 3).join(' ');
        if (words.length > 2 && words.length < 50) {
            return words;
        }

        return 'ouroboros-project';
    }

    /**
     * Convert string to kebab-case
     */
    private toKebabCase(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .replace(/[^\w-]/g, '')
            .toLowerCase();
    }

    /**
     * Refines the Prima Materia (Specification) into a robust architectural document.
     * Corresponds to the user's "Refine Mode" intent.
     */
    public async refineSpecification() {
        const store = useOuroborosStore.getState();
        const content = store.documentContent;
        if (!content.trim()) return;

        store.setStatus('thinking');
        this.addLog('info', 'Running Architectural Refinement Loop...');

        // Verify we have keys
        const googleKey = this.apiKey || process.env.API_KEY || "";
        const openaiKey = this.openaiApiKey || process.env.OPENAI_API_KEY || "";
        this.ai.updateKeys(googleKey || undefined, openaiKey || undefined);

        const prompt = `
        You are the Ouroboros Architect (Senior Level).
        Your goal: Transmute this raw idea (Prima Materia) into a Professional Technical Specification.

        INPUT PRIMA MATERIA:
        ${content}

        INSTRUCTIONS:
        1. Analyze the core intent and vision.
        2. Expand on technical requirements (Frontend, Backend, Database, Auth).
        3. Identify and explicitly define implied features.
        4. Structure the output as a clean, professional Markdown document (The Project Bible).
        5. Main Sections: Executive Summary, Core Features, Tech Stack & Architecture, Data Models, User Flows.

        OUTPUT:
        Return ONLY the rewritten Markdown document. Do not add conversational filler.
        `;

        try {
            const settings = store.settings;
            // Use Genesis or Prism model for high reasoning
            const model = settings.model_genesis || settings.model_prism || settings.model || 'gpt-4o';

            const resp = await this.callLLM(model, prompt);

            if (resp.text) {
                store.setDocumentContent(resp.text);
                this.addLog('success', 'Prima Materia successfully transmuted.');
            } else {
                this.addLog('warn', 'Refinement returned empty.');
            }
        } catch (e) {
            this.addLog('error', `Refinement failed: ${e}`);
        }

        store.setStatus('idle');
    }

    public async downloadPrismTasks() {
        const store = useOuroborosStore.getState();
        const analysis = store.prismAnalysis;
        if (!analysis) return;

        const date = new Date().toISOString().split('T')[0];
        let md = `# PRISM DECOMPOSITION: ${date}\n\n`;
        md += `**Domain:** ${store.livingConstitution.domain}\n`;
        md += `**Original Goal:** ${store.livingConstitution.originalRequirements}\n\n`;

        md += `## 🧠 The Council\n`;
        analysis.stepD.councilMembers.forEach(m => {
            md += `- **${m.agent.role}**: ${m.agent.description || 'Specialist'}\n`;
        });
        md += `\n`;

        md += `## ⚡ Atomic Task List\n`;
        analysis.stepB.atomicTasks.forEach((t, i) => {
            md += `- [ ] **${t.title}**\n`;
            md += `  - *Specialist:* ${t.assignedSpecialist}\n`;
            md += `  - *Instruction:* ${t.instruction}\n`;
        });

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PRISM_TASKS_${date}.md`;
        a.click();
    }

    public async generateDebugReport(): Promise<string> {
        const nodes = await db.nodes.toArray();
        const logs = await db.logs.toArray();
        const edges = await db.edges.toArray();
        const store = useOuroborosStore.getState();
        const settings = store.settings;

        const timestamp = new Date().toISOString();
        const dateStr = new Date().toLocaleString();

        let report = `# 🐍 OUROBOROS DEBUG REPORT
**Generated:** ${dateStr}
**Timestamp:** ${timestamp}
**Session:** ${store.currentSessionName || 'Unsaved Session'}
**Status:** ${store.status}

---

## 1. 📋 ORIGINAL REQUIREMENTS (PRIMA MATERIA)

\`\`\`
${store.originalRequirements || store.documentContent || 'No requirements captured'}
\`\`\`

---

## 2. 🏛️ LIVING CONSTITUTION

| Field | Value |
|-------|-------|
| **Domain** | ${store.livingConstitution.domain || 'Not set'} |
| **Tech Stack** | ${store.livingConstitution.techStack?.join(', ') || 'None'} |
| **Last Updated** | ${store.livingConstitution.lastUpdated ? new Date(store.livingConstitution.lastUpdated).toLocaleString() : 'Never'} |
| **Delta Count** | ${store.livingConstitution.deltaCount || 0} |

### Constraints
${store.livingConstitution.constraints?.length > 0
                ? store.livingConstitution.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')
                : '_No constraints recorded_'}

### Decisions
${store.livingConstitution.decisions?.length > 0
                ? store.livingConstitution.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')
                : '_No decisions recorded_'}

### Warnings
${store.livingConstitution.warnings?.length > 0
                ? store.livingConstitution.warnings.map((w, i) => `⚠️ ${w}`).join('\n')
                : '_No warnings_'}

---

## 3. 🔮 PRISM ANALYSIS

`;

        if (store.prismAnalysis) {
            const prism = store.prismAnalysis;

            report += `### Step A: Domain Classification
| Field | Value |
|-------|-------|
| **Domain** | ${prism.stepA?.domain || 'N/A'} |
| **Sub-Domain** | ${prism.stepA?.subDomain || 'N/A'} |
| **Confidence** | ${prism.stepA?.confidence ? (prism.stepA.confidence * 100).toFixed(1) + '%' : 'N/A'} |
| **Expertise Required** | ${prism.stepA?.domainExpertise?.join(', ') || 'N/A'} |

### Step B: The Council
`;
            if (prism.stepB?.council?.specialists) {
                report += `| ID | Role | Temperature |\n|-----|------|-------------|\n`;
                prism.stepB.council.specialists.forEach((s: any) => {
                    report += `| ${s.id} | ${s.role} | ${s.temperature || 0.5} |\n`;
                });
                report += `\n**Council Reasoning:** ${prism.stepB.council.reasoning || 'N/A'}\n\n`;
            }

            report += `### Step B: Atomic Tasks (${prism.stepB?.atomicTasks?.length || 0} total)
| # | ID | Title | Specialist | Complexity | Path | Enabled |
|---|-----|-------|------------|------------|------|---------|
`;
            if (prism.stepB?.atomicTasks) {
                prism.stepB.atomicTasks.forEach((t: any, i: number) => {
                    report += `| ${i + 1} | ${t.id} | ${t.title?.substring(0, 40)}${t.title?.length > 40 ? '...' : ''} | ${t.assignedSpecialist || '❌ undefined'} | ${t.complexity || '?'} | ${t.routingPath || '?'} | ${t.enabled !== false ? '✅' : '❌'} |\n`;
                });
            }

            report += `\n### Step C: Routing Summary
| Metric | Value |
|--------|-------|
| **Fast Path Tasks** | ${prism.stepC?.fastPathTasks?.length || 0} |
| **Slow Path Tasks** | ${prism.stepC?.slowPathTasks?.length || 0} |
| **Est. Total Tokens** | ${prism.stepC?.estimatedTotalTokens?.toLocaleString() || 'N/A'} |
| **Complexity Distribution** | Low: ${prism.stepC?.complexityDistribution?.low || 0}, Med: ${prism.stepC?.complexityDistribution?.medium || 0}, High: ${prism.stepC?.complexityDistribution?.high || 0} |

`;
        } else {
            report += `_No Prism analysis available. Factory may not have been started._\n\n`;
        }

        report += `---

## 4. ✅ VERIFIED BRICKS (${store.verifiedBricks?.length || 0} total)

`;
        if (store.verifiedBricks?.length > 0) {
            store.verifiedBricks.forEach((brick, i) => {
                report += `### Brick ${i + 1}: ${brick.id}
- **Persona:** ${brick.persona?.substring(0, 100)}${brick.persona?.length > 100 ? '...' : ''}
- **Instruction:** ${brick.instruction?.substring(0, 150)}${brick.instruction?.length > 150 ? '...' : ''}
- **Confidence:** ${(brick.confidence * 100).toFixed(0)}%
- **Verified At:** ${new Date(brick.verifiedAt).toLocaleString()}
- **Artifact Preview:** 
\`\`\`
${brick.artifact?.substring(0, 500)}${brick.artifact?.length > 500 ? '\n... (truncated)' : ''}
\`\`\`

`;
            });
        } else {
            report += `_No verified bricks yet._\n\n`;
        }

        report += `---

## 5. 📊 USAGE METRICS

| Model | Prompt Tokens | Completion Tokens | Total Tokens | Requests |
|-------|---------------|-------------------|--------------|----------|
`;
        if (Object.keys(store.usageMetrics).length > 0) {
            Object.entries(store.usageMetrics).forEach(([model, data]: [string, any]) => {
                report += `| ${model} | ${data.promptTokens?.toLocaleString() || 0} | ${data.completionTokens?.toLocaleString() || 0} | ${data.totalTokens?.toLocaleString() || 0} | ${data.requestCount || 0} |\n`;
            });
        } else {
            report += `| _No usage data_ | - | - | - | - |\n`;
        }

        report += `
---

## 6. ⚙️ MODEL CONFIGURATION

| Role | Model ID |
|------|----------|
| **Global Default** | ${settings.model || 'Not set'} |
| **Genesis** | ${settings.model_genesis || '(uses global)'} |
| **Prism** | ${settings.model_prism || '(uses global)'} |
| **Specialist** | ${settings.model_specialist || '(uses global)'} |
| **Reflexion (Critique)** | ${settings.model_reflexion || '(uses global)'} |
| **Antagonist (Tribunal)** | ${settings.model_antagonist || '(uses global)'} |
| **Compiler** | ${settings.model_compiler || '(uses global)'} |
| **Security** | ${settings.model_security || '(uses global)'} |
| **Oracle** | ${settings.model_oracle || '(uses global)'} |
| **Local Base URL** | ${settings.localBaseUrl || 'N/A'} |
| **Local Model ID** | ${settings.localModelId || 'N/A'} |

### Feature Flags
| Flag | Status |
|------|--------|
| Red-Flagging | ${settings.enableRedFlagging ? '✅ ON' : '❌ OFF'} |
| Antagonist Protocol | ${settings.enableAntagonistProtocol ? '✅ ON' : '❌ OFF'} |
| Agent Memory | ${settings.enableAgentMemory ? '✅ ON' : '❌ OFF'} |
| Hydra Auto-Failover | ${settings.hydraSettings?.autoFailover ? '✅ ON' : '❌ OFF'} |
| Debug Mode | ${settings.debugMode ? '✅ ON' : '❌ OFF'} |

---

## 7. 📊 EFFICIENCY REPORT (Token Usage)

`;

        if (store.usageMetrics && Object.keys(store.usageMetrics).length > 0) {
            report += "| Model | Requests | Prompt | Completion | Total |\n";
            report += "| :--- | :---: | :---: | :---: | :---: |\n";

            let grandTotal = 0;
            Object.entries(store.usageMetrics).forEach(([model, stats]) => {
                report += `| **${model}** | ${stats.requestCount} | ${stats.promptTokens.toLocaleString()} | ${stats.completionTokens.toLocaleString()} | ${stats.totalTokens.toLocaleString()} |\n`;
                grandTotal += stats.totalTokens;
            });

            report += `| **TOTAL** | | | | **${grandTotal.toLocaleString()}** |\n\n`;
        } else {
            report += `_No token usage recorded yet._\n\n`;
        }

        report += `
---

## 8. 🔭 EVENT HORIZON LOGS (${logs.length} entries)

`;
        if (logs.length > 0) {
            // Sort by timestamp (newest last)
            const sortedLogs = [...logs].sort((a, b) => {
                // Handle string timestamps like "10:30:45 PM"
                return String(a.timestamp).localeCompare(String(b.timestamp));
            });

            sortedLogs.forEach(log => {
                const levelIcon = log.level === 'error' ? '🔴' :
                    log.level === 'warn' ? '🟡' :
                        log.level === 'success' ? '🟢' :
                            log.level === 'system' ? '🔵' : '⚪';
                const nodeTag = log.nodeId ? ` \`[${log.nodeId}]\`` : '';
                report += `- ${levelIcon} **${log.timestamp}**${nodeTag}: ${log.message}\n`;
            });
        } else {
            report += `_No logs captured._\n`;
        }

        report += `
---

## 9. 🗣️ ORACLE CONVERSATION

`;
        if (store.oracleChatHistory?.length > 0) {
            report += `**Clarity Score:** ${store.clarityScore || 0}/100\n\n`;
            store.oracleChatHistory.forEach(msg => {
                const role = msg.role === 'oracle' ? '🔮 Oracle' : '👤 User';
                report += `**${role}** (${new Date(msg.timestamp).toLocaleTimeString()}):\n> ${msg.content}\n\n`;
            });
        } else {
            report += `_No Oracle conversation._\n`;
        }

        report += `
---

## 10. 🕸️ NODE EXECUTION TRACE (${nodes.length} nodes)

`;
        // Group nodes by status for summary
        const statusCounts: Record<string, number> = {};
        nodes.forEach(n => {
            statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
        });

        report += `### Summary
| Status | Count |
|--------|-------|
`;
        Object.entries(statusCounts).forEach(([status, count]) => {
            const icon = status === 'complete' ? '✅' : status === 'error' ? '❌' : status === 'pending' ? '⏳' : status === 'running' ? '🔄' : '•';
            report += `| ${icon} ${status} | ${count} |\n`;
        });

        report += `\n### Detailed Node Data\n`;

        for (const node of nodes) {
            report += `
### [${node.id}] - ${node.label}
| Field | Value |
|-------|-------|
| **Type** | ${node.type} |
| **Status** | ${node.status} |
| **Score** | ${node.score || 'N/A'} |
| **Department** | ${node.department || 'N/A'} |
| **Mode** | ${node.mode || 'N/A'} |
| **Dependencies** | ${node.dependencies?.join(', ') || 'None'} |
| **Red Flags** | ${node.redFlags?.map(f => f.type).join(', ') || 'None'} |
`;
            if (node.debugData) {
                report += `| **Model Used** | ${node.debugData.modelUsed || 'N/A'} |
| **Execution Time** | ${node.debugData.executionTimeMs || 'N/A'} ms |
`;
            }

            if (node.output) {
                report += `
**Output Preview:**
\`\`\`
${node.output.substring(0, 800)}${node.output.length > 800 ? '\n... (truncated)' : ''}
\`\`\`
`;
            }

            if (node.debugData?.lastPrompt) {
                report += `
**Prompt Used:**
\`\`\`
${node.debugData.lastPrompt.substring(0, 1000)}${node.debugData.lastPrompt.length > 1000 ? '\n... (truncated)' : ''}
\`\`\`
`;
            }

            if (node.debugData?.rawResponse) {
                report += `
**Raw Response:**
\`\`\`
${node.debugData.rawResponse.substring(0, 1000)}${node.debugData.rawResponse.length > 1000 ? '\n... (truncated)' : ''}
\`\`\`
`;
            }

            report += `---
`;
        }

        report += `
## 11. 📁 GRAPH STRUCTURE

**Nodes:** ${nodes.length}
**Edges:** ${edges.length}

### Edge List
`;
        if (edges.length > 0) {
            edges.forEach(e => {
                report += `- ${e.source} → ${e.target}\n`;
            });
        } else {
            report += `_No edges._\n`;
        }

        report += `
---

## 12. 📄 MANIFESTATION (Final Output)

`;
        if (store.manifestation) {
            report += `\`\`\`
${store.manifestation}
\`\`\`
`;
        } else {
            report += `_No manifestation generated yet._\n`;
        }

        report += `
---
*End of Debug Report*
*Generated by Ouroboros Engine V2.99*
`;

        return report;
    }

    public async printDebugReport() {
        const report = await this.generateDebugReport();
        console.log("=== OUROBOROS DEBUG REPORT ===");
        console.log(report);
        console.log("===============================");
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

    private calculateLayout(nodes: Record<string, Node>): Record<string, Node> {
        const layers: Record<string, number> = {};
        const assignLayers = () => {
            let changed = true;
            while (changed) {
                changed = false;
                Object.values(nodes).forEach(node => {
                    if (node.dependencies.length === 0) {
                        if (layers[node.id] !== 0) { layers[node.id] = 0; changed = true; }
                    } else {
                        const maxDep = Math.max(...node.dependencies.map(d => layers[d] ?? -1));
                        if (maxDep !== -1 && layers[node.id] !== maxDep + 1) { layers[node.id] = maxDep + 1; changed = true; }
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
            const allEdges = await db.edges.toArray();
            const edgesToDelete = allEdges.filter(e => ids.includes(e.source) || ids.includes(e.target)).map(e => e.id!);
            if (edgesToDelete.length > 0) await db.edges.bulkDelete(edgesToDelete);
        }
    }

    private extractJson(text: string): any {
        return safeExtractJson(text, null);
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
        const TIMEOUT_MS = 300000; // 5 minutes safety timeout
        return Promise.race([
            this.generateWithHydra(model, prompt, config),
            new Promise<LLMResponse>((_, reject) =>
                setTimeout(() => reject(new Error(`LLM Execution Timeout (${TIMEOUT_MS / 1000}s)`)), TIMEOUT_MS)
            )
        ]);
    }

    private getFailoverList(primaryModelId: string): string[] {
        const settings = useOuroborosStore.getState().settings;
        const customTiers = settings.customTiers || MODEL_TIERS;
        const S = customTiers.S_TIER || [];
        const A = customTiers.A_TIER || [];
        const B = customTiers.B_TIER || [];
        let failoverSequence: string[] = [];
        if (S.includes(primaryModelId)) failoverSequence = [...S, ...A, ...B];
        else if (A.includes(primaryModelId)) failoverSequence = [...A, ...B];
        else if (B.includes(primaryModelId)) failoverSequence = [...B];
        else return [primaryModelId];
        const unique = Array.from(new Set(failoverSequence));
        const others = unique.filter(m => m !== primaryModelId);
        return [primaryModelId, ...others];
    }

    private async generateWithHydra(primaryModelId: string, prompt: string, config?: any): Promise<LLMResponse> {
        const settings = useOuroborosStore.getState().settings;
        if (!settings.hydraSettings?.autoFailover) {
            const resp = await this.ai.models.generateContent({ model: primaryModelId, contents: prompt, config: config });
            // Usage handled by UnifiedLLMClient callback
            return resp;
        }
        const failoverList = this.getFailoverList(primaryModelId);
        const resp = await this.ai.executeWithHydra(failoverList, prompt, config, this.penaltyBox, (model, err) => {
            this.addLog('warn', `Hydra Failover: ${model} -> ${err.message}`);
        });
        // Usage handled by UnifiedLLMClient callback
        return resp;
    }
}
