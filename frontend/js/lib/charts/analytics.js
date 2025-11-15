// frontend/js/lib/charts/analytics.js
import { API_BASE_URL } from '../../../config.js';
import { blockchain, globalLocations, globalCategories, inventory } from '../../app-state.js';
import { addChart } from './helpers.js';
import { showError } from '../../ui/components/notifications.js';

// --- Main Analytics Page Renderer ---

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
        
        // Render charts from KPI data
        renderTxMixLineChart(kpis.txMixLineData, kpis.dateLabels);
        renderLocationActivityChart(kpis.locationActivityData, kpis.dateLabels);

    } catch (error) {
        console.error("Failed to render analytics page:", error);
        showError(error.message);
    }
};

// --- KPI List Renderers ---

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
                <span class="font-semibold text-indigo-600">₹${item.value.toFixed(2)}</span>
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


// --- Chart Renderers (Local Data) ---

const renderTxVelocityChart = () => {
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
                    backgroundColor: '#10b981',
                },
                {
                    label: 'Stock Out',
                    data: txOutData,
                    backgroundColor: '#ef4444',
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
    
    const pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Array.from(locationValues.keys()),
            datasets: [{
                label: 'Inventory Value',
                data: Array.from(locationValues.values()),
                backgroundColor: ['#3b82f6', '#f97316', '#10b981', '#ef4444', '#6b7280']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } }
        }
    });
    addChart(pieChart);
};

const renderTxHeatmapChart = () => {
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
                backgroundColor: '#4f46e5',
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

    const categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Array.from(categoryValues.keys()),
            datasets: [{
                label: 'Inventory Value',
                data: Array.from(categoryValues.values()),
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f97316', '#ef4444', '#6b7280', '#fbbf24']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } }
        }
    });
    addChart(categoryChart);
};

// --- Chart Renderers (KPI Data) ---

const renderTxMixLineChart = (data, labels) => {
    const ctx = document.getElementById('tx-mix-line-chart')?.getContext('2d');
    if (!ctx || !data || !labels) return;

    const datasets = [
        {
            label: 'Create Item',
            data: data['CREATE_ITEM'] || [],
            borderColor: '#10b981', // green-500
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.1
        },
        {
            label: 'Stock In',
            data: data['STOCK_IN'] || [],
            borderColor: '#3b82f6', // blue-500
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: false,
            tension: 0.1
        },
        {
            label: 'Stock Out',
            data: data['STOCK_OUT'] || [],
            borderColor: '#ef4444', // red-500
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: false,
            tension: 0.1
        },
        {
            label: 'Move',
            data: data['MOVE'] || [],
            borderColor: '#f97316', // orange-500
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
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
            plugins: { legend: { position: 'top' } },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Ensure we only count in whole numbers
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

    const colors = ['#4f46e5', '#f97316', '#10b981', '#ef4444', '#6b7280', '#fbbf24', '#8b5cf6'];
    let colorIndex = 0;

    const datasets = [];
    for (const locationName in data) {
        datasets.push({
            label: locationName,
            data: data[locationName],
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: colors[colorIndex % colors.length] + '1A', // 10% opacity
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
                        stepSize: 1 // Ensure we only count in whole numbers
                    }
                } 
            }
        }
    });
    addChart(lineChart);
};