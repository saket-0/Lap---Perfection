// frontend/js/lib/charts/analytics.js
// import { API_BASE_URL } from '../../../config.js';
import { blockchain, globalLocations, globalCategories, inventory } from '../../app-state.js';
import { addChart } from './helpers.js';
import { showError } from '../../ui/components/notifications.js';
import { getChartColors, SEMANTIC_PALETTE, CATEGORICAL_PALETTE } from './colors.js';

// vvv REVERTED HELPER FUNCTION vvv
/**
 * Generates a custom HTML legend for a chart.
 * @param {Chart} chart - The Chart.js instance.
 * @param {string} containerId - The ID of the div to inject the legend into.
 */
const generateHTMLLegend = (chart, containerId) => {
    const legendContainer = document.getElementById(containerId);
    if (!legendContainer) return;

    const legendItems = chart.data.labels.map((label, index) => {
        const color = chart.data.datasets[0].backgroundColor[index];
        return `
            <div class="legend-item">
                <span class="legend-color-box" style="background-color: ${color}"></span>
                <span class="legend-label">${label}</span>
            </div>
        `;
    });

    legendContainer.innerHTML = `<div class="chart-legend">${legendItems.join('')}</div>`;
};
// ^^^ END REVERT ^^^

// --- Main Analytics Page Renderer ---
// ... (This function is unchanged)
export const renderAnalyticsPage = async () => {
    try {
        // Render charts that use local data
        renderTxVelocityChart();
        renderTxHeatmapChart();
        renderInventoryDistributionChart(); 
        renderInventoryCategoryChart(); 

        // Fetch consolidated KPIs
        const response = await fetch(`${API_BASE_URL}/api/analytics/kpis`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to load analytics KPIs');
        }
        const kpis = await response.json();

        // Render KPI lists
        renderTopMoversList(kpis.topMovers);
        renderHighValueList(kpis.highValueItems);
        renderStaleInventoryList(kpis.staleInventory);
        renderMostActiveUsers(kpis.mostActiveUsers);
        
        // Render charts from KPI data
        renderTxMixLineChart(kpis.txMixLineData, kpis.dateLabels);
        renderLocationActivityChart(kpis.locationActivityData, kpis.dateLabels);
        renderStockValueChart(kpis.stockValueLineData, kpis.dateLabels);

    } catch (error) {
        console.error("Failed to render analytics page:", error);
        showError(error.message);
    }
};

// --- KPI List Renderers ---
// (These functions are unchanged)
const renderTopMoversList = (topMovers) => {
    const container = document.getElementById('analytics-top-movers');
    if (!container) return;
    container.innerHTML = '';
    
    if (topMovers.length === 0) {
        container.innerHTML = '<p class="text-slate-500">No stock-out transactions in 30 days.</p>';
        return;
    }
    
    topMovers.forEach(item => {
        container.innerHTML += `
            <div class="flex justify-between items-center clickable-stat-item" data-product-id="${item.sku}">
                <span class="truncate" title="${item.name} (${item.sku})">${item.name}</span>
                <span class="font-semibold text-indigo-600">${item.quantity} units</span>
            </div>
        `;
    });
};

const renderHighValueList = (highValueItems) => {
    const container = document.getElementById('analytics-high-value');
    if (!container) return;
    container.innerHTML = '';
    
    if (highValueItems.length === 0) {
        container.innerHTML = '<p class="text-slate-500">No items in stock.</p>';
        return;
    }
    
    highValueItems.forEach(item => {
        container.innerHTML += `
            <div class="flex justify-between items-center clickable-stat-item" data-product-id="${item.sku}">
                <span class="truncate" title="${item.name} (${item.sku})">${item.name}</span>
                <span class="font-semibold text-indigo-600">₹${item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        `;
    });
};

const renderStaleInventoryList = (staleInventory) => {
    const container = document.getElementById('analytics-stale-inventory');
    if (!container) return;
    container.innerHTML = '';
    
    if (staleInventory.length === 0) {
        container.innerHTML = '<p class="text-slate-500">All items are moving!</p>';
        return;
    }
    
    staleInventory.forEach(item => {
        container.innerHTML += `
            <div class="flex justify-between items-center clickable-stat-item" data-product-id="${item.sku}">
                <span class="truncate" title="${item.name} (${item.sku})">${item.name}</span>
                <span class="font-semibold text-red-600">${item.stock} units</span>
            </div>
        `;
    });
};

const renderMostActiveUsers = (activeUsers) => {
    const container = document.getElementById('analytics-active-users');
    if (!container) return;
    container.innerHTML = '';
    
    if (!activeUsers || activeUsers.length === 0) {
        container.innerHTML = '<p class="text-slate-500">No user activity in 30 days.</p>';
        return;
    }
    
    activeUsers.forEach(user => {
        container.innerHTML += `
            <div class="flex justify-between items-center">
                <span class="truncate" title="${user.name}">${user.name}</span>
                <span class="font-semibold text-indigo-600">${user.count} actions</span>
            </div>
        `;
    });
};


// --- Chart Renderers (Local Data) ---

const renderTxVelocityChart = () => {
    // ... (This function is unchanged)
    const labels = [];
    const txInMap = new Map();
    const txOutMap = new Map();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toISOString().split('T')[0];
        labels.push(label);
        txInMap.set(label, 0);
        txOutMap.set(label, 0);
    }

    blockchain.forEach(block => {
        if (block.transaction.txType === 'GENESIS') return;
        
        const dateStr = new Date(block.timestamp).toISOString().split('T')[0];
        const txType = block.transaction.txType;
        
        if (txInMap.has(dateStr) && (txType === 'STOCK_IN' || txType === 'CREATE_ITEM')) {
            txInMap.set(dateStr, txInMap.get(dateStr) + 1);
        }
        if (txOutMap.has(dateStr) && txType === 'STOCK_OUT') {
            txOutMap.set(dateStr, txOutMap.get(dateStr) + 1);
        }
    });

    const txInData = labels.map(label => txInMap.get(label));
    const txOutData = labels.map(label => txOutMap.get(label));

    const ctx = document.getElementById('tx-velocity-chart')?.getContext('2d');
    if (!ctx) return;
    
    const velocityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Stock In / Create',
                    data: txInData,
                    backgroundColor: SEMANTIC_PALETTE.stockIn,
                },
                {
                    label: 'Stock Out',
                    data: txOutData,
                    backgroundColor: SEMANTIC_PALETTE.stockOut,
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
    addChart(velocityChart);
};

const renderInventoryDistributionChart = () => {
    const locationValues = new Map();
    
    globalLocations.forEach(loc => {
        if (!loc.is_archived) {
            locationValues.set(loc.name, 0);
        }
    });

    inventory.forEach(product => {
        const price = product.price || 0;
        product.locations.forEach((qty, location) => {
            if (locationValues.has(location)) {
                locationValues.set(location, locationValues.get(location) + (qty * price));
            }
        });
    });

    const ctx = document.getElementById('inventory-distribution-chart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = Array.from(locationValues.keys());
    const data = Array.from(locationValues.values());
    const colors = getChartColors(labels.length);

    const pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inventory Value',
                data: data,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: false 
                },
                // vvv MODIFIED TOOLTIP vvv
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                // Get total
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                // Calculate percentage
                                const percentage = (context.parsed / total * 100).toFixed(1);
                                // Format value
                                const value = context.parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                // Combine
                                label += `₹${value} (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                }
                // ^^^ END MODIFICATION ^^^
            }
        }
    });
    addChart(pieChart);
    
    generateHTMLLegend(pieChart, 'inventory-distribution-legend');
};

const renderTxHeatmapChart = () => {
    // ... (This function is unchanged)
    const hourCounts = Array(24).fill(0);
    
    blockchain.forEach(block => {
        if (block.transaction.txType === 'GENESIS') return;
        const hour = new Date(block.timestamp).getUTCHours();
        hourCounts[hour]++;
    });

    const labels = Array.from({length: 24}, (_, i) => `${i}:00`);

    const ctx = document.getElementById('tx-heatmap-chart')?.getContext('2d');
    if (!ctx) return;

    const heatmapChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transactions by Hour (UTC)',
                data: hourCounts,
                backgroundColor: CATEGORICAL_PALETTE[0], // Use primary brand color
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    addChart(heatmapChart);
};

const renderInventoryCategoryChart = () => {
    const categoryValues = new Map();

    globalCategories.forEach(cat => {
        if (!cat.is_archived) {
            categoryValues.set(cat.name, 0);
        }
    });

    inventory.forEach(product => {
        const price = product.price || 0;
        const category = product.category || 'Uncategorized';
        let totalStock = 0;
        product.locations.forEach(qty => totalStock += qty);
        
        const currentCategoryValue = categoryValues.get(category) || 0;
        if (categoryValues.has(category)) {
             categoryValues.set(category, currentCategoryValue + (totalStock * price));
        }
    });

    const ctx = document.getElementById('inventory-category-chart')?.getContext('2d');
    if (!ctx) return;

    const labels = Array.from(categoryValues.keys());
    const data = Array.from(categoryValues.values());
    const colors = getChartColors(labels.length);

    const categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inventory Value',
                data: data,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: false 
                },
                // vvv MODIFIED TOOLTIP vvv
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                // Get total
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                // Calculate percentage
                                const percentage = (context.parsed / total * 100).toFixed(1);
                                // Format value
                                const value = context.parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                // Combine
                                label += `₹${value} (${percentage}%)`;
                            }
                            return label;
                        }
                    }
                }
                // ^^^ END MODIFICATION ^^^
            }
        }
    });
    addChart(categoryChart);

    generateHTMLLegend(categoryChart, 'inventory-category-legend');
};

// --- Chart Renderers (KPI Data) ---
// (These functions are unchanged)
const renderTxMixLineChart = (data, labels) => {
    const ctx = document.getElementById('tx-mix-line-chart')?.getContext('2d');
    if (!ctx || !data || !labels) return; 

    const datasets = [
        {
            label: 'Create Item',
            data: data['CREATE_ITEM'] || [],
            borderColor: SEMANTIC_PALETTE.create,
            backgroundColor: SEMANTIC_PALETTE.create + '1A', 
            fill: false,
            tension: 0.1
        },
        {
            label: 'Stock In',
            data: data['STOCK_IN'] || [],
            borderColor: SEMANTIC_PALETTE.stockIn,
            backgroundColor: SEMANTIC_PALETTE.stockIn + '1A',
            fill: false,
            tension: 0.1
        },
        {
            label: 'Stock Out',
            data: data['STOCK_OUT'] || [],
            borderColor: SEMANTIC_PALETTE.stockOut,
            backgroundColor: SEMANTIC_PALETTE.stockOut + '1A',
            fill: false,
            tension: 0.1
        },
        {
            label: 'Move',
            data: data['MOVE'] || [],
            borderColor: SEMANTIC_PALETTE.move,
            backgroundColor: SEMANTIC_PALETTE.move + '1A',
            fill: false,
            tension: 0.1
        }
    ];

    const lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: { 
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `${context.parsed.y} units`;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return `${value} units`;
                        }
                    }
                } 
            }
        }
    });
    addChart(lineChart);
};

const renderLocationActivityChart = (data, labels) => {
    const ctx = document.getElementById('location-activity-chart')?.getContext('2d');
    if (!ctx || !data || !labels) return; 

    const datasets = [];
    const colors = getChartColors(Object.keys(data).length);
    let colorIndex = 0;

    for (const locationName in data) {
        datasets.push({
            label: locationName,
            data: data[locationName],
            borderColor: colors[colorIndex],
            backgroundColor: colors[colorIndex] + '1A', // 10% opacity
            fill: false,
            tension: 0.1
        });
        colorIndex++;
    }

    const lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 
                    }
                } 
            }
        }
    });
    addChart(lineChart);
};

const renderStockValueChart = (data, labels) => {
    const ctx = document.getElementById('stock-value-chart')?.getContext('2d');
    if (!ctx || !data || !labels) return; 

    const datasets = [
        {
            label: 'Value In (Create/Stock-In)',
            data: data['STOCK_IN'] || [],
            borderColor: SEMANTIC_PALETTE.stockIn,
            backgroundColor: SEMANTIC_PALETTE.stockIn + '1A',
            fill: true,
            tension: 0.1
        },
        {
            label: 'Value Out (Stock-Out)',
            data: data['STOCK_OUT'] || [],
            borderColor: SEMANTIC_PALETTE.stockOut,
            backgroundColor: SEMANTIC_PALETTE.stockOut + '1A',
            fill: true,
            tension: 0.1
        }
    ];

    const valueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: { 
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `₹${context.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        // Format as currency
                        callback: function(value, index, values) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                } 
            }
        }
    });
    addChart(valueChart);
};