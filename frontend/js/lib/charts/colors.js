// frontend/js/lib/charts/colors.js

// A centralized place for chart colors to ensure consistency.

// 1. Standard Categorical Palette
// (Tailwind Colors: Indigo, Sky, Emerald, Amber, Rose, Violet)
export const CATEGORICAL_PALETTE = [
    '#4f46e5', // Indigo 600
    '#0ea5e9', // Sky 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#f43f5e', // Rose 500
    '#8b5cf6', // Violet 500
];

// 2. Semantic Palette (for specific transaction types)
export const SEMANTIC_PALETTE = {
    stockIn: '#10b981',   // Green 500
    stockOut: '#ef4444',  // Red 500
    create: '#10b981',    // Green 500 (same as stockIn)
    move: '#3b82f6',      // Blue 500
    other: '#6b7280',     // Slate 500
};

/**
 * Gets a repeating list of colors for a chart.
 * @param {number} count - The number of datasets or data points.
 * @returns {string[]} An array of color hex codes.
 */
export const getChartColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
    }
    return colors;
};