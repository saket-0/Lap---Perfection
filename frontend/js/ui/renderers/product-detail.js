// frontend/js/ui/renderers/product-detail.js
import { inventory, blockchain, globalLocations } from '../../app-state.js'; // <-- No change needed here
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

    // vvv DEFINE LOW STOCK THRESHOLD vvv
    const LOW_STOCK_THRESHOLD = 10;
    // ^^^ END DEFINITION ^^^

    // Get elements
    const editButton = appContent.querySelector('#product-edit-toggle-button');
    const editNameInput = appContent.querySelector('#edit-product-name');
    const editPriceInput = appContent.querySelector('#edit-product-price');
    const editCategorySelect = appContent.querySelector('#edit-product-category');
    const editImageUrlInput = appContent.querySelector('#edit-product-image-url'); // <-- ADDED
    
    const displayName = appContent.querySelector('#detail-product-name');
    const displayId = appContent.querySelector('#detail-product-id');
    const displayCategory = appContent.querySelector('#detail-product-category');
    const displayPrice = appContent.querySelector('#detail-product-price');
    
    // --- MODIFIED IMAGE RENDERING ---
    const displayImage = appContent.querySelector('#product-detail-image');
    const displayPlaceholder = appContent.querySelector('#product-detail-placeholder');
    
    const sharedIdInput = appContent.querySelector('#update-product-id');

    const imageUrl = product.imageUrl || '';
    if (displayImage && displayPlaceholder) {
        if (imageUrl) {
            displayImage.src = imageUrl;
            displayImage.style.display = 'block';
            displayPlaceholder.style.display = 'none';
        } else {
            displayImage.src = ""; 
            displayImage.style.display = 'none';
            displayPlaceholder.style.display = 'flex';
        }
    }

    // Populate Display View
    displayName.textContent = product.productName;
    displayId.textContent = productId;
    sharedIdInput.value = productId;

    const price = product.price || 0;
    // vvv MODIFIED PRICE DISPLAY vvv
    displayPrice.textContent = `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    displayPrice.classList.remove('text-slate-700');
    displayPrice.classList.add('text-indigo-600'); // Use brand color
    // ^^^ END MODIFICATION ^^^
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
        
        // vvv SET DYNAMIC COLOR CLASS vvv
        const stockColorClass = qty <= LOW_STOCK_THRESHOLD ? 'font-bold text-red-600' : 'font-medium text-slate-800 dark:text-slate-200';
        // ^^^ END SET ^^^

        if (qty > 0 || (locData && !isArchived)) {
            // vvv MODIFIED THIS BLOCK vvv
            stockLevelsDiv.innerHTML += `
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">${location}:</span>
                    <span class="${stockColorClass}">${qty} units</span>
                </div>`;
            // ^^^ END MODIFICATION ^^^
        }
    });

    // vvv MODIFIED TOTAL STOCK DISPLAY vvv
    const totalStockEl = appContent.querySelector('#detail-total-stock');
    const totalStockColorClass = totalStock <= LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-indigo-600';
    totalStockEl.textContent = `${totalStock} units`;
    totalStockEl.classList.remove('text-indigo-600', 'text-red-600');
    totalStockEl.classList.add(totalStockColorClass);
    // ^^^ END MODIFICATION ^^^
    
    // Populate Edit Form
    if (editButton) {
        editNameInput.value = product.productName;
        editPriceInput.value = price.toFixed(2); // .toFixed() is fine for an input field
        populateCategoryDropdown(editCategorySelect);
        editCategorySelect.value = product.category || 'Uncategorized';
        editImageUrlInput.value = imageUrl; // <-- ADDED
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