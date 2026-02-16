import React from 'react';
import clsx from 'clsx';
import type { ProjectMode } from '../../engine/genesis-protocol';
import { getModeDescription, getModeDisplayName } from '../../engine/utils/mode-helpers';

const MODE_OPTIONS: ProjectMode[] = [
    'software',
    'scientific_research',
    'legal_research',
    'creative_writing',
    'general'
];

interface ModeSelectorProps {
    currentMode?: ProjectMode;
    onSelectMode: (mode: ProjectMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onSelectMode }) => {
    return (
        <div className="mt-3 space-y-2 rounded border border-emerald-900/40 bg-black/30 p-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
                Select Project Mode
            </div>
            {MODE_OPTIONS.map((mode) => {
                const selected = currentMode === mode;
                return (
                    <button
                        key={mode}
                        onClick={() => onSelectMode(mode)}
                        className={clsx(
                            'w-full rounded border p-2 text-left transition-colors',
                            selected
                                ? 'border-emerald-500/60 bg-emerald-900/25'
                                : 'border-emerald-900/40 bg-black/20 hover:border-emerald-700/60 hover:bg-emerald-900/15'
                        )}
                    >
                        <div className="text-[11px] font-bold text-emerald-200">
                            {getModeDisplayName(mode)}
                        </div>
                        <div className="mt-1 text-[10px] text-emerald-600/90">
                            {getModeDescription(mode)}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

