// frontend/js/ui/renderers/product-list.js
import { inventory, newProductCounter } from '../../app-state.js';
import { permissionService } from '../../services/permissions.js';
import { populateLocationDropdown, populateCategoryDropdown } from '../components/dropdowns.js';
import { generateUniqueSku } from '../../utils/product.js';

export const renderProductList = () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const productGrid = appContent.querySelector('#product-grid');
    if (!productGrid) return;
    
    const searchInput = appContent.querySelector('#product-search-input');
    const categoryFilterEl = appContent.querySelector('#product-category-filter');
    const locationFilterEl = appContent.querySelector('#product-location-filter');

    // Show/hide Add Item container
    appContent.querySelector('#add-item-container').style.display = permissionService.can('CREATE_ITEM') ? 'block' : 'none';
    
    // Populate the "Add Product" form dropdowns
    const addForm = appContent.querySelector('#add-item-form');
    if (addForm) {
        populateLocationDropdown(addForm.querySelector('#add-to'));
        populateCategoryDropdown(addForm.querySelector('#add-product-category'));
        
        if (!addForm.querySelector('#add-product-id').value) {
            addForm.querySelector('#add-product-id').value = generateUniqueSku();
        }
        if (!addForm.querySelector('#add-product-name').value) {
            addForm.querySelector('#add-product-name').value = `New Product ${newProductCounter}`;
        }
    }
    
    // Populate the FILTER dropdowns
    if (categoryFilterEl) {
        populateCategoryDropdown(categoryFilterEl, true); 
    }
    if (locationFilterEl) {
        populateLocationDropdown(locationFilterEl, true);
    }

    // Read filter values
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const categoryFilter = categoryFilterEl ? categoryFilterEl.value : 'all';
    const locationFilter = locationFilterEl ? locationFilterEl.value : 'all';

    productGrid.innerHTML = ''; 
    let productsFound = 0;
    
    const LOW_STOCK_THRESHOLD = 10;

    const productsArray = Array.from(inventory.entries());
    productsArray.reverse(); // Show newest first

    productsArray.forEach(([productId, product]) => {
        // Filter logic
        if (product.is_deleted) return;
        
        const productName = product.productName.toLowerCase();
        const sku = productId.toLowerCase();
        if (searchTerm && !productName.includes(searchTerm) && !sku.includes(searchTerm)) {
            return;
        }
        if (categoryFilter !== 'all' && product.category !== categoryFilter) {
            return;
        }
        if (locationFilter !== 'all') {
            const stockAtLocation = product.locations.get(locationFilter) || 0;
            if (stockAtLocation <= 0) {
                return;
            }
        }

        productsFound++;

        // Render product card
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.dataset.productId = productId;

        let totalStock = 0;
        product.locations.forEach(qty => totalStock += qty);

        const imageUrl = product.imageUrl || '';
        
        // vvv MODIFIED: Removed 'dark:text-slate-200' and 'dark:text-indigo-300' vvv
        const stockColorClass = totalStock <= LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-slate-800'; 
        const priceColorClass = 'text-indigo-600'; 
        // ^^^ END MODIFICATION ^^^

        productCard.innerHTML = `
            ${imageUrl ? 
                `<img src="${imageUrl}" alt="${product.productName}" class="product-card-image" onerror="this.style.display='none'; this.parentElement.querySelector('.product-card-placeholder').style.display='flex';">` : 
                ``
            }
            <div class="product-card-placeholder" style="${imageUrl ? 'display: none;' : 'display: flex;'}">
                <i class="ph-bold ph-package"></i>
            </div>
            
            <div class="product-card-content">
                <div class="flex-1">
                    <p class="text-xs font-medium text-indigo-600 mb-1">${product.category || 'Uncategorized'}</p>
                    <h3 class="font-semibold text-base text-slate-800 truncate" title="${product.productName}">${product.productName}</h3>
                    <p class="text-xs text-slate-500 mb-2">${productId}</p>
                </div>
                
                <div class="flex justify-between items-center text-sm font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span class="text-slate-600">Price:</span>
                    <span class="${priceColorClass}">₹${(product.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div class="flex justify-between items-center text-sm font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span class="text-slate-600">Total Stock:</span>
                    <span class="font-semibold ${stockColorClass}">${totalStock} units</span>
                </div>
            </div>
        `;
        productGrid.appendChild(productCard);
    });

    // Handle empty state
    if (productsFound === 0) {
        let message = 'No products found.';
        if (inventory.size === 0) {
            message = `No products in inventory. ${permissionService.can('CREATE_ITEM') ? 'Add one above!' : ''}`;
        } else if (searchTerm) {
            message = `No products found matching "${searchTerm}".`;
        } else if (categoryFilter !== 'all' || locationFilter !== 'all') {
            message = 'No products match the current filters.';
        }
        productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-4">${message}</p>`;
    }
};