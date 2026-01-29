import React, { useRef, useState } from 'react';
import { Plus, Maximize, Minus, UserCheck, Users, Trophy, Infinity, Code, Shield, Layers, Search, Swords } from 'lucide-react';
import { Graph, Node } from '../types';

interface GraphViewProps {
    graph: Graph;
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({ graph, selectedId, onSelect }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [zoom, setZoom] = useState(1);
    const [isTreeView, setIsTreeView] = useState(false);

    // Toggle Layout Mode
    const toggleLayout = () => setIsTreeView(!isTreeView);

    // Simple Tree Layout Calculation (Vertical)
    const getLayoutedNodes = (): Record<string, Node> => {
        if (!isTreeView) return graph.nodes;

        const nodes = Object.values(graph.nodes);
        if (nodes.length === 0) return {};

        const layouted: Record<string, Node> = {};
        const childrenMap: Record<string, string[]> = {};
        const roots: string[] = [];

        // Build hierarchy map
        nodes.forEach(n => {
            if (n.parentId && graph.nodes[n.parentId]) {
                if (!childrenMap[n.parentId]) childrenMap[n.parentId] = [];
                childrenMap[n.parentId].push(n.id);
            } else {
                roots.push(n.id);
            }
        });

        // Recursive position assignment
        let currentX = 0;
        const X_SPACING = 250;
        const Y_SPACING = 150;

        const assignPositions = (nodeId: string, depth: number) => {
            const children = childrenMap[nodeId] || [];

            // Process children first to center parent
            const childXPositions: number[] = [];
            children.forEach(cid => {
                assignPositions(cid, depth + 1);
                childXPositions.push(layouted[cid].x || 0);
            });

            let x = 0;
            if (children.length === 0) {
                x = currentX;
                currentX += X_SPACING;
            } else {
                // Center over children
                const minX = Math.min(...childXPositions);
                const maxX = Math.max(...childXPositions);
                x = (minX + maxX) / 2;
            }

            layouted[nodeId] = {
                ...graph.nodes[nodeId],
                x: x,
                y: 100 + (depth * Y_SPACING)
            };
        };

        roots.forEach(rid => assignPositions(rid, 0));
        return layouted;
    };

    const displayNodes = isTreeView ? getLayoutedNodes() : graph.nodes;

    return (
        <div className="w-full h-full overflow-auto bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative">

            {/* CONTROLS */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
                <button
                    onClick={toggleLayout}
                    className={`p-2 border rounded backdrop-blur-sm transition-colors ${isTreeView ? 'bg-emerald-900/50 text-white border-emerald-500' : 'bg-black/50 text-emerald-400 border-emerald-900 hover:bg-emerald-900/50'}`}
                    title={isTreeView ? "Switch to Flat DAG View" : "Switch to Tree Hierarchy View"}
                >
                    <Layers className="w-4 h-4" />
                </button>
                <div className="h-px bg-emerald-900 my-1" />
                <button
                    onClick={() => setZoom(z => Math.min(z + 0.1, 2.5))}
                    className="p-2 bg-black/50 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900 rounded backdrop-blur-sm transition-colors"
                    title="Zoom In"
                >
                    <Plus className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setZoom(1)}
                    className="p-2 bg-black/50 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900 rounded backdrop-blur-sm transition-colors"
                    title="Reset Zoom"
                >
                    <Maximize className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setZoom(z => Math.max(z - 0.1, 0.4))}
                    className="p-2 bg-black/50 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900 rounded backdrop-blur-sm transition-colors"
                    title="Zoom Out"
                >
                    <Minus className="w-4 h-4" />
                </button>
            </div>

            <svg ref={svgRef} width={2400 * zoom} height={2400 * zoom} viewBox="0 0 2400 2400" className="block origin-top-left transition-all duration-300">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#166534" />
                    </marker>
                </defs>

                {graph.edges.map((edge, i) => {
                    const params = isTreeView ? displayNodes : graph.nodes;
                    const source = params[edge.source];
                    const target = params[edge.target];

                    if (!source || !target) return null;

                    // If tree view, only show decomposition edges (parent->child) or keep dependencies? 
                    // Let's keep all, but standard visual
                    const dx = (target.x! - source.x!) * 0.5;
                    const dy = (target.y! - source.y!) * 0.5;

                    // Vertical bezier for Tree, Horizontal for DAG
                    const d = isTreeView
                        ? `M${source.x},${source.y} C${source.x},${source.y! + dy} ${target.x},${target.y! - dy} ${target.x},${target.y}`
                        : `M${source.x},${source.y} C${source.x! + dx},${source.y} ${target.x! - dx},${target.y} ${target.x},${target.y}`;

                    const isActive = source.status === 'complete' && target.status !== 'pending';
                    return (
                        <path key={i} d={d} stroke={isActive ? "#10b981" : "#064e3b"} strokeWidth={isActive ? 2 : 1} fill="none" markerEnd="url(#arrowhead)" className="transition-all duration-500 opacity-60" />
                    );
                })}

                {Object.values(displayNodes).map((node: Node) => {
                    const isSelected = selectedId === node.id;
                    let stroke = "#064e3b";
                    let fill = "#022c22";
                    let radius = 20;

                    if (node.status === 'complete') { stroke = "#10b981"; fill = "#064e3b"; }

                    // Color code by Depth in Tree View
                    if (isTreeView && node.depth !== undefined) {
                        const depthColors = ['#0f172a', '#1e1b4b', '#312e81', '#4338ca', '#4f46e5', '#6366f1'];
                        fill = depthColors[Math.min(node.depth, depthColors.length - 1)];
                    }

                    // Department Colors (Original logic preserves if not overridden by logic above, but let's allow Department to override depth if meaningful?)
                    // Actually, strategy says "Color-code by depth level". Let's prefer depth in Tree View.

                    if (!isTreeView) {
                        // Original Department Colors
                        if (node.department === 'strategy') { fill = node.status === 'complete' ? '#581c87' : '#2e1065'; }
                        if (node.department === 'marketing') { fill = node.status === 'complete' ? '#c2410c' : '#431407'; }
                        if (node.department === 'ux') { fill = node.status === 'complete' ? '#831843' : '#4a044e'; }
                        if (node.department === 'security') { fill = node.status === 'complete' ? '#7f1d1d' : '#450a0a'; }
                        if (node.department === 'engineering') { fill = node.status === 'complete' ? '#1e3a8a' : '#172554'; }
                    }

                    // ... existing special node logic ...
                    // Alchemist (Compiler) - larger amber node
                    if (node.type === 'synthesizer' || node.type === 'lossless_compiler') {
                        radius = 30;
                        stroke = "#f59e0b";
                        fill = "#451a03";
                    }
                    // Tribunal (Antagonist) - smaller amber node
                    if (node.type === 'gatekeeper') {
                        radius = 15;
                        stroke = "#f59e0b";
                    }
                    // Security Patcher - red/rose node
                    if (node.type === 'security_patcher') {
                        radius = 22;
                        stroke = "#f43f5e";
                        fill = "#4c0519";
                    }

                    // Status Effects
                    let animateClass = "";
                    if (node.status === 'verifying' || node.status === 'voting') {
                        stroke = "#a855f7"; // Purple for verification
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'synthesizing' || node.status === 'compiling') {
                        stroke = "#f59e0b"; // Amber for synthesis/compilation
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'critiquing') {
                        stroke = "#ef4444"; // Red for critique
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'distress') {
                        stroke = "#f59e0b"; // Amber
                        fill = "#78350f"; // Dark Amber
                        animateClass = "animate-pulse";
                    }
                    // V2.99 New Status Effects
                    if (node.status === 'reflexion') {
                        stroke = "#06b6d4"; // Cyan for reflexion
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'surveying') {
                        stroke = "#22c55e"; // Green for surveying
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'auditing') {
                        stroke = "#dc2626"; // Red for hostile audit
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'patching') {
                        stroke = "#f43f5e"; // Rose for security patching
                        animateClass = "animate-pulse";
                    }

                    if (isSelected) stroke = "#fff";

                    // Get appropriate icon based on node type
                    const getNodeIcon = () => {
                        switch (node.type) {
                            case 'specialist':
                                return <UserCheck className="w-5 h-5 text-emerald-200 opacity-80" />;
                            case 'domain_lead':
                                return <Users className="w-5 h-5 text-white" />;
                            case 'gatekeeper':
                                // Tribunal (Antagonist) - Swords icon for hostile audit
                                return <Swords className="w-5 h-5 text-amber-500" />;
                            case 'synthesizer':
                            case 'lossless_compiler':
                                // Alchemist (Compiler) - Layers icon for assembly
                                return <Layers className="w-5 h-5 text-amber-500" />;
                            case 'security_patcher':
                                return <Shield className="w-5 h-5 text-rose-400" />;
                            default:
                                return <Code className="w-5 h-5 text-blue-400" />;
                        }
                    };

                    return (
                        <g
                            key={node.id}
                            transform={`translate(${node.x},${node.y})`}
                            onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
                            className="cursor-pointer group"
                        >
                            {/* Inner scaling group for hover effect without breaking positioning */}
                            <g className="transition-transform duration-300 group-hover:scale-110">
                                <circle r={radius} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} className={`transition-colors duration-300 ${animateClass}`} />
                                <g transform="translate(-10, -10)">
                                    {getNodeIcon()}
                                </g>
                            </g>

                            {/* ReCAP Expansion Badge */}
                            {node.decompositionStatus === 'expanded' && (
                                <g transform="translate(15, 15)">
                                    <circle r="6" fill="#0ea5e9" stroke="#000" />
                                    <Layers className="w-3 h-3 text-white" x="-1.5" y="-1.5" />
                                </g>
                            )}

                            {/* Score Badge */}
                            {node.score !== undefined && node.score !== 0 && (
                                <g transform="translate(15, -15)">
                                    <circle r="8" fill="#10b981" stroke="#000" />
                                    <text dy="3" dx="0" textAnchor="middle" fontSize="8" fill="#000" fontWeight="bold">
                                        {Math.round(node.score)}
                                    </text>
                                </g>
                            )}

                            <text y={radius + 15} textAnchor="middle" fill={isSelected ? "#fff" : "#065f46"} fontSize="9" className="font-mono tracking-wider font-bold">{node.label.substring(0, 15).toUpperCase()}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
