import { create } from 'zustand';
import { LogEntry, OracleMessage, OracleContext } from '../types';

interface OuroborosState {
    // App Status
    status: 'idle' | 'thinking' | 'paused';
    setStatus: (status: 'idle' | 'thinking' | 'paused') => void;

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

    // Oracle Actions
    addOracleMessage: (message: OracleMessage) => void;
    setClarityScore: (score: number) => void;
    toggleOracle: (active: boolean) => void;
    setFusedContext: (context: OracleContext) => void;
    resetOracle: () => void;

    // Actions
    resetSession: () => void;
}

export const useOuroborosStore = create<OuroborosState>((set, get) => ({
    // Status
    status: 'idle',
    setStatus: (status) => set({ status }),

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
        model: 'gemini-2.0-flash-exp', // Updated default
        concurrency: 1,
        rpm: 10,
        rpd: 1500, // Updated default
        autoSaveInterval: 300,
        enableRedFlagging: true, // Enable by default for v2
        enableMultiRoundVoting: true,
        enableStreaming: false,
        enableWebWorkers: false,
        enableAgentMemory: true,
        baseFontSize: 16, // Default font size
        maxMicroAgentDepth: 3,
        initialJudgeCount: 3,
        gitIntegration: false,
        redTeamMode: false,
        debugMode: false,
        model_manifestation: 'gemini-2.0-flash-exp',
        localBaseUrl: 'http://localhost:11434/v1',
        localModelId: 'gemma:7b'
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
    addOracleMessage: (message) => set((state) => ({ oracleChatHistory: [...state.oracleChatHistory, message] })),
    setClarityScore: (score) => set({ clarityScore: score }),
    toggleOracle: (active) => set({ isOracleActive: active }),
    setFusedContext: (context) => set({ fusedContext: context }),
    resetOracle: () => set({ oracleChatHistory: [], clarityScore: 0, isOracleActive: false, fusedContext: null }),

    // Reset
    resetSession: () => set({ status: 'idle', projectPlan: [] }),
}));
