import React from 'react';
import { Settings, RefreshCw, Flame, Workflow, CheckCircle } from 'lucide-react';
import { AppMode, PlanItem } from '../types';
import { DEPARTMENTS } from '../constants';

interface ControlPanelProps {
    appMode: AppMode;
    setAppMode: (mode: AppMode) => void;
    cycleCount: number;
    setShowSettings: (show: boolean) => void;
    isProcessing: boolean;
    selectedDepts: Record<string, boolean>;
    setSelectedDepts: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    autoLoop: boolean;
    setAutoLoop: (loop: boolean) => void;
    documentContent: string;
    setDocumentContent: (content: string) => void;
    projectPlan: PlanItem[];
    startRefinement: () => void;
    startPlanning: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    appMode, setAppMode, cycleCount, setShowSettings, isProcessing,
    selectedDepts, setSelectedDepts, autoLoop, setAutoLoop,
    documentContent, setDocumentContent, projectPlan,
    startRefinement, startPlanning
}) => {
    return (
        <div className="w-[450px] flex flex-col border-r border-emerald-900/30 bg-[#020402]">
            {/* HEADER */}
            <div className="p-4 border-b border-emerald-900/30 flex flex-col gap-4 bg-[#050505]">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🐍</span>
                        <div>
                            <h1 className="font-bold text-emerald-100 tracking-wider text-sm">THE OUROBOROS ENGINE</h1>
                            <div className="text-[10px] text-emerald-600 font-mono">v2.0 // RECURSIVE PROTOCOL</div>
                        </div>
                    </div>
                    <button onClick={() => setShowSettings(true)} className="text-emerald-700 hover:text-emerald-400">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setAppMode('refine')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${appMode === 'refine' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'text-emerald-800 hover:text-emerald-600 border border-transparent'}`}
                    >
                        REFINE
                    </button>
                    <button
                        onClick={() => setAppMode('plan')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${appMode === 'plan' ? 'bg-amber-900/50 text-amber-400 border border-amber-700' : 'text-emerald-800 hover:text-emerald-600 border border-transparent'}`}
                    >
                        MANIFEST
                    </button>
                </div>
            </div>

            {/* INPUT AREA */}
            <div className="flex-1 p-4 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-emerald-600 tracking-wider">PRIMA MATERIA</span>
                    {cycleCount > 0 && <span className="text-[10px] text-emerald-500">Cycle: {cycleCount}</span>}
                </div>
                <textarea
                    value={documentContent}
                    onChange={(e) => setDocumentContent(e.target.value)}
                    className="flex-1 bg-[#080a08] border border-emerald-900/30 rounded p-3 text-xs font-mono text-emerald-100 focus:outline-none focus:border-emerald-700 resize-none mb-4"
                    placeholder="Enter your specification or goal..."
                    disabled={isProcessing}
                />

                {/* CONTROLS */}
                {appMode === 'refine' ? (
                    <div className="space-y-4">
                        <div className="p-3 bg-emerald-900/10 border border-emerald-900/30 rounded">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase">The Squad</span>
                                <div
                                    onClick={() => setAutoLoop(!autoLoop)}
                                    className={`cursor-pointer flex items-center gap-1.5 text-[10px] ${autoLoop ? 'text-emerald-400' : 'text-emerald-800'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${autoLoop ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-900'}`} />
                                    AUTO-LOOP
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.keys(DEPARTMENTS).map(dept => (
                                    <button
                                        key={dept}
                                        onClick={() => setSelectedDepts(p => ({ ...p, [dept]: !p[dept] }))}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] transition-all ${selectedDepts[dept] ? 'bg-emerald-900/40 border-emerald-600 text-emerald-200' : 'border-emerald-900/30 text-emerald-800 hover:border-emerald-700'}`}
                                    >
                                        <CheckCircle className={`w-3 h-3 ${selectedDepts[dept] ? 'opacity-100' : 'opacity-0'}`} />
                                        {DEPARTMENTS[dept as keyof typeof DEPARTMENTS].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={startRefinement}
                            disabled={isProcessing}
                            className={`w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-emerald-900/20 text-emerald-800 cursor-not-allowed' : 'bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]'}`}
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                            {isProcessing ? 'DELIBERATING...' : 'SUMMON COUNCIL'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 border border-emerald-900/30 rounded p-2 bg-[#080a08]">
                            {projectPlan.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-emerald-900">
                                    <Workflow className="w-8 h-8 mb-2 opacity-20" />
                                    <span className="text-xs">No active manifestation</span>
                                </div>
                            ) : (
                                projectPlan.map(item => (
                                    <div key={item.id} className="p-2 bg-emerald-900/10 border border-emerald-900/30 rounded">
                                        <div className="text-[10px] font-bold text-amber-500 mb-1">{item.title}</div>
                                        {item.children?.map(child => (
                                            <div key={child.id} className="pl-2 border-l border-emerald-800 mt-1 text-[10px] text-emerald-400/70">
                                                {child.title}
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={startPlanning}
                            disabled={isProcessing}
                            className={`w-full py-3 rounded font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-amber-900/20 text-amber-800 cursor-not-allowed' : 'bg-amber-900/50 hover:bg-amber-800 text-amber-100 border border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.2)]'}`}
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Workflow className="w-4 h-4" />}
                            {isProcessing ? 'MANIFESTING...' : 'EXECUTE PLAN'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
