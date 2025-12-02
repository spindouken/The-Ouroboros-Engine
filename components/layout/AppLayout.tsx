import { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import clsx from 'clsx';

interface AppLayoutProps {
    sidebar: ReactNode;
    graph: ReactNode;
    logs: ReactNode;
}

export const AppLayout = ({ sidebar, graph, logs }: AppLayoutProps) => {
    return (
        <div className="h-screen w-screen bg-[#050505] text-emerald-100 overflow-hidden font-mono selection:bg-emerald-900 selection:text-amber-100">
            <PanelGroup direction="horizontal">
                {/* LEFT SIDEBAR: THE COUNCIL */}
                <Panel defaultSize={20} minSize={15} maxSize={30} className="bg-[#0a0a0a] border-r border-emerald-900/30 flex flex-col">
                    {sidebar}
                </Panel>

                <PanelResizeHandle className="w-1 bg-emerald-900/20 hover:bg-emerald-500/50 transition-colors cursor-col-resize" />

                {/* MAIN CONTENT AREA */}
                <Panel defaultSize={80} minSize={50}>
                    <PanelGroup direction="vertical">
                        {/* TOP: THE VOID (GRAPH) */}
                        <Panel defaultSize={70} minSize={30} className="relative">
                            {graph}
                        </Panel>

                        <PanelResizeHandle className="h-1 bg-emerald-900/20 hover:bg-emerald-500/50 transition-colors cursor-row-resize" />

                        {/* BOTTOM: THE ORACLE (LOGS) */}
                        <Panel defaultSize={30} minSize={10} className="bg-[#080808] border-t border-emerald-900/30 flex flex-col">
                            {logs}
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );
};
