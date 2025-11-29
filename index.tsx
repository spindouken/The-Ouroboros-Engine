import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppMode, Node } from './types';
import { DEPARTMENTS } from './constants';
import { SettingsPanel } from './components/SettingsPanel';
import { ControlPanel } from './components/ControlPanel';
import { LogViewer } from './components/LogViewer';
import { GraphView } from './components/GraphView';
import { NodeInspector } from './components/NodeInspector';
import { useEngine } from './hooks/useEngine';
import './index.css';

// --- COMPONENT: APP ---

const App = () => {
    // Engine Hook
    const { state, engine } = useEngine();

    // UI State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [appMode, setAppMode] = useState<AppMode>('refine');
    const [showSettings, setShowSettings] = useState(false);

    // Squad Configuration (UI only, passed to engine on start)
    const [selectedDepts, setSelectedDepts] = useState<Record<string, boolean>>({
        strategy: true, marketing: false, ux: true, engineering: true, security: true
    });
    const [autoLoop, setAutoLoop] = useState(true);

    // Sync document content if needed (e.g. initial load)
    useEffect(() => {
        if (!state.documentContent) {
            engine.setDocumentContent(`PROJECT: ETERNAL_ENGINE
  
Concept: A recursive AI system that continuously rewrites its own source code to optimize for intelligence density.

Core Axiom: "The code that writes the code must be better than the code it writes."

Directives:
- Must survive power cycles.
- Must preserve the 'Core Seed' of its logic.
- Must consume external APIs to grow.`);
        }
    }, []);

    // --- HANDLERS ---

    const handleStartRefinement = () => {
        const activeDepts = Object.keys(DEPARTMENTS).filter(k => selectedDepts[k]);
        setAppMode('refine');
        engine.startRefinement(state.documentContent, activeDepts);
    };

    const handleStartPlanning = () => {
        setAppMode('plan');
        engine.startPlanning(state.documentContent);
    };

    const handleUpdateSettings = (newSettings: any) => {
        engine.updateSettings(newSettings);
    };

    const handleNodeClick = (nodeId: string) => {
        setSelectedNodeId(nodeId);
    };

    // --- RENDER ---

    return (
        <div className="flex h-screen bg-[#050505] text-emerald-100 overflow-hidden font-mono selection:bg-emerald-900 selection:text-amber-100 relative">

            {showSettings && (
                <SettingsPanel
                    settings={state.settings}
                    onUpdate={handleUpdateSettings}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {/* ControlPanel is now a sidebar in this layout */}
            <ControlPanel
                appMode={appMode}
                setAppMode={setAppMode}
                cycleCount={state.cycleCount || 0}
                setShowSettings={setShowSettings}
                isProcessing={state.isProcessing}
                selectedDepts={selectedDepts}
                setSelectedDepts={setSelectedDepts}
                autoLoop={autoLoop}
                setAutoLoop={setAutoLoop} // Note: autoLoop is local UI state now, engine might need it if we want it persisted
                documentContent={state.documentContent}
                setDocumentContent={(content) => engine.setDocumentContent(content)}
                projectPlan={state.projectPlan || []}
                startRefinement={handleStartRefinement}
                startPlanning={handleStartPlanning}
            />

            {/* RIGHT PANEL: The Graph Engine */}
            <div className="flex-1 flex flex-col relative bg-[#030303]">

                <LogViewer logs={state.logs} />

                {/* Graph Visualizer */}
                <div className="flex-1 relative overflow-hidden">
                    <GraphView
                        graph={state.graph}
                        selectedId={selectedNodeId}
                        onSelect={handleNodeClick}
                    />

                    {/* Inspector Overlay */}
                    {selectedNodeId && state.graph.nodes[selectedNodeId] && (
                        <div className="absolute top-4 right-4 w-[450px] max-h-[calc(100%-2rem)] z-50 pointer-events-none">
                            <NodeInspector
                                node={state.graph.nodes[selectedNodeId]}
                                settings={state.settings}
                                logs={state.logs}
                                onClose={() => setSelectedNodeId(null)}
                                onUpdateSettings={handleUpdateSettings}
                            />
                        </div>
                    )}
                </div>
            </div>
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
