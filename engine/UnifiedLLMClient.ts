import { GoogleGenAI } from "@google/genai";
import { MODELS, MODEL_TIERS } from "../constants";
import { PenaltyBoxRegistry } from "./PenaltyBoxRegistry";
import { extractWithPreference, safeYamlParse, safeJsonParse } from "../utils/safe-json";

import { Leviathan } from "./leviathan";

export class AllHeadsSeveredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AllHeadsSeveredError';
    }
}

export interface LLMResponse {
    text: string;
    modelUsed?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export class UnifiedLLMClient {
    private googleClient: GoogleGenAI | null = null;
    private openaiApiKey: string | null = null;

    private openRouterApiKey: string | null = null;
    private groqApiKey: string | null = null;
    private localBaseUrl: string = 'http://localhost:11434/v1';
    private localModelId: string = 'gemma:7b';
    private localSmallModelId: string = 'gemma:2b';

    constructor(googleKey?: string, openaiKey?: string, openRouterKey?: string, localBaseUrl?: string, localModelId?: string, groqKey?: string, localSmallModelId?: string) {
        if (googleKey) {
            this.googleClient = new GoogleGenAI({ apiKey: googleKey });
        }
        this.openaiApiKey = openaiKey || null;
        this.openRouterApiKey = openRouterKey || null;
        if (localBaseUrl) this.localBaseUrl = localBaseUrl;
        if (localModelId) this.localModelId = localModelId;
        if (localSmallModelId) this.localSmallModelId = localSmallModelId;
        if (groqKey) this.groqApiKey = groqKey;
    }

    public updateKeys(googleKey?: string, openaiKey?: string, openRouterKey?: string, localBaseUrl?: string, localModelId?: string, groqKey?: string, localSmallModelId?: string) {
        if (googleKey) {
            this.googleClient = new GoogleGenAI({ apiKey: googleKey });
        }
        if (openaiKey !== undefined) {
            this.openaiApiKey = openaiKey;
        }
        if (openRouterKey !== undefined) {
            this.openRouterApiKey = openRouterKey;
        }
        if (localBaseUrl !== undefined) {
            this.localBaseUrl = localBaseUrl;
        }
        if (localModelId !== undefined) {
            this.localModelId = localModelId;
        }
        if (localSmallModelId !== undefined) {
            this.localSmallModelId = localSmallModelId;
        }
        if (groqKey !== undefined) {
            this.groqApiKey = groqKey;
        }
    }

    /**
     * Executes an LLM call with Hydra Failover Protocol.
     * Iterates through the provided model list (tier) and handles retries/failover.
     */

    public async executeWithHydra(
        models: string[],
        prompt: string,
        config: any,
        box: PenaltyBoxRegistry,
        onRetry?: (model: string, error: any) => void
    ): Promise<LLMResponse> {
        let lastError: any = null;
        let attemptedCount = 0;

        for (const modelId of models) {
            // 1. Check Penalty Box
            if (box.isRateLimited(modelId)) {
                console.warn(`[Hydra] Skipping ${modelId} (Penalty Box)`);
                continue;
            }

            // 2. Attempt Call
            try {
                attemptedCount++;
                const response = await this.models.generateContent({
                    model: modelId,
                    contents: prompt,
                    config: config
                });
                // Tag the response with the model that actually succeeded
                console.log(`[Hydra] Success with ${modelId}`);
                return { ...response, modelUsed: modelId };
            } catch (error: any) {
                lastError = error;
                const errMsg = error.message || '';
                const isNetworkError = errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('Connection refused') || errMsg.includes('Failed to fetch');
                const isRateLimit = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('quota') || errMsg.includes('Too Many Requests');
                const isServerError = errMsg.includes('500') || errMsg.includes('502') || errMsg.includes('503') || errMsg.includes('Overloaded');
                const isNotFound = errMsg.includes('404') || errMsg.includes('Not Found');

                if (isRateLimit || isServerError || isNotFound || isNetworkError) {
                    // Log and Penalize
                    console.warn(`[Hydra] Model ${modelId} failed: ${errMsg}. Failing over...`);
                    box.add(modelId); // Default penalty
                    if (onRetry) onRetry(modelId, error);
                } else {
                    // If it's a prompt error (400), do NOT failover blindly, as next model will likely fail too.
                    // BUT, sometimes 400 is 'Model not found' or 'Context length exceeded'.
                    // Context length exceeded -> Fallback might work if next model has larger context?
                    // For now, let's bubble up non-transient errors unless we are sure.
                    // Ouroboros V2 Strategy says: "On Failure (429/500/404/Connection)... Auto-Fallback".
                    throw error;
                }
            }
        }

        if (attemptedCount === 0) {
            throw new AllHeadsSeveredError("All available models in this tier are currently in the Penalty Box. Please wait or manually reroute.");
        }

        throw new AllHeadsSeveredError(`Hydra Failover Exhausted. Last error: ${lastError?.message}`);
    }

    /**
     * Soft-Strict Protocol: Execute with Hydra and extract structured data
     * 
     * This method wraps executeWithHydra and extracts structured data from the response
     * using YAML-first, JSON-fallback strategy (per V2.99 Refinement Strategy Pillar 1).
     * 
     * @param models - Array of model IDs to try (tier)
     * @param prompt - The prompt to send
     * @param config - LLM configuration
     * @param box - Penalty box registry
     * @param options - Extraction options
     * @returns Object containing both raw response and extracted structured data
     */
    public async executeWithHydraStructured<T = any>(
        models: string[],
        prompt: string,
        config: any,
        box: PenaltyBoxRegistry,
        options: {
            preferredFormat?: 'yaml' | 'json';
            defaultValue?: T | null;
            onRetry?: (model: string, error: any) => void;
        } = {}
    ): Promise<{
        response: LLMResponse;
        structured: { data: T | null; format: 'yaml' | 'json' | null };
    }> {
        const response = await this.executeWithHydra(
            models,
            prompt,
            config,
            box,
            options.onRetry
        );

        // Extract structured data using Soft-Strict Protocol
        const structured = extractWithPreference<T>(
            response.text,
            options.preferredFormat || 'yaml',
            options.defaultValue ?? null
        );

        if (structured.format) {
            console.log(`[Hydra:SoftStrict] Extracted ${structured.format.toUpperCase()} from response`);
        } else {
            console.warn('[Hydra:SoftStrict] Failed to extract structured data from response');
        }

        return { response, structured };
    }

    private onUsageCallback: ((model: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void) | null = null;

    public setUsageCallback(callback: (model: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void) {
        this.onUsageCallback = callback;
    }

    public get models() {
        return {
            generateContent: async (params: { model: string, contents: string, config?: any }): Promise<LLMResponse> => {
                const modelDef = MODELS.find(m => m.id === params.model);
                let provider = modelDef?.provider;

                if (!provider) {
                    // Fallback: Infer provider from ID
                    if (params.model.startsWith('openrouter/') || params.model.includes('/')) {
                        provider = 'openrouter';
                    } else if (params.model.startsWith('gpt-') || params.model.startsWith('o1-')) {
                        provider = 'openai';
                    } else if (params.model === 'local-custom') {
                        provider = 'local';
                    } else if (params.model.includes('llama') || params.model.includes('mixtral') || params.model.includes('gemma') && !params.model.includes(':free')) {
                        // Heuristic for Groq if not caught by constants (imperfect but better than Google fallback)
                        // But we should rely on explicit constants first. 
                        // Check for groq prefix
                        provider = 'groq';
                    } else {
                        provider = 'google'; // Default fallback
                    }
                    console.warn(`[UnifiedLLMClient] Model '${params.model}' not found in registry. Inferred provider: ${provider}`);
                }

                let res: LLMResponse;
                if (provider === 'openai') {
                    res = await this.callOpenAI(params);
                } else if (provider === 'openrouter') {
                    res = await this.callOpenRouter(params);
                } else if (provider === 'local') {
                    res = await this.callLocal(params);
                } else if (provider === 'groq') {
                    res = await this.callGroq(params);
                } else {
                    res = await this.callGoogle(params);
                }

                // Global Token Tracking
                if (this.onUsageCallback && res.usage) {
                    this.onUsageCallback(params.model, res.usage);
                }

                return { ...res, modelUsed: params.model };
            }
        };
    }

    private async callLocal(params: { model: string, contents: string, config?: any }): Promise<LLMResponse> {
        try {
            const isJson = params.config?.responseMimeType === "application/json";

            // Dual Engine Routing
            let actualModel = this.localModelId;
            let finalContents = params.contents;
            let useJsonMode = isJson;

            if (params.model === 'local-custom-small') {
                actualModel = this.localSmallModelId;

                // Leviathan Middleware: The Doppler Sandwich
                // Small models need the constraints repeated at the end.
                finalContents = Leviathan.sandwich(params.contents);

                // For 4B/8B models, 'json_object' mode is mandatory to prevent markdown bleed.
                useJsonMode = true;
            }

            const response = await fetch(`${this.localBaseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer local-dummy-key"
                },
                body: JSON.stringify({
                    model: actualModel,
                    messages: [{ role: "user", content: finalContents }],
                    temperature: params.config?.temperature ?? 0.7,
                    response_format: useJsonMode ? { type: "json_object" } : undefined
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Local API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";

            const usage = data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            } : undefined;

            return { text: content, usage };

        } catch (error: any) {
            console.error("Local API Error:", error);
            throw new Error(`Local API Error: ${error.message || error} (Check if Ollama is running and OLLAMA_ORIGINS is set)`);
        }
    }

    private async callOpenRouter(params: { model: string, contents: string, config?: any }): Promise<LLMResponse> {
        if (!this.openRouterApiKey) {
            throw new Error("OpenRouter API Key not set.");
        }

        try {
            const isJson = params.config?.responseMimeType === "application/json";
            const actualModel = params.model;

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.openRouterApiKey}`,
                    "HTTP-Referer": "http://localhost:3000", // Required by OpenRouter
                    "X-Title": "Ouroboros Engine" // Optional
                },
                body: JSON.stringify({
                    model: actualModel,
                    messages: [{ role: "user", content: params.contents }],
                    temperature: params.config?.temperature ?? 0.7,
                    response_format: isJson ? { type: "json_object" } : undefined,
                    reasoning: params.model === 'openai/gpt-oss-20b:free' ? { enabled: true } : undefined
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";

            const usage = data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            } : undefined;

            return { text: content, usage };

        } catch (error: any) {
            console.error("OpenRouter API Error:", error);
            throw new Error(`OpenRouter API Error: ${error.message || error}`);
        }
    }

    private async callGoogle(params: { model: string, contents: string, config?: any }): Promise<LLMResponse> {
        if (!this.googleClient) {
            throw new Error("Google API Key not set.");
        }
        try {
            // MODEL ALIASING (Fix for stale user settings or deprecations)
            let finalModel = params.model;
            if (finalModel === 'gemini-1.5-flash' || finalModel === 'gemini-1.5-flash-001') finalModel = 'gemini-2.0-flash-exp';
            if (finalModel === 'gemini-1.5-pro' || finalModel === 'gemini-1.5-pro-001') finalModel = 'gemini-2.0-flash-exp'; // Pro fallback to working Flash

            const resp = await this.googleClient.models.generateContent({
                model: finalModel,
                contents: params.contents,
                config: params.config
            });

            // Google GenAI SDK might return usageMetadata differently depending on version
            // Assuming resp.usageMetadata exists
            const usage = resp.usageMetadata ? {
                promptTokens: resp.usageMetadata.promptTokenCount || 0,
                completionTokens: resp.usageMetadata.candidatesTokenCount || 0,
                totalTokens: resp.usageMetadata.totalTokenCount || 0
            } : undefined;

            return { text: resp.text || "", usage };
        } catch (error: any) {
            console.error("Google API Error:", error);
            throw new Error(`Google API Error: ${error.message || error}`);
        }
    }

    private async callOpenAI(params: { model: string, contents: string, config?: any }): Promise<LLMResponse> {
        if (!this.openaiApiKey) {
            throw new Error("OpenAI API Key not set.");
        }

        try {
            const isJson = params.config?.responseMimeType === "application/json";

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: params.model,
                    messages: [{ role: "user", content: params.contents }],
                    temperature: params.config?.temperature ?? 0.7,
                    response_format: isJson ? { type: "json_object" } : undefined
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";

            const usage = data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            } : undefined;

            return { text: content, usage };

        } catch (error: any) {
            console.error("OpenAI API Error:", error);
            throw new Error(`OpenAI API Error: ${error.message || error}`);
        }
    }

    private async callGroq(params: { model: string, contents: string, config?: any }): Promise<LLMResponse> {
        if (!this.groqApiKey) {
            throw new Error("Groq API Key not set.");
        }

        try {
            const isJson = params.config?.responseMimeType === "application/json";

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.groqApiKey}`
                },
                body: JSON.stringify({
                    model: params.model,
                    messages: [{ role: "user", content: params.contents }],
                    temperature: params.config?.temperature ?? 0.7,
                    response_format: isJson ? { type: "json_object" } : undefined
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Groq API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || "";

            const usage = data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            } : undefined;

            return { text: content, usage };

        } catch (error: any) {
            console.error("Groq API Error:", error);
            throw new Error(`Groq API Error: ${error.message || error}`);
        }
    }
}

