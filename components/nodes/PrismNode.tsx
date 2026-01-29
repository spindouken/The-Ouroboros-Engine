import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { Sparkles, Users, ListTodo, Split } from 'lucide-react';

const PrismNode = ({ data, selected }: NodeProps) => {
    const isComplete = data.status === 'complete';

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`
                relative w-[280px] rounded-xl border border-purple-500/50 
                bg-black/90 backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.2)]
                overflow-hidden transition-all duration-300
                ${selected ? 'ring-2 ring-purple-400' : ''}
            `}
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-3 border-b border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-200 font-bold tracking-wider">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span>PRISM CORE</span>
                </div>
                <div className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded text-purple-300 border border-purple-500/30">
                    V2.99
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-purple-200/80">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span>Council Members</span>
                    </div>
                    <span className="font-mono text-purple-100">{data.councilCount || 0}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-purple-200/80">
                    <div className="flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-purple-400" />
                        <span>Atomic Tasks</span>
                    </div>
                    <span className="font-mono text-purple-100">{data.taskCount || 0}</span>
                </div>

                {data.domain && (
                    <div className="pt-2 border-t border-purple-800/30 flex items-center justify-between text-[10px]">
                        <span className="text-purple-400">DOMAIN:</span>
                        <span className="text-purple-100 font-bold uppercase">{data.domain}</span>
                    </div>
                )}

                {data.fastPath > 0 && (
                    <div className="pt-1 flex items-center gap-2 text-[10px] text-emerald-400">
                        <Split className="w-3 h-3" />
                        <span>Fast Track: {data.fastPath} tasks</span>
                    </div>
                )}
            </div>

            {/* Handles - Source Only (It generates tasks) */}
            <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-black" />
        </motion.div>
    );
};

export default memo(PrismNode);
