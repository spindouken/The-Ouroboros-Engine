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
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Next-Gen Speed & Intellect', rpm: 5, rpd: 20, provider: 'google' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'High Intelligence, Low Rate Limit', rpm: 2, rpd: 50, provider: 'google' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Balanced Speed & Intellect', rpm: 10, rpd: 250, provider: 'google' },
    { id: 'gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash Preview', desc: 'Latest Flash Features', rpm: 10, rpd: 250, provider: 'google' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', desc: 'Fast & Efficient', rpm: 15, rpd: 1000, provider: 'google' },
    { id: 'gemini-2.5-flash-lite-preview', label: 'Gemini 2.5 Flash-Lite Preview', desc: 'Latest Lite Features', rpm: 15, rpd: 1000, provider: 'google' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Legacy Flash', rpm: 15, rpd: 200, provider: 'google' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite', desc: 'Legacy Lite (High RPM)', rpm: 30, rpd: 200, provider: 'google' },
    { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp', desc: 'Experimental 2.0', rpm: 10, rpd: 1500, provider: 'google' },
    // 1.5 Series (Stable)
    { id: 'gemini-1.5-flash-001', label: 'Gemini 1.5 Flash', desc: 'Stable 1.5 Flash', rpm: 60, rpd: 1000, provider: 'google' },
    { id: 'gemini-1.5-pro-001', label: 'Gemini 1.5 Pro', desc: 'Stable 1.5 Pro', rpm: 2, rpd: 50, provider: 'google' },

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

    // Added OpenRouter Free Models
    { id: 'google/gemma-3n-e2b-it:free', label: 'Gemma 3n e2b', desc: 'Google (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'google/gemma-3n-e4b-it:free', label: 'Gemma 3n e4b', desc: 'Google (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'arcee-ai/trinity-mini:free', label: 'Trinity Mini', desc: 'Arcee AI (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'qwen/qwen3-4b:free', label: 'Qwen 3 4B', desc: 'Qwen (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B', desc: 'Mistral AI (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', desc: 'Meta (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B IT', desc: 'Google (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', label: 'Llama 3.2 3B', desc: 'Meta (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'moonshotai/kimi-k2:free', label: 'Kimi k2', desc: 'Moonshot AI (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'amazon/nova-2-lite-v1:free', label: 'Nova 2 Lite', desc: 'Amazon (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', label: 'Dolphin Mistral 24B', desc: 'Cognitive Comp. (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'allenai/olmo-3-32b-think:free', label: 'OLMo 3 32B', desc: 'Allen AI (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nemotron Nano 9B', desc: 'Nvidia (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 24B', desc: 'Mistral AI (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'kwaipilot/kat-coder-pro:free', label: 'Kat Coder Pro', desc: 'KwaiPilot (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B', desc: 'OpenAI (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'qwen/qwen3-235b-a22b:free', label: 'Qwen 3 235B', desc: 'Qwen (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B IT', desc: 'Google (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },
    { id: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B IT', desc: 'Google (Free)', rpm: 20, rpd: 50, provider: 'openrouter' },

    // Groq Models
    // A-Tier (Formerly S)
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B', desc: 'A-Tier Groq', rpm: 30, rpd: 1000, provider: 'groq' },
    { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi k2', desc: 'A-Tier Groq', rpm: 60, rpd: 1000, provider: 'groq' },
    { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi k2 (0905)', desc: 'A-Tier Groq', rpm: 60, rpd: 1000, provider: 'groq' },
    { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', desc: 'A-Tier Groq', rpm: 60, rpd: 1000, provider: 'groq' },

    // B-Tier (Formerly A)
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', desc: 'B-Tier Groq', rpm: 30, rpd: 1000, provider: 'groq' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', desc: 'B-Tier Groq', rpm: 30, rpd: 1000, provider: 'groq' },
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', desc: 'B-Tier Groq', rpm: 30, rpd: 1000, provider: 'groq' },

    // B-Tier
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', desc: 'B-Tier Groq', rpm: 30, rpd: 14400, provider: 'groq' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', desc: 'B-Tier Groq', rpm: 30, rpd: 1000, provider: 'groq' },
    { id: 'allam-2-7b', label: 'Allam 2 7B', desc: 'B-Tier Groq', rpm: 30, rpd: 7000, provider: 'groq' },
    { id: 'groq/compound-mini', label: 'Groq Compound Mini', desc: 'B-Tier Groq', rpm: 30, rpd: 250, provider: 'groq' },
    { id: 'groq/compound', label: 'Groq Compound', desc: 'B-Tier Groq', rpm: 30, rpd: 250, provider: 'groq' },

    // Local / Custom
    { id: 'local-custom', label: 'Local / Custom (Ollama)', desc: 'Runs on your machine via Ollama', rpm: 9999, rpd: 9999, provider: 'local' },
    { id: 'local-custom-small', label: 'Speed Engine (Small Model)', desc: 'For Repetitive Tasks (Local)', rpm: 9999, rpd: 9999, provider: 'local' },
];

export const MODEL_TIERS = {
    'S_TIER': [
        'gemini-2.5-pro', 'gpt-4o', 'gpt-5.1', 'o1', 'claude-3-5-sonnet'
    ],
    'A_TIER': [
        'gemini-3-flash', 'gemma-3-27b', 'gemini-2.5-flash', 'gemini-1.5-flash-001', 'gemini-2.0-flash-exp', 'gpt-4o-mini', 'gpt-5-mini', 'claude-3-haiku',
        'meta-llama/llama-4-maverick-17b-128e-instruct',
        'moonshotai/kimi-k2-instruct',
        'moonshotai/kimi-k2-instruct-0905',
        'qwen/qwen3-32b'
    ],
    'B_TIER': [
        'gemini-2.5-flash-lite',
        'gemma-3-12b',
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'openai/gpt-oss-120b',
        'llama-3.1-8b-instant',
        'openai/gpt-oss-20b',
        'allam-2-7b',
        'groq/compound-mini',
        'groq/compound',
        'local-custom',
        'local-custom-small',
        'x-ai/grok-4.1-fast:free',
        'google/gemini-2.0-flash-exp:free',
        'openai/gpt-oss-20b:free',
        'google/gemma-3n-e2b-it:free',
        'google/gemma-3n-e4b-it:free',
        'arcee-ai/trinity-mini:free',
        'qwen/qwen3-4b:free',
        'mistralai/mistral-7b-instruct:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemma-3-27b-it:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'moonshotai/kimi-k2:free',
        'amazon/nova-2-lite-v1:free',
        'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        'allenai/olmo-3-32b-think:free',
        'nvidia/nemotron-nano-9b-v2:free',
        'mistralai/mistral-small-3.1-24b-instruct:free',
        'kwaipilot/kat-coder-pro:free',
        'openai/gpt-oss-120b:free',
        'qwen/qwen3-235b-a22b:free',
        'google/gemma-3-12b-it:free',
        'google/gemma-3-4b-it:free'
    ]
};

export const DEFAULT_HYDRA_SETTINGS = {
    autoFailover: true,
    maxRetries: 2,
    fallbackStrategy: 'cost' as const
};

