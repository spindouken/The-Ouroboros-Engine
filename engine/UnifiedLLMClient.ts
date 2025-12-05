import { GoogleGenAI } from "@google/genai";
import { MODELS } from "../constants";

export interface LLMResponse {
    text: string;
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

    constructor(googleKey?: string, openaiKey?: string, openRouterKey?: string) {
        if (googleKey) {
            this.googleClient = new GoogleGenAI({ apiKey: googleKey });
        }
        this.openaiApiKey = openaiKey || null;
        this.openRouterApiKey = openRouterKey || null;
    }

    public updateKeys(googleKey?: string, openaiKey?: string, openRouterKey?: string) {
        if (googleKey) {
            this.googleClient = new GoogleGenAI({ apiKey: googleKey });
        }
        if (openaiKey !== undefined) {
            this.openaiApiKey = openaiKey;
        }
        if (openRouterKey !== undefined) {
            this.openRouterApiKey = openRouterKey;
        }
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
                    } else {
                        provider = 'google'; // Default fallback
                    }
                    console.warn(`[UnifiedLLMClient] Model '${params.model}' not found in registry. Inferred provider: ${provider}`);
                }

                if (provider === 'openai') {
                    return this.callOpenAI(params);
                } else if (provider === 'openrouter') {
                    return this.callOpenRouter(params);
                } else {
                    return this.callGoogle(params);
                }
            }
        };
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
            const resp = await this.googleClient.models.generateContent({
                model: params.model,
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
}
