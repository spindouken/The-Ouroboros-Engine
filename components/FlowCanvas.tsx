import { useCallback, useMemo } from 'react';
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
    addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import AgentNode from './nodes/AgentNode';

const nodeTypes: NodeTypes = {
    agentNode: AgentNode,
};

interface FlowCanvasProps {
    onNodeClick?: (nodeId: string) => void;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ onNodeClick }) => {
    // Local-First: Query DB directly
    const dbNodes = useLiveQuery(() => db.nodes.toArray()) || [];
    const dbEdges = useLiveQuery(() => db.edges.toArray()) || [];

    // Map DB nodes to ReactFlow nodes
    const nodes = useMemo(() => dbNodes.map(n => ({
        id: n.id,
        type: 'agentNode',
        position: { x: n.x || 0, y: n.y || 0 },
        data: n,
        // We can sync selection if we store it in DB, or let ReactFlow handle it locally (uncontrolled)
        // For now, let's assume selection is transient or we need a local state for it if we want to control it.
        // But ReactFlow works best if we pass 'selected' prop if we want to control it.
        // Let's stick to basic mapping for now.
    })), [dbNodes]);

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
            // We could handle selection persistence here if we added 'selected' to DB schema
        });
    }, []);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        // Handle edge deletion
        changes.forEach(change => {
            if (change.type === 'remove') {
                // We need to find the edge ID in DB. 
                // Our mapped ID is `e-${e.id}`.
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

                {/* Overlay Status */}
                <Panel position="top-right" className="bg-black/60 backdrop-blur px-4 py-2 rounded border border-emerald-900/30 text-xs text-emerald-400 font-mono">
                    ACTIVE NODES: {nodes.filter(n => n.data.status === 'running').length} / {nodes.length}
                </Panel>
            </ReactFlow>
        </div>
    );
};
