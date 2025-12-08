import React from 'react';
import { X, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { useOuroborosStore } from '../../store/ouroborosStore';
import { OuroborosEngine } from '../../engine/OuroborosEngine';
import { MODELS, MODEL_TIERS } from '../../constants';
import { ModelTier } from '../../types';

export const HydraTierEditor: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // Access store directly
    const settings = useOuroborosStore((state) => state.settings);
    const customTiers = settings.customTiers || MODEL_TIERS;

    const updateTiers = (newTiers: Record<ModelTier, string[]>) => {
        OuroborosEngine.getInstance().updateSettings({ customTiers: newTiers });
    };

    const moveModel = (tier: ModelTier, index: number, direction: 'up' | 'down') => {
        const models = [...(customTiers[tier] || [])];
        if (direction === 'up' && index > 0) {
            [models[index], models[index - 1]] = [models[index - 1], models[index]];
        } else if (direction === 'down' && index < models.length - 1) {
            [models[index], models[index + 1]] = [models[index + 1], models[index]];
        }
        updateTiers({ ...customTiers, [tier]: models });
    };

    const removeModel = (tier: ModelTier, index: number) => {
        const models = [...(customTiers[tier] || [])];
        models.splice(index, 1);
        updateTiers({ ...customTiers, [tier]: models });
    };

    const addModel = (tier: ModelTier, modelId: string) => {
        const models = [...(customTiers[tier] || [])];
        if (!models.includes(modelId)) {
            models.push(modelId);
            updateTiers({ ...customTiers, [tier]: models });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-8">
            <div className="bg-[#0a0c0a] border border-emerald-900 rounded-lg w-full max-w-4xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-emerald-700 hover:text-emerald-400"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6 border-b border-emerald-900/50 pb-4">
                    <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        HYDRA PROTOCOL: TIER CONFIGURATION
                    </h2>
                    <p className="text-xs text-emerald-600 mt-1">
                        Define the "Equivalence Classes" for the Hydra Failover Protocol. When the primary model fails (Rate Limit), the engine will automatically try the next model in the list.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-6 overflow-y-auto custom-scrollbar flex-1 pb-4">
                    {(['S_TIER', 'A_TIER', 'B_TIER'] as ModelTier[]).map((tier) => (
                        <div key={tier} className="flex flex-col gap-2">
                            <h3 className="font-bold text-center p-2 bg-emerald-900/20 border border-emerald-900 rounded text-emerald-300">
                                {tier.replace('_', ' ')}
                            </h3>

                            <div className="flex-1 bg-black/50 border border-emerald-900/30 rounded p-2 gap-2 flex flex-col overflow-y-auto min-h-[300px]">
                                {(customTiers[tier] || []).map((modelId, idx) => {
                                    const modelDef = MODELS.find(m => m.id === modelId);
                                    return (
                                        <div key={modelId} className="flex items-center gap-2 p-2 bg-emerald-900/10 border border-emerald-900/30 rounded group">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-emerald-400 truncate">{modelDef?.label || modelId}</div>
                                                <div className="text-[9px] text-emerald-600 truncate">{modelDef?.provider || 'unknown'}</div>
                                            </div>
                                            <div className="flex flex-col gap-1 opacity-50 group-hover:opacity-100">
                                                <button onClick={() => moveModel(tier, idx, 'up')} disabled={idx === 0} className="hover:text-emerald-300 disabled:opacity-30"><ChevronUp size={12} /></button>
                                                <button onClick={() => moveModel(tier, idx, 'down')} disabled={idx === (customTiers[tier]?.length || 0) - 1} className="hover:text-emerald-300 disabled:opacity-30"><ChevronDown size={12} /></button>
                                            </div>
                                            <button onClick={() => removeModel(tier, idx)} className="text-red-900 hover:text-red-500 ml-1"><X size={12} /></button>
                                        </div>
                                    );
                                })}

                                <div className="mt-auto pt-2 border-t border-emerald-900/30">
                                    <select
                                        className="w-full bg-black border border-emerald-900 rounded text-[10px] text-emerald-500 p-1"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                addModel(tier, e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        value=""
                                    >
                                        <option value="">+ Add Model...</option>
                                        {MODELS.filter(m => !(customTiers[tier] || []).includes(m.id)).map(m => (
                                            <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-emerald-900/30">
                    <button
                        onClick={() => OuroborosEngine.getInstance().updateSettings({ customTiers: MODEL_TIERS })}
                        className="mr-auto px-4 py-2 text-xs text-amber-500 hover:text-amber-400 font-bold"
                    >
                        RESET TO DEFAULTS
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-sm"
                    >
                        DONE
                    </button>
                </div>
            </div>
        </div>
    );
};
