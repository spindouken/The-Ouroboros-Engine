import { Brain, Megaphone, Sparkles, Code, ShieldCheck } from 'lucide-react';

export const DEPARTMENTS = {
    strategy: { id: 'strategy', label: 'Strategy', color: 'text-purple-400', icon: Brain },
    marketing: { id: 'marketing', label: 'Growth', color: 'text-orange-400', icon: Megaphone },
    ux: { id: 'ux', label: 'Design', color: 'text-pink-400', icon: Sparkles },
    engineering: { id: 'engineering', label: 'Engineering', color: 'text-blue-400', icon: Code },
    security: { id: 'security', label: 'Security', color: 'text-rose-400', icon: ShieldCheck }
};

export const EXPERT_PERSONAS = {
    strategy: [
        { id: 'visionary', label: 'The Visionary', instruction: 'Focus on maximum ambition, market dominance, and "soul". Ignore constraints.' },
        { id: 'pragmatist', label: 'The Pragmatist', instruction: 'Focus on MVP, feasibility, costs, and immediate value.' }
    ],
    marketing: [
        { id: 'hypeman', label: 'The Hype Man', instruction: 'Focus on virality, hooks, and emotional resonance.' },
        { id: 'analyst', label: 'The Analyst', instruction: 'Focus on retention, funnels, and user acquisition logic.' }
    ],
    ux: [
        { id: 'empath', label: 'The Empath', instruction: 'Focus purely on user feeling, accessibility, and delight.' },
        { id: 'mechanic', label: 'The Mechanic', instruction: 'Focus on friction, click-flow, and interaction logic.' }
    ],
    engineering: [
        { id: 'architect', label: 'The Architect', instruction: 'Focus on system stability, database schema, and scalability.' },
        { id: 'hacker', label: 'The Optimizer', instruction: 'Focus on speed, latency, and efficient code paths.' }
    ],
    security: [
        { id: 'paranoid', label: 'The Paranoid', instruction: 'Assume everything will fail. Find the leaks.' },
        { id: 'compliance', label: 'The Officer', instruction: 'Focus on data governance, RBAC, and standards.' }
    ]
};

export const MODELS = [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'High Intelligence, Low Rate Limit', rpm: 2, rpd: 50 },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Balanced Speed & Intellect', rpm: 10, rpd: 250 },
    { id: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash Preview', desc: 'Latest Flash Features', rpm: 10, rpd: 250 },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', desc: 'Fast & Efficient', rpm: 15, rpd: 1000 },
    { id: 'gemini-2.5-flash-lite-preview', label: 'Gemini 2.5 Flash-Lite Preview', desc: 'Latest Lite Features', rpm: 15, rpd: 1000 },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Legacy Flash', rpm: 15, rpd: 200 },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', desc: 'Legacy Lite (High RPM)', rpm: 30, rpd: 200 },
];
