import React from 'react';
import clsx from 'clsx';
import type { ProjectMode } from '../../engine/genesis-protocol';
import { getModeDisplayName } from '../../engine/utils/mode-helpers';

const MODE_BADGE_STYLES: Record<ProjectMode, string> = {
    software: 'border-cyan-600/60 bg-cyan-950/50 text-cyan-300',
    scientific_research: 'border-blue-600/60 bg-blue-950/50 text-blue-300',
    legal_research: 'border-amber-600/60 bg-amber-950/50 text-amber-300',
    creative_writing: 'border-fuchsia-600/60 bg-fuchsia-950/50 text-fuchsia-300',
    general: 'border-emerald-600/60 bg-emerald-950/50 text-emerald-300'
};

interface ModeBadgeProps {
    mode?: ProjectMode;
    className?: string;
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, className }) => {
    if (!mode) {
        return (
            <span
                className={clsx(
                    'inline-flex items-center rounded-full border border-emerald-900/60 bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700',
                    className
                )}
            >
                Mode pending
            </span>
        );
    }

    return (
        <span
            className={clsx(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                MODE_BADGE_STYLES[mode],
                className
            )}
        >
            {getModeDisplayName(mode)}
        </span>
    );
};

