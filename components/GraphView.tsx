import React, { useRef, useState } from 'react';
import { Plus, Maximize, Minus, UserCheck, Users, Trophy, Infinity, Code } from 'lucide-react';
import { Graph, Node } from '../types';

interface GraphViewProps {
    graph: Graph;
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({ graph, selectedId, onSelect }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [zoom, setZoom] = useState(1);

    return (
        <div className="w-full h-full overflow-auto bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative">

            {/* ZOOM CONTROLS */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
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
                    const source = graph.nodes[edge.source];
                    const target = graph.nodes[edge.target];
                    if (!source || !target) return null;

                    // Bezier for better visuals
                    const dx = (target.x! - source.x!) * 0.5;
                    const d = `M${source.x},${source.y} C${source.x! + dx},${source.y} ${target.x! - dx},${target.y} ${target.x},${target.y}`;

                    const isActive = source.status === 'complete' && target.status !== 'pending';
                    return (
                        <path key={i} d={d} stroke={isActive ? "#10b981" : "#064e3b"} strokeWidth={isActive ? 2 : 1} fill="none" markerEnd="url(#arrowhead)" className="transition-all duration-500 opacity-60" />
                    );
                })}

                {Object.values(graph.nodes).map((node: Node) => {
                    const isSelected = selectedId === node.id;
                    let stroke = "#064e3b";
                    let fill = "#022c22";
                    let radius = 20;

                    if (node.status === 'complete') { stroke = "#10b981"; fill = "#064e3b"; }

                    // Department Colors
                    if (node.department === 'strategy') { fill = node.status === 'complete' ? '#581c87' : '#2e1065'; }
                    if (node.department === 'marketing') { fill = node.status === 'complete' ? '#c2410c' : '#431407'; }
                    if (node.department === 'ux') { fill = node.status === 'complete' ? '#831843' : '#4a044e'; }
                    if (node.department === 'security') { fill = node.status === 'complete' ? '#7f1d1d' : '#450a0a'; }
                    if (node.department === 'engineering') { fill = node.status === 'complete' ? '#1e3a8a' : '#172554'; }

                    if (node.type === 'synthesizer') { radius = 30; stroke = "#f59e0b"; fill = "#451a03"; }
                    if (node.type === 'gatekeeper') { radius = 15; stroke = "#f59e0b"; }

                    // Status Effects
                    let animateClass = "";
                    if (node.status === 'verifying' || node.status === 'voting') {
                        stroke = "#a855f7"; // Purple for verification
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'synthesizing') {
                        stroke = "#f59e0b"; // Amber for synthesis
                        animateClass = "animate-pulse";
                    }
                    if (node.status === 'critiquing') {
                        stroke = "#ef4444"; // Red for critique
                        animateClass = "animate-pulse";
                    }

                    if (isSelected) stroke = "#fff";

                    // Oscillation Fix: Removed hover:scale-105 from the parent 'g'.
                    // Added 'group' to parent and applied scaling to inner 'g'.
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
                                    {node.type === 'specialist' ? <UserCheck className="w-5 h-5 text-emerald-200 opacity-80" /> :
                                        node.type === 'domain_lead' ? <Users className="w-5 h-5 text-white" /> :
                                            node.type === 'gatekeeper' ? <Trophy className="w-5 h-5 text-amber-500" /> :
                                                node.type === 'synthesizer' ? <Infinity className="w-5 h-5 text-amber-500" /> :
                                                    <Code className="w-5 h-5 text-blue-400" />}
                                </g>
                            </g>

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
