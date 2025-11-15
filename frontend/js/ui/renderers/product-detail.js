// frontend/js/ui/renderers/product-detail.js
import { inventory, blockchain, globalLocations } from '../../app-state.js';
import { permissionService } from '../../services/permissions.js';
import { showError } from '../components/notifications.js';
import { populateLocationDropdown, populateCategoryDropdown } from '../components/dropdowns.js';
import { createLedgerBlockElement } from '../components/ledger-block.js';
import { renderItemStockChart } from '../../lib/charts/product.js';
// We'll create navigateTo in the router.js file later
// For now, we assume it's globally available or passed in
// To make this modular, we should import the router itself.
// import { navigateTo } from '../router.js'; 

/**
 * Toggles the product detail view between display and edit modes.
 * @param {boolean} isEditing - True to show edit form, false to show display info.
 */
const toggleProductEditMode = (isEditing) => {
    const displayView = document.getElementById('product-display-view');
    const editView = document.getElementById('product-edit-view');
    const editButton = document.getElementById('product-edit-toggle-button');

    if (!displayView || !editView || !editButton) return;

    if (isEditing) {
        displayView.classList.add('hidden');
        editView.classList.remove('hidden');
        editButton.classList.add('hidden');
    } else {
        displayView.classList.remove('hidden');
        editView.classList.add('hidden');
        editButton.classList.remove('hidden');
    }
};

const renderItemHistory = (productId) => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const historyDisplay = appContent.querySelector('#item-history-display');
    if (!historyDisplay) return;
    historyDisplay.innerHTML = '';
    
    const itemHistory = blockchain
        .filter(block => block.transaction.itemSku === productId)
        .reverse();

    if (itemHistory.length === 0) {
        historyDisplay.innerHTML = '<p class="text-sm text-slate-500">No history found for this item.</p>';
        return;
    }

    itemHistory.forEach(block => {
        historyDisplay.appendChild(createLedgerBlockElement(block));
    });
};

export const renderProductDetail = (productId, navigateTo) => { // Accept navigateTo
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    const product = inventory.get(productId);
    if (!product || product.is_deleted) {
        showError(`Product ${productId} not found or has been deleted.`);
        if (navigateTo) navigateTo('products'); // Use the passed router function
        return; 
    }

    // Get elements
    const editButton = appContent.querySelector('#product-edit-toggle-button');
    const editNameInput = appContent.querySelector('#edit-product-name');
    const editPriceInput = appContent.querySelector('#edit-product-price');
    const editCategorySelect = appContent.querySelector('#edit-product-category');
    
    const displayName = appContent.querySelector('#detail-product-name');
    const displayId = appContent.querySelector('#detail-product-id');
    const displayCategory = appContent.querySelector('#detail-product-category');
    const displayPrice = appContent.querySelector('#detail-product-price');
    
    const sharedIdInput = appContent.querySelector('#update-product-id');

    // Populate Display View
    displayName.textContent = product.productName;
    displayId.textContent = productId;
    sharedIdInput.value = productId;

    const price = product.price || 0;
    displayPrice.textContent = `₹${price.toFixed(2)}`;
    displayCategory.textContent = product.category || 'Uncategorized';

    // Populate Stock Update Forms
    populateLocationDropdown(appContent.querySelector('#update-location'));
    populateLocationDropdown(appContent.querySelector('#move-from-location'));
    populateLocationDropdown(appContent.querySelector('#move-to-location'));

    // Populate Stock Levels
    const stockLevelsDiv = appContent.querySelector('#detail-stock-levels');
    stockLevelsDiv.innerHTML = '';
    let totalStock = 0;

    const allProductLocations = new Set(globalLocations.map(l => l.name));
    product.locations.forEach((qty, loc) => allProductLocations.add(loc));

    allProductLocations.forEach(location => {
        const qty = product.locations.get(location) || 0;
        totalStock += qty;
        const locData = globalLocations.find(l => l.name === location);
        const isArchived = locData ? locData.is_archived : false;

        if (qty > 0 || (locData && !isArchived)) {
            stockLevelsDiv.innerHTML += `
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">${location}:</span>
                    <span class="font-medium text-slate-800">${qty} units</span>
                </div>`;
        }
    });

    appContent.querySelector('#detail-total-stock').textContent = `${totalStock} units`;
    
    // Populate Edit Form
    if (editButton) {
        editNameInput.value = product.productName;
        editPriceInput.value = price.toFixed(2);
        populateCategoryDropdown(editCategorySelect);
        editCategorySelect.value = product.category || 'Uncategorized';
        toggleProductEditMode(false); // Ensure edit form is hidden
    }

    // Show/Hide sections based on permissions and state
    const dangerZone = appContent.querySelector('#danger-zone-container');
    const updateStock = appContent.querySelector('#update-stock-container');
    const archivedMsg = appContent.querySelector('#product-archived-message');
    const deleteForm = appContent.querySelector('#delete-product-form');

    if (dangerZone) {
        dangerZone.style.display = permissionService.can('DELETE_ITEM') ? 'block' : 'none';
    }

    if (product.is_deleted) {
        if (updateStock) updateStock.style.display = 'none'; 
        if (editButton) editButton.style.display = 'none';
        if (dangerZone) dangerZone.style.display = 'block'; 
        if (archivedMsg) archivedMsg.style.display = 'block'; 
        if (deleteForm) deleteForm.style.display = 'none'; 
    } else {
        if (updateStock) updateStock.style.display = permissionService.can('UPDATE_STOCK') ? 'block' : 'none';
        if (editButton) editButton.style.display = permissionService.can('EDIT_ITEM') ? 'block' : 'none';
        if (archivedMsg) archivedMsg.style.display = 'none';
        if (deleteForm) deleteForm.style.display = 'block';
    }

    // Render sub-components
    renderItemHistory(productId);
    renderItemStockChart(productId);
};

// Export the toggle function so listeners can access it
export { toggleProductEditMode };