import React, { useState } from 'react';
import { Node, AppSettings, MicroTask, RedFlag, AgentMemory, LogEntry } from '../types';

interface NodeInspectorProps {
    node: Node;
    settings: AppSettings;
    logs: LogEntry[];
    onClose: () => void;
    onUpdateSettings: (settings: AppSettings) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ node, settings, logs, onClose, onUpdateSettings }) => {
    const [activeTab, setActiveTab] = useState<'output' | 'mdap' | 'logs' | 'artifacts' | 'tribunal'>('output');

    if (!node) return null;

    const hasArtifacts = node.artifacts && (node.artifacts.code || node.artifacts.specification || node.artifacts.proof);
    const isTribunal = node.type === 'gatekeeper' && node.data?.judgeOutputs;

    return (
        <div className="w-full node-glass border border-emerald-800/50 rounded-lg p-4 shadow-2xl max-h-[80vh] overflow-y-auto flex flex-col gap-3 bg-[#0a0a0a]/90 backdrop-blur-md pointer-events-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-emerald-800/50 pb-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-emerald-100 text-sm">
                        {node.label}
                    </h3>
                    {node.score !== undefined && node.score !== 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${node.score > 80 ? 'bg-emerald-900 text-emerald-400' : 'bg-amber-900 text-amber-400'}`}>
                            Vote: {node.score}%
                        </span>
                    )}
                    <span className="text-xs text-emerald-600 ml-2">{node.persona}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-emerald-900/30 rounded p-0.5">
                        <button
                            onClick={() => setActiveTab('output')}
                            className={`px-3 py-1 text-xs rounded ${activeTab === 'output' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:text-emerald-200'}`}
                        >
                            Output
                        </button>
                        <button
                            onClick={() => setActiveTab('mdap')}
                            className={`px-3 py-1 text-xs rounded ${activeTab === 'mdap' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:text-emerald-200'}`}
                        >
                            MDAP
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`px-3 py-1 text-xs rounded ${activeTab === 'logs' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:text-emerald-200'}`}
                        >
                            Logs
                        </button>
                        {hasArtifacts && (
                            <button
                                onClick={() => setActiveTab('artifacts')}
                                className={`px-3 py-1 text-xs rounded ${activeTab === 'artifacts' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:text-emerald-200'}`}
                            >
                                Artifacts
                            </button>
                        )}
                        {isTribunal && (
                            <button
                                onClick={() => setActiveTab('tribunal')}
                                className={`px-3 py-1 text-xs rounded ${activeTab === 'tribunal' ? 'bg-emerald-800 text-white' : 'text-emerald-400 hover:text-emerald-200'}`}
                            >
                                Tribunal
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="text-emerald-500 hover:text-emerald-300">
                        ✕
                    </button>
                </div>
            </div>

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
                ) : activeTab === 'mdap' ? (
                    <MDAPPanel node={node} settings={settings} onUpdateSettings={onUpdateSettings} />
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
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
}

const MDAPPanel: React.FC<MDAPPanelProps> = ({ node, settings, onUpdateSettings }) => {
    return (
        <div className="flex flex-col gap-4">
            {/* Controls */}
            <div className="grid grid-cols-2 gap-4 p-2 bg-emerald-900/20 rounded border border-emerald-800/30">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400">Enable MDAP</span>
                    <input
                        type="checkbox"
                        checked={settings.enableRedFlagging} // Assuming MDAP implies Red Flagging + others for now, or we can add a specific MDAP toggle if needed. 
                        // Actually, MVP_TASKS says "Enable MDAP" control. I should probably add a specific setting or use a combination. 
                        // For now, let's assume it toggles the suite of features.
                        onChange={(e) => onUpdateSettings({ ...settings, enableRedFlagging: e.target.checked, enableMultiRoundVoting: e.target.checked, enableAgentMemory: e.target.checked })}
                        className="accent-emerald-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400">Red Flagging</span>
                    <input
                        type="checkbox"
                        checked={settings.enableRedFlagging}
                        onChange={(e) => onUpdateSettings({ ...settings, enableRedFlagging: e.target.checked })}
                        className="accent-emerald-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400">Voting Rounds</span>
                    <input
                        type="checkbox"
                        checked={settings.enableMultiRoundVoting}
                        onChange={(e) => onUpdateSettings({ ...settings, enableMultiRoundVoting: e.target.checked })}
                        className="accent-emerald-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400">Agent Memory</span>
                    <input
                        type="checkbox"
                        checked={settings.enableAgentMemory}
                        onChange={(e) => onUpdateSettings({ ...settings, enableAgentMemory: e.target.checked })}
                        className="accent-emerald-500"
                    />
                </div>
                <div className="flex items-center justify-between col-span-2 border-t border-emerald-800/30 pt-2 mt-1">
                    <span className="text-xs text-emerald-400">Max Micro-Agent Depth</span>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        value={settings.maxMicroAgentDepth || 3}
                        onChange={(e) => onUpdateSettings({ ...settings, maxMicroAgentDepth: parseInt(e.target.value) })}
                        className="w-12 bg-emerald-900/50 border border-emerald-700 text-emerald-100 text-xs rounded px-1"
                    />
                </div>
                <div className="flex items-center justify-between col-span-2">
                    <span className="text-xs text-emerald-400">Initial Judge Count</span>
                    <input
                        type="number"
                        min="1"
                        max="9"
                        step="2"
                        value={settings.initialJudgeCount || 3}
                        onChange={(e) => onUpdateSettings({ ...settings, initialJudgeCount: parseInt(e.target.value) })}
                        className="w-12 bg-emerald-900/50 border border-emerald-700 text-emerald-100 text-xs rounded px-1"
                    />
                </div>
            </div>

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
