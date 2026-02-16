import React from 'react';
import { Edit2, Lock } from 'lucide-react';
import clsx from 'clsx';

interface ChangeModeButtonProps {
    locked: boolean;
    onClick: () => void;
}

export const ChangeModeButton: React.FC<ChangeModeButtonProps> = ({ locked, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={clsx(
                'inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                locked
                    ? 'border-red-900/50 bg-red-950/20 text-red-400/80 hover:bg-red-950/30'
                    : 'border-cyan-900/60 bg-cyan-950/20 text-cyan-400 hover:border-cyan-700 hover:text-cyan-300'
            )}
            title={locked ? 'Mode is locked once execution starts' : 'Override detected mode'}
        >
            {locked ? <Lock className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
            {locked ? 'Locked' : 'Change Mode'}
        </button>
    );
};

