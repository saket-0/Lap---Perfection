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

        productCard.innerHTML = `
            <div class="product-card-placeholder"><i class="ph-bold ph-package"></i></div>
            <div class="product-card-content">
                <h3 class="font-semibold text-lg text-indigo-700 truncate">${product.productName}</h3>
                <p class="text-xs text-slate-500 mb-1">${productId}</p>
                <p class="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full inline-block mb-2">${product.category || 'Uncategorized'}</p>
                <hr class="my-2">
                <div class="flex justify-between items-center text-sm font-semibold">
                    <span>Total Stock:</span>
                    <span>${totalStock} units</span>
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
        productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">${message}</p>`;
    }
};