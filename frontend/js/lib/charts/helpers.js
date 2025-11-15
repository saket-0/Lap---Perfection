// frontend/js/lib/charts/helpers.js

// Keep track of charts to destroy them on navigation
let currentCharts = [];

export const destroyCurrentCharts = () => {
    currentCharts.forEach(chart => chart.destroy());
    currentCharts = [];
};

export const addChart = (chartInstance) => {
    if (chartInstance) {
        currentCharts.push(chartInstance);
    }
};

export const updateCharts = () => {
    currentCharts.forEach(chart => chart.update());
};