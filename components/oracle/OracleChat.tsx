import React, { useState, useRef, useEffect } from 'react';
import { useOuroborosStore } from '../../store/ouroborosStore';
import { OuroborosEngine } from '../../engine/OuroborosEngine';
import { Send, Sparkles, X, RotateCcw } from 'lucide-react';
import { ClarityGauge } from './ClarityGauge';

export const OracleChat: React.FC = () => {
    const { oracleChatHistory, addOracleMessage, isOracleActive, toggleOracle, setFusedContext, setDocumentContent, documentContent, clarityScore } = useOuroborosStore();
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

        const userMsg = input;
        setInput('');
        setIsProcessing(true);

        // Optimistic update handled by Engine or here? 
        // Engine adds messages to store.

        await OuroborosEngine.getInstance().runOracle(userMsg, oracleChatHistory);

        setIsProcessing(false);
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
            toggleOracle(false);
        }
        setIsProcessing(false);
        setIsProcessing(false);
    };

    const handleIgnite = async () => {
        setIsProcessing(true);
        const starterMsg = documentContent.trim() || "I have a new idea I'd like to explore. Please interview me to help clarify my vision.";
        await OuroborosEngine.getInstance().initiateOracleInterview(starterMsg);
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {oracleChatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 opacity-70">
                        <Sparkles className="w-12 h-12 text-purple-500/50 animate-pulse" />
                        <p className="text-sm text-center max-w-[200px] font-mono">
                            The Oracle awaits your spark.
                        </p>
                        <button
                            onClick={handleIgnite}
                            disabled={isProcessing}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold text-xs transition-all shadow-lg hover:shadow-purple-500/20 flex items-center gap-2"
                        >
                            <Sparkles className="w-3 h-3" />
                            CONSULT THE ORACLE
                        </button>
                    </div>
                ) : (
                    <>
                        {oracleChatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-700 text-gray-200 rounded-bl-none border border-purple-500/20'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Actions */}
            <div className="p-3 bg-gray-800 border-t border-gray-700">
                {oracleChatHistory.length > 2 && (
                    <button
                        onClick={handleFusion}
                        disabled={isProcessing}
                        className="w-full mb-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded font-bold text-xs hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-3 h-3" />
                        {isProcessing ? 'Fusing Context...' : 'Perform Context Fusion'}
                    </button>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Answer the Oracle..."
                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        disabled={isProcessing}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isProcessing || !input.trim()}
                        className="p-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                    {oracleChatHistory.length === 0 && (
                        <button
                            onClick={handleIgnite}
                            disabled={isProcessing}
                            className="p-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
                            title="Consult The Oracle"
                        >
                            <Sparkles className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
