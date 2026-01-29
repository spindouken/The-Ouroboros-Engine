import React, { useState, useEffect, useRef } from 'react';
import { Settings, RefreshCw, Flame, Workflow, CheckCircle, StopCircle, RotateCcw, Sparkles, Download, Play, Pause, Eye, Edit2, ChevronRight, Trash2, FileText, X, Plus, Save, FolderArchive } from 'lucide-react';
import { AppMode, LogEntry } from '../types';
import { DEPARTMENTS } from '../constants';
import { useOuroborosStore } from '../store/ouroborosStore';
import { OuroborosEngine } from '../engine/OuroborosEngine';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import clsx from 'clsx';

import { useSoundEffects } from '../hooks/useSoundEffects';
import { OracleChat } from './oracle/OracleChat';

interface ControlPanelProps {
    appMode: AppMode;
    setAppMode: (mode: AppMode) => void;
    setShowSettings: (show: boolean) => void;
}

// --- TASK LIST VIEWER ---
const TaskListViewer: React.FC<{ tasks: any[] }> = ({ tasks }) => {
    return (
        <div className="flex-1 bg-[#050505] p-4 font-mono text-sm mb-4">
            <h3 className="text-xs font-bold text-emerald-600 mb-4 uppercase tracking-widest border-b border-emerald-900/50 pb-2">
                Approved Directives ({tasks.reduce((acc, t) => acc + 1 + (t.children?.length || 0), 0)})
            </h3>
            <div className="space-y-4">
                {tasks.map((module, idx) => (
                    <div key={module.id || idx} className="space-y-2">
                        {/* Module Header */}
                        <div className="flex items-start gap-3 p-2 bg-emerald-900/20 border border-emerald-500/30 rounded hover:bg-emerald-900/30 transition-colors">
                            <div className="text-emerald-400 font-bold mt-0.5 flex-shrink-0 text-xs shadow-[0_0_5px_rgba(52,211,153,0.5)] px-1 rounded border border-emerald-500/50">CORE</div>
                            <div className="flex-1">
                                <div className="text-emerald-100 font-bold text-xs mb-1 tracking-wide uppercase">{module.title || "Untitled Module"}</div>
                                <div className="text-emerald-500/80 text-[10px] leading-relaxed">{module.description || "No description provided."}</div>
                            </div>
                        </div>

                        {/* Children Tasks */}
                        {module.children && module.children.length > 0 && (
                            <div className="pl-6 space-y-1 border-l border-emerald-900/30 ml-3">
                                {module.children.map((task: any, tIdx: number) => (
                                    <div key={task.id || tIdx} className="flex items-start gap-2 p-1.5 hover:bg-emerald-900/10 rounded transition-colors group">
                                        <Play className="w-2 h-2 text-emerald-600 mt-1 flex-shrink-0 fill-current group-hover:text-emerald-400 transition-colors" />
                                        <div className="flex-1">
                                            <div className="text-emerald-300 font-bold text-[11px] group-hover:text-emerald-200 transition-colors">{task.title}</div>
                                            <div className="text-emerald-600/70 text-[10px] group-hover:text-emerald-500/70 transition-colors line-clamp-2">{task.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- CONSTITUTION VIEWER ---
const ConstitutionViewer: React.FC<{
    constitution: any;
    onUpdateConstraints: (newConstraints: string[]) => void;
}> = ({ constitution, onUpdateConstraints }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newConstraint, setNewConstraint] = useState('');

    if (!constitution || !constitution.domain) {
        return (
            <div className="p-4 text-center text-emerald-800/50">
                <p className="text-xs">No constitution established yet.</p>
            </div>
        );
    }

    const handleDeleteConstraint = (index: number) => {
        const updated = [...(constitution.constraints || [])];
        updated.splice(index, 1);
        onUpdateConstraints(updated);
    };

    const handleAddConstraint = () => {
        if (!newConstraint.trim()) return;
        const updated = [...(constitution.constraints || []), newConstraint.trim()];
        onUpdateConstraints(updated);
        setNewConstraint('');
    };

    return (
        <div className="p-4 space-y-4 font-mono text-sm">
            <div className="border-b border-amber-900/30 pb-2 flex justify-between items-center">
                <div>
                    <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em]">📜 LIVING CONSTITUTION</h3>
                    <p className="text-[10px] text-amber-700 mt-1">The binding rules for this project</p>
                </div>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={clsx(
                        "p-1.5 rounded transition-colors flex items-center gap-1 text-[10px] font-bold border",
                        isEditing
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                            : "bg-transparent text-amber-700 hover:text-amber-500 border-transparent hover:border-amber-900/30"
                    )}
                >
                    {isEditing ? <Save className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                    {isEditing ? "DONE" : "EDIT"}
                </button>
            </div>

            {/* Domain */}
            <div className="space-y-1">
                <div className="text-[10px] font-bold text-emerald-600 uppercase">Domain</div>
                <div className="text-emerald-200 text-xs bg-emerald-900/20 px-2 py-1 rounded">{constitution.domain}</div>
            </div>

            {/* Tech Stack */}
            {constitution.techStack && constitution.techStack.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Tech Stack (Binding)</div>
                    <div className="flex flex-wrap gap-1">
                        {constitution.techStack.map((tech: string, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-cyan-900/30 text-cyan-400 rounded border border-cyan-800/50">{tech}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Constraints */}
            <div className="space-y-1">
                <div className="text-[10px] font-bold text-red-500 uppercase flex justify-between items-center">
                    <span>🔒 Constraints (Non-Negotiable)</span>
                    {isEditing && <span className="text-[9px] text-red-400/50">Blocking Tasks? Remove them here.</span>}
                </div>
                <div className="space-y-1">
                    {(constitution.constraints && constitution.constraints.length > 0) ? (
                        constitution.constraints.map((c: string, i: number) => (
                            <div key={i} className="group relative text-[10px] text-red-300/80 bg-red-950/20 px-2 py-1.5 rounded border-l-2 border-red-600 flex justify-between items-start gap-2">
                                <span className="flex-1">{c}</span>
                                {isEditing && (
                                    <button
                                        onClick={() => handleDeleteConstraint(i)}
                                        className="text-red-500 hover:text-red-300 opacity-60 hover:opacity-100 transition-opacity"
                                        title="Remove Constraint"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-[10px] text-red-900/50 italic px-2">No active constraints.</div>
                    )}

                    {/* Add Constraint Input */}
                    {isEditing && (
                        <div className="flex gap-2 mt-2 pt-2 border-t border-red-900/20">
                            <input
                                type="text"
                                value={newConstraint}
                                onChange={(e) => setNewConstraint(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddConstraint()}
                                placeholder="Add new constraint..."
                                className="flex-1 bg-red-950/10 border border-red-900/30 rounded text-[10px] px-2 py-1 text-red-200 placeholder-red-900/50 focus:outline-none focus:border-red-500/50"
                            />
                            <button
                                onClick={handleAddConstraint}
                                disabled={!newConstraint.trim()}
                                className="bg-red-900/30 hover:bg-red-800/50 text-red-400 rounded px-2 flex items-center justify-center disabled:opacity-50"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Decisions (Dynamic - added during execution) */}
            {constitution.decisions && constitution.decisions.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[10px] font-bold text-purple-500 uppercase">⚡ Decisions (Accumulated)</div>
                    <div className="space-y-1">
                        {constitution.decisions.map((d: string, i: number) => (
                            <div key={i} className="text-[10px] text-purple-300/80 bg-purple-950/20 px-2 py-1 rounded">
                                {d}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Warnings */}
            {constitution.warnings && constitution.warnings.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[10px] font-bold text-amber-500 uppercase">⚠️ Warnings</div>
                    <div className="space-y-1">
                        {constitution.warnings.map((w: string, i: number) => (
                            <div key={i} className="text-[10px] text-amber-300/80 bg-amber-950/20 px-2 py-1 rounded">
                                {w}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Metadata */}
            <div className="text-[9px] text-emerald-900 mt-4 pt-2 border-t border-emerald-900/30">
                Last Updated: {new Date(constitution.lastUpdated).toLocaleString()} | Deltas: {constitution.deltaCount || 0}
            </div>
        </div>
    );
};

// --- CYBERPUNK MARKDOWN RENDERER ---
const CyberpunkPreview: React.FC<{ content: string }> = ({ content }) => {
    // 1. Clean up code fences but PRESERVE content
    // We remove the ``` wrapper lines but keep the text inside and around them
    // This allows mixed content (multiple blocks, or text outside blocks) to render fully
    const cleanContent = content
        .replace(/^```[\w-]*\s*$/gm, '') // Remove opening/closing fences on their own lines
        .trim();

    // 2. Simple Line-by-Line Parser (Cyberpunk Style)
    const lines = cleanContent.split('\n');

    return (
        <div className="w-full bg-[#050505] p-4 font-mono text-sm whitespace-pre-wrap break-words">
            {lines.map((line, idx) => {
                // H1
                if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-xl font-bold text-emerald-400 mt-4 mb-2 border-b border-emerald-900/50 pb-1 tracking-widest uppercase shadow-[0_0_10px_rgba(52,211,153,0.1)]">{line.replace('# ', '')}</h1>;
                }
                // H2
                if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-lg font-bold text-emerald-500 mt-3 mb-1 pl-2 border-l-2 border-emerald-600">{line.replace('## ', '')}</h2>;
                }
                // H3
                if (line.startsWith('### ')) {
                    return <h3 key={idx} className="text-md font-bold text-emerald-600 mt-2 mb-1">{line.replace('### ', '')}</h3>;
                }
                // Checkbox (Unchecked)
                if (line.trim().startsWith('- [ ]')) {
                    return (
                        <div key={idx} className="flex items-start gap-2 py-0.5 text-emerald-300/80 hover:text-emerald-200 transition-colors">
                            <div className="w-4 h-4 border border-emerald-700 rounded-sm bg-black/50 mt-0.5 flex-shrink-0" />
                            <span>{line.replace('- [ ]', '')}</span>
                        </div>
                    );
                }
                // Checkbox (Checked)
                if (line.trim().startsWith('- [x]')) {
                    return (
                        <div key={idx} className="flex items-start gap-2 py-0.5 text-emerald-500 line-through decoration-emerald-800 decoration-2 opacity-60">
                            <div className="w-4 h-4 border border-emerald-700 rounded-sm bg-emerald-900/50 mt-0.5 flex-shrink-0 flex items-center justify-center text-[10px]">✓</div>
                            <span>{line.replace('- [x]', '')}</span>
                        </div>
                    );
                }
                // Helper to parse inline styles (bold, italic)
                const parseInline = (text: string) => {
                    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
                    return parts.map((part, pIdx) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={pIdx} className="text-emerald-300 font-bold">{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith('*') && part.endsWith('*')) {
                            return <em key={pIdx} className="text-emerald-200 italic">{part.slice(1, -1)}</em>;
                        }
                        return part;
                    });
                };

                // List Item (Handle both '-' and '*')
                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                    const content = line.trim().startsWith('- ') ? line.replace('- ', '') : line.replace('* ', '');
                    return (
                        <div key={idx} className="flex items-start gap-2 py-1 pl-2">
                            <Play className="w-2.5 h-2.5 text-emerald-500 mt-1.5 flex-shrink-0 fill-current" />
                            <span className="text-emerald-100/90 leading-relaxed">{parseInline(content)}</span>
                        </div>
                    );
                }
                // Separator
                if (line.trim() === '---') {
                    return <hr key={idx} className="border-emerald-900/50 my-4" />;
                }
                // Empty Line
                if (line.trim() === '') {
                    return <div key={idx} className="h-2" />;
                }

                // Default Text
                return (
                    <div key={idx} className="text-emerald-100/80 min-h-[1.2em]">
                        {parseInline(line)}
                    </div>
                );
            })}
        </div>
    );
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
    appMode, setAppMode, setShowSettings
}) => {
    const {
        status,
        documentContent,
        setDocumentContent,
        projectPlan,
        manifestation,
        toggleOracle,
        isOracleActive,
        prismAnalysis,
        setPrismAnalysis,
        livingConstitution,
        updateLivingConstitution,
        originalRequirements,
        verifiedBricks
    } = useOuroborosStore();

    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [prismViewTab, setPrismViewTab] = useState<'council' | 'constitution'>('council');
    const [showOriginalPrompt, setShowOriginalPrompt] = useState(false);
    const isProcessing = status === 'thinking';
    const engine = OuroborosEngine.getInstance();
    const { playClick, playHover } = useSoundEffects();

    const handleStop = () => {
        playClick();
        engine.abort();
    };

    const handleReset = () => {
        playClick();
        if (confirm("WARNING: This will wipe all session data. Are you sure?")) {
            engine.clearSession();
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#020402]">
            {/* HEADER */}
            <div className="p-4 border-b border-emerald-900/30 flex flex-col gap-4 bg-[#050505]">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-5">
                        <img src="/Ouroboros.png" alt="Ouroboros Logo" className="w-20 h-20 object-contain" />
                        <div>
                            <h1 className="font-bold text-emerald-100 tracking-wider text-xl">THE OUROBOROS ENGINE</h1>
                            <div className="text-[10px] text-emerald-600 font-mono">v2.99 // PRAGMATIC BRICK FACTORY</div>
                        </div>
                    </div>
                    <button
                        onClick={() => { playClick(); setShowSettings(true); }}
                        onMouseEnter={() => playHover()}
                        className="text-emerald-700 hover:text-emerald-400 transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => { playClick(); setAppMode('refine'); }}
                        onMouseEnter={() => playHover()}
                        className={clsx(
                            "flex-1 py-1.5 text-xs font-bold rounded transition-colors",
                            appMode === 'refine' ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700" : "text-emerald-800 hover:text-emerald-600 border border-transparent"
                        )}
                    >
                        REFINE
                    </button>
                    <button
                        onClick={() => { playClick(); setAppMode('plan'); }}
                        onMouseEnter={() => playHover()}
                        className={clsx(
                            "flex-1 py-1.5 text-xs font-bold rounded transition-colors",
                            appMode === 'plan' ? "bg-amber-900/50 text-amber-400 border border-amber-700" : "text-emerald-800 hover:text-emerald-600 border border-transparent"
                        )}
                    >
                        MANIFEST
                    </button>
                </div>
            </div>

            {/* INPUT AREA */}
            <div className="flex-1 p-4 flex flex-col min-h-0">
                {appMode === 'refine' ? (
                    // --- REFINE MODE: The Main Stage (PRIMA MATERIA + FACTORY) ---
                    <>
                        {/* Refine Header */}
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-emerald-600 tracking-wider">
                                {manifestation && viewMode === 'edit'
                                    ? "PROJECT SOUL (MANIFESTATION)"
                                    : prismAnalysis
                                        ? "🔮 PRISM DECOMPOSITION"
                                        : "PRIMA MATERIA"}
                            </span>
                            <div className="flex gap-2 items-center">
                                {/* Oracle Button */}
                                <button
                                    onClick={() => {
                                        playClick();
                                        toggleOracle(!isOracleActive);
                                    }}
                                    onMouseEnter={() => playHover()}
                                    className="text-purple-400 hover:text-purple-300 p-1 rounded hover:bg-purple-900/20 transition-colors"
                                    title="Consult The Oracle"
                                >
                                    <Sparkles className="w-4 h-4" />
                                </button>

                                {/* Subtle Refine Spec Button (integrated into Oracle area) */}
                                {!prismAnalysis && !isOracleActive && documentContent.trim() && (
                                    <button
                                        onClick={() => { playClick(); engine.refineSpecification(); }}
                                        onMouseEnter={() => playHover()}
                                        className="text-[9px] font-bold text-emerald-700 hover:text-emerald-400 px-2 py-1 rounded border border-emerald-900/30 hover:border-emerald-700 transition-colors"
                                        title="Auto-polish your specification"
                                    >
                                        ✨ POLISH
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        playClick();
                                        if (confirm("Clear Prima Materia?")) {
                                            setDocumentContent('');
                                        }
                                    }}
                                    onMouseEnter={() => playHover()}
                                    className="text-emerald-700 hover:text-red-400 p-1 rounded hover:bg-emerald-900/20 transition-colors"
                                    title="Clear Input"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="w-px h-4 bg-emerald-900/50 mx-1" />

                                {/* View Toggle: Show if we have content to view */}
                                {(manifestation || prismAnalysis || projectPlan.length > 0) && (
                                    <button
                                        onClick={() => { playClick(); setViewMode(viewMode === 'edit' ? 'preview' : 'edit'); }}
                                        onMouseEnter={() => playHover()}
                                        className={clsx(
                                            "text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors",
                                            viewMode === 'preview' ? "bg-amber-900/40 text-amber-400 border border-amber-700" : "bg-emerald-900/40 text-emerald-400 border border-emerald-700"
                                        )}
                                        title={viewMode === 'edit' ? "View Prism Analysis" : "View Final Document"}
                                    >
                                        {viewMode === 'edit' ? <Workflow className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                        {viewMode === 'edit' ? "VIEW PRISM" : "VIEW DOC"}
                                    </button>
                                )}

                                {/* View Original Prompt Button - Show when we have original requirements */}
                                {originalRequirements && (manifestation || prismAnalysis) && (
                                    <button
                                        onClick={() => { playClick(); setShowOriginalPrompt(true); }}
                                        onMouseEnter={() => playHover()}
                                        className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors text-cyan-600 hover:text-cyan-400 border border-cyan-900/30 hover:border-cyan-700"
                                        title="View Original Prompt"
                                    >
                                        <FileText className="w-3 h-3" />
                                        ORIGINAL
                                    </button>
                                )}
                                <button onClick={handleReset} onMouseEnter={() => playHover()} className="text-emerald-700 hover:text-emerald-400" title="Reset Session">
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        {/* Refine Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 mb-4 border border-emerald-900/30 rounded bg-[#080a08]">
                            {isOracleActive ? (
                                <OracleChat />
                            ) : manifestation && viewMode === 'edit' ? (
                                // --- MANIFESTATION VIEW (Final Compiled Document) ---
                                <CyberpunkPreview content={manifestation} />
                            ) : prismAnalysis ? (
                                // --- PRISM VIEW with TABS (Council + Constitution) ---
                                <div className="h-full flex flex-col">
                                    {/* Tab Bar */}
                                    <div className="flex border-b border-emerald-900/50 bg-[#080808]">
                                        <button
                                            onClick={() => { playClick(); setPrismViewTab('council'); }}
                                            className={clsx(
                                                "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                                prismViewTab === 'council'
                                                    ? "text-emerald-400 bg-emerald-900/30 border-b-2 border-emerald-500"
                                                    : "text-emerald-700 hover:text-emerald-500"
                                            )}
                                        >
                                            👥 Council & Tasks
                                        </button>
                                        <button
                                            onClick={() => { playClick(); setPrismViewTab('constitution'); }}
                                            className={clsx(
                                                "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                                prismViewTab === 'constitution'
                                                    ? "text-amber-400 bg-amber-900/30 border-b-2 border-amber-500"
                                                    : "text-amber-700 hover:text-amber-500"
                                            )}
                                        >
                                            📜 Constitution
                                        </button>
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-y-auto">
                                        {prismViewTab === 'constitution' ? (
                                            <ConstitutionViewer
                                                constitution={livingConstitution}
                                                onUpdateConstraints={(newConstraints) => updateLivingConstitution({ constraints: newConstraints })}
                                            />
                                        ) : (
                                            <div className="p-4 space-y-6">
                                                {/* Specialists Review */}
                                                <div className="space-y-3">
                                                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] border-b border-emerald-900/30 pb-1">Council of Specialists</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {prismAnalysis.stepD.councilMembers.map((member: any, i: number) => (
                                                            <div key={i} className="bg-emerald-950/20 border border-emerald-900/50 px-3 py-2 rounded flex-1 min-w-[140px]">
                                                                <div className="text-emerald-200 text-xs font-bold">{member.agent.role}</div>
                                                                <div className="text-emerald-600 text-[10px] uppercase">{member.agent.id}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Tasks Review */}
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center border-b border-emerald-900/30 pb-1">
                                                        <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
                                                            Decomposed Task List ({prismAnalysis.stepB.atomicTasks.length} tasks)
                                                        </h3>
                                                        <button
                                                            onClick={() => { playClick(); engine.downloadPrismTasks(); }}
                                                            className="text-[9px] font-bold text-emerald-600 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                                            title="Export Tasks to Markdown"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            EXPORT
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {prismAnalysis.stepB.atomicTasks.map((task: any, i: number) => (
                                                            <div key={i} className={clsx(
                                                                "p-3 rounded border transition-colors",
                                                                task.title.startsWith('🔴') ? "bg-red-950/10 border-red-900/30" : "bg-black/40 border-emerald-900/20"
                                                            )}>
                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                    <div className="text-emerald-100 text-xs font-bold">{task.title}</div>
                                                                    <div className={clsx(
                                                                        "text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold",
                                                                        task.routingPath === 'slow' ? "text-amber-400 border-amber-900/50 bg-amber-900/20" : "text-emerald-600 border-emerald-900/50"
                                                                    )}>
                                                                        {task.routingPath}
                                                                    </div>
                                                                </div>
                                                                <div className="text-emerald-700 text-[10px] leading-relaxed italic mb-1">{task.assignedSpecialist}</div>
                                                                <div className="text-emerald-500/80 text-[10px] leading-relaxed">{task.instruction}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : viewMode === 'edit' ? (
                                // --- PRIMA MATERIA EDITOR ---
                                <textarea
                                    value={documentContent}
                                    onChange={(e) => setDocumentContent(e.target.value)}
                                    onBlur={() => engine.saveSession()}
                                    className="w-full h-full bg-transparent border-none p-3 text-sm font-mono text-emerald-100 focus:outline-none resize-none"
                                    placeholder="Enter your specification or goal..."
                                    disabled={isProcessing}
                                />
                            ) : (
                                <CyberpunkPreview content={documentContent} />
                            )}
                        </div>

                        {/* REFINE ACTION BUTTONS */}
                        {isProcessing ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { playClick(); useOuroborosStore.getState().setStatus('paused'); }}
                                    onMouseEnter={() => playHover()}
                                    className="flex-1 py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-amber-900/20 text-amber-400 border border-amber-800 hover:bg-amber-900/40"
                                >
                                    <Pause className="w-4 h-4" />
                                    PAUSE
                                </button>
                                <button
                                    onClick={handleStop}
                                    onMouseEnter={() => playHover()}
                                    className="px-4 py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/40"
                                    title="Abort Execution"
                                >
                                    <StopCircle className="w-4 h-4" />
                                </button>
                            </div>
                        ) : status === 'paused' ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { playClick(); engine.processGraph(); }}
                                    onMouseEnter={() => playHover()}
                                    className="flex-1 py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-emerald-100 text-black border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-white"
                                >
                                    <Play className="w-4 h-4" />
                                    RESUME FACTORY
                                </button>
                                <button
                                    onClick={handleStop}
                                    onMouseEnter={() => playHover()}
                                    className="px-4 py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/40"
                                    title="Abort Execution"
                                >
                                    <StopCircle className="w-4 h-4" />
                                </button>
                            </div>
                        ) : prismAnalysis ? (
                            // IF PRISM ANALYSIS EXISTS: START FACTORY
                            // IF PRISM ANALYSIS EXISTS: START OR RESUME
                            <div className="grid grid-cols-5 gap-2">
                                {verifiedBricks.length > 0 ? (
                                    <button
                                        onClick={() => { playClick(); engine.resumeCurrentWorkbench(); }}
                                        onMouseEnter={() => playHover()}
                                        className="col-span-2 py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-emerald-100 text-black border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-white"
                                    >
                                        <Play className="w-4 h-4" />
                                        RESUME FACTORY
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { playClick(); engine.startExecution(); }}
                                        onMouseEnter={() => playHover()}
                                        className="col-span-2 py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-emerald-100 text-black border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-white"
                                    >
                                        <Flame className="w-4 h-4" />
                                        START FACTORY
                                    </button>
                                )}
                                <button
                                    onClick={() => { playClick(); engine.downloadProject('markdown'); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-1 py-3 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1 bg-blue-900/20 text-blue-400 border border-blue-800 hover:bg-blue-900/40"
                                    title="Download Project Bible (Markdown)"
                                >
                                    <Download className="w-3 h-3" />
                                    MD
                                </button>
                                <button
                                    onClick={() => { playClick(); engine.downloadProject('json'); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-1 py-3 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1 bg-purple-900/20 text-purple-400 border border-purple-800 hover:bg-purple-900/40"
                                    title="Download Project Data (JSON)"
                                >
                                    <Workflow className="w-3 h-3" />
                                    JSON
                                </button>
                                <button
                                    onClick={() => { playClick(); engine.downloadProject('scaffold'); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-1 py-3 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1 bg-emerald-900/20 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/40"
                                    title="Download Project Scaffold (ZIP)"
                                >
                                    <FolderArchive className="w-3 h-3" />
                                    ZIP
                                </button>
                            </div>
                        ) : manifestation || projectPlan.length > 0 ? (
                            // IF RESULTS EXIST: RE-INITIALIZE + DOWNLOADS (Including Scaffold ZIP)
                            <div className="grid grid-cols-5 gap-2">
                                <button
                                    onClick={() => { playClick(); engine.startRefinement(documentContent); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-2 py-2 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 bg-amber-900/20 text-amber-400 border border-amber-800 hover:bg-amber-900/40"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    RE-INITIALIZE
                                </button>
                                <button
                                    onClick={() => { playClick(); engine.downloadProject('markdown'); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-1 py-2 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1 bg-blue-900/20 text-blue-400 border border-blue-800 hover:bg-blue-900/40"
                                    title="Download Project Bible (Markdown)"
                                >
                                    <Download className="w-3 h-3" />
                                    MD
                                </button>
                                <button
                                    onClick={() => { playClick(); engine.downloadProject('json'); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-1 py-2 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1 bg-purple-900/20 text-purple-400 border border-purple-800 hover:bg-purple-900/40"
                                    title="Download Project Data (JSON)"
                                >
                                    <Workflow className="w-3 h-3" />
                                    JSON
                                </button>
                                <button
                                    onClick={() => { playClick(); engine.downloadProject('scaffold'); }}
                                    onMouseEnter={() => playHover()}
                                    className="col-span-1 py-2 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1 bg-emerald-900/20 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/40"
                                    title="Download Project Scaffold (ZIP)"
                                >
                                    <FolderArchive className="w-3 h-3" />
                                    ZIP
                                </button>
                            </div>
                        ) : (
                            // DEFAULT: GENERATE TASK PLAN (Genesis -> Prism -> Saboteur)
                            <button
                                onClick={() => { playClick(); engine.startRefinement(documentContent); }}
                                onMouseEnter={() => playHover()}
                                className="w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                disabled={!documentContent.trim()}
                            >
                                <Sparkles className="w-4 h-4" />
                                GENESIS → PRISM → FACTORY
                            </button>
                        )}
                    </>
                ) : (
                    // --- MANIFEST MODE: Task Decomposition for IDE Agents (Coming Soon) ---
                    <div className="space-y-2 flex flex-col h-full">
                        {/* Manifest Header */}
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-amber-600 tracking-wider">
                                🚀 TASK EXPORT FOR IDE AGENTS
                            </span>
                            <button onClick={handleReset} onMouseEnter={() => playHover()} className="text-emerald-700 hover:text-emerald-400" title="Reset Session">
                                <RotateCcw className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Manifest Content - Placeholder */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 mb-4 border border-amber-900/30 rounded bg-[#050505]">
                            <div className="h-full flex flex-col items-center justify-center text-amber-800/50 gap-4 p-8">
                                <Workflow className="w-16 h-16 opacity-20" />
                                <div className="text-center max-w-sm">
                                    <p className="font-bold text-lg text-amber-600/80 mb-2">COMING SOON</p>
                                    <p className="text-xs text-amber-700/60 leading-relaxed">
                                        This page will take your completed Project Soul and break it into a
                                        <strong className="text-amber-500"> massive set of sequential tasks</strong>
                                        formatted for IDE agents like Cursor, Windsurf, or Claude Code.
                                    </p>
                                    <p className="text-[10px] text-amber-900/60 mt-4">
                                        For now, use the <span className="font-bold text-emerald-500">REFINE</span> page to generate your project.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Manifest Action Buttons - Disabled Placeholder */}
                        <button
                            disabled
                            className="w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-amber-900/10 text-amber-800/50 border border-amber-900/30 cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            EXPORT TO IDE AGENT (COMING SOON)
                        </button>
                    </div>
                )}
            </div>

            {/* Original Prompt Modal Overlay */}
            {showOriginalPrompt && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowOriginalPrompt(false)}>
                    <div
                        className="bg-[#0a0a0a] border border-cyan-900/50 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-4 border-b border-cyan-900/30">
                            <div>
                                <h2 className="text-sm font-bold text-cyan-400 tracking-wider">📝 ORIGINAL PRIMA MATERIA</h2>
                                <p className="text-[10px] text-cyan-700 mt-1">The original input before factory processing</p>
                            </div>
                            <button
                                onClick={() => setShowOriginalPrompt(false)}
                                className="text-cyan-700 hover:text-cyan-400 p-1 rounded hover:bg-cyan-900/20 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <pre className="text-sm text-cyan-100/90 whitespace-pre-wrap font-mono leading-relaxed">
                                {originalRequirements || documentContent || "No original prompt found."}
                            </pre>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 border-t border-cyan-900/30 flex justify-end">
                            <button
                                onClick={() => setShowOriginalPrompt(false)}
                                className="text-xs font-bold text-cyan-600 hover:text-cyan-400 px-4 py-2 rounded border border-cyan-900/30 hover:border-cyan-700 transition-colors"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
