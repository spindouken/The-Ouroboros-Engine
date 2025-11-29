import React, { useState } from 'react';
import { Settings, X, Zap, Gauge, Info } from 'lucide-react';
import { AppSettings } from '../types';
import { MODELS } from '../constants';

interface SettingsPanelProps {
    settings: AppSettings;
    onUpdate: (settings: Partial<AppSettings>) => void;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdate, onClose }) => {
    const [showLimitsInfo, setShowLimitsInfo] = useState(false);

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-[#0a0c0a] border border-emerald-900/80 rounded-lg w-full max-w-lg shadow-2xl p-6 relative">
                <button
                    onClick={onClose}
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
                        <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                            <Zap className="w-3 h-3" /> SELECT MODEL
                        </label>
                        <div className="grid gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {MODELS.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => {
                                        const newModel = MODELS.find(m => m.id === model.id);
                                        onUpdate({
                                            model: model.id,
                                            rpm: newModel?.rpm || 60,
                                            rpd: newModel?.rpd || 10000
                                        });
                                    }}
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
                            ].map(({ label, key }) => (
                                <div key={key} className="space-y-1">
                                    <label className="text-[10px] text-emerald-600 font-bold">{label}</label>
                                    <select
                                        value={(settings[key as keyof AppSettings] as string) || ""}
                                        onChange={(e) => onUpdate({ [key]: e.target.value })}
                                        className="w-full bg-black border border-emerald-900 rounded p-1 text-emerald-400 text-xs focus:border-emerald-500 focus:outline-none"
                                    >
                                        <option value="">Default ({MODELS.find(m => m.id === settings.model)?.label})</option>
                                        {MODELS.map(m => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RATE LIMITS */}
                    <div className="grid grid-cols-2 gap-4 relative">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                                <Gauge className="w-3 h-3" /> MAX RPM (Requests/Min)
                                <button
                                    onClick={() => setShowLimitsInfo(!showLimitsInfo)}
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
                </div>

                <div className="mt-8 pt-4 border-t border-emerald-900/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-sm"
                    >
                        CONFIRM
                    </button>
                </div>
            </div>
        </div >
    );
};
