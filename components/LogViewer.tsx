import React, { useState } from 'react';
import { Terminal, Filter } from 'lucide-react';
import { LogEntry } from '../types';

interface LogViewerProps {
    logs: LogEntry[];
}

type LogFilter = 'All' | 'Decomposer' | 'Validator' | 'Voting' | 'Memory';

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
    const [filter, setFilter] = useState<LogFilter>('All');

    const filteredLogs = logs.filter(log => {
        if (filter === 'All') return true;
        // Simple keyword matching for now, ideally we'd have a 'category' field in LogEntry
        const msg = log.message.toLowerCase();
        if (filter === 'Decomposer') return msg.includes('decompose') || msg.includes('micro');
        if (filter === 'Validator') return msg.includes('validat') || msg.includes('flag');
        if (filter === 'Voting') return msg.includes('vote') || msg.includes('judge') || msg.includes('tribunal');
        if (filter === 'Memory') return msg.includes('memory') || msg.includes('recall');
        return true;
    });

    return (
        <div className="h-48 border-b border-emerald-900/30 flex flex-col bg-[#030303]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-emerald-900/20 bg-[#030303]">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-[10px]">
                    <Terminal className="w-3 h-3" /> EVENT HORIZON
                </div>
                <div className="flex gap-2">
                    {(['All', 'Decomposer', 'Validator', 'Voting', 'Memory'] as LogFilter[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-[9px] px-2 py-0.5 rounded border ${filter === f ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'text-emerald-800 border-transparent hover:border-emerald-900'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 text-[10px] font-mono">
                {filteredLogs.map(log => (
                    <div key={log.id} className={`flex gap-2 ${log.level === 'error' ? 'text-rose-500' :
                        log.level === 'success' ? 'text-emerald-400' :
                            log.level === 'warn' ? 'text-amber-500' :
                                log.level === 'system' ? 'text-emerald-600' : 'text-emerald-800'
                        }`}>
                        <span className="opacity-30 w-12 shrink-0">{log.timestamp}</span>
                        <span className="break-all">
                            {log.nodeId && <span className="text-emerald-300 bg-emerald-900/30 px-1 rounded mr-1.5 opacity-70 border border-emerald-800/50">{log.nodeId}</span>}
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
