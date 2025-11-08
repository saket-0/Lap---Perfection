// Lap/js/chart-renderer.js

// Keep track of charts to destroy them on navigation
let currentCharts = [];

const destroyCurrentCharts = () => {
    currentCharts.forEach(chart => chart.destroy());
    currentCharts = [];
};

const renderItemStockChart = (productId) => {
    const itemHistory = blockchain
        .filter(block => block.transaction.itemSku === productId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort chronological

    if (itemHistory.length === 0) return;

    const labels = [];
    const dataPoints = [];
    let currentStock = 0;

    itemHistory.forEach(block => {
        const tx = block.transaction;
        switch (tx.txType) {
            case 'CREATE_ITEM':
                currentStock += tx.quantity;
                break;
            case 'STOCK_IN':
                currentStock += tx.quantity;
                break;
            case 'STOCK_OUT':
                currentStock -= tx.quantity;
                break;
            case 'MOVE':
                break;
        }
        labels.push(new Date(block.timestamp).toLocaleString());
        dataPoints.push(currentStock);
    });

    const ctx = document.getElementById('item-stock-chart')?.getContext('2d');
    if (!ctx) return;
    
    const stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Stock',
                data: dataPoints,
                borderColor: '#4f46e5',
                backgroundColor: '#eef2ff',
                fill: true,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    currentCharts.push(stockChart);
};


// *** MODIFIED: This function now calls the restored charts ***
const renderAnalyticsPage = async () => {
    try {
        // Render the charts that use local data
        renderTxVelocityChart();
        renderTxHeatmapChart();
        renderInventoryDistributionChart(); // <-- ADDED BACK
        renderInventoryCategoryChart(); // <-- ADDED BACK

        // Fetch the new consolidated KPIs
        const response = await fetch(`${API_BASE_URL}/api/analytics/kpis`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to load analytics KPIs');
        }
        const kpis = await response.json();

        // Render the new charts/lists
        renderTransactionMixChart(kpis.txMix);
        renderTopMoversList(kpis.topMovers);
        renderHighValueList(kpis.highValueItems);
        renderStaleInventoryList(kpis.staleInventory);

    } catch (error) {
        console.error("Failed to render analytics page:", error);
        showError(error.message);
    }
};


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
    currentCharts.push(velocityChart);
};

// *** ADDED BACK: Renders Inventory Value by Location ***
const renderInventoryDistributionChart = () => {
    const locationValues = new Map();
    
    // Use globalLocations to get the source of truth for locations
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
    currentCharts.push(pieChart);
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
    currentCharts.push(heatmapChart);
};

// *** ADDED BACK: Renders Inventory Value by Category ***
const renderInventoryCategoryChart = () => {
    const categoryValues = new Map();

    // Use globalCategories to get the source of truth
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
        // Only add if the category is known and not archived
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
    currentCharts.push(categoryChart);
};

// --- New KPI Functions from last step ---

const renderTransactionMixChart = (txMixData) => {
    const ctx = document.getElementById('tx-mix-chart')?.getContext('2d');
    if (!ctx) return;

    const labels = txMixData.map(d => d[0]);
    const data = txMixData.map(d => d[1]);

    const pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transaction Mix',
                data: data,
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f97316', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } }
        }
    });
    currentCharts.push(pieChart);
};

// *** MODIFIED: Added class and data-product-id ***
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

// *** MODIFIED: Added class and data-product-id ***
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

// *** MODIFIED: Added class and data-product-id ***
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

// *** "renderProfileLocationChart" FUNCTION REMOVED ***