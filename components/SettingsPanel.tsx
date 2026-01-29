import React, { useState, useEffect } from 'react';
import { Settings, X, Zap, Gauge, Info, Download, Upload, Shield, Bug, FolderOpen, Terminal } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import { OuroborosEngine } from '../engine/OuroborosEngine';
import { AppSettings } from '../types';
import { MODELS } from '../constants';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useOuroborosStore } from '../store/ouroborosStore';
import { SessionCodex } from './SessionCodex';
import { HydraTierEditor } from './settings/HydraTierEditor';

interface SettingsPanelProps {
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
    const settings = useLiveQuery(() => db.settings.get(1)) || {} as AppSettings;
    const onUpdate = (newSettings: Partial<AppSettings>) => {
        OuroborosEngine.getInstance().updateSettings(newSettings);
    };
    const [showLimitsInfo, setShowLimitsInfo] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<'all' | 'google' | 'openai' | 'groq'>('all');
    const [activeTab, setActiveTab] = useState<'config' | 'codex'>('config');
    const [showHydraEditor, setShowHydraEditor] = useState(false);
    const engine = OuroborosEngine.getInstance();
    const { playClick, playHover } = useSoundEffects();
    const { usageMetrics } = useOuroborosStore();



    const handleExport = async () => {
        playClick();
        const json = await engine.exportDatabase();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ouroboros_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        playClick();
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (text) {
                if (confirm("This will overwrite your current session. Continue?")) {
                    await engine.importDatabase(text);
                    onClose();
                }
            }
        };
        reader.readAsText(file);
    };

    const mainContent = (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-[#0a0c0a] border border-emerald-900/80 rounded-lg w-full max-w-lg shadow-2xl p-6 relative max-h-full overflow-y-auto custom-scrollbar">
                <button
                    onClick={() => { playClick(); onClose(); }}
                    onMouseEnter={() => playHover()}
                    className="absolute top-4 right-4 text-emerald-700 hover:text-emerald-400"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4 mb-6 border-b border-emerald-900/50 pb-2">
                    <button
                        onClick={() => { playClick(); setActiveTab('config'); }}
                        className={`text-sm font-bold flex items-center gap-2 pb-1 ${activeTab === 'config' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-emerald-700 hover:text-emerald-500'}`}
                    >
                        <Settings className="w-4 h-4" /> CONFIG
                    </button>
                    <button
                        onClick={() => { playClick(); setActiveTab('codex'); }}
                        className={`text-sm font-bold flex items-center gap-2 pb-1 ${activeTab === 'codex' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-emerald-700 hover:text-emerald-500'}`}
                    >
                        <FolderOpen size={16} /> SESSION CODEX
                    </button>
                </div>

                {activeTab === 'config' ? (
                    <>
                        <div className="space-y-6">
                            {/* MODEL SELECTION */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> SELECT MODEL
                                    </label>
                                    <div className="flex gap-1">
                                        {['all', 'google', 'openai', 'openrouter', 'groq'].map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setSelectedProvider(p as any)}
                                                className={`text-[10px] px-2 py-0.5 rounded border ${selectedProvider === p
                                                    ? 'bg-emerald-900/50 border-emerald-500 text-emerald-300'
                                                    : 'bg-black border-emerald-900/30 text-emerald-700 hover:text-emerald-500'
                                                    }`}
                                            >
                                                {p.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {MODELS.filter(m => selectedProvider === 'all' || m.provider === selectedProvider).map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                playClick();
                                                const newModel = MODELS.find(m => m.id === model.id);
                                                onUpdate({
                                                    model: model.id,
                                                    rpm: newModel?.rpm || 60,
                                                    rpd: newModel?.rpd || 10000
                                                });
                                            }}
                                            onMouseEnter={() => playHover()}
                                            className={`text-left p-3 rounded border transition-all ${settings.model === model.id
                                                ? 'bg-emerald-900/30 border-emerald-500 text-emerald-100'
                                                : 'bg-black border-emerald-900/50 text-emerald-600 hover:bg-emerald-900/10'
                                                }`}
                                        >
                                            <div className="font-bold text-sm">{model.label}</div>
                                            <div className="text-[10px] opacity-70">{model.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* TIERED MODEL CONFIGURATION */}
                            <div className="space-y-3 pt-4 border-t border-emerald-900/30">
                                <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                    <Zap className="w-3 h-3" /> TIERED MODEL CONFIGURATION
                                </label>

                                {/* Quick Templates */}
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={() => {
                                            playClick();
                                            onUpdate({
                                                // Legacy settings
                                                model_specialist: '', model_lead: '', model_architect: '',
                                                model_synthesizer: '', model_judge: '', model_manifestation: '', model_prism: '',
                                                // V2.99 settings (clears stale values)
                                                model_reflexion: '', model_antagonist: '', model_compiler: '',
                                                model_genesis: '', model_oracle: '', model_fast: ''
                                            });
                                        }}
                                        onMouseEnter={() => playHover()}
                                        className="px-2 py-1 bg-emerald-900/20 border border-emerald-900/50 rounded text-[10px] text-emerald-400 hover:bg-emerald-900/40"
                                    >
                                        Reset (Balanced)
                                    </button>
                                    <button
                                        onClick={() => {
                                            playClick();
                                            onUpdate({
                                                model_specialist: 'gemini-2.5-flash',
                                                model_lead: 'gemini-2.5-flash',
                                                model_architect: 'gemini-2.5-pro',
                                                model_synthesizer: 'gemini-2.5-pro',
                                                model_judge: 'gemini-2.5-pro',
                                                model_manifestation: 'gemini-2.5-flash',
                                                model_prism: 'gemini-2.5-pro'
                                            });
                                        }}
                                        onMouseEnter={() => playHover()}
                                        className="px-2 py-1 bg-purple-900/20 border border-purple-900/50 rounded text-[10px] text-purple-400 hover:bg-purple-900/40"
                                    >
                                        Genius Core
                                    </button>
                                    <button
                                        onClick={() => {
                                            playClick();
                                            onUpdate({
                                                model_specialist: 'gemini-3-flash',
                                                model_lead: 'gemini-3-flash',
                                                model_architect: 'gemini-3-flash',
                                                model_synthesizer: 'gemini-3-flash',
                                                model_judge: 'gemini-3-flash',
                                                model_manifestation: 'gemini-3-flash',
                                                model_prism: 'gemini-3-flash'
                                            });
                                        }}
                                        onMouseEnter={() => playHover()}
                                        className="px-2 py-1 bg-amber-900/20 border border-amber-900/50 rounded text-[10px] text-amber-400 hover:bg-amber-900/40"
                                    >
                                        Gemini 3 Speed
                                    </button>
                                    <button
                                        onClick={() => {
                                            playClick();
                                            onUpdate({
                                                model_specialist: 'gemma-3-4b',
                                                model_lead: 'gemma-3-12b',
                                                model_architect: 'gemma-3-27b',
                                                model_synthesizer: 'gemma-3-27b',
                                                model_judge: 'gemma-3-27b',
                                                model_manifestation: 'gemma-3-12b',
                                                model_prism: 'gemma-3-27b'
                                            });
                                        }}
                                        onMouseEnter={() => playHover()}
                                        className="px-2 py-1 bg-blue-900/20 border border-blue-900/50 rounded text-[10px] text-blue-400 hover:bg-blue-900/40"
                                    >
                                        Free Tier (Gemma)
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    {/* REFINE MODE */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold text-emerald-500 border-b border-emerald-900/50 pb-1 mb-2">REFINE MODE (The Council)</h4>
                                        {[
                                            { label: 'Genesis (Originator)', key: 'model_genesis' },
                                            { label: 'Prism (Decomposer)', key: 'model_prism' },
                                            { label: 'Oracle (Interviewer)', key: 'model_oracle' },
                                            { label: 'Tribunal (Antagonist)', key: 'model_antagonist' },
                                            { label: 'Synthesizer (Alchemist)', key: 'model_synthesizer' },
                                        ].map(({ label, key }) => (
                                            <div key={`refine_${key}`} className="space-y-1">
                                                <label className="text-[10px] text-emerald-600 font-bold">{label}</label>
                                                <select
                                                    value={(settings[key as keyof AppSettings] as string) || ""}
                                                    onChange={(e) => onUpdate({ [key]: e.target.value })}
                                                    className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                                >
                                                    <option value="">Default ({MODELS.find(m => m.id === settings.model)?.label})</option>
                                                    {/* Show current value if it's not in the list (e.g. legacy/stale setting) */}
                                                    {settings[key as keyof AppSettings] && !MODELS.find(m => m.id === settings[key as keyof AppSettings]) && (
                                                        <option value={settings[key as keyof AppSettings] as string}>
                                                            {settings[key as keyof AppSettings] as string} (Legacy/Unknown)
                                                        </option>
                                                    )}
                                                    {MODELS.filter(m => selectedProvider === 'all' || m.provider === selectedProvider).map(m => (
                                                        <option key={m.id} value={m.id}>{m.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>

                                    {/* MANIFEST MODE */}
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold text-amber-500 border-b border-amber-900/50 pb-1 mb-2">MANIFEST MODE (The Builder)</h4>
                                        {[
                                            { label: 'Specialist (Worker)', key: 'model_specialist' },
                                            { label: 'Architect (Planner)', key: 'model_architect' },
                                            { label: 'Reflexion (Fast/Repair)', key: 'model_reflexion' },
                                            { label: 'Manifestation (Compiler)', key: 'model_manifestation' },
                                            { label: 'General Fast (Utility)', key: 'model_fast' },
                                        ].map(({ label, key }) => (
                                            <div key={`manifest_${key}`} className="space-y-1">
                                                <label className="text-[10px] text-emerald-600 font-bold">{label}</label>
                                                <select
                                                    value={(settings[key as keyof AppSettings] as string) || ""}
                                                    onChange={(e) => onUpdate({ [key]: e.target.value })}
                                                    className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                                >
                                                    <option value="">Default ({MODELS.find(m => m.id === settings.model)?.label})</option>
                                                    {/* Show current value if it's not in the list (e.g. legacy/stale setting) */}
                                                    {settings[key as keyof AppSettings] && !MODELS.find(m => m.id === settings[key as keyof AppSettings]) && (
                                                        <option value={settings[key as keyof AppSettings] as string}>
                                                            {settings[key as keyof AppSettings] as string} (Legacy/Unknown)
                                                        </option>
                                                    )}
                                                    {MODELS.filter(m => selectedProvider === 'all' || m.provider === selectedProvider).map(m => (
                                                        <option key={m.id} value={m.id}>{m.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))
                                        }
                                    </div>
                                </div>
                            </div>

                            {/* HYDRA PROTOCOL */}
                            <div className="space-y-3 pt-4 border-t border-emerald-900/30">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                        <Shield className="w-3 h-3 text-amber-500" /> HYDRA FAILOVER PROTOCOL
                                    </label>
                                    <button
                                        onClick={() => { playClick(); setShowHydraEditor(true); }}
                                        className="text-[10px] text-amber-500 hover:text-amber-400 font-bold border border-amber-900/50 px-2 py-1 rounded bg-amber-900/10"
                                    >
                                        EDIT FALLBACK MODELS
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                        <span className="text-xs text-emerald-400">Auto-Failover</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.hydraSettings?.autoFailover ?? true}
                                            onChange={(e) => onUpdate({ hydraSettings: { ...(settings.hydraSettings || { maxRetries: 2, fallbackStrategy: 'cost' } as any), autoFailover: e.target.checked } })}
                                            className="accent-amber-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                        <span className="text-xs text-emerald-400">Strategy</span>
                                        <select
                                            value={settings.hydraSettings?.fallbackStrategy ?? 'cost'}
                                            onChange={(e) => onUpdate({ hydraSettings: { ...(settings.hydraSettings || { maxRetries: 2, autoFailover: true } as any), fallbackStrategy: e.target.value as any } })}
                                            className="bg-black text-amber-500 text-[10px] border-none focus:ring-0 text-right focus:outline-none"
                                        >
                                            <option value="cost">Cost First</option>
                                            <option value="speed">Speed First</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* V2.99 PROTOCOLS */}
                            <div className="space-y-3 pt-4 border-t border-emerald-900/30">
                                <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                    <Shield className="w-3 h-3" /> V2.99 FACTORY PROTOCOLS
                                </label>
                                <p className="text-[10px] text-emerald-800 italic">
                                    Core safety protocols are mandatory. Quality strictness is configurable via Turbo Mode.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                        <span className="text-xs text-emerald-400">Red Flagging</span>
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            disabled
                                            className="accent-emerald-500 opacity-50"
                                            title="Safety is not optional"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                        <span className="text-xs text-emerald-400">Antagonist Protocol</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.enableAntagonistProtocol ?? true}
                                            onChange={(e) => onUpdate({ enableAntagonistProtocol: e.target.checked })}
                                            className="accent-emerald-500"
                                            title="Toggle Tribunal (Antagonist) audit"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                        <span className="text-xs text-emerald-400">Agent Memory</span>
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            disabled
                                            className="accent-emerald-500 opacity-50"
                                            title="Learning is not optional"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-black border border-amber-900/50 rounded">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-amber-500 font-bold">Allow Code Gen</span>
                                            <span className="text-[9px] text-amber-600/70">Experimental</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.allowCodeGeneration || false}
                                            onChange={(e) => onUpdate({ allowCodeGeneration: e.target.checked })}
                                            className="accent-amber-500"
                                            title="Allow implementation code generation (Bypasses Security Veto)"
                                        />
                                    </div>

                                    {/* V2.99 Final Gaps Features */}
                                    <div className="flex flex-col p-2 bg-black border border-emerald-900 rounded col-span-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-emerald-400">Adaptive Routing</span>
                                                <span className="text-[9px] text-emerald-600">Smart routing by complexity</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={settings.enableAdaptiveRouting || false}
                                                onChange={(e) => onUpdate({ enableAdaptiveRouting: e.target.checked })}
                                                className="accent-emerald-500"
                                            />
                                        </div>
                                        {settings.enableAdaptiveRouting && (
                                            <div className="space-y-1 mt-1 border-t border-emerald-900/30 pt-1">
                                                <label className="text-[9px] text-emerald-600 font-bold">Fast Model (Low Complexity)</label>
                                                <select
                                                    value={settings.model_fast || ""}
                                                    onChange={(e) => onUpdate({ model_fast: e.target.value })}
                                                    className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-[10px] focus:border-emerald-500 focus:outline-none"
                                                >
                                                    <option value="">Use Default ({MODELS.find(m => m.id === settings.model)?.label})</option>
                                                    {MODELS.filter(m => selectedProvider === 'all' || m.provider === selectedProvider).map(m => (
                                                        <option key={m.id} value={m.id}>{m.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-emerald-400">Predictive Cost Scaling</span>
                                            <span className="text-[9px] text-emerald-600">Auto-upgrade on failure</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={settings.enablePredictiveCostScaling || false}
                                            onChange={(e) => onUpdate({ enablePredictiveCostScaling: e.target.checked })}
                                            className="accent-emerald-500"
                                        />
                                    </div>

                                    {/* Consistency Layer Settings */}
                                    <div className="flex flex-col p-2 bg-black border border-emerald-900 rounded col-span-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-emerald-400">Project Insight (Consistency)</span>
                                                <span className="text-[9px] text-emerald-600">Mid-term memory synthesizer</span>
                                            </div>
                                            <div className="text-[9px] text-emerald-500 italic">Always Active</div>
                                        </div>
                                        <div className="space-y-1 mt-1 border-t border-emerald-900/30 pt-1">
                                            <label className="text-[9px] text-emerald-600 font-bold">Historian Model</label>
                                            <select
                                                value={settings.model_project_insight || ""}
                                                onChange={(e) => onUpdate({ model_project_insight: e.target.value })}
                                                className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-[10px] focus:border-emerald-500 focus:outline-none"
                                            >
                                                <option value="">Use Default ({MODELS.find(m => m.id === settings.model)?.label})</option>
                                                {MODELS.filter(m => selectedProvider === 'all' || m.provider === selectedProvider).map(m => (
                                                    <option key={m.id} value={m.id}>{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Disabled Red Flags */}
                                    <div className="col-span-2 p-2 bg-black border border-emerald-900 rounded mt-1">
                                        <span className="text-xs text-emerald-400 font-bold block mb-2">Disable Specific Red Flags</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'too_short', label: 'Too Short (<50 chars)' },
                                                { id: 'too_generic', label: 'Too Generic (Placeholders)' },
                                                { id: 'contradictory', label: 'Contradictory' },
                                                { id: 'low_confidence', label: 'Low Confidence' }
                                            ].map(flag => (
                                                <label key={flag.id} className="flex items-center gap-2 cursor-pointer hover:bg-emerald-900/10 rounded p-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.disabledRedFlags?.includes(flag.id as any) || false}
                                                        onChange={(e) => {
                                                            const current = settings.disabledRedFlags || [];
                                                            if (e.target.checked) {
                                                                onUpdate({ disabledRedFlags: [...current, flag.id as any] });
                                                            } else {
                                                                onUpdate({ disabledRedFlags: current.filter(f => f !== flag.id) });
                                                            }
                                                        }}
                                                        className="accent-red-500"
                                                    />
                                                    <span className="text-[10px] text-emerald-500">{flag.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded">
                                    <span className="text-xs text-emerald-400">Pre-Seed Library (Golden Seeds)</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.enableGoldenSeeds ?? false}
                                        onChange={(e) => onUpdate({ enableGoldenSeeds: e.target.checked })}
                                        className="accent-emerald-500"
                                        title="Enable verified template matching"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-emerald-600 font-bold">Consensus Threshold (%)</label>
                                        <input
                                            type="number"
                                            min="50"
                                            max="100"
                                            value={settings.consensusThreshold || 85}
                                            onChange={(e) => onUpdate({ consensusThreshold: parseInt(e.target.value) })}
                                            className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>


                                {/* TURBO MODE (V2.99) */}
                                <div className="mt-3 pt-3 border-t border-emerald-900/30">
                                    <div className="flex items-center justify-between pb-2">
                                        <span className="text-xs text-emerald-500 font-bold flex items-center gap-1" title="Skip 'Too Generic' checks for simple tasks">
                                            <Zap className="w-3 h-3 text-amber-500" /> TURBO MODE
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={settings.turboMode || false}
                                            onChange={(e) => onUpdate({ turboMode: e.target.checked })}
                                            className="accent-amber-500"
                                            title="Force Turbo Mode ON (Skips Generic Checks)"
                                        />
                                    </div>
                                    <div className="pl-4 space-y-2 border-l-2 border-emerald-900/30">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-emerald-500" title="Automatically enable Turbo Mode for low complexity tasks (Recommended)">Auto-Enable (Smart)</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.autoTurboMode !== false}
                                                onChange={(e) => onUpdate({ autoTurboMode: e.target.checked })}
                                                className="accent-emerald-500"
                                            />
                                        </div>
                                        {(settings.autoTurboMode !== false) && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-emerald-600 font-bold" title="Tasks with complexity LOWER than this will trigger Turbo Mode">Complexity Threshold ({settings.turboComplexityThreshold || 5})</label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={settings.turboComplexityThreshold || 5}
                                                    onChange={(e) => onUpdate({ turboComplexityThreshold: parseInt(e.target.value) })}
                                                    className="w-full accent-emerald-500 h-1 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* PRISM DECOMPOSITION SETTINGS */}
                                <div className="mt-4 pt-4 border-t border-emerald-900/30">
                                    <label className="text-[10px] font-bold text-amber-500 flex items-center gap-2 mb-3" title="Controls how Prism breaks down goals into tasks">
                                        🔮 PRISM DECOMPOSITION SETTINGS
                                    </label>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Max Atomic Tasks */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-emerald-600 font-bold" title="Limit the number of tasks Prism can create (Breadth Control)">Max Atomic Tasks</label>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.maxAtomicTasks !== undefined}
                                                    onChange={(e) => onUpdate({ maxAtomicTasks: e.target.checked ? 20 : undefined })}
                                                    className="accent-amber-500 w-3 h-3"
                                                />
                                            </div>
                                            {settings.maxAtomicTasks !== undefined ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="5"
                                                        max="50"
                                                        value={settings.maxAtomicTasks}
                                                        onChange={(e) => onUpdate({ maxAtomicTasks: parseInt(e.target.value) })}
                                                        className="flex-1 accent-amber-500 h-1 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-amber-400 text-xs font-bold w-6">{settings.maxAtomicTasks}</span>
                                                </div>
                                            ) : (
                                                <div className="text-[9px] text-emerald-800 italic h-5 flex items-center">Auto-Detected (Unlimited)</div>
                                            )}
                                            <p className="text-[9px] text-emerald-800">Use for MVP or Budget constraints</p>
                                        </div>

                                        {/* Max Decomposition Passes */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-emerald-600 font-bold" title="How many times Prism re-checks and splits tasks (Depth Refinement)">Max Decomp. Passes</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={settings.maxDecompositionPasses || 3}
                                                    onChange={(e) => onUpdate({ maxDecompositionPasses: parseInt(e.target.value) })}
                                                    className="flex-1 accent-amber-500 h-1 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <span className="text-amber-400 text-xs font-bold w-6">{settings.maxDecompositionPasses || 3}</span>
                                            </div>
                                            <p className="text-[9px] text-emerald-800">Higher = More granular tasks</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        {/* Max Council Size */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-emerald-600 font-bold" title="Limit the number of specialists hired (Cost/Parallelism Control)">Max Council Size</label>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.maxCouncilSize !== undefined}
                                                    onChange={(e) => onUpdate({ maxCouncilSize: e.target.checked ? 5 : undefined })}
                                                    className="accent-amber-500 w-3 h-3"
                                                />
                                            </div>
                                            {settings.maxCouncilSize !== undefined ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="3"
                                                        max="15"
                                                        value={settings.maxCouncilSize}
                                                        onChange={(e) => onUpdate({ maxCouncilSize: parseInt(e.target.value) })}
                                                        className="flex-1 accent-amber-500 h-1 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <span className="text-amber-400 text-xs font-bold w-6">{settings.maxCouncilSize}</span>
                                                </div>
                                            ) : (
                                                <div className="text-[9px] text-emerald-800 italic h-5 flex items-center">Auto-Detected</div>
                                            )}
                                        </div>

                                        {/* Recursive Decomposition Toggle */}
                                        <div className="flex items-center justify-between p-2 bg-black border border-emerald-900 rounded mt-0">
                                            <div>
                                                <span className="text-xs text-emerald-400" title="Allow tasks to spawn their own sub-projects (Fractal Growth)">Recursive Decomp.</span>
                                                <p className="text-[9px] text-emerald-700">Explosive vertical expansion</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={settings.enableRecursiveDecomposition || false}
                                                onChange={(e) => onUpdate({ enableRecursiveDecomposition: e.target.checked })}
                                                className="accent-amber-500"
                                            />
                                        </div>

                                        {/* JSON Retry Mode */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-emerald-600 font-bold">JSON Retry Mode</label>
                                            <select
                                                value={settings.jsonRetryMode || 'prompt'}
                                                onChange={(e) => onUpdate({ jsonRetryMode: e.target.value as 'none' | 'all' | 'prompt' })}
                                                className="w-full bg-black border border-emerald-900 rounded p-1 text-amber-400 text-xs focus:border-emerald-500 focus:outline-none"
                                            >
                                                <option value="prompt">Prompt User</option>
                                                <option value="all">Auto-Retry All</option>
                                                <option value="none">Skip (No Retry)</option>
                                            </select>
                                            <p className="text-[9px] text-emerald-800">On JSON parse failure</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FONT SIZE SLIDER */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                    <Settings className="w-3 h-3" /> UI SCALE (FONT SIZE)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="12"
                                        max="24"
                                        step="1"
                                        value={settings.baseFontSize || 16}
                                        onChange={(e) => onUpdate({ baseFontSize: parseInt(e.target.value) })}
                                        className="flex-1 accent-emerald-500 h-1 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="w-8 text-center font-bold text-emerald-400">{settings.baseFontSize || 16}px</div>
                                </div>
                            </div>

                            {/* RATE LIMITS */}
                            <div className="grid grid-cols-2 gap-4 relative">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                        <Gauge className="w-3 h-3" /> MAX RPM (Requests/Min)
                                        <button
                                            onClick={() => { playClick(); setShowLimitsInfo(!showLimitsInfo); }}
                                            className="text-emerald-500 hover:text-emerald-300"
                                        >
                                            <Info className="w-3 h-3" />
                                        </button>
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.rpm}
                                        onChange={(e) => onUpdate({ rpm: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 font-bold text-sm focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                        <Gauge className="w-3 h-3" /> MAX RPD (Requests/Day)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.rpd}
                                        onChange={(e) => onUpdate({ rpd: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 font-bold text-sm focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>

                                {/* LIMITS TOOLTIP */}
                                {showLimitsInfo && (
                                    <div className="absolute top-full left-0 right-0 mt-2 z-10 bg-[#050505] border border-emerald-500/50 rounded p-4 shadow-xl text-xs text-emerald-300">
                                        <h4 className="font-bold text-emerald-400 mb-2 border-b border-emerald-900/50 pb-1">Google Free Tier Limits</h4>
                                        <div className="grid gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {MODELS.map(m => (
                                                <div key={m.id} className="flex justify-between items-center border-b border-emerald-900/30 pb-1 last:border-0">
                                                    <span className="font-bold">{m.label}</span>
                                                    <span className="text-emerald-500/80">{m.rpm} RPM | {m.rpd} RPD</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* USAGE METRICS */}
                            <div className="space-y-3 pt-4 border-t border-emerald-900/30">
                                <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                    <Gauge className="w-3 h-3" /> SESSION USAGE METRICS
                                </label>
                                <div className="bg-black border border-emerald-900 rounded p-3 text-xs max-h-40 overflow-y-auto custom-scrollbar">
                                    {Object.keys(usageMetrics || {}).length === 0 ? (
                                        <div className="text-emerald-800 italic text-center">No usage recorded this session.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {Object.entries(usageMetrics || {}).map(([modelId, metrics]) => (
                                                <div key={modelId} className="flex justify-between items-center border-b border-emerald-900/30 pb-1 last:border-0">
                                                    <span className="font-bold text-emerald-500">{MODELS.find(m => m.id === modelId)?.label || modelId}</span>
                                                    <div className="text-right">
                                                        <div className="text-emerald-300">{metrics.totalTokens.toLocaleString()} tokens</div>
                                                        <div className="text-[10px] text-emerald-700">{metrics.requestCount} requests</div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="pt-2 border-t border-emerald-500/30 flex justify-between items-center font-bold text-emerald-400">
                                                <span>TOTAL SESSION</span>
                                                <span>
                                                    {Object.values(usageMetrics || {})
                                                        .reduce((acc, m) => acc + m.totalTokens, 0).toLocaleString()} tokens
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* CONCURRENCY SLIDER */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                    <Gauge className="w-3 h-3" /> MAX CONCURRENT AGENTS (THROTTLE)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="15"
                                        value={settings.concurrency}
                                        onChange={(e) => onUpdate({ concurrency: parseInt(e.target.value) })}
                                        className="flex-1 accent-emerald-500 h-1 bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="w-8 text-center font-bold text-emerald-400">{settings.concurrency}</div>
                                </div>
                                <p className="text-[10px] text-emerald-800">
                                    Lower this value if you encounter "Quota Exceeded" (429) errors.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleExport}
                                    onMouseEnter={() => playHover()}
                                    className="flex items-center justify-center gap-2 p-2 bg-emerald-900/20 border border-emerald-900/50 rounded hover:bg-emerald-900/40 text-xs text-emerald-400 font-bold"
                                >
                                    <Download className="w-3 h-3" /> EXPORT DB
                                </button>
                                <label
                                    onMouseEnter={() => playHover()}
                                    className="flex items-center justify-center gap-2 p-2 bg-emerald-900/20 border border-emerald-900/50 rounded hover:bg-emerald-900/40 text-xs text-emerald-400 font-bold cursor-pointer"
                                >
                                    <Upload className="w-3 h-3" /> IMPORT DB
                                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                                </label>
                                <button
                                    onClick={() => { playClick(); engine.printDebugReport(); }}
                                    onMouseEnter={() => playHover()}
                                    className="flex items-center justify-center gap-2 p-2 bg-amber-900/20 border border-amber-900/50 rounded hover:bg-amber-900/40 text-xs text-amber-400 font-bold"
                                >
                                    <Terminal className="w-3 h-3" /> PRINT DEBUG
                                </button>
                                <button
                                    onClick={() => { playClick(); engine.downloadDebugReport(); }}
                                    onMouseEnter={() => playHover()}
                                    className="flex items-center justify-center gap-2 p-2 bg-red-900/20 border border-red-900/50 rounded hover:bg-red-900/40 text-xs text-red-400 font-bold"
                                >
                                    <Bug className="w-3 h-3" /> DOWNLOAD REPORT
                                </button>
                            </div>
                        </div>

                        {/* SECURITY */}
                        <div className="space-y-3 pt-4 border-t border-emerald-900/30 mt-6">
                            <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                <Shield className="w-3 h-3" /> SECURITY
                            </label>
                            <div className="flex flex-col gap-2 p-2 bg-emerald-900/10 rounded border border-emerald-900/30">
                                <div className="flex flex-col">
                                    <span className="text-xs text-emerald-400 font-bold">Google Gemini API Key</span>
                                    <span className="text-[10px] text-emerald-600">Required for AI generation.</span>
                                </div>
                                <input
                                    type="password"
                                    value={settings.apiKey || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (settings.apiKey === undefined && val !== '') {
                                            engine.setApiKey(val);
                                        } else {
                                            onUpdate({ apiKey: val });
                                            engine.setApiKey(val);
                                        }
                                    }}
                                    placeholder="Enter API Key..."
                                    className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                />

                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-emerald-500">Session-Only (Don't save to DB)</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.apiKey === undefined || settings.apiKey === ''}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const currentKey = settings.apiKey;
                                                if (currentKey) engine.setApiKey(currentKey);
                                                onUpdate({ apiKey: undefined });
                                            } else {
                                                onUpdate({ apiKey: '' });
                                            }
                                        }}
                                        className="accent-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 p-2 bg-emerald-900/10 rounded border border-emerald-900/30 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-emerald-400 font-bold">OpenAI API Key</span>
                                    <span className="text-[10px] text-emerald-600">Required for GPT/O1 models.</span>
                                </div>
                                <input
                                    type="password"
                                    value={settings.openaiApiKey || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        onUpdate({ openaiApiKey: val });
                                        engine.setOpenAIKey(val);
                                    }}
                                    placeholder="sk-..."
                                    className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2 p-2 bg-emerald-900/10 rounded border border-emerald-900/30 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-emerald-400 font-bold">OpenRouter API Key</span>
                                    <span className="text-[10px] text-emerald-600">Optional: For Grok, Llama 3, etc.</span>
                                </div>
                                <input
                                    type="password"
                                    value={settings.openRouterApiKey || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        onUpdate({ openRouterApiKey: val });
                                        engine.setOpenRouterKey(val);
                                    }}
                                    placeholder="sk-or-..."
                                    className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2 p-2 bg-emerald-900/10 rounded border border-emerald-900/30 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-emerald-400 font-bold">Groq API Key</span>
                                    <span className="text-[10px] text-emerald-600">Required for Llama 3 (Groq), Kimi, Qwen.</span>
                                </div>
                                <input
                                    type="password"
                                    value={settings.groqApiKey || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        onUpdate({ groqApiKey: val });
                                        engine.updateKeys(undefined, undefined, undefined, undefined, undefined, val);
                                    }}
                                    placeholder="gsk_..."
                                    className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            {/* LOCAL INFERENCE (OLLAMA) */}
                            <div className="flex flex-col gap-2 p-2 bg-emerald-900/10 rounded border border-emerald-900/30 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-emerald-400 font-bold">Local Inference (Ollama)</span>
                                    <span className="text-[10px] text-emerald-600">Run models locally. Requires `OLLAMA_ORIGINS="*"`</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-emerald-600 font-bold">Base URL</label>
                                        <input
                                            type="text"
                                            value={settings.localBaseUrl || 'http://localhost:11434/v1'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                onUpdate({ localBaseUrl: val });
                                                // We need to update the engine client too, but we'll do it via a useEffect or direct call if needed
                                                // For now, let's assume engine.updateSettings handles it or we add a specific setter
                                                engine.updateKeys(undefined, undefined, undefined, val, undefined);
                                            }}
                                            placeholder="http://localhost:11434/v1"
                                            className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-emerald-600 font-bold">Model ID (Power Engine)</label>
                                        <input
                                            type="text"
                                            value={settings.localModelId || 'gemma:7b'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                onUpdate({ localModelId: val });
                                                engine.updateKeys(undefined, undefined, undefined, undefined, val);
                                            }}
                                            placeholder="gemma:7b"
                                            className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-[10px] text-emerald-600 font-bold">Speed Engine (Small Model ID)</label>
                                        <input
                                            type="text"
                                            value={settings.localSmallModelId || 'gemma:2b'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                onUpdate({ localSmallModelId: val });
                                                engine.setLocalSmallModelId(val);
                                            }}
                                            placeholder="gemma:2b"
                                            className="w-full bg-black border border-emerald-900 rounded p-2 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        playClick();
                                        const url = (settings.localBaseUrl || 'http://localhost:11434/v1').replace('/v1', '');
                                        try {
                                            const res = await fetch(url);
                                            if (res.ok) {
                                                alert("Connection Successful! Ollama is running.");
                                            } else {
                                                alert(`Connection Failed: ${res.status} ${res.statusText}`);
                                            }
                                        } catch (e: any) {
                                            alert(`Connection Failed: ${e.message}. Check OLLAMA_ORIGINS env var.`);
                                        }
                                    }}
                                    className="mt-2 px-3 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-900/50 rounded text-[10px] text-emerald-400"
                                >
                                    Test Connection
                                </button>
                            </div>

                            {/* DANGER ZONE - HARD RESET */}
                            <div className="mt-4 p-3 border border-red-900/50 bg-red-950/20 rounded">
                                <div className="flex items-center gap-2 text-red-500 font-bold text-xs mb-2">
                                    <Bug className="w-4 h-4" /> DANGER ZONE
                                </div>
                                <p className="text-[10px] text-red-400/80 mb-3 leading-relaxed">
                                    If the Factory is completely stuck, use this to wipe EVERYTHING (Local Storage, Database, Cache) and force a hard reload.
                                    This cannot be undone.
                                </p>
                                <button
                                    onClick={async () => {
                                        if (confirm("⚠️ NUCLEAR LAUNCH DETECTED ⚠️\n\nThis will wipe ALL your Ouroboros data, settings, and sessions permanently.\n\nAre you sure you want to proceed?")) {
                                            playClick();
                                            // 1. Clear Database
                                            await engine.clearSession();
                                            // 2. Clear Local Storage
                                            localStorage.clear();
                                            // 3. Force Reload
                                            window.location.reload();
                                        }
                                    }}
                                    className="w-full py-2 bg-red-900/40 hover:bg-red-600 border border-red-800 text-red-200 hover:text-white font-bold text-xs rounded tracking-widest flex items-center justify-center gap-2 transition-all"
                                >
                                    <Terminal className="w-3 h-3" /> FACTORY RESET (NUKE)
                                </button>
                            </div>

                            <div className="p-2 bg-amber-900/10 border border-amber-900/30 rounded text-[10px] text-amber-500/80 italic mt-2">
                                Disclaimer: All data is stored locally in your browser (IndexedDB). Clearing browser data will wipe your Ouroboros sessions.
                            </div>
                        </div>
                    </>
                ) : (
                    <SessionCodex />
                )}

                <div className="mt-8 pt-4 border-t border-emerald-900/30 flex justify-end">
                    <button
                        onClick={() => { playClick(); onClose(); }}
                        onMouseEnter={() => playHover()}
                        className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-sm"
                    >
                        CONFIRM
                    </button>
                </div>
            </div>
        </div >
    );

    if (showHydraEditor) {
        return <HydraTierEditor onClose={() => setShowHydraEditor(false)} />;
    }

    return mainContent;
};
