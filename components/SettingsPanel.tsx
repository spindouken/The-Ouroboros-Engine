import React, { useState, useEffect } from 'react';
import { Settings, X, Zap, Gauge, Info, Download, Upload, Shield } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import { OuroborosEngine } from '../engine/OuroborosEngine';
import { AppSettings } from '../types';
import { MODELS } from '../constants';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface SettingsPanelProps {
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
    const settings = useLiveQuery(() => db.settings.get(1)) || {} as AppSettings;
    const onUpdate = (newSettings: Partial<AppSettings>) => {
        OuroborosEngine.getInstance().updateSettings(newSettings);
    };
    const [showLimitsInfo, setShowLimitsInfo] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<'all' | 'google' | 'openai'>('all');
    const engine = OuroborosEngine.getInstance();
    const { playClick, playHover } = useSoundEffects();

    // Apply font size immediately when settings change
    useEffect(() => {
        if (settings.baseFontSize) {
            document.documentElement.style.fontSize = `${settings.baseFontSize}px`;
        }
    }, [settings.baseFontSize]);

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

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-[#0a0c0a] border border-emerald-900/80 rounded-lg w-full max-w-lg shadow-2xl p-6 relative max-h-full overflow-y-auto custom-scrollbar">
                <button
                    onClick={() => { playClick(); onClose(); }}
                    onMouseEnter={() => playHover()}
                    className="absolute top-4 right-4 text-emerald-700 hover:text-emerald-400"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold text-emerald-400 mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5" /> ENGINE CONFIGURATION
                </h2>

                <div className="space-y-6">
                    {/* MODEL SELECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> SELECT MODEL
                            </label>
                            <div className="flex gap-1">
                                {['all', 'google', 'openai'].map(p => (
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
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Specialist', key: 'model_specialist' },
                                { label: 'Lead (Tech/Domain)', key: 'model_lead' },
                                { label: 'Architect', key: 'model_architect' },
                                { label: 'Synthesizer', key: 'model_synthesizer' },
                                { label: 'Judge', key: 'model_judge' },
                                { label: 'Manifestation', key: 'model_manifestation' },
                                { label: 'Prism (Roles)', key: 'model_prism' },
                            ].map(({ label, key }) => (
                                <div key={key} className="space-y-1">
                                    <label className="text-[10px] text-emerald-600 font-bold">{label}</label>
                                    <select
                                        value={(settings[key as keyof AppSettings] as string) || ""}
                                        onChange={(e) => onUpdate({ [key]: e.target.value })}
                                        className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="">Default ({MODELS.find(m => m.id === settings.model)?.label})</option>
                                        {MODELS.filter(m => selectedProvider === 'all' || m.provider === selectedProvider).map(m => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
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
                    <div className="p-2 bg-amber-900/10 border border-amber-900/30 rounded text-[10px] text-amber-500/80 italic">
                        Disclaimer: All data is stored locally in your browser (IndexedDB). Clearing browser data will wipe your Ouroboros sessions.
                    </div>
                </div>

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
        </div>
    );
};
