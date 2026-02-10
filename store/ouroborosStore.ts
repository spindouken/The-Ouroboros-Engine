import { create } from 'zustand';
import { LogEntry, OracleMessage, OracleContext, Node, PotentialConstitution, VisualProfile } from '../types';
import { DEFAULT_HYDRA_SETTINGS, MODEL_TIERS } from '../constants';

// V2.99 Types for Blackboard Delta / Living Constitution
export interface VerifiedBrickState {
    id: string;
    persona: string;
    instruction: string;
    artifact: string;
    confidence: number;
    verifiedAt: number;
    delta?: any;
}

export interface LivingConstitutionState {
    originalRequirements: string;
    domain: string;
    techStack: string[];
    constraints: string[];
    decisions: string[];
    warnings: string[];
    lastUpdated: number;
    deltaCount: number;
}

/**
 * Snapshot for time-travel / rollback capability (Session Codex)
 * Captures the state at a specific point in time
 */
export interface StateSnapshot {
    id: string;
    timestamp: number;
    label: string; // Human-readable description (e.g., "After Prism decomposition")
    documentContent: string;
    nodeCount: number;
    verifiedBrickCount: number;
    lastNodeId?: string;
}

/**
 * Resume state for crash recovery (Masonry Resume Capability)
 */
export interface ResumeState {
    isResuming: boolean;
    lastVerifiedNodeId: string | null;
    pausedAt: number | null;
    hardPauseTriggered: boolean;
}

interface OuroborosState {
    // App Status (extended for HARD PAUSE)
    status: 'idle' | 'thinking' | 'paused' | 'hard_paused';
    setStatus: (status: 'idle' | 'thinking' | 'paused' | 'hard_paused') => void;

    // Session State
    currentSessionId: string | null;
    currentSessionName: string | null;
    setCurrentSession: (id: string | null, name: string | null) => void;

    // App Data
    documentContent: string;
    setDocumentContent: (content: string) => void;
    projectPlan: any[]; // Using any[] for PlanItem[] to avoid circular dependency
    setProjectPlan: (plan: any[]) => void;
    manifestation: string | null;
    setManifestation: (content: string | null) => void;

    originalRequirements: string;
    setOriginalRequirements: (requirements: string) => void;

    // Settings
    settings: any; // Using any for AppSettings
    updateSettings: (settings: any) => void;

    // Usage Metrics
    usageMetrics: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; requestCount: number }>;
    addUsage: (modelId: string, usage: { promptTokens: number; completionTokens: number }) => void;
    resetUsage: () => void;

    // Council State
    council: Record<string, boolean>;
    toggleCouncilMember: (dept: string) => void;

    // Oracle State
    oracleChatHistory: OracleMessage[];
    clarityScore: number;
    isOracleActive: boolean;
    fusedContext: OracleContext | null;
    potentialConstitutions: PotentialConstitution[] | null;


    // Oracle Actions
    addOracleMessage: (message: OracleMessage) => void;
    setClarityScore: (score: number) => void;
    toggleOracle: (active: boolean) => void;
    setFusedContext: (context: OracleContext) => void;
    setPotentialConstitutions: (vibes: PotentialConstitution[] | null) => void;
    resetOracle: () => void;


    // History Stack (Session Codex Time Travel - Sec 2.3)
    historyStack: StateSnapshot[];
    createSnapshot: (label: string, lastNodeId?: string) => void;
    undoLastBrick: (count?: number) => StateSnapshot | null;
    getSnapshotById: (id: string) => StateSnapshot | null;
    clearHistory: () => void;

    // Resume State (Masonry Resume Capability - Sec 2.3)
    resumeState: ResumeState;
    setResumeState: (state: Partial<ResumeState>) => void;
    markLastVerifiedNode: (nodeId: string) => void;

    // V2.99: Living Constitution State (Blackboard Delta - Sec 4.5)
    verifiedBricks: VerifiedBrickState[];
    addVerifiedBrick: (brick: VerifiedBrickState) => void;
    setVerifiedBricks: (bricks: VerifiedBrickState[]) => void;
    clearVerifiedBricks: () => void;

    livingConstitution: LivingConstitutionState;
    projectInsights: string; // V2.99 Mid-Term Memory
    updateLivingConstitution: (updates: Partial<LivingConstitutionState>) => void;
    addConstitutionConstraint: (constraint: string) => void;
    addConstitutionDecision: (decision: string) => void;
    addConstitutionWarning: (warning: string) => void;
    setProjectInsights: (insights: string) => void;
    resetLivingConstitution: () => void;

    // V2.99: Prism Analysis State
    prismAnalysis: any | null;
    setPrismAnalysis: (analysis: any | null) => void;

    // Actions
    // V3.0: HUD Alerts
    alerts: import('../types').Alert[];
    addAlert: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
    removeAlert: (id: string) => void;

    resetSession: () => void;
}

export const useOuroborosStore = create<OuroborosState>((set, get) => ({
    // Status
    status: 'idle',
    setStatus: (status) => set({ status }),

    // Session State
    currentSessionId: null,
    currentSessionName: null,
    setCurrentSession: (id, name) => set({ currentSessionId: id, currentSessionName: name }),

    // App Data
    documentContent: '',
    setDocumentContent: (content) => set({ documentContent: content }),
    projectPlan: [],
    setProjectPlan: (plan) => set({ projectPlan: plan }),
    manifestation: null,
    setManifestation: (content) => set({ manifestation: content }),

    originalRequirements: '',
    setOriginalRequirements: (requirements) => set({ originalRequirements: requirements }),

    // Settings (Cached for Engine performance, synced with DB)
    settings: {
        visualProfile: 'CYBERPUNK', // Default to V3.0 aesthetic
        reduceMotion: false,
        model: 'gemini-2.0-flash-exp', // Updated default
        concurrency: 1,
        rpm: 10,
        rpd: 1500, // Updated default
        autoSaveInterval: 300,
        enableGoldenSeeds: false, // Default to disabled as requested
        enableRedFlagging: true, // Enable by default for v2 - SAFETY IS NOT OPTIONAL
        enableAntagonistProtocol: true, // V2.99: Renamed from enableMultiRoundVoting - uses AntagonistMirror
        enableStreaming: false,
        enableWebWorkers: false,
        enableAgentMemory: true, // LEARNING IS NOT OPTIONAL
        baseFontSize: 16, // Default font size
        gitIntegration: false,
        redTeamMode: false,
        debugMode: false,
        maxRecursiveDepth: 3, // V3.0 ReCAP Depth Limit
        model_manifestation: '',
        // V2.99: Model settings for new roles (Empty = inherit from global 'model' setting)
        model_antagonist: '', // High-reasoning model for hostile audit (leave empty to use global default)
        model_reflexion: '', // Fast/cheap model for self-critique (leave empty to use global default)
        model_compiler: '', // Model for Lossless Compiler (leave empty to use global default)
        localBaseUrl: 'http://localhost:11434/v1',
        localModelId: 'gemma3:12b',
        localSmallModelId: 'gemma3:4b',
        hydraSettings: DEFAULT_HYDRA_SETTINGS,
        customTiers: MODEL_TIERS,

        // V2.99 Final Features
        disabledRedFlags: [],
        enableAdaptiveRouting: false,
        enablePredictiveCostScaling: false,
    },
    updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),

    // Usage Metrics
    usageMetrics: {},
    addUsage: (modelId, usage) => set((state) => {
        const current = state.usageMetrics[modelId] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, requestCount: 0 };
        return {
            usageMetrics: {
                ...state.usageMetrics,
                [modelId]: {
                    promptTokens: current.promptTokens + usage.promptTokens,
                    completionTokens: current.completionTokens + usage.completionTokens,
                    totalTokens: current.totalTokens + (usage.promptTokens + usage.completionTokens),
                    requestCount: current.requestCount + 1
                }
            }
        };
    }),
    resetUsage: () => set({ usageMetrics: {} }),

    // Council
    council: { strategy: true, marketing: false, ux: true, engineering: true, security: true },
    toggleCouncilMember: (dept) => set((state) => ({
        council: { ...state.council, [dept]: !state.council[dept] }
    })),

    // Oracle
    oracleChatHistory: [],
    clarityScore: 0,
    isOracleActive: false,
    fusedContext: null,
    potentialConstitutions: null,
    addOracleMessage: (message) => set((state) => ({ oracleChatHistory: [...state.oracleChatHistory, message] })),
    setClarityScore: (score) => set({ clarityScore: score }),
    toggleOracle: (active) => set({ isOracleActive: active }),
    setFusedContext: (context) => set({ fusedContext: context }),
    setPotentialConstitutions: (vibes) => set({ potentialConstitutions: vibes }),
    resetOracle: () => set({ oracleChatHistory: [], clarityScore: 0, isOracleActive: false, fusedContext: null, potentialConstitutions: null }),


    // History Stack (Session Codex Time Travel - Sec 2.3)
    historyStack: [],

    createSnapshot: (label, lastNodeId) => set((state) => {
        const snapshot: StateSnapshot = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            label,
            documentContent: state.documentContent,
            nodeCount: 0, // Will be updated by engine when snapshot is created
            verifiedBrickCount: 0, // Will be updated by engine
            lastNodeId
        };
        // Keep max 50 snapshots (prevent memory bloat)
        const newStack = [...state.historyStack, snapshot].slice(-50);
        return { historyStack: newStack };
    }),

    undoLastBrick: (count = 1) => {
        const state = get();
        if (state.historyStack.length === 0) return null;

        // Get the target snapshot (count steps back)
        const targetIndex = Math.max(0, state.historyStack.length - count);
        const targetSnapshot = state.historyStack[targetIndex];

        if (targetSnapshot) {
            // Restore document content to snapshot state
            set({
                documentContent: targetSnapshot.documentContent,
                historyStack: state.historyStack.slice(0, targetIndex + 1)
            });
            return targetSnapshot;
        }
        return null;
    },

    getSnapshotById: (id) => {
        const state = get();
        return state.historyStack.find(s => s.id === id) || null;
    },

    clearHistory: () => set({ historyStack: [] }),

    // Resume State (Masonry Resume Capability - Sec 2.3)
    resumeState: {
        isResuming: false,
        lastVerifiedNodeId: null,
        pausedAt: null,
        hardPauseTriggered: false
    },

    setResumeState: (newState) => set((state) => ({
        resumeState: { ...state.resumeState, ...newState }
    })),

    markLastVerifiedNode: (nodeId) => set((state) => ({
        resumeState: { ...state.resumeState, lastVerifiedNodeId: nodeId }
    })),

    // V2.99: Verified Bricks State (Sec 4.5)
    verifiedBricks: [],

    addVerifiedBrick: (brick) => set((state) => ({
        verifiedBricks: [...state.verifiedBricks, brick]
    })),

    setVerifiedBricks: (bricks) => set({ verifiedBricks: bricks }),

    clearVerifiedBricks: () => set({ verifiedBricks: [] }),

    // V2.99: Living Constitution State (Sec 4.5)
    livingConstitution: {
        originalRequirements: '',
        domain: 'Unknown',
        techStack: [],
        constraints: [],
        decisions: [],
        warnings: [],
        lastUpdated: Date.now(),
        deltaCount: 0
    },
    projectInsights: '',

    updateLivingConstitution: (updates) => set((state) => ({
        livingConstitution: {
            ...state.livingConstitution,
            ...updates,
            lastUpdated: Date.now()
        }
    })),

    addConstitutionConstraint: (constraint) => set((state) => ({
        livingConstitution: {
            ...state.livingConstitution,
            constraints: [...state.livingConstitution.constraints, constraint],
            lastUpdated: Date.now()
        }
    })),

    addConstitutionDecision: (decision) => set((state) => ({
        livingConstitution: {
            ...state.livingConstitution,
            decisions: [...state.livingConstitution.decisions, decision],
            lastUpdated: Date.now()
        }
    })),

    addConstitutionWarning: (warning) => set((state) => ({
        livingConstitution: {
            ...state.livingConstitution,
            warnings: [...state.livingConstitution.warnings, warning],
            lastUpdated: Date.now(),
            deltaCount: state.livingConstitution.deltaCount + 1
        }
    })),
    setProjectInsights: (insights: string) => set({ projectInsights: insights }), // V2.99
    // -- END V2.99 --

    resetLivingConstitution: () => set({
        livingConstitution: {
            originalRequirements: '',
            domain: 'Unknown',
            techStack: [],
            constraints: [],
            decisions: [],
            warnings: [],
            lastUpdated: Date.now(),
            deltaCount: 0
        }
    }),

    // Reset
    resetSession: () => set({
        status: 'idle',
        documentContent: '', // Wipe Prima Materia
        manifestation: null, // Wipe Manifestation
        projectPlan: [],
        // Critical: Wipe Oracle state on new session start to prevent "Ghost Context"
        oracleChatHistory: [],
        clarityScore: 0,
        isOracleActive: false,
        fusedContext: null,
        potentialConstitutions: null,

        // Reset history on new session
        historyStack: [],
        // Reset resume state
        resumeState: {
            isResuming: false,
            lastVerifiedNodeId: null,
            pausedAt: null,
            hardPauseTriggered: false
        },
        // V2.99: Reset Living Constitution state
        verifiedBricks: [],
        livingConstitution: {
            originalRequirements: '',
            domain: 'Unknown',
            techStack: [],
            constraints: [],
            decisions: [],
            warnings: [],
            lastUpdated: Date.now(),
            deltaCount: 0
        },
        prismAnalysis: null,
        projectInsights: '' // V2.99: Clear mid-term memory
    }),

    // V3.0: HUD Alerts
    alerts: [],
    addAlert: (type, title, message) => set((state) => {
        const id = crypto.randomUUID();
        // Auto-dismiss: 5s for info/success, 8s for errors (so they don't stick forever)
        const timeout = type === 'error' ? 8000 : 5000;

        setTimeout(() => {
            get().removeAlert(id);
        }, timeout);

        return { alerts: [...state.alerts, { id, type, title, message, timestamp: Date.now() }] };
    }),
    removeAlert: (id) => set((state) => ({
        alerts: state.alerts.filter(a => a.id !== id)
    })),

    // V2.99: Prism Analysis
    prismAnalysis: null,
    setPrismAnalysis: (analysis) => set({ prismAnalysis: analysis }),
}));

