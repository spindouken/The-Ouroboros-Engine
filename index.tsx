import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppMode } from './types';
import { SettingsPanel } from './components/SettingsPanel';
import { ControlPanel } from './components/ControlPanel';
import { LogViewer } from './components/LogViewer';
import { FlowCanvas } from './components/FlowCanvas';
import { NodeInspector } from './components/NodeInspector';
import { AppLayout } from './components/layout/AppLayout';
import { useOuroborosStore } from './store/ouroborosStore';
import { OuroborosEngine } from './engine/OuroborosEngine';
import './index.css';

// --- COMPONENT: APP ---

const App = () => {
    // State from Zustand
    const {
        documentContent,
        setDocumentContent
    } = useOuroborosStore();

    // UI State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [appMode, setAppMode] = useState<AppMode>('refine');
    const [showSettings, setShowSettings] = useState(false);

    // Initialize Engine & Load Session
    useEffect(() => {
        const engine = OuroborosEngine.getInstance();
        engine.loadSession().then(() => {
            // If session loaded empty content (new user), set default
            if (!useOuroborosStore.getState().documentContent) {
                setDocumentContent(`PROJECT: ETERNAL_ENGINE
  
Concept: A recursive AI system that continuously rewrites its own source code to optimize for intelligence density.

Core Axiom: "The code that writes the code must be better than the code it writes."

Directives:
- Must survive power cycles.
- Must preserve the 'Core Seed' of its logic.
- Must consume external APIs to grow.`);
            }
        });
    }, []);

    // Node selection is handled by local state via FlowCanvas callback

    return (
        <div className="h-screen w-screen bg-[#050505] text-emerald-100 overflow-hidden font-mono selection:bg-emerald-900 selection:text-amber-100">

            {showSettings && (
                <SettingsPanel
                    onClose={() => setShowSettings(false)}
                />
            )}

            <AppLayout
                sidebar={
                    <ControlPanel
                        appMode={appMode}
                        setAppMode={setAppMode}
                        setShowSettings={setShowSettings}
                    />
                }
                graph={
                    <div className="w-full h-full relative">
                        <FlowCanvas onNodeClick={setSelectedNodeId} />
                        {/* Inspector Overlay */}
                        {selectedNodeId && (
                            <div className="absolute top-4 right-4 w-[400px] max-h-[calc(100%-2rem)] z-50">
                                <NodeInspector
                                    nodeId={selectedNodeId}
                                    onClose={() => setSelectedNodeId(null)}
                                />
                            </div>
                        )}
                    </div>
                }
                logs={<LogViewer />}
            />
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error("Root element not found!");
}
