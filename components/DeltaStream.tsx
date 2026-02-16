import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Plus, ShieldAlert, Activity, Cpu, Hexagon, Zap, Brain } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';

interface DeltaStreamProps {
    constitution: any;
    filterNodeId?: string;
}

interface StreamItem {
    id: string;
    type: 'add' | 'modify' | 'warning' | 'log_work' | 'log_error' | 'log_system';
    content: string;
    timestamp: number;
    source: string; // 'Constitution', 'Prism', 'Agent: <Name>', etc.
    metadata?: any;
    highlight?: boolean;
}

export const DeltaStream: React.FC<DeltaStreamProps> = ({ constitution, filterNodeId }) => {
    const [constStream, setConstStream] = useState<StreamItem[]>([]);
    const prevConstraintsRef = useRef<string[]>([]);

    // 1. Fetch Real-time Logs from DB (Global Event Horizon)
    // We limit to 30 recent logs to keep the stream performant and focused
    const recentLogs = useLiveQuery(() => {
        let collection = db.logs.orderBy('timestamp').reverse();
        if (filterNodeId) {
            // If filtering, we want more history for this specific node to fill the view
            return collection.filter(log => log.nodeId === filterNodeId).limit(50).toArray();
        }
        return collection.limit(30).toArray();
    }, [filterNodeId]) || [];

    // 2. Monitor Constitution for visual deltas (Amendments from Store)
    useEffect(() => {
        if (!constitution || filterNodeId) return; // Only show Const updates on Global View

        const currentConstraints = constitution.constraints || [];
        const prevConstraints = prevConstraintsRef.current;

        // Detect New Constraints
        const newConstraints = currentConstraints.filter((c: string) => !prevConstraints.includes(c));

        if (newConstraints.length > 0) {
            const newItems: StreamItem[] = newConstraints.map((c: string) => ({
                id: `const-${Math.random().toString(36).substr(2, 9)}`,
                type: 'add',
                content: c,
                timestamp: Date.now(),
                source: 'LIVING CONSTITUTION'
            }));

            // Add to local state stream (persist for session)
            setConstStream(prev => [...newItems, ...prev].slice(0, 20)); // Keep last 20 amendments
        }
        prevConstraintsRef.current = currentConstraints;
    }, [constitution, filterNodeId]);


    // -- Log Formatter (Story Mode) --
    const formatLogContent = (content: string, type: StreamItem['type'], source: string) => {
        if (type === 'add') return { text: content, highlight: true }; // Constitution updates are already clean

        // 1. System/Lock Messages into Narrative
        if (content.includes('✅ SEM ACQ')) return { text: "Acquired semaphore lock. Resource secured.", highlight: false };
        if (content.includes('⏳ SEM WAIT')) return { text: "Queueing for system resources...", highlight: false };
        if (content.includes('⏳ QUEUED')) return { text: "Node is queued and waiting for execution slot.", highlight: false };
        if (content.includes('✅ RATE ACQ')) return { text: "Rate limit check passed. Proceeding.", highlight: false };
        if (content.includes('⏳ RATE WAIT')) return { text: "Awaiting rate limit cooldown...", highlight: false };
        if (content.includes('▷ EXEC START')) {
            const node = content.split(': ')[1] || 'Process';
            return { text: `Initializing execution sequence for [${node}]...`, highlight: true };
        }

        // 2. Agent Activities (Thinking/Reflexion)
        if (content.includes('Thinking...')) return { text: "Analyzing task requirements and context...", highlight: true };
        if (content.includes('Reflexion')) return { text: "Critique Loop: Reviewing output against constraints...", highlight: true };
        if (content.includes('(Attempt')) return { text: content.replace('activating...', 'is coming online.'), highlight: true };

        // 3. Fallback: Clean up raw content
        return { text: content, highlight: false };
    };

    // 3. Merge Strategies: Logs + Constitution Updates
    const mergedStream = useMemo(() => {
        const logItems: StreamItem[] = recentLogs.map(log => {
            let type: StreamItem['type'] = 'log_work';
            if (log.level === 'error') type = 'log_error';
            if (log.nodeId === 'system_prism' || (log.nodeId && log.nodeId.startsWith('system'))) type = 'log_system';

            // Determine Source Label with more detail
            let source = log.nodeId || 'SYSTEM';
            if (log.nodeId === 'system_prism') source = 'PRISM OPTICS';
            if (log.nodeId === 'system_constitution') source = 'CONSTITUTION';
            if (log.nodeId === 'system_compiler') source = 'LOSSLESS COMPILER';

            // Format Agent Names if standard node (e.g., node-123)
            if (source.startsWith('node-')) source = `AGENT ${source.split('-')[1]}`;

            // Format Agent Names if standard node (e.g., node-123)
            if (source.startsWith('node-')) source = `AGENT ${source.split('-')[1]}`;

            // Convert string timestamp to number for sorting
            const timestamp = new Date(log.timestamp).getTime();

            return {
                id: `log-${log.id || timestamp}`,
                type,
                content: log.message, // Revert to RAW message
                timestamp: isNaN(timestamp) ? Date.now() : timestamp,
                source: source.toUpperCase(),
                highlight: false // Disable highlight for now
            };
        });

        // Combine and Sort by Timestamp Descending (Newest Top)
        return [...constStream, ...logItems].sort((a, b) => b.timestamp - a.timestamp);
    }, [recentLogs, constStream]);


    // -- Visual Helpers --
    const getIcon = (item: StreamItem) => {
        if (item.source.includes('PRISM')) return <Hexagon className="w-2.5 h-2.5" />;
        if (item.source.includes('CONSTITUTION')) return <ScrollText className="w-2.5 h-2.5" />;
        if (item.source.includes('COMPILER')) return <Zap className="w-2.5 h-2.5" />;
        if (item.type === 'log_error') return <ShieldAlert className="w-2.5 h-2.5" />;
        if (item.content.includes('Thinking')) return <Brain className="w-2.5 h-2.5" />;
        return <Activity className="w-2.5 h-2.5" />;
    };

    const getColorScheme = (item: StreamItem) => {
        if (item.type === 'log_error')
            return 'border-red-500 text-red-500 bg-red-950/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]';

        if (item.source.includes('PRISM'))
            return 'border-purple-500 text-purple-400 bg-purple-950/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]';

        if (item.source.includes('CONSTITUTION'))
            return 'border-amber-500 text-amber-400 bg-amber-950/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]';

        if (item.source.includes('COMPILER'))
            return 'border-orange-500 text-orange-400 bg-orange-950/10 shadow-[0_0_10px_rgba(249,115,22,0.2)]';

        // Default Agents (Emerald)
        return 'border-emerald-500 text-emerald-400 bg-emerald-950/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
    };

    return (
        <div className={`flex flex-col h-full bg-[#030303] w-full overflow-hidden relative ${filterNodeId ? '' : 'border-l border-emerald-900/30'}`}>
            {/* Header */}
            {!filterNodeId && (
                <div className="p-3 border-b border-emerald-900/50 bg-emerald-950/10 flex items-center justify-between backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500 blur-md opacity-20 animate-pulse"></div>
                            <Cpu className="w-4 h-4 text-emerald-400 relative z-10" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-emerald-100 tracking-[0.2em] uppercase block leading-none">Event Horizon</span>
                            <span className="text-[8px] text-emerald-600 font-mono leading-none">REAL-TIME TELEMETRY</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
                    </div>
                </div>
            )}

            {/* Stream Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 relative scrollbar-thin scrollbar-thumb-emerald-900/50 hover:scrollbar-thumb-emerald-700">

                {/* Scanline Background */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none mix-blend-overlay fixed"></div>

                <AnimatePresence initial={false}>
                    {mergedStream.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            className="text-center mt-20 text-[10px] text-emerald-800 font-mono"
                        >
                            {filterNodeId ? '// AWAITING NODE ACTIVITY...' : '// LISTENING FOR QUANTUM FLUCTUATIONS...'}
                        </motion.div>
                    ) : (
                        mergedStream.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="relative group"
                            >
                                <div className="flex gap-3 items-start">
                                    {/* Icon Node */}
                                    <div className={`
                                        relative z-10 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 bg-black
                                        ${getColorScheme(item).split(' ').slice(0, 2).join(' ')}
                                    `}>
                                        {getIcon(item)}
                                    </div>

                                    {/* Card */}
                                    <div className={`
                                        flex-1 p-2 rounded border backdrop-blur-sm
                                        ${getColorScheme(item).split(' ').slice(2).join(' ')}
                                        border-opacity-30 bg-opacity-10
                                        transition-colors duration-200
                                    `}>
                                        <div className="flex justify-between items-start mb-0.5">
                                            <span className="text-[9px] font-bold uppercase opacity-90 tracking-wider flex items-center gap-1">
                                                {item.source}
                                                <span className="text-[8px] opacity-50 font-mono normal-case">
                                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{new Date(item.timestamp).getMilliseconds().toString().slice(0, 2)}
                                                </span>
                                            </span>
                                        </div>
                                        <div className={`text-[10px] leading-relaxed font-mono ${item.highlight ? 'text-emerald-100 font-bold' : 'text-emerald-100/70'} break-words opacity-90`}>
                                            {item.type === 'add' && <span className="text-emerald-500 mr-1.5 font-bold">AMENDMENT +</span>}
                                            {item.content}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
