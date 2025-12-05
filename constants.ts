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
    // Google Models
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'High Intelligence, Low Rate Limit', rpm: 2, rpd: 50, provider: 'google' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Balanced Speed & Intellect', rpm: 10, rpd: 250, provider: 'google' },
    { id: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash Preview', desc: 'Latest Flash Features', rpm: 10, rpd: 250, provider: 'google' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', desc: 'Fast & Efficient', rpm: 15, rpd: 1000, provider: 'google' },
    { id: 'gemini-2.5-flash-lite-preview', label: 'Gemini 2.5 Flash-Lite Preview', desc: 'Latest Lite Features', rpm: 15, rpd: 1000, provider: 'google' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Legacy Flash', rpm: 15, rpd: 200, provider: 'google' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', desc: 'Legacy Lite (High RPM)', rpm: 30, rpd: 200, provider: 'google' },

    // Gemma 3 Models (Free Tier)
    { id: 'gemma-3-27b', label: 'Gemma 3 27B', desc: 'High Intelligence Open Model', rpm: 30, rpd: 14400, provider: 'google' },
    { id: 'gemma-3-12b', label: 'Gemma 3 12B', desc: 'Balanced Open Model', rpm: 30, rpd: 14400, provider: 'google' },
    { id: 'gemma-3-4b', label: 'Gemma 3 4B', desc: 'Efficient Open Model', rpm: 30, rpd: 14400, provider: 'google' },
    { id: 'gemma-3-2b', label: 'Gemma 3 2B', desc: 'Lightweight Open Model', rpm: 30, rpd: 14400, provider: 'google' },
    { id: 'gemma-3-1b', label: 'Gemma 3 1B', desc: 'Ultra-Light Open Model', rpm: 30, rpd: 14400, provider: 'google' },

    // OpenAI Models - Group 1 (250k tokens/day)
    { id: 'gpt-5.1', label: 'GPT-5.1', desc: 'Latest Flagship', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', desc: 'Specialized Coding', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'gpt-5', label: 'GPT-5', desc: 'Flagship Intelligence', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex', desc: 'Coding Expert', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'gpt-5-chat-latest', label: 'GPT-5 Chat', desc: 'Latest Chat Model', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'gpt-4.1', label: 'GPT-4.1', desc: 'High Intelligence', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'gpt-4o', label: 'GPT-4o', desc: 'Omni Model', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'o1', label: 'o1', desc: 'Reasoning Model', rpm: 60, rpd: 250, provider: 'openai' },
    { id: 'o3', label: 'o3', desc: 'Advanced Reasoning', rpm: 60, rpd: 250, provider: 'openai' },

    // OpenAI Models - Group 2 (2.5m tokens/day)
    { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', desc: 'Efficient Coding', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', desc: 'Efficient Generalist', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'gpt-5-nano', label: 'GPT-5 Nano', desc: 'Ultra-Fast', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'Efficient GPT-4', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', desc: 'Ultra-Fast GPT-4', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Efficient Omni', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'o1-mini', label: 'o1 Mini', desc: 'Efficient Reasoning', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'o3-mini', label: 'o3 Mini', desc: 'Efficient Reasoning', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'o4-mini', label: 'o4 Mini', desc: 'Next-Gen Mini', rpm: 100, rpd: 2500, provider: 'openai' },
    { id: 'codex-mini-latest', label: 'Codex Mini Latest', desc: 'Latest Code Mini', rpm: 100, rpd: 2500, provider: 'openai' },

    // OpenRouter Models (Free/Cheap)
    { id: 'x-ai/grok-4.1-fast:free', label: 'Grok Beta (Free)', desc: 'OpenRouter Free Tier', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (OR Free)', desc: 'OpenRouter Free Tier', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (Free)', desc: 'OpenRouter Free Tier with Reasoning', rpm: 20, rpd: 50, provider: 'openrouter' },
];
