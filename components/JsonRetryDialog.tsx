/**
 * JSON Retry Dialog Component (V2.99)
 * 
 * Modal that appears when JSON parsing fails, letting user choose retry options.
 * Part of the "NOT A CODING AGENT" factory protocol.
 */

import React from 'react';
import { X, RefreshCw, SkipForward, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FailedNode {
    nodeId: string;
    nodeName: string;
    rawOutput: string;
}

interface JsonRetryDialogProps {
    failedNodes: FailedNode[];
    onRetryAll: () => void;
    onRetrySelected: (nodeIds: string[]) => void;
    onSkipAll: () => void;
    onClose: () => void;
}

export const JsonRetryDialog: React.FC<JsonRetryDialogProps> = ({
    failedNodes,
    onRetryAll,
    onRetrySelected,
    onSkipAll,
    onClose
}) => {
    const [selectedNodes, setSelectedNodes] = React.useState<Set<string>>(new Set());

    const toggleNode = (nodeId: string) => {
        const newSet = new Set(selectedNodes);
        if (newSet.has(nodeId)) {
            newSet.delete(nodeId);
        } else {
            newSet.add(nodeId);
        }
        setSelectedNodes(newSet);
    };

    const handleRetrySelected = () => {
        if (selectedNodes.size > 0) {
            onRetrySelected(Array.from(selectedNodes));
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="bg-[#050505] border border-amber-500/50 rounded-xl w-full max-w-lg shadow-[0_0_50px_rgba(245,158,11,0.15)] p-6 relative overflow-hidden"
                >
                    {/* Scanline Effect */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-amber-700 hover:text-amber-400 transition-colors z-10"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="p-2 bg-amber-500/10 rounded border border-amber-500/30">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-amber-400 tracking-wide uppercase">JSON Parsing Failure</h2>
                            <div className="text-[10px] text-amber-600 font-mono">PROTOCOL EXCEPTION_0xJSON</div>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-emerald-400/80 mb-6 font-mono leading-relaxed relative z-10">
                        <strong className="text-emerald-300">{failedNodes.length} node(s)</strong> returned corrupted or invalid JSON data.
                        <br />
                        Initiate recovery protocol to re-prompt agents with strict formatting constraints?
                    </p>

                    {/* Failed Nodes List */}
                    <div className="max-h-48 overflow-y-auto mb-6 space-y-2 scrollbar-thin scrollbar-thumb-amber-900 pr-2 relative z-10">
                        {failedNodes.map(node => (
                            <div
                                key={node.nodeId}
                                className={`p-3 rounded border cursor-pointer transition-all flex justify-between items-center group ${selectedNodes.has(node.nodeId)
                                    ? 'bg-amber-900/20 border-amber-500/50'
                                    : 'bg-black/40 border-emerald-900/30 hover:border-emerald-500/50'
                                    }`}
                                onClick={() => toggleNode(node.nodeId)}
                                role="checkbox"
                                aria-checked={selectedNodes.has(node.nodeId)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleNode(node.nodeId);
                                    }
                                }}
                            >
                                <div className="overflow-hidden">
                                    <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider group-hover:text-amber-400 transition-colors">{node.nodeName}</div>
                                    <div className="text-[10px] text-emerald-700 truncate font-mono mt-1">
                                        {node.rawOutput.substring(0, 80)}...
                                    </div>
                                </div>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedNodes.has(node.nodeId) ? 'bg-amber-500 border-amber-400' : 'border-emerald-800 bg-black'}`}>
                                    {selectedNodes.has(node.nodeId) && <div className="w-2 h-2 bg-black rounded-sm" />}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 relative z-10">
                        <button
                            onClick={onRetryAll}
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/50 rounded text-amber-400 hover:text-amber-200 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all font-bold text-xs uppercase tracking-widest"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Retry All
                        </button>
                        <button
                            onClick={handleRetrySelected}
                            disabled={selectedNodes.size === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 rounded text-emerald-400 hover:text-emerald-200 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-xs uppercase tracking-widest"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Retry ({selectedNodes.size})
                        </button>
                        <button
                            onClick={onSkipAll}
                            className="flex-shrink-0 flex items-center justify-center gap-2 py-3 px-4 bg-red-900/10 hover:bg-red-900/20 border border-red-900/50 rounded text-red-400 hover:text-red-300 transition-all font-bold text-xs uppercase tracking-widest"
                            title="Abort and use fallback data"
                        >
                            <SkipForward className="w-3 h-3" />
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default JsonRetryDialog;
