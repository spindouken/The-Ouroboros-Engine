import { GoogleGenAI } from "@google/genai";
import { MODELS } from "../constants";

export interface LLMResponse {
    text: string;
}

export class UnifiedLLMClient {
    private googleClient: GoogleGenAI | null = null;
    private openaiApiKey: string | null = null;

    constructor(googleKey?: string, openaiKey?: string) {
        if (googleKey) {
            this.googleClient = new GoogleGenAI({ apiKey: googleKey });
        }
        this.openaiApiKey = openaiKey || null;
    }

    public updateKeys(googleKey?: string, openaiKey?: string) {
        if (googleKey) {
            this.googleClient = new GoogleGenAI({ apiKey: googleKey });
        }
        if (openaiKey !== undefined) {
            this.openaiApiKey = openaiKey;
        }
    }

    public get models() {
        return {
            generateContent: async (params: { model: string, contents: string, config?: any }): Promise<LLMResponse> => {
                const modelDef = MODELS.find(m => m.id === params.model);
                const provider = modelDef?.provider || 'google';

                if (provider === 'openai') {
                    return this.callOpenAI(params);
                } else {
                    return this.callGoogle(params);
                }
            }
        };
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
            return { text: resp.text || "" };
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
            return { text: content };

        } catch (error: any) {
            console.error("OpenAI API Error:", error);
            throw new Error(`OpenAI API Error: ${error.message || error}`);
        }
    }
}
