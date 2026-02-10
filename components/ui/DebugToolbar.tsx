import React from 'react';
import { useOuroborosStore } from '../../store/ouroborosStore';
import { BioButton } from './BioButton';
import { AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';

export const DebugToolbar: React.FC = () => {
    const { addAlert } = useOuroborosStore();

    return (
        <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 p-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg hover:opacity-100 opacity-30 transition-opacity">
            <div className="text-[10px] font-mono text-center text-white/50 uppercase tracking-widest mb-1 border-b border-white/10 pb-1">
                Debug Controls
            </div>

            <BioButton
                variant="tech"
                onClick={() => addAlert('info', 'SYSTEM INITIALIZED', 'Ouroboros Engine v2.99 is ready.')}
                className="text-[10px] py-1"
                icon={<Info className="w-3 h-3" />}
            >
                Info Alert
            </BioButton>

            <BioButton
                variant="primary"
                onClick={() => addAlert('success', 'VERIFICATION COMPLETE', 'Brick valid. Merging to blackboard...')}
                className="text-[10px] py-1"
                icon={<CheckCircle className="w-3 h-3" />}
            >
                Success Alert
            </BioButton>

            <BioButton
                variant="danger"
                onClick={() => addAlert('error', 'TRIBUNAL REJECTION', 'Violation of Directive 4: Architecture mismatch detected. Evidence: "JQuery usage".')}
                className="text-[10px] py-1"
                icon={<AlertTriangle className="w-3 h-3" />}
            >
                Error Alert
            </BioButton>

            <BioButton
                variant="outline"
                onClick={() => {
                    addAlert('info', 'PROCESSING GRAPH', 'Expanding 4 nodes...');
                    setTimeout(() => addAlert('success', 'EXPANSION COMPLETE', '12 new sub-tasks created.'), 2000);
                }}
                className="text-[10px] py-1"
                icon={<Zap className="w-3 h-3" />}
            >
                Sim Sequence
            </BioButton>

            <div className="h-px bg-white/10 my-1" />

            <div className="text-[9px] text-white/40 mb-1 text-center">MATRIX RAIN STATE</div>
            <div className="flex gap-1">
                <button
                    onClick={() => useOuroborosStore.getState().setStatus('thinking')}
                    className="flex-1 bg-purple-900/50 hover:bg-purple-700 text-[9px] text-purple-200 py-1 rounded"
                >
                    Think
                </button>
                <button
                    onClick={() => useOuroborosStore.getState().setStatus('idle')}
                    className="flex-1 bg-emerald-900/50 hover:bg-emerald-700 text-[9px] text-emerald-200 py-1 rounded"
                >
                    Idle
                </button>
                <button
                    onClick={() => useOuroborosStore.getState().setStatus('hard_paused')}
                    className="flex-1 bg-red-900/50 hover:bg-red-700 text-[9px] text-red-200 py-1 rounded"
                >
                    Halt
                </button>
            </div>
        </div>
    );
};
