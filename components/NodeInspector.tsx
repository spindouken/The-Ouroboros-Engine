import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import { OuroborosEngine } from '../engine/OuroborosEngine';
import { AppSettings, LogEntry, Node } from '../types';
import { MODELS } from '../constants';
import { AlertTriangle } from 'lucide-react';

interface NodeInspectorProps {
    nodeId: string;
    onClose: () => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ nodeId, onClose }) => {
    const node = useLiveQuery(() => db.nodes.get(nodeId), [nodeId]);
    const settings = useLiveQuery(() => db.settings.get(1)) || {} as AppSettings;
    const logs = useLiveQuery(() => db.logs.where('nodeId').equals(nodeId).reverse().sortBy('timestamp'), [nodeId]) || [];

    const onUpdateSettings = (newSettings: Partial<AppSettings>) => {
        OuroborosEngine.getInstance().updateSettings(newSettings);
    };

    const [activeTab, setActiveTab] = useState<'output' | 'prompt' | 'identity' | 'mdap' | 'logs' | 'artifacts' | 'tribunal'>('output');

    const [rescueModel, setRescueModel] = useState<string>('');
    const [isGlobalRescue, setIsGlobalRescue] = useState(false);

    if (!node) return null;

    const hasArtifacts = node.artifacts && (node.artifacts.code || node.artifacts.specification || node.artifacts.proof);
    const isTribunal = node.type === 'gatekeeper' && node.data?.judgeOutputs;

    return (
        <div className="w-full node-glass border border-emerald-800/50 rounded-lg p-4 shadow-2xl max-h-[80vh] overflow-y-auto flex flex-col gap-3 bg-[#0a0a0a]/90 backdrop-blur-md pointer-events-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-emerald-800/50 pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1 overflow-hidden pr-4">
                        <h3 className="font-bold text-emerald-100 text-sm leading-tight break-words" title={node.label}>
                            {node.label}
                        </h3>
                        <div className="flex items-center gap-2">
                            {node.score !== undefined && node.score !== 0 && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${node.score > 80 ? 'bg-emerald-900 text-emerald-400' : 'bg-amber-900 text-amber-400'}`}>
                                    Vote: {node.score}%
                                </span>
                            )}
                            <span className="text-xs text-emerald-600 capitalize">{node.type.replace('_', ' ')}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-emerald-500 hover:text-emerald-300 p-1">
                        ✕
                    </button>
                </div>

                <div className="flex gap-1 flex-wrap">
                    <button
                        onClick={() => setActiveTab('output')}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'output' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                    >
                        Output
                    </button>
                    <button
                        onClick={() => setActiveTab('prompt')}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'prompt' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                    >
                        Task
                    </button>
                    <button
                        onClick={() => setActiveTab('identity')}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'identity' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                    >
                        Identity
                    </button>
                    <button
                        onClick={() => setActiveTab('mdap')}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'mdap' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                    >
                        MDAP
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'logs' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                    >
                        Logs
                    </button>
                    {hasArtifacts && (
                        <button
                            onClick={() => setActiveTab('artifacts')}
                            className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'artifacts' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                        >
                            Artifacts
                        </button>
                    )}
                    {isTribunal && (
                        <button
                            onClick={() => setActiveTab('tribunal')}
                            className={`px-3 py-1 text-xs rounded border transition-colors ${activeTab === 'tribunal' ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'}`}
                        >
                            Tribunal
                        </button>
                    )}
                </div>
            </div>

            {/* HYDRA DISTRESS SIGNAL */}
            {node.status === 'distress' && (
                <div className="mx-4 mt-2 p-3 bg-amber-900/30 border border-amber-500/50 rounded animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    <h3 className="text-amber-500 font-bold flex items-center gap-2 mb-2 text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4" /> HYDRA: ALL HEADS SEVERED
                    </h3>
                    <p className="text-[11px] text-amber-200/80 mb-3 font-mono leading-relaxed break-all">
                        The Hydra Protocol exhausted all available models in the tier.
                        Requires manual intervention to proceed.
                        <br />
                        <span className="text-red-400 font-bold mt-1 block break-words">Error: {node.lastHydraLog || "Unknown 429 Error"}</span>
                    </p>

                    <div className="flex flex-col gap-2">
                        <select
                            className="w-full bg-black/50 border border-amber-900 rounded p-1.5 text-xs text-amber-500 font-bold focus:border-amber-500 focus:outline-none"
                            onChange={(e) => setRescueModel(e.target.value)}
                            value={rescueModel}
                        >
                            <option value="">Select Rescue Model...</option>
                            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>

                        <label className="flex items-center gap-2 text-[10px] text-amber-500 cursor-pointer hover:text-amber-400 transition-colors">
                            <input
                                type="checkbox"
                                checked={isGlobalRescue}
                                onChange={(e) => setIsGlobalRescue(e.target.checked)}
                                className="accent-amber-500 bg-black border-amber-900 rounded focus:ring-amber-500"
                            />
                            Update Global Default for Session (Prevents Recurring Failures)
                        </label>

                        <button
                            onClick={() => {
                                const updateGlobal = isGlobalRescue && !!rescueModel;
                                // Reset node state to pending to allow re-execution
                                OuroborosEngine.getInstance().updateNodeState(node.id, {
                                    status: 'pending',
                                    output: null,
                                    distress: false,
                                    failedModel: undefined,
                                    lastHydraLog: undefined
                                });
                                // If a rescue model is selected, update it
                                if (rescueModel) {
                                    // Implementation depends on how we pass one-off model overrides.
                                    // For now, retryNode is the correct method, but we need to ensure it handling status reset.
                                    OuroborosEngine.getInstance().retryNode(node.id, rescueModel, updateGlobal);
                                } else {
                                    // Just a vanilla retry/reset
                                    OuroborosEngine.getInstance().retryNode(node.id, undefined, updateGlobal);
                                }
                                onClose();
                            }}
                            className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded shadow-lg hover:shadow-amber-500/20 transition-all uppercase tracking-wider"
                        >
                            DEPLOY RESCUE
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'output' ? (
                    node.output ? (
                        <div className="text-xs text-emerald-200/80 whitespace-pre-wrap leading-relaxed font-mono">
                            {node.output}
                        </div>
                    ) : (
                        <div className="text-xs text-emerald-800 italic">Thinking...</div>
                    )
                ) : activeTab === 'prompt' ? (
                    <div className="text-xs text-emerald-200/80 whitespace-pre-wrap leading-relaxed font-mono bg-black/20 p-2 rounded border border-emerald-900/30">
                        {node.instruction}
                    </div>
                ) : activeTab === 'identity' ? (
                    <div className="text-xs text-emerald-200/80 whitespace-pre-wrap leading-relaxed font-mono bg-black/20 p-2 rounded border border-emerald-900/30">
                        {node.persona}
                    </div>
                ) : activeTab === 'mdap' ? (
                    <MDAPPanel node={node} />
                ) : activeTab === 'artifacts' ? (
                    <ArtifactsPanel artifacts={node.artifacts} />
                ) : activeTab === 'tribunal' ? (
                    <TribunalPanel result={node.data} />
                ) : (
                    <NodeLogsPanel logs={logs} nodeId={node.id} />
                )}
            </div>
        </div>
    );
};

interface NodeLogsPanelProps {
    logs: LogEntry[];
    nodeId: string;
}

const NodeLogsPanel: React.FC<NodeLogsPanelProps> = ({ logs, nodeId }) => {
    const nodeLogs = logs.filter(l => l.nodeId === nodeId);

    return (
        <div className="flex flex-col gap-1 font-mono text-[10px]">
            {nodeLogs.length > 0 ? nodeLogs.map(log => (
                <div key={log.id} className={`flex gap-2 ${log.level === 'error' ? 'text-rose-500' :
                    log.level === 'success' ? 'text-emerald-400' :
                        log.level === 'warn' ? 'text-amber-500' :
                            log.level === 'system' ? 'text-emerald-600' : 'text-emerald-800'
                    }`}>
                    <span className="opacity-30 w-12 shrink-0">{log.timestamp}</span>
                    <span>{log.message}</span>
                </div>
            )) : (
                <div className="text-emerald-800 italic">No logs for this node.</div>
            )}
        </div>
    );
};

interface MDAPPanelProps {
    node: Node;
}

const MDAPPanel: React.FC<MDAPPanelProps> = ({ node }) => {
    return (
        <div className="flex flex-col gap-4">
            {/* Visualization Only - Settings moved to Global Settings Panel */}


            {/* Visualization */}
            <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Micro-Tasks</h4>
                {node.microTasks && node.microTasks.length > 0 ? (
                    <div className="flex flex-col gap-1 pl-2 border-l border-emerald-800">
                        {node.microTasks.map((task) => (
                            <div key={task.id} className="text-xs text-emerald-400/80">
                                <span className="text-emerald-600">[{task.status}]</span> {task.instruction.substring(0, 50)}...
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-emerald-800 italic">No micro-tasks decomposed.</div>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Red Flags</h4>
                {node.redFlags && node.redFlags.length > 0 ? (
                    <div className="flex flex-col gap-1 pl-2 border-l border-red-800">
                        {node.redFlags.map((flag, idx) => (
                            <div key={idx} className="text-xs text-red-400/80">
                                <span className="font-bold">[{flag.severity}]</span> {flag.message}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-emerald-800 italic">No red flags detected.</div>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Memory</h4>
                {node.memory && node.memory.length > 0 ? (
                    <div className="flex flex-col gap-1 pl-2 border-l border-amber-800">
                        {node.memory.map((mem, idx) => (
                            <div key={idx} className="text-xs text-amber-400/80">
                                <span className="text-amber-600">[Cycle {mem.cycle}]</span> {mem.feedback.substring(0, 50)}...
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-emerald-800 italic">No memory injected.</div>
                )}
            </div>
        </div>
    );
};

const ArtifactsPanel: React.FC<{ artifacts: any }> = ({ artifacts }) => {
    if (!artifacts) return null;
    return (
        <div className="flex flex-col gap-4">
            {artifacts.specification && (
                <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider border-b border-emerald-800 pb-1">Specification</h4>
                    <div className="text-xs text-emerald-200/80 whitespace-pre-wrap font-mono bg-black/30 p-2 rounded max-h-40 overflow-y-auto">
                        {artifacts.specification}
                    </div>
                </div>
            )}
            {artifacts.code && (
                <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider border-b border-emerald-800 pb-1">Code</h4>
                    <div className="text-xs text-emerald-200/80 whitespace-pre-wrap font-mono bg-black/30 p-2 rounded max-h-40 overflow-y-auto">
                        {artifacts.code}
                    </div>
                </div>
            )}
            {artifacts.proof && (
                <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider border-b border-emerald-800 pb-1">Proof</h4>
                    <div className="text-xs text-emerald-200/80 whitespace-pre-wrap font-mono bg-black/30 p-2 rounded max-h-40 overflow-y-auto">
                        {artifacts.proof}
                    </div>
                </div>
            )}
        </div>
    );
};

const TribunalPanel: React.FC<{ result: any }> = ({ result }) => {
    if (!result || !result.judgeOutputs) return null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-emerald-900/30 p-2 rounded">
                <span className="text-xs text-emerald-400 font-bold">Round {result.round} Consensus</span>
                <span className={`text-sm font-bold ${result.averageScore > 70 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.averageScore.toFixed(1)}%
                </span>
            </div>

            {result.requiresHumanReview && (
                <div className="bg-red-900/30 border border-red-800 p-2 rounded text-xs text-red-200 font-bold flex items-center gap-2">
                    <span>⛔</span> VETO TRIGGERED - IMMEDIATE REJECTION
                </div>
            )}

            <div className="flex flex-col gap-2">
                {result.judgeOutputs.map((judge: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1 bg-black/20 p-2 rounded border border-emerald-900/30">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-300">{judge.judgeId}</span>
                            <span className={`text-xs font-mono ${judge.score > 70 ? 'text-emerald-400' : judge.score === 0 ? 'text-red-500 font-bold' : 'text-amber-400'}`}>
                                {judge.score === 0 ? 'VETO' : `${judge.score}%`}
                            </span>
                        </div>
                        <span className="text-[10px] text-emerald-600 uppercase tracking-wider">{judge.focus}</span>
                        <p className="text-xs text-emerald-200/70 italic">"{judge.reasoning}"</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
