import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Alert } from '../../types';

interface HoloStampProps {
    alert: Alert;
    onDismiss: (id: string) => void;
}

export const HoloStamp: React.FC<HoloStampProps> = ({ alert, onDismiss }) => {
    const isError = alert.type === 'error';
    const isSuccess = alert.type === 'success';

    const colorClass = isError
        ? 'text-red-500 border-red-500 bg-red-950/90 shadow-[0_0_50px_rgba(239,68,68,0.3)] border-4 border-double clip-path-jagged'
        : isSuccess
            ? 'text-emerald-500 border-emerald-500 bg-emerald-950/90 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
            : 'text-cyan-500 border-cyan-500 bg-cyan-950/90 shadow-[0_0_20px_rgba(6,182,212,0.5)]';

    return (
        <motion.div
            initial={{ scale: 2, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: isError ? -5 : 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`
                pointer-events-auto
                relative
                flex items-center gap-4
                p-4 pr-8
                rounded-sm
                border-2
                uppercase tracking-widest font-bold font-mono
                backdrop-blur-md
                ${colorClass}
            `}
            onClick={() => onDismiss(alert.id)}
        >
            {/* Icon */}
            <div className="shrink-0">
                {isError ? <AlertCircle className="w-8 h-8" /> :
                    isSuccess ? <CheckCircle className="w-8 h-8" /> :
                        <Info className="w-8 h-8" />}
            </div>

            {/* Content */}
            <div>
                <div className="text-xl leading-none mb-1">{alert.title}</div>
                {alert.message && <div className="text-[10px] opacity-80 leading-tight normal-case font-sans tracking-normal">{alert.message}</div>}
            </div>

            {/* Scanlines Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSIjZmZmIiAvPgo8L3N2Zz4=')]"></div>

            {/* Border Corners */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white/50"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white/50"></div>
        </motion.div>
    );
};
