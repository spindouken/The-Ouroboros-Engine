import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import { OuroborosEngine } from '../engine/OuroborosEngine';
import { useOuroborosStore } from '../store/ouroborosStore';
import { Save, FolderOpen, Trash2, Download, Upload, Plus } from 'lucide-react';
import { useSoundEffects } from '../hooks/useSoundEffects';

export const SessionCodex: React.FC = () => {
    const sessions = useLiveQuery(() => db.projects.toArray()) || [];
    const { currentSessionId, currentSessionName } = useOuroborosStore();
    const engine = OuroborosEngine.getInstance();
    const { playClick, playHover } = useSoundEffects();
    const [importing, setImporting] = useState(false);

    const handleLoad = async (id: string) => {
        playClick();
        if (confirm("Load this session? Unsaved progress in current workbench will be lost.")) {
            await engine.loadFromCodex(id);
        }
    };

    const handleSave = async () => {
        playClick();
        const name = prompt("Enter Session Name:", currentSessionName || "New Session");
        if (name) {
            // If it's a new name or new session, it's a new save unless we strictly track ID
            // Ideally we track ID.
            // If currentSessionId exists, we ask if overwrite or save as new?
            // For simplicity: If ID exists and name matches, overwrite. Else new.
            // Actually let's just use the engine method with ID if we have it.
            if (currentSessionId && name === currentSessionName) {
                if (confirm(`Overwrite "${name}"?`)) {
                    await engine.saveToCodex(name, currentSessionId);
                }
            } else {
                await engine.saveToCodex(name); // New entry
            }
        }
    };

    const handleSaveAsNew = async () => {
        playClick();
        const name = prompt("Enter New Session Name:", "Copy of " + (currentSessionName || "Session"));
        if (name) {
            await engine.saveToCodex(name); // Force new ID
        }
    };

    const handleDelete = async (id: string, name: string) => {
        playClick();
        if (confirm(`Permanently delete "${name}"?`)) {
            await engine.deleteFromCodex(id);
        }
    };

    const handleExport = async (id: string, name: string) => {
        playClick();
        const json = await engine.exportCodexItem(id);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}.ouroboros.json`;
        a.click();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        playClick();
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (text) {
                await engine.importCodexItem(text);
                setImporting(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-4">
            {/* HEADER / ACTIONS */}
            <div className="flex justify-between items-center p-3 bg-emerald-900/10 border border-emerald-900/30 rounded">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-emerald-600 font-bold tracking-widest">Workbench Status</span>
                    <span className="text-emerald-300 font-bold">{currentSessionName || "Unsaved Session"}</span>
                    <span className="text-[10px] text-emerald-700 font-mono">{currentSessionId || "No ID"}</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        onMouseEnter={() => playHover()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded font-bold transition-colors shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    >
                        <Save className="w-3 h-3" />
                        {currentSessionId ? "SAVE" : "SAVE SESSION"}
                    </button>
                    {currentSessionId && (
                        <button
                            onClick={handleSaveAsNew}
                            onMouseEnter={() => playHover()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700 text-emerald-400 text-xs rounded font-bold transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            CLONE
                        </button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="border-t border-emerald-900/30 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-2">
                        <FolderOpen className="w-3 h-3" /> The Codex ({sessions.length})
                    </h3>
                    <label className="cursor-pointer text-[10px] text-emerald-500 flex items-center gap-1 hover:text-emerald-300">
                        <Upload className="w-3 h-3" /> IMPORT FILE
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />
                    </label>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {sessions.length === 0 ? (
                        <div className="text-center p-4 text-emerald-900 italic text-xs">No saved sessions in the Codex.</div>
                    ) : (
                        sessions.map(s => (
                            <div key={s.id} className={`flex items-center justify-between p-2 rounded border transition-all ${s.id === currentSessionId
                                ? 'bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                : 'bg-black border-emerald-900/30 hover:bg-emerald-900/10'
                                }`}>
                                <div className="flex flex-col flex-1 min-w-0 mr-4">
                                    <div className="text-sm font-bold text-emerald-300 truncate">{s.name}</div>
                                    <div className="text-[10px] text-emerald-700 font-mono">
                                        {new Date(s.updatedAt).toLocaleDateString()} • {s.createdAt !== s.updatedAt ? 'Updated' : 'Created'} • {(s.nodes?.length || 0)} Nodes
                                    </div>
                                </div>

                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleLoad(s.id)}
                                        onMouseEnter={() => playHover()}
                                        title="Load Session"
                                        className="p-1.5 hover:bg-emerald-500 hover:text-black text-emerald-500 rounded transition-colors"
                                    >
                                        <FolderOpen className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleExport(s.id, s.name)}
                                        onMouseEnter={() => playHover()}
                                        title="Export to File"
                                        className="p-1.5 hover:bg-blue-900/30 text-blue-500 rounded transition-colors"
                                    >
                                        <Download className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(s.id, s.name)}
                                        onMouseEnter={() => playHover()}
                                        title="Delete Session"
                                        className="p-1.5 hover:bg-red-900/30 text-red-500 rounded transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
