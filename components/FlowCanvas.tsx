import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    NodeTypes,
    Panel,
    NodeChange,
    EdgeChange,
    Connection,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import AgentNode from './nodes/AgentNode';
import { calculateLayout } from '../utils/graphLayout';
import { LayoutGrid } from 'lucide-react';

const nodeTypes: NodeTypes = {
    agentNode: AgentNode,
};

import { AppMode } from '../types';

interface FlowCanvasProps {
    onNodeClick?: (nodeId: string) => void;
    appMode: AppMode;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ onNodeClick, appMode }) => {
    // Local-First: Query DB directly
    const dbNodes = useLiveQuery(() => db.nodes.toArray()) || [];
    const dbEdges = useLiveQuery(() => db.edges.toArray()) || [];

    const filteredNodes = useMemo(() => dbNodes.filter(n => n.mode === appMode), [dbNodes, appMode]);

    // Map DB nodes to ReactFlow nodes
    const nodes = useMemo(() => filteredNodes.map(n => ({
        id: n.id,
        type: 'agentNode',
        position: { x: n.x || 0, y: n.y || 0 },
        data: n,
    })), [filteredNodes]);

    // Map DB edges to ReactFlow edges
    const edges = useMemo(() => dbEdges.map(e => ({
        id: e.id ? `e-${e.id}` : `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
        type: 'smoothstep'
    })), [dbEdges]);

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                // Persist position to DB
                db.nodes.update(change.id, { x: change.position.x, y: change.position.y });
            }
        });
    }, []);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        // Handle edge deletion
        changes.forEach(change => {
            if (change.type === 'remove') {
                const dbId = parseInt(change.id.replace('e-', ''));
                if (!isNaN(dbId)) {
                    db.edges.delete(dbId);
                }
            }
        });
    }, []);

    const onConnect = useCallback((params: Connection) => {
        if (params.source && params.target) {
            db.edges.add({
                source: params.source,
                target: params.target,
                type: 'manual'
            });
        }
    }, []);

    const handleAutoLayout = useCallback(async () => {
        // We need to pass ALL nodes/edges relevant to the layout, which is filteredNodes
        // But calculateLayout expects Node[], Edge[].
        // We need to filter edges too.
        const relevantNodeIds = new Set(filteredNodes.map(n => n.id));
        const relevantEdges = dbEdges.filter(e => relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target));

        const layoutedNodes = calculateLayout(filteredNodes, relevantEdges, appMode);

        await db.transaction('rw', db.nodes, async () => {
            for (const node of layoutedNodes) {
                await db.nodes.update(node.id, { x: node.x, y: node.y });
            }
        });
    }, [filteredNodes, dbEdges, appMode]);

    // Auto-layout on initial load if nodes are unpositioned
    useEffect(() => {
        const unpositioned = filteredNodes.filter(n => (!n.x && n.x !== 0) || (!n.y && n.y !== 0));
        // If more than 50% are unpositioned, run layout
        if (filteredNodes.length > 0 && unpositioned.length > filteredNodes.length / 2) {
            handleAutoLayout();
        }
    }, [filteredNodes.length, appMode]); // Run when count changes or mode changes

    const proOptions = { hideAttribution: true };

    return (
        <div className="w-full h-full bg-[#030303]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => onNodeClick?.(node.id)}
                nodeTypes={nodeTypes}
                fitView
                proOptions={proOptions}
                minZoom={0.1}
                maxZoom={1.5}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#059669', strokeWidth: 2 },
                }}
            >
                <Background color="#064e3b" gap={20} size={1} className="opacity-20" />
                <Controls className="bg-black/50 border-emerald-900/50 text-emerald-500 fill-emerald-500" />
                <MiniMap
                    nodeColor={(n) => {
                        if (n.data.status === 'error') return '#ef4444';
                        if (n.data.status === 'complete') return '#10b981';
                        if (n.data.status === 'running') return '#34d399';
                        return '#065f46';
                    }}
                    className="bg-black/80 border border-emerald-900/30 rounded-lg overflow-hidden"
                    maskColor="rgba(0, 0, 0, 0.7)"
                />

                {/* Overlay Status & Controls */}
                <Panel position="top-right" className="flex gap-2">
                    <div className="bg-black/60 backdrop-blur px-4 py-2 rounded border border-emerald-900/30 text-xs text-emerald-400 font-mono flex items-center">
                        ACTIVE NODES: {nodes.filter(n => n.data.status === 'running').length} / {nodes.length}
                    </div>
                    <button
                        onClick={handleAutoLayout}
                        className="bg-black/60 backdrop-blur px-3 py-2 rounded border border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
                        title="Auto Layout"
                    >
                        <LayoutGrid size={16} />
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    );
};
