// frontend/js/lib/charts/product.js
import { blockchain } from '../../app-state.js';
import { addChart } from './helpers.js';
// vvv NEW IMPORT vvv
import { CATEGORICAL_PALETTE } from './colors.js';
// ^^^ END IMPORT ^^^

export const renderItemStockChart = (productId) => {
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
                // No change in *total* stock
                break;
        }
        labels.push(new Date(block.timestamp).toLocaleString());
        dataPoints.push(currentStock);
    });

    const ctx = document.getElementById('item-stock-chart')?.getContext('2d');
    if (!ctx) return;
    
    // vvv MODIFIED vvv
    const currentTheme = localStorage.getItem('bims_theme') || 'light';
    const primaryColor = CATEGORICAL_PALETTE[0]; // Get main brand color
    const chartBackgroundColor = currentTheme === 'light' 
        ? primaryColor + '1A' // 10% opacity
        : 'rgba(79, 70, 229, 0.2)'; // Dark indigo (transparent)
    // ^^^ END MODIFICATION ^^^

    const stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Stock',
                data: dataPoints,
                // vvv MODIFIED vvv
                borderColor: primaryColor,
                backgroundColor: chartBackgroundColor,
                fill: true,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: primaryColor,
                // ^^^ END MODIFICATION ^^^
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#312e81'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    
    addChart(stockChart);
};