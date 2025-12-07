import React, { useState, useEffect, useRef } from 'react';
import { Settings, RefreshCw, Flame, Workflow, CheckCircle, StopCircle, RotateCcw, Sparkles, Download, Play, Eye, Edit2, ChevronRight } from 'lucide-react';
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
        council,
        toggleCouncilMember,
        documentContent,
        setDocumentContent,
        projectPlan,
        manifestation,
        resetSession,
        toggleOracle,
        isOracleActive,
        clarityScore,
        oracleChatHistory
    } = useOuroborosStore();

    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
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
                            <div className="text-[10px] text-emerald-600 font-mono">v2.1 // RECURSIVE PROTOCOL</div>
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
                    <>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-emerald-600 tracking-wider">PRIMA MATERIA</span>
                            <div className="flex gap-2 items-center">
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
                                <div className="w-px h-4 bg-emerald-900/50 mx-1" />
                                <button
                                    onClick={() => { playClick(); setViewMode(viewMode === 'edit' ? 'preview' : 'edit'); }}
                                    onMouseEnter={() => playHover()}
                                    className={clsx(
                                        "text-xs font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors",
                                        viewMode === 'preview' ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700" : "text-emerald-700 hover:text-emerald-400"
                                    )}
                                    title={viewMode === 'edit' ? "Switch to Preview" : "Switch to Editor"}
                                >
                                    {viewMode === 'edit' ? <Eye className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                                    {viewMode === 'edit' ? "PREVIEW" : "EDIT"}
                                </button>
                                <div className="w-px h-4 bg-emerald-900/50 mx-1" />
                                <button onClick={handleReset} onMouseEnter={() => playHover()} className="text-emerald-700 hover:text-emerald-400" title="Reset Session">
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 mb-4 border border-emerald-900/30 rounded bg-[#080a08]">
                            {isOracleActive ? (
                                <OracleChat />
                            ) : viewMode === 'edit' ? (
                                <textarea
                                    value={documentContent}
                                    onChange={(e) => setDocumentContent(e.target.value)}
                                    onBlur={() => engine.saveSession()} // Save on blur
                                    className="w-full h-full bg-transparent border-none p-3 text-sm font-mono text-emerald-100 focus:outline-none resize-none"
                                    placeholder="Enter your specification or goal..."
                                    disabled={isProcessing}
                                />
                            ) : (
                                <CyberpunkPreview content={documentContent} />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-2 flex flex-col h-full">
                        {/* MANIFEST CONTROLS */}
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-amber-600 tracking-wider">MANIFESTATION LOG</span>
                            <div className="flex gap-2">
                                {/* TRANSFORM TOGGLE */}
                                {projectPlan.length > 0 && (
                                    <button
                                        onClick={() => { playClick(); setViewMode(viewMode === 'edit' ? 'preview' : 'edit'); }}
                                        onMouseEnter={() => playHover()}
                                        className={clsx(
                                            "text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors",
                                            viewMode === 'preview' ? "bg-amber-900/40 text-amber-400 border border-amber-700" : "text-amber-700 hover:text-amber-400"
                                        )}
                                        title={viewMode === 'edit' ? "View Transformed Plan" : "View Raw Logs"}
                                    >
                                        {viewMode === 'edit' ? <Sparkles className="w-3 h-3" /> : <Workflow className="w-3 h-3" />}
                                        {viewMode === 'edit' ? "VIEW DOC" : "VIEW PLAN"}
                                    </button>
                                )}
                                <div className="w-px h-4 bg-emerald-900/50 mx-1" />
                                <button onClick={handleReset} onMouseEnter={() => playHover()} className="text-emerald-700 hover:text-emerald-400" title="Reset Session">
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 mb-4 border border-emerald-900/30 rounded bg-[#050505]">
                            {(viewMode === 'preview' || (!manifestation && projectPlan.length > 0)) && projectPlan.length > 0 ? (
                                <TaskListViewer tasks={projectPlan} />
                            ) : manifestation ? (
                                <CyberpunkPreview content={manifestation} />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-emerald-800/50 gap-4 p-4">
                                    <Sparkles className="w-12 h-12 opacity-20" />
                                    <div className="text-center">
                                        <p className="font-bold text-sm">NO MANIFESTATION FOUND</p>
                                        <p className="text-xs">Execute a plan to generate directives.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ACTION BUTTONS */}
                        {isProcessing ? (
                            <button
                                onClick={handleStop}
                                onMouseEnter={() => playHover()}
                                className="w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/40"
                            >
                                <StopCircle className="w-4 h-4" />
                                ABORT
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => { playClick(); engine.startPlanning(documentContent); }}
                                    onMouseEnter={() => playHover()}
                                    className="w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-amber-900/20 text-amber-400 border border-amber-800 hover:bg-amber-900/40"
                                >
                                    <Play className="w-4 h-4" />
                                    EXECUTE PLAN
                                </button>

                                {projectPlan.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        <button
                                            onClick={() => { playClick(); engine.generateManifestation(); }}
                                            onMouseEnter={() => playHover()}
                                            className="col-span-2 py-2 rounded font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 bg-emerald-900/20 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/40"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            GENERATE DOC
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
                                            title="Download Project Plan (JSON)"
                                        >
                                            <Workflow className="w-3 h-3" />
                                            JSON
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* CONTROLS */}
                {
                    appMode === 'refine' ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-emerald-900/10 border border-emerald-900/30 rounded">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[0.625rem] font-bold text-emerald-500 uppercase">The Council</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(DEPARTMENTS).map(dept => (
                                        <button
                                            key={dept}
                                            onClick={() => { playClick(); toggleCouncilMember(dept); }}
                                            onMouseEnter={() => playHover()}
                                            className={clsx(
                                                "flex-1 min-w-[80px] flex items-center justify-center gap-2 px-2 py-2 rounded border text-[0.625rem] transition-all font-mono uppercase",
                                                council[dept]
                                                    ? "bg-emerald-900/40 border-emerald-600 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                                    : "border-emerald-900/30 text-emerald-800 hover:border-emerald-700 bg-black/20"
                                            )}
                                        >
                                            {/* Cyberpunk Chip Style - No Checkmark */}
                                            {DEPARTMENTS[dept as keyof typeof DEPARTMENTS].label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {isProcessing ? (
                                    <button
                                        onClick={handleStop}
                                        onMouseEnter={() => playHover()}
                                        className="w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/40"
                                    >
                                        <StopCircle className="w-4 h-4" />
                                        ABORT
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { playClick(); engine.startRefinement(documentContent, Object.keys(council).filter(k => council[k])); }}
                                        onMouseEnter={() => playHover()}
                                        className="w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                    >
                                        <Flame className="w-4 h-4" />
                                        SUMMON COUNCIL
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : null
                }
            </div >
        </div >
    );
};
