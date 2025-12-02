import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { LogEntry } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';

interface LogViewerProps {
    logs?: LogEntry[];
}

type LogFilter = 'All' | 'Decomposer' | 'Validator' | 'Voting' | 'Memory';

const TypewriterText = ({ text }: { text: string }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        let i = 0;
        setDisplayedText('');
        const interval = setInterval(() => {
            setDisplayedText(prev => prev + text.charAt(i));
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 10); // Speed of typing
        return () => clearInterval(interval);
    }, [text]);

    return <span>{displayedText}</span>;
};



export const LogViewer: React.FC<LogViewerProps> = () => {
    const logs = useLiveQuery(() => db.logs.orderBy('id').toArray()) || [];
    const [filter, setFilter] = useState<LogFilter>('All');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, filter]);

    const filteredLogs = logs.filter(log => {
        if (filter === 'All') return true;
        const msg = log.message.toLowerCase();
        if (filter === 'Decomposer') return msg.includes('decompose') || msg.includes('micro');
        if (filter === 'Validator') return msg.includes('validat') || msg.includes('flag');
        if (filter === 'Voting') return msg.includes('vote') || msg.includes('judge') || msg.includes('tribunal');
        if (filter === 'Memory') return msg.includes('memory') || msg.includes('recall');
        return true;
    });

    return (
        <div className="h-full border-b border-emerald-900/30 flex flex-col bg-[#030303] font-mono">
            <div className="flex items-center justify-between px-4 py-2 border-b border-emerald-900/20 bg-[#050505]">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs tracking-wider">
                    <Terminal className="w-3 h-3" />
                    <span className="animate-pulse">EVENT HORIZON</span>
                </div>
                <div className="flex gap-2">
                    {(['All', 'Decomposer', 'Validator', 'Voting', 'Memory'] as LogFilter[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-[0.625rem] px-2 py-0.5 rounded border transition-colors ${filter === f ? 'bg-emerald-900/50 text-emerald-300 border-emerald-600' : 'text-emerald-700 border-transparent hover:text-emerald-500'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                <AnimatePresence initial={false}>
                    {filteredLogs.map((log, index) => {
                        const isLatest = index === filteredLogs.length - 1;
                        return (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex gap-2 text-[0.6875rem] leading-relaxed ${log.level === 'error' ? 'text-red-400' :
                                    log.level === 'success' ? 'text-emerald-300' :
                                        log.level === 'warn' ? 'text-amber-400' :
                                            log.level === 'system' ? 'text-emerald-500' : 'text-emerald-700'
                                    }`}
                            >
                                <span className="opacity-40 w-14 shrink-0 font-light">{log.timestamp}</span>
                                <span className="break-all">
                                    {log.nodeId && (
                                        <span className="text-emerald-400 bg-emerald-950/50 px-1 rounded mr-2 opacity-80 border border-emerald-900/50 text-[0.625rem]">
                                            {log.nodeId}
                                        </span>
                                    )}
                                    {isLatest ? <TypewriterText text={log.message} /> : log.message}
                                </span>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};
