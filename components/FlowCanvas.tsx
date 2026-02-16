import { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    NodeTypes,
    Panel,
    NodeChange,
    EdgeChange,
    Connection,
    MarkerType,
    useReactFlow,
    EdgeTypes,
    BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/ouroborosDB';
import AgentNode from './nodes/AgentNode';
import PrismNode from './nodes/PrismNode';
import ConstitutionNode from './nodes/ConstitutionNode';
import BioSnakeEdge from './edges/BioSnakeEdge';
// import { DataStreamOverlay } from './visualization/DataStreamOverlay';
import { calculateLayout } from '../utils/graphLayout';
import { LayoutGrid } from 'lucide-react';
import { useOuroborosStore } from '../store/ouroborosStore';
import { AppMode } from '../types';

const nodeTypes: NodeTypes = {
    agentNode: AgentNode,
    prismNode: PrismNode,
    constitutionNode: ConstitutionNode
};

const edgeTypes: EdgeTypes = {
    bioSnake: BioSnakeEdge
};

interface FlowCanvasProps {
    onNodeClick?: (nodeId: string) => void;
    appMode: AppMode;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ onNodeClick, appMode }) => {
    // Local-First: Query DB directly
    const dbNodes = useLiveQuery(() => db.nodes.toArray()) || [];
    const dbEdges = useLiveQuery(() => db.edges.toArray()) || [];
    const store = useOuroborosStore();

    const filteredNodes = useMemo(() => dbNodes.filter(n => n.mode === appMode), [dbNodes, appMode]);
    const queueMetrics = useMemo(() => {
        const byId = Object.fromEntries(filteredNodes.map((node) => [node.id, node]));
        let runnable = 0;
        let blocked = 0;
        for (const node of filteredNodes) {
            if (node.status !== 'pending') continue;
            const deps = Array.isArray(node.dependencies) ? node.dependencies : [];
            const canRun = deps.every((depId) => !byId[depId] || byId[depId].status === 'complete');
            if (canRun) runnable++;
            else blocked++;
        }

        const queued = filteredNodes.filter((node) => node.status === 'queued').length;
        const active = filteredNodes.filter((node) =>
            ['running', 'planning', 'reflexion', 'synthesizing', 'auditing', 'critiquing', 'verifying', 'compiling', 'thinking', 'decomposing'].includes(node.status)
        ).length;

        return { runnable, blocked, queued, active };
    }, [filteredNodes]);

    // State for System Node positions to allow responsive dragging
    const [sysNodePositions, setSysNodePositions] = useState<Record<string, { x: number, y: number }>>({});

    // Load initial positions on mount
    useEffect(() => {
        const loaded: Record<string, { x: number, y: number }> = {};
        ['system_prism', 'system_constitution'].forEach(id => {
            const stored = localStorage.getItem(`layout_${id}`);
            if (stored) {
                try {
                    loaded[id] = JSON.parse(stored);
                } catch (e) { }
            }
        });
        setSysNodePositions(prev => ({ ...prev, ...loaded }));
    }, []);

    // Helper to get position (State -> Default)
    const getSystemNodePos = (id: string, defaultPos: { x: number, y: number }) => {
        return sysNodePositions[id] || defaultPos;
    };

    // Map DB nodes to ReactFlow nodes + Inject System Nodes
    const nodes = useMemo(() => {
        const flowNodes: any[] = filteredNodes.map(n => ({
            id: n.id,
            type: 'agentNode',
            position: { x: n.x || 0, y: n.y || 0 },
            data: n,
        }));

        // INJECT: PRISM NODE (If analysis exists)
        if (store.prismAnalysis) {
            const analysis = store.prismAnalysis;
            const fastCount = analysis.stepC.fastPathTasks.length;
            const pos = getSystemNodePos('system_prism', { x: 0, y: -250 });

            flowNodes.push({
                id: 'system_prism',
                type: 'prismNode',
                position: pos,
                data: {
                    status: 'complete',
                    councilCount: analysis.stepB.council.specialists.length,
                    taskCount: analysis.stepB.atomicTasks.length,
                    domain: analysis.stepA.domain,
                    fastPath: fastCount
                }
            });
        }

        // INJECT: CONSTITUTION NODE (Always exists if Genesis ran)
        if (store.livingConstitution) {
            const consti = store.livingConstitution;
            const pos = getSystemNodePos('system_constitution', { x: 600, y: 0 });

            flowNodes.push({
                id: 'system_constitution',
                type: 'constitutionNode',
                position: pos,
                data: {
                    domain: consti.domain,
                    constraintCount: consti.constraints.length,
                    decisionCount: consti.decisions.length || 0,
                    warningCount: consti.warnings?.length || 0,
                    lastUpdated: Date.now(), // Estimate
                    updateCount: (consti.decisions.length + (consti.warnings?.length || 0))
                }
            });
        }

        return flowNodes;
    }, [filteredNodes, store.prismAnalysis, store.livingConstitution, sysNodePositions]);

    // Map DB edges + Inject System Edges
    const edges = useMemo(() => {
        // Helper to check if source/target node is running - EXPANDED LIST (Reverted Strictness)
        const activeStatuses = new Set([
            'running', 'planning', 'reflexion', 'synthesizing', 'auditing',
            'critiquing', 'verifying', 'compiling', 'thinking', 'decomposing'
        ]);
        const runningNodeIds = new Set(filteredNodes.filter(n => activeStatuses.has(n.status)).map(n => n.id));


        // Find compiler ID for special handling
        const targetCompiler = filteredNodes.find(n => n.type === 'lossless_compiler');
        const isCompilerActive = targetCompiler && (targetCompiler.status === 'running' || targetCompiler.status === 'synthesizing' || targetCompiler.status === 'compiling');

        const flowEdges: any[] = dbEdges.map(e => {
            // SPECIAL RULE: If target is compiler, ONLY animate if compiler is active
            if (targetCompiler && e.target === targetCompiler.id && !isCompilerActive) {
                return {
                    id: e.id ? `e-${e.id}` : `e-${e.source}-${e.target}`,
                    source: e.source,
                    target: e.target,
                    animated: true,
                    style: { stroke: '#10b981', strokeWidth: 2, opacity: 0.3 }, // Dimmed
                    type: 'bioSnake',
                    data: {
                        animated: false, // FORCE OFF
                        connectionType: 'standard'
                    }
                };
            }

            return {
                id: e.id ? `e-${e.id}` : `e-${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
                animated: true,
                style: { stroke: '#10b981', strokeWidth: 2 },
                type: 'bioSnake', // Re-enable custom edge
                data: {
                    animated: runningNodeIds.has(e.source) || runningNodeIds.has(e.target),
                    connectionType: 'standard' // Standard edges can also have flow if needed
                }
            };
        });

        // INJECT: PRISM -> SPECIALISTS connection
        if (store.prismAnalysis) {
            // Find all specialist nodes
            filteredNodes.filter(n => n.type === 'specialist').forEach(node => {
                flowEdges.push({
                    id: `e-prism-${node.id}`,
                    source: 'system_prism',
                    target: node.id,
                    animated: true,
                    style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' }, // Purple dashed
                    type: 'bioSnake',
                    data: {
                        animated: activeStatuses.has(node.status),
                        connectionType: 'system-flow'
                    }
                });
            });
        }

        // INJECT: CONSTITUTION -> SPECIALISTS connection (Context Flow)
        if (store.livingConstitution) {
            filteredNodes.filter(n => n.type === 'specialist' || n.type === 'lossless_compiler').forEach(node => {
                // If compiler, handled separately below
                if (node.type === 'lossless_compiler') return;

                // SPECIAL VISUAL RULE: Constitution context flows even when node is just "Running" (Initialized)
                // This shows the agent is "Connected" to the laws.
                const isConnected = activeStatuses.has(node.status) || node.status === 'running';

                flowEdges.push({
                    id: `e-constitution-${node.id}`,
                    source: 'system_constitution', // Source is Constitution (Context flows IN)
                    target: node.id,
                    animated: false,
                    style: { stroke: '#f59e0b', strokeWidth: 1, opacity: 0.5 }, // Amber thin
                    type: 'bioSnake',
                    data: {
                        animated: isConnected,
                        connectionType: 'system-flow'
                    }
                });
            });
        }

        // INJECT: ALL NODES -> LOSSLESS COMPILER (Only when compiling)
        const compilerNode = filteredNodes.find(n => n.type === 'lossless_compiler');
        if (compilerNode && (compilerNode.status === 'running' || compilerNode.status === 'synthesizing' || compilerNode.status === 'compiling')) {
            // Connect ALL completed/verified specialists to the compiler
            filteredNodes.filter(n => n.type === 'specialist' && n.status === 'complete').forEach(node => {
                flowEdges.push({
                    id: `e-${node.id}-compiler`,
                    source: node.id,
                    target: compilerNode.id,
                    animated: true,
                    style: { stroke: '#10b981', strokeWidth: 3 }, // Thick green
                    type: 'bioSnake',
                    data: {
                        animated: true, // Always animated when compiling
                        connectionType: 'compile-flow'
                    }
                });
            });
        }

        return flowEdges;
    }, [dbEdges, filteredNodes, store.prismAnalysis, store.livingConstitution]);

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                const nodeId = change.id;
                // Handle System Nodes (Prism, Constitution) - Persist to LocalStorage + State
                if (nodeId.startsWith('system_')) {
                    const newPos = { x: change.position.x, y: change.position.y };
                    setSysNodePositions(prev => ({ ...prev, [nodeId]: newPos }));
                    localStorage.setItem(`layout_${nodeId}`, JSON.stringify(newPos));
                } else {
                    // Persist position to DB for regular nodes
                    db.nodes.update(change.id, { x: change.position.x, y: change.position.y });
                }
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

    const onConnect = useCallback((connection: Connection) => {
        if (connection.source && connection.target) {
            db.edges.add({
                source: connection.source,
                target: connection.target,
                type: 'dependency'
            });
        }
    }, []);

    const handleNodeClick = useCallback((_: React.MouseEvent, node: any) => {
        onNodeClick?.(node.id);
    }, [onNodeClick]);

    // Auto-Layout Handler using graphLayout utility
    const handleAutoLayout = useCallback(async () => {
        const nodesMap: Record<string, any> = {};
        filteredNodes.forEach(n => { nodesMap[n.id] = n; });

        const edgesData = dbEdges.map(e => ({ source: e.source, target: e.target }));
        const layouted = calculateLayout(Object.values(nodesMap), edgesData, 'plan');

        await db.transaction('rw', db.nodes, async () => {
            for (const node of Object.values(layouted)) {
                await db.nodes.update(node.id, { x: node.x, y: node.y, layer: node.layer });
            }
        });
    }, [filteredNodes, dbEdges]);

    return (
        <div className="h-full w-full bg-[#030303]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={2}
                defaultEdgeOptions={{
                    type: 'bioSnake', // Default to BioSnake
                    animated: true,
                    style: { stroke: '#059669', strokeWidth: 2 },
                }}
            >
                <Background
                    color="#064e3b"
                    gap={24}
                    size={2}
                    variant={BackgroundVariant.Dots}
                    className="opacity-20 blend-overlay"
                />
                <Controls className="bg-black/50 border-emerald-900/50 text-emerald-500 fill-emerald-500 backdrop-blur-sm" />
                <MiniMap
                    nodeColor={(n) => {
                        if (n.data.status === 'error') return '#ef4444';
                        if (n.data.status === 'complete') return '#10b981';
                        if (n.data.status === 'queued') return '#f59e0b';
                        if (n.data.status === 'running') return '#34d399';
                        return '#065f46';
                    }}
                    className="bg-black/80 border border-emerald-900/30 rounded-lg overflow-hidden backdrop-blur-md shadow-2xl"
                    maskColor="rgba(0, 0, 0, 0.7)"
                />

                {/* Overlay Status & Controls */}
                <Panel position="top-right" className="flex gap-2">
                    <div className="bg-zinc-950/80 backdrop-blur-md px-4 py-2 rounded-lg border border-emerald-500/30 text-xs text-emerald-400 font-display font-medium tracking-wide flex items-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        ACTIVE: <span className="text-white ml-1 font-bold">{queueMetrics.active}</span>
                        <span className="mx-2 opacity-40">|</span>
                        QUEUED: <span className="text-amber-300 ml-1 font-bold">{queueMetrics.queued}</span>
                        <span className="mx-2 opacity-40">|</span>
                        BLOCKED: <span className="text-cyan-300 ml-1 font-bold">{queueMetrics.blocked}</span>
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
