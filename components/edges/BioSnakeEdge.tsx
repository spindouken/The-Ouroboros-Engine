import React, { memo } from 'react';
import { BaseEdge, EdgeProps, getSmoothStepPath, getBezierPath } from 'reactflow';

/**
 * BioSnakeEdge
 * 
 * A pulsing, "alive" edge component used for Ouroboros V3.
 * It consists of two layers:
 * 1. A thick, semi-transparent "vein" base.
 * 2. A thin, glowing "nervous system" spine that animates along the path.
 * 
 * Supports two variants implicitly via CSS classes:
 * - Default: Emerald/Green (Standard flow)
 * - Error: Red/Amber (Distress) - can be controlled via style prop
 */

const BioSnakeEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data // Expecting data.isAnimated or similar
}: EdgeProps) => {
    // Standard SmoothStep path for circuit-like feel, or Bezier for organic.
    // Ouroboros V3 spec suggests "Twisting Snake", which usually implies optimized Bezier
    // or Smart Step. Let's stick to SmoothStep for "Tech" feel or Bezier for "Bio".
    // Mixing them: High-tension Bezier.
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const isRunning = data?.animated === true;

    return (
        <>
            {/* Layer 1: The Vein (Outer Glow/Volume) */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 4,
                    stroke: 'var(--node-border, #10b981)',
                    opacity: 0.15,
                    filter: 'blur(1px)' // Soften the vein
                }}
            />

            {/* Layer 2: The Spine (Nervous System Signal) */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 2,
                    stroke: isRunning ? '#34d399' : 'var(--node-border, #10b981)',
                    strokeDasharray: '10 10', // Matches the CSS animation offset of 20
                    opacity: isRunning ? 1 : 0.5,
                    animation: isRunning ? 'bio-flow 0.5s linear infinite' : 'none'
                }}
            />

            {/* Ball Flow for ALL Active Edges */}
            {isRunning && (
                <circle r="6" fill="#ffffff" filter="drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))">
                    <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
                </circle>
            )}
        </>
    );
};

export default memo(BioSnakeEdge);
