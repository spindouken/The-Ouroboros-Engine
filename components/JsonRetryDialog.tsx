/**
 * JSON Retry Dialog Component (V2.99)
 * 
 * Modal that appears when JSON parsing fails, letting user choose retry options.
 * Part of the "NOT A CODING AGENT" factory protocol.
 */

import React from 'react';
import { X, RefreshCw, SkipForward, AlertTriangle } from 'lucide-react';

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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-[#0a0c0a] border border-amber-900/80 rounded-lg w-full max-w-lg shadow-2xl p-6 relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-amber-700 hover:text-amber-400 transition-colors"
                    aria-label="Close dialog"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                    <h2 className="text-lg font-bold text-amber-400">JSON Parsing Failed</h2>
                </div>

                {/* Description */}
                <p className="text-sm text-emerald-600 mb-4">
                    {failedNodes.length} node(s) returned invalid JSON.
                    Would you like to retry with explicit JSON formatting instructions?
                </p>

                {/* Failed Nodes List */}
                <div className="max-h-48 overflow-y-auto mb-4 space-y-2 scrollbar-thin scrollbar-thumb-emerald-900">
                    {failedNodes.map(node => (
                        <div
                            key={node.nodeId}
                            className={`p-2 rounded border cursor-pointer transition-all ${selectedNodes.has(node.nodeId)
                                    ? 'bg-amber-900/30 border-amber-500'
                                    : 'bg-black border-emerald-900/50 hover:border-emerald-700'
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
                            <div className="text-sm font-bold text-emerald-400">{node.nodeName}</div>
                            <div className="text-xs text-emerald-700 truncate font-mono">
                                {node.rawOutput.substring(0, 100)}...
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={onRetryAll}
                        className="flex-1 flex items-center justify-center gap-2 p-2 bg-amber-900/30 border border-amber-700 rounded text-amber-400 hover:bg-amber-900/50 transition-colors font-medium text-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry All
                    </button>
                    <button
                        onClick={handleRetrySelected}
                        disabled={selectedNodes.size === 0}
                        className="flex-1 flex items-center justify-center gap-2 p-2 bg-emerald-900/30 border border-emerald-700 rounded text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry Selected ({selectedNodes.size})
                    </button>
                    <button
                        onClick={onSkipAll}
                        className="flex-1 flex items-center justify-center gap-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 hover:bg-red-900/50 transition-colors font-medium text-sm"
                    >
                        <SkipForward className="w-4 h-4" />
                        Skip All
                    </button>
                </div>

                {/* Help Text */}
                <p className="text-xs text-emerald-800 mt-4 text-center">
                    Retry will re-prompt the LLM with explicit JSON formatting instructions.
                    Skip will continue with empty/fallback data.
                </p>
            </div>
        </div>
    );
};

export default JsonRetryDialog;
