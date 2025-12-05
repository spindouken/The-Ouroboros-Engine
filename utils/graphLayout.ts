import { Node, Edge } from '../types';

interface TreeNode {
    id: string;
    width: number;
    height: number;
    children: TreeNode[];
    x: number;
    y: number;
    data: Node;
}

export const calculateLayout = (nodes: Node[], edges: Edge[], mode: 'plan' | 'refine'): Node[] => {
    if (nodes.length === 0) return [];

    const nodeMap = new Map<string, TreeNode>();
    nodes.forEach(n => {
        nodeMap.set(n.id, {
            id: n.id,
            width: 250, // Approximate width of node card
            height: 100, // Approximate height
            children: [],
            x: 0,
            y: 0,
            data: n
        });
    });

    // Build Tree
    const roots = new Set<string>(nodeMap.keys());

    edges.forEach(e => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);

        if (source && target) {
            if (mode === 'plan') {
                // Parent = Source
                source.children.push(target);
                roots.delete(target.id);
            } else {
                // Parent = Target (Refine mode: Tribunal <- Alchemist <- Lead <- Specialist)
                target.children.push(source);
                roots.delete(source.id);
            }
        }
    });

    // Sort children for consistent ordering (e.g. by ID or Department)
    nodeMap.forEach(node => {
        node.children.sort((a, b) => a.id.localeCompare(b.id));
    });

    // Layout Constants
    const X_SPACING = 400;
    const Y_SPACING = 150;

    // Recursive Layout Function
    // Returns the total height of the subtree
    const layoutNode = (node: TreeNode, depth: number): number => {
        if (node.children.length === 0) {
            // Leaf
            return Y_SPACING;
        }

        let totalHeight = 0;
        node.children.forEach(child => {
            totalHeight += layoutNode(child, depth + 1);
        });

        // Center parent vertically relative to children
        // Children are stacked starting from current Y cursor?
        // No, we need to assign Y coordinates.

        // Let's do a second pass or accumulate Y.
        // Actually, simpler:
        // 1. Layout children.
        // 2. Parent Y = Average of first and last child Y.

        return totalHeight;
    };

    // We need to track current Y position for each depth? 
    // Or just global Y counter?
    // Standard Reingold-Tilford is complex.
    // Simple approach: DFS. Keep track of next available Y.

    let currentY = 0;

    const assignPositions = (node: TreeNode, depth: number) => {
        if (node.children.length === 0) {
            node.y = currentY;
            currentY += Y_SPACING;
        } else {
            node.children.forEach(child => assignPositions(child, depth + 1));
            // Center parent
            const firstChild = node.children[0];
            const lastChild = node.children[node.children.length - 1];
            node.y = (firstChild.y + lastChild.y) / 2;
        }

        // Assign X
        // Plan: Depth * Spacing
        // Refine: (MaxDepth - Depth) * Spacing? 
        // We don't know MaxDepth yet. 
        // Let's just assign Depth * Spacing for now, and invert later if needed.
        node.x = depth * X_SPACING;
    };

    // Handle multiple roots (forest)
    Array.from(roots).forEach(rootId => {
        const root = nodeMap.get(rootId);
        if (root) {
            assignPositions(root, 0);
            // Add spacing between trees
            currentY += Y_SPACING;
        }
    });

    // Post-processing for Refine Mode
    if (mode === 'refine') {
        // Invert X: Find max X, subtract current X.
        let maxX = 0;
        nodeMap.forEach(n => {
            if (n.x > maxX) maxX = n.x;
        });

        nodeMap.forEach(n => {
            n.x = maxX - n.x;
        });
    }

    // Convert back to Node[]
    return Array.from(nodeMap.values()).map(tn => ({
        ...tn.data,
        x: tn.x,
        y: tn.y
    }));
};
