import { create } from 'zustand';
import { LogEntry } from '../types';

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

    // Council State
    council: Record<string, boolean>;
    toggleCouncilMember: (dept: string) => void;

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
        concurrency: 4,
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
        model_manifestation: 'gemini-2.0-flash-exp'
    },
    updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),

    // Council
    council: { strategy: true, marketing: false, ux: true, engineering: true, security: true },
    toggleCouncilMember: (dept) => set((state) => ({
        council: { ...state.council, [dept]: !state.council[dept] }
    })),

    // Reset
    resetSession: () => set({ status: 'idle', projectPlan: [] }),
}));
