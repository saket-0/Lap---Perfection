// frontend/js/ui/renderers/dashboard.js
// import { API_BASE_URL } from '../../../config.js';
import { inventory, blockchain } from '../../app-state.js';
import { permissionService } from '../../services/permissions.js';
import { createLedgerBlockElement } from '../components/ledger-block.js';

export const renderDashboard = async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    let totalUnits = 0;
    let totalValue = 0;
    let activeSkuCount = 0;
    inventory.forEach(product => {
        if (product.is_deleted) return;
        
        activeSkuCount++;
        let totalStock = 0;
        product.locations.forEach(qty => totalStock += qty);
        totalUnits += totalStock;
        totalValue += (product.price || 0) * totalStock;
    });

    appContent.querySelector('#kpi-total-value').textContent = `₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    appContent.querySelector('#kpi-total-units').textContent = totalUnits;
    appContent.querySelector('#kpi-total-skus').textContent = activeSkuCount;
    
    // vvv THIS LINE HAS BEEN REMOVED vvv
    // appContent.querySelector('#kpi-transactions').textContent = blockchain.length;
    // ^^^ END REMOVAL ^^^
    
    // --- Render Recent Activity ---
    const activityContainer = appContent.querySelector('#recent-activity-container');
    if (activityContainer && permissionService.can('VIEW_LEDGER')) {
        const activityList = appContent.querySelector('#recent-activity-list');
        const emptyMessage = appContent.querySelector('#recent-activity-empty');
        const viewLedgerLink = appContent.querySelector('#dashboard-view-ledger');

        viewLedgerLink.style.display = 'block';
        activityList.innerHTML = '';

        const recentBlocks = [...blockchain]
            .reverse()
            .filter(block => block.transaction.txType !== 'GENESIS')
            .slice(0, 5);

        if (recentBlocks.length === 0) {
            emptyMessage.style.display = 'block';
        } else {
            emptyMessage.style.display = 'none';
            recentBlocks.forEach(block => {
                activityList.appendChild(createLedgerBlockElement(block));
            });
        }
    } else if (activityContainer) {
        activityContainer.style.display = 'none';
    }

    // --- Render Low Stock Predictions ---
    const lowStockContainer = appContent.querySelector('#low-stock-container');
    if (lowStockContainer && permissionService.can('VIEW_PRODUCTS')) {
        const lowStockList = appContent.querySelector('#low-stock-list');
        const emptyMessage = appContent.querySelector('#low-stock-empty');
        const thresholdLabel = appContent.querySelector('#low-stock-threshold-label');
        
        lowStockList.innerHTML = '<p class="text-sm text-slate-500">Loading predictions...</p>';
        thresholdLabel.textContent = '(Based on 30-day velocity)';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/analytics/low-stock-predictions`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load predictions');
            
            const lowStockProducts = await response.json();
            lowStockList.innerHTML = ''; 

            if (lowStockProducts.length === 0) {
                emptyMessage.style.display = 'block';
            } else {
                emptyMessage.style.display = 'none';
                lowStockProducts.forEach(product => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'low-stock-item p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer';
                    itemElement.dataset.productId = product.id;
                    itemElement.innerHTML = `
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-semibold text-indigo-700">${product.name}</p>
                                <p class="text-xs text-slate-500">${product.id}</p>
                            </div>
                            <div class="text-right">
                                <span class="text-lg font-bold text-red-600">${product.stock} units</span>
                                <p class="text-xs font-medium text-red-700">Low in ~${product.daysToEmpty} days</p>
                            </div>
                        </div>
                    `;
                    lowStockList.appendChild(itemElement);
                });
            }
        } catch (error) {
            console.error(error.message);
            lowStockList.innerHTML = `<p class="text-sm text-red-500">Could not load predictions.</p>`;
        }

    } else if (lowStockContainer) {
        lowStockContainer.style.display = 'none';
    }
};