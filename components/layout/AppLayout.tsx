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
        <div className="h-screen w-screen bg-canvas text-primary overflow-hidden selection:bg-emerald-900 selection:text-amber-100 relative">
            <PanelGroup direction="horizontal">
                {/* LEFT SIDEBAR: THE COUNCIL */}
                <Panel defaultSize={20} minSize={15} maxSize={30} className="bg-node border-r border-emerald-900/30 flex flex-col z-10 backdrop-blur-sm">
                    {sidebar}
                </Panel>

                <PanelResizeHandle className="w-1 bg-emerald-900/20 hover:bg-emerald-500/50 transition-colors cursor-col-resize z-20" />

                {/* MAIN CONTENT AREA */}
                <Panel defaultSize={80} minSize={50}>
                    <PanelGroup direction="vertical">
                        {/* TOP: THE VOID (GRAPH) */}
                        <Panel defaultSize={70} minSize={30} className="relative z-0">
                            {graph}
                        </Panel>

                        <PanelResizeHandle className="h-1 bg-emerald-900/20 hover:bg-emerald-500/50 transition-colors cursor-row-resize z-20" />

                        {/* BOTTOM: THE ORACLE (LOGS) */}
                        <Panel defaultSize={30} minSize={10} className="bg-node border-t border-emerald-900/30 flex flex-col z-10 backdrop-blur-sm">
                            {logs}
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );
};
