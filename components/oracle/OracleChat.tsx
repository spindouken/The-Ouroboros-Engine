import React, { useState, useRef, useEffect } from 'react';
import { useOuroborosStore } from '../../store/ouroborosStore';
import { OuroborosEngine } from '../../engine/OuroborosEngine';
import { Send, Sparkles, X, RotateCcw } from 'lucide-react';
import { ClarityGauge } from './ClarityGauge';

export const OracleChat: React.FC = () => {
    const { oracleChatHistory, addOracleMessage, isOracleActive, toggleOracle, setFusedContext, setDocumentContent, documentContent, clarityScore, potentialConstitutions, setPotentialConstitutions } = useOuroborosStore();
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [oracleChatHistory]);

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;

        // If we are in "Vibe Generation Mode" (Empty history, no vibes yet)
        if (oracleChatHistory.length === 0 && !potentialConstitutions) {
            handleGenerateVibes(input);
            return;
        }

        const userMsg = input;
        setInput('');
        setIsProcessing(true);
        await OuroborosEngine.getInstance().runOracle(userMsg, oracleChatHistory);
        setIsProcessing(false);
    };

    const handleGenerateVibes = async (seed: string) => {
        setIsProcessing(true);
        setInput('');

        // V2.99: Shadow Contextualizer - Generate 3 distinct vibes
        await OuroborosEngine.getInstance().generateShadowVibes(seed);

        setIsProcessing(false);
    };

    const handleVibeSelect = async (vibe: any) => {
        setIsProcessing(true);

        // V2.99: Deep Prompt Refinement
        const refinedSpec = await OuroborosEngine.getInstance().refineDeepPrompt(documentContent || input || "My Project", vibe);

        if (refinedSpec) {
            // Format for Document Content
            const formattedContent = `
# ${refinedSpec["Project Name"] || "Untitled Project"}

> **Vibe:** ${vibe.label}
> **Core Objective:** ${refinedSpec["Core Objective"]}

## Key Features
${(refinedSpec["Key Features"] || []).map((f: string) => `- ${f}`).join('\n')}

## Technical Constraints
${(refinedSpec["Technical Constraints"] || []).map((c: string) => `- ${c}`).join('\n')}

## Data Schema
${refinedSpec["Data Schema"] || "TBD"}

## Unknown Unknowns (Addressed)
${(refinedSpec["Unknown Unknowns Identified"] || []).map((u: string) => `- ${u}`).join('\n')}
            `;

            setDocumentContent(formattedContent);
            setPotentialConstitutions(null); // Clear vibes view

            // Add a system welcome message
            addOracleMessage({
                role: 'oracle',
                content: `I've drafted a technical specification based on the **${vibe.label}** approach. Review the document on the right. Shall we refine it further, or proceeded to the Factory Floor?`,
                timestamp: Date.now()
            });

            // Make sure the oracle considers this context
            useOuroborosStore.getState().setFusedContext({
                originalRequest: seedRef.current,
                interviewTranscript: [],
                fusedSpec: refinedSpec
            });
        }

        setIsProcessing(false);
    };

    // Keep track of the original seed for context
    const seedRef = useRef("");
    const onSeedSubmit = () => {
        if (input.trim()) {
            seedRef.current = input;
            handleGenerateVibes(input);
        }
    };

    const handleFusion = async () => {
        setIsProcessing(true);
        const fusedData = await OuroborosEngine.getInstance().performContextFusion(oracleChatHistory);

        if (fusedData) {
            setFusedContext({
                originalRequest: oracleChatHistory[0]?.content || "",
                interviewTranscript: oracleChatHistory,
                fusedSpec: fusedData
            });

            // Format for Document Content
            const formattedContent = `
# ${fusedData["Project Name"] || "Untitled Project"}

## Core Objective
${fusedData["Core Objective"] || "N/A"}

## Key Features
${(fusedData["Key Features"] || []).map((f: string) => `- ${f}`).join('\n')}

## Technical Constraints
${(fusedData["Technical Constraints"] || []).map((c: string) => `- ${c}`).join('\n')}

## User Personas
${(fusedData["User Personas"] || []).map((p: string) => `- ${p}`).join('\n')}

## Unknown Unknowns (Addressed)
${(fusedData["Unknown Unknowns Identified"] || []).map((u: string) => `- ${u}`).join('\n')}
            `;

            setDocumentContent(formattedContent);
            // Don't close oracle automatically, let them discuss
        }
        setIsProcessing(false);
    };

    if (!isOracleActive) return null;

    return (
        <div className="flex flex-col h-full bg-gray-900 border border-purple-500/30 rounded-lg overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-gray-100">The Oracle</span>
                </div>
                <div className="flex items-center gap-3">
                    <ClarityGauge score={clarityScore} />
                    <button onClick={() => {
                        if (confirm("Reset Oracle Session?")) {
                            useOuroborosStore.getState().resetOracle();
                        }
                    }} className="text-gray-400 hover:text-white" title="Reset Session">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleOracle(false)} className="text-gray-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* STATE 1: Empty - Show Seed Input */}
                {oracleChatHistory.length === 0 && !potentialConstitutions && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-6 opacity-90 animate-fade-in">
                        <div className="text-center space-y-2">
                            <Sparkles className="w-12 h-12 text-purple-500 mx-auto animate-pulse" />
                            <h3 className="text-xl font-bold text-white">Project Genesis</h3>
                            <p className="text-sm max-w-xs mx-auto">
                                Describe your idea in a single sentence. The Oracle will handle the rest.
                            </p>
                        </div>
                        {/* Input is handled by the main input bar below, but we can instruct the user */}
                        <div className="text-xs text-gray-500">
                            👇 Type your idea below and hit Enter
                        </div>
                    </div>
                )}

                {/* STATE 2: Vibe Selection */}
                {oracleChatHistory.length === 0 && potentialConstitutions && (
                    <div className="space-y-4 animate-slide-up">
                        <h3 className="text-center text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                            Choose Your Path
                        </h3>
                        <p className="text-center text-xs text-gray-400 mb-4">
                            The Oracle has foreseen 3 potential futures for "{seedRef.current}".
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                            {potentialConstitutions.map((vibe) => (
                                <div
                                    key={vibe.id}
                                    onClick={() => handleVibeSelect(vibe)}
                                    className={`
                                        cursor-pointer p-4 rounded-xl border border-gray-700 bg-gray-800/50 
                                        hover:bg-gray-700 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 
                                        transition-all duration-200 group relative overflow-hidden
                                        ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                                    `}
                                >
                                    <div className="absolute top-0 right-0 p-2 opacity-50 text-xs font-mono uppercase border-l border-b border-gray-700 rounded-bl bg-gray-900">
                                        {vibe.riskLevel}
                                    </div>
                                    <h4 className="font-bold text-white group-hover:text-purple-300 mb-1">{vibe.label}</h4>
                                    <p className="text-xs text-gray-300 italic mb-2">"{vibe.preview}"</p>
                                    <p className="text-xs text-gray-400 leading-relaxed mb-3">{vibe.description}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {vibe.techStackHint.slice(0, 3).map((tech, i) => (
                                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-900 rounded text-gray-500 border border-gray-700">
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setPotentialConstitutions(null)}
                            className="w-full text-xs text-gray-500 hover:text-white mt-4 underline"
                        >
                            Back to Idea Input
                        </button>
                    </div>
                )}

                {/* STATE 3: Chat History */}
                {oracleChatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 p-3 rounded-2xl rounded-bl-sm border border-gray-700 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                            <span className="text-xs text-gray-400">Consulting the ether...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-gray-800 border-t border-gray-700">
                {oracleChatHistory.length > 2 && (
                    <button
                        onClick={handleFusion}
                        disabled={isProcessing}
                        className="w-full mb-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold text-xs hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Sparkles className="w-3 h-3" />
                        {isProcessing ? 'Fusing Context...' : 'Perform Context Fusion'}
                    </button>
                )}

                <div className="flex gap-2 relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (!oracleChatHistory.length && !potentialConstitutions ? onSeedSubmit() : handleSend())}
                        placeholder={potentialConstitutions ? "Select a vibe above..." : oracleChatHistory.length === 0 ? "Describe your idea..." : "Answer the Oracle..."}
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600"
                        disabled={isProcessing || (!!potentialConstitutions && oracleChatHistory.length === 0)}
                    />
                    <button
                        onClick={!oracleChatHistory.length && !potentialConstitutions ? onSeedSubmit : handleSend}
                        disabled={isProcessing || !input.trim()}
                        className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-500 disabled:opacity-50 shadow-lg hover:shadow-purple-500/20 transition-all"
                    >
                        {oracleChatHistory.length === 0 && !potentialConstitutions ? <Sparkles className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </button>

                    {/* Fallback Ignite Button (for getting out of stuck states) */}
                    {oracleChatHistory.length === 0 && (
                        <button
                            onClick={() => OuroborosEngine.getInstance().initiateOracleInterview("Let's brainstorm.")}
                            className="absolute -top-10 right-0 text-xs text-gray-600 hover:text-gray-400 underline"
                        >
                            Skip to Chat
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
