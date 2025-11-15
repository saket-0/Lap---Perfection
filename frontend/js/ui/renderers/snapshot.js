// frontend/js/ui/renderers/snapshot.js
import { inventory } from '../../app-state.js';

export const renderSnapshotView = (snapshotData) => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const { kpis, inventory: snapshotInventory, snapshotTime } = snapshotData;

    appContent.querySelector('#snapshot-time-display').textContent = new Date(snapshotTime).toLocaleString();
    appContent.querySelector('#kpi-snapshot-total-value').textContent = `₹${kpis.totalValue.toFixed(2)}`;
    appContent.querySelector('#kpi-snapshot-total-units').textContent = kpis.totalUnits;
    appContent.querySelector('#kpi-snapshot-transactions').textContent = kpis.transactionCount;

    const productGrid = appContent.querySelector('#snapshot-product-grid');
    productGrid.innerHTML = '';

    const inventoryMap = new Map(snapshotInventory);
    
    if (inventoryMap.size === 0) {
        productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">No products existed in the system at this time.</p>`;
        return;
    }

    inventoryMap.forEach((product, productId) => {
        if (product.is_deleted) return;

        const productCard = document.createElement('div');
        productCard.className = 'product-card opacity-80'; 

        const locationsMap = new Map(product.locations);
        let totalStock = 0;
        locationsMap.forEach(qty => totalStock += qty);

        productCard.innerHTML = `
            <div class="product-card-placeholder"><i class="ph-bold ph-package"></i></div>
            <div class="product-card-content">
                <h3 class="font-semibold text-lg text-indigo-700 truncate">${product.productName}</h3>
                <p class="text-xs text-slate-500 mb-1">${productId}</p>
                <p class="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full inline-block mb-2">${product.category || 'Uncategorized'}</p>
                <hr class="my-2">
                <div class="flex justify-between items-center text-sm font-semibold">
                    <span>Total Stock (at time):</span>
                    <span>${totalStock} units</span>
                </div>
            </div>
        `;
        productGrid.appendChild(productCard);
    });
};