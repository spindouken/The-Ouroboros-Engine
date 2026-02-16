import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Activity, Brain, Shield, Zap, Eye, Hexagon } from 'lucide-react';

const AgentNode = ({ data, selected }: NodeProps) => {
    // STRICT Activity Check: 'running' is removed to prevent passive glow.
    // Only animate if actively thinking or performing work.
    const isQueued = data.status === 'queued';
    const isProcessing = ['running', 'planning', 'reflexion', 'synthesizing', 'auditing', 'critiquing', 'verifying', 'compiling', 'thinking', 'decomposing'].includes(data.status);
    const isComplete = data.status === 'complete';
    const isError = data.status === 'error';

    // Icon mapping based on type
    const getIcon = () => {
        switch (data.type) {
            case 'domain_lead': return <Brain className="w-4 h-4" />;
            case 'specialist': return <Activity className="w-4 h-4" />;
            case 'gatekeeper': return <Shield className="w-4 h-4" />;
            case 'synthesizer': return <Hexagon className="w-4 h-4" />;
            case 'architect': return <Eye className="w-4 h-4" />;
            default: return <Zap className="w-4 h-4" />;
        }
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={clsx(
                "relative w-[240px] rounded-lg border backdrop-blur-md transition-all duration-300",
                "flex flex-col overflow-hidden shadow-xl",
                selected ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "border-emerald-900/50 hover:border-emerald-500/50",
                isProcessing ? "bg-emerald-950/90 border-emerald-400/50" : "bg-[#0a0a0a]/90",
                isQueued && "bg-amber-950/40 border-amber-500/50",
                isError && "border-red-500/50 bg-red-950/20"
            )}
        >
            {/* Glowing Border Effect for Processing */}
            {isProcessing && (
                <>
                    <div className="absolute -inset-[8px] rounded-xl animate-pulse-ring border-2 border-emerald-400/30 z-[-2]" />
                    <div className="absolute -inset-[3px] rounded-lg bg-emerald-500/10 shadow-[0_0_40px_rgba(52,211,153,0.6)] z-[-1]" />
                    {/* Bright White Halo - No Blending for Max Visibility */}
                    <div className="absolute -inset-[1px] rounded-lg border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.9)] z-10 pointer-events-none" />
                </>
            )}
            {isQueued && !isProcessing && (
                <div className="absolute -inset-[2px] rounded-lg border border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.35)] z-10 pointer-events-none" />
            )}

            {/* Header */}
            <div className={clsx(
                "px-3 py-2 flex items-center gap-2 border-b text-xs font-bold uppercase tracking-wider",
                isComplete ? "bg-emerald-900/30 text-emerald-100" : "bg-black/40 text-emerald-400",
                isError && "bg-red-900/30 text-red-200"
            )}>
                {getIcon()}
                <span className="truncate flex-1">{data.label}</span>
                {data.score > 0 && (
                    <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        data.score > 80 ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                    )}>
                        {data.score}%
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="p-3 text-[10px] text-emerald-100/70 font-mono space-y-2">
                <div className="flex justify-between">
                    <span className="opacity-50">ROLE:</span>
                    <span className="text-emerald-100">{data.persona?.split(' ')[0] || 'Agent'}</span>
                </div>

                {data.output && (
                    <div className="mt-2 pt-2 border-t border-emerald-900/30">
                        <div className="line-clamp-3 opacity-80 italic">
                            "{data.output.substring(0, 100)}..."
                        </div>
                    </div>
                )}

                {/* Prompt / Instruction Section */}
                {data.instruction && (
                    <div className="mt-2 pt-2 border-t border-emerald-900/30">
                        <span className="opacity-50 block mb-1">PROMPT:</span>
                        <div className="text-[9px] text-emerald-200/60 bg-black/20 p-1 rounded border border-emerald-900/20 line-clamp-3 break-words" title={data.instruction}>
                            {data.instruction}
                        </div>
                    </div>
                )}

                {isProcessing && (
                    <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        <span>PROCESSING...</span>
                    </div>
                )}
                {isQueued && !isProcessing && (
                    <div className="flex items-center gap-2 text-amber-300">
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                        <span>QUEUED...</span>
                    </div>
                )}
            </div>

            {/* Handles */}
            <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-2 !h-2 !border-none" />
            <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-2 !h-2 !border-none" />
        </motion.div>
    );
};

export default memo(AgentNode);
