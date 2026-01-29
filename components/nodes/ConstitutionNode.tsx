import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { ScrollText, Scale, AlertTriangle, FileCheck } from 'lucide-react';

const ConstitutionNode = ({ data, selected }: NodeProps) => {

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`
                relative w-[300px] rounded-xl border border-amber-500/50 
                bg-black/90 backdrop-blur-xl shadow-[0_0_30px_rgba(245,158,11,0.2)]
                overflow-hidden transition-all duration-300
                ${selected ? 'ring-2 ring-amber-400' : ''}
            `}
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-900/50 to-orange-900/50 p-3 border-b border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-200 font-bold tracking-wider">
                    <ScrollText className="w-5 h-5 text-amber-400" />
                    <span>LIVING CONSTITUTION</span>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                <div className="text-xs text-amber-200/60 font-mono text-center mb-2">
                    {data.domain || 'DOMAIN UNSET'}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-950/30 p-2 rounded border border-amber-900/30 text-center">
                        <Scale className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                        <div className="text-[10px] text-amber-300">CONSTRAINTS</div>
                        <div className="text-lg font-bold text-amber-100">{data.constraintCount || 0}</div>
                    </div>
                    <div className="bg-amber-950/30 p-2 rounded border border-amber-900/30 text-center">
                        <FileCheck className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                        <div className="text-[10px] text-blue-300">DECISIONS</div>
                        <div className="text-lg font-bold text-blue-100">{data.decisionCount || 0}</div>
                    </div>
                </div>

                {data.warningCount > 0 && (
                    <div className="bg-red-950/20 p-2 rounded border border-red-900/50 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-red-400 font-bold">WARNINGS ACTIVE</span>
                            <span className="text-[10px] text-red-300">Downstream caution advised</span>
                        </div>
                        <span className="ml-auto text-lg font-bold text-red-200">{data.warningCount}</span>
                    </div>
                )}

                <div className="pt-2 border-t border-amber-800/30 flex items-center justify-between text-[10px] text-amber-500/60">
                    <span>Updates: {data.updateCount || 0}</span>
                    <span>Last: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'N/A'}</span>
                </div>
            </div>

            {/* Handles - Two-way flow */}
            <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-black" />
            <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-black" />
        </motion.div>
    );
};

export default memo(ConstitutionNode);
