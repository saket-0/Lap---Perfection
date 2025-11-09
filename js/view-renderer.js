// Lap/js/view-renderer.js

// --- *** NEW HELPER FUNCTION *** ---
/**
 * Toggles the product detail view between display and edit modes.
 * @param {boolean} isEditing - True to show edit form, false to show display info.
 */
const toggleProductEditMode = (isEditing) => {
    const displayView = document.getElementById('product-display-view');
    const editView = document.getElementById('product-edit-view');
    const editButton = document.getElementById('product-edit-toggle-button');

    if (isEditing) {
        displayView.classList.add('hidden');
        editView.classList.remove('hidden');
        editButton.classList.add('hidden'); // Hide edit button while editing
    } else {
        displayView.classList.remove('hidden');
        editView.classList.add('hidden');
        editButton.classList.remove('hidden'); // Show edit button
    }
};
// --- *** END NEW HELPER FUNCTION *** ---


// --- View Rendering Functions ---

const renderDashboard = async () => {
    // ... (This function is unchanged) ...
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    let totalUnits = 0;
    let totalValue = 0;
    inventory.forEach(product => {
        if (product.is_deleted) return;
        
        let totalStock = 0;
        product.locations.forEach(qty => totalStock += qty);
        totalUnits += totalStock;
        totalValue += (product.price || 0) * totalStock;
    });

    appContent.querySelector('#kpi-total-value').textContent = `₹${totalValue.toFixed(2)}`;
    appContent.querySelector('#kpi-total-units').textContent = totalUnits;
    appContent.querySelector('#kpi-transactions').textContent = blockchain.length;
    
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


// *** MODIFIED: Logic re-ordered in this function ***
const renderProductList = () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const productGrid = appContent.querySelector('#product-grid');
    if (!productGrid) return;
    
    // --- Get filter elements FIRST ---
    const searchInput = appContent.querySelector('#product-search-input');
    const categoryFilterEl = appContent.querySelector('#product-category-filter');
    const locationFilterEl = appContent.querySelector('#product-location-filter');

    // --- Show/hide Add Item container ---
    appContent.querySelector('#add-item-container').style.display = permissionService.can('CREATE_ITEM') ? 'block' : 'none';
    
    // --- Populate the "Add Product" form dropdowns ---
    const addForm = appContent.querySelector('#add-item-form');
    if (addForm) {
        populateLocationDropdown(addForm.querySelector('#add-to'));
        populateCategoryDropdown(addForm.querySelector('#add-product-category'));
        
        // Only set these if the form is truly empty (e.g., not mid-edit)
        if (!addForm.querySelector('#add-product-id').value) {
            addForm.querySelector('#add-product-id').value = generateUniqueSku();
        }
        if (!addForm.querySelector('#add-product-name').value) {
            addForm.querySelector('#add-product-name').value = `New Product ${newProductCounter}`;
        }
    }
    
    // --- *** FIX: Populate the FILTER dropdowns *BEFORE* reading their values *** ---
    if (categoryFilterEl) {
        populateCategoryDropdown(categoryFilterEl, true); 
    }
    if (locationFilterEl) {
        populateLocationDropdown(locationFilterEl, true);
    }
    // --- *** END FIX *** ---

    // --- Now, read the filter values (they will be correctly set to 'all') ---
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const categoryFilter = categoryFilterEl ? categoryFilterEl.value : 'all';
    const locationFilter = locationFilterEl ? locationFilterEl.value : 'all';

    // --- Clear grid ---
    productGrid.innerHTML = ''; 

    let productsFound = 0;

    const productsArray = Array.from(inventory.entries());
    productsArray.reverse(); 

    productsArray.forEach(([productId, product]) => {
        // 1. Check for deletion
        if (product.is_deleted) return;
        
        // 2. Check Search Term
        const productName = product.productName.toLowerCase();
        const sku = productId.toLowerCase();
        if (searchTerm && !productName.includes(searchTerm) && !sku.includes(searchTerm)) {
            return;
        }

        // 3. Check Category Filter
        if (categoryFilter !== 'all' && product.category !== categoryFilter) {
            return;
        }

        // 4. Check Location Filter
        if (locationFilter !== 'all') {
            const stockAtLocation = product.locations.get(locationFilter) || 0;
            if (stockAtLocation <= 0) {
                return;
            }
        }
        // --- End Filter Logic ---

        productsFound++;

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

const renderProductDetail = (productId) => {
    // ... (This function is unchanged) ...
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    const product = inventory.get(productId);
    if (!product || product.is_deleted) { // <-- Added check for deleted
        showError(`Product ${productId} not found or has been deleted.`);
        navigateTo('products'); // <-- Redirect to list
        return; 
    }

    // --- *** MODIFIED: Get all new elements *** ---
    const editButton = appContent.querySelector('#product-edit-toggle-button');
    const editNameInput = appContent.querySelector('#edit-product-name');
    const editPriceInput = appContent.querySelector('#edit-product-price');
    const editCategorySelect = appContent.querySelector('#edit-product-category');
    
    const displayName = appContent.querySelector('#detail-product-name');
    const displayId = appContent.querySelector('#detail-product-id');
    const displayCategory = appContent.querySelector('#detail-product-category');
    const displayPrice = appContent.querySelector('#detail-product-price');
    
    const sharedIdInput = appContent.querySelector('#update-product-id');
    // --- *** END MODIFICATION *** ---

    // Populate Display View
    displayName.textContent = product.productName;
    displayId.textContent = productId;
    sharedIdInput.value = productId; // This is the shared hidden input

    const price = product.price || 0;
    displayPrice.textContent = `₹${price.toFixed(2)}`;
    displayCategory.textContent = product.category || 'Uncategorized';

    // Populate Stock Update Forms
    populateLocationDropdown(appContent.querySelector('#update-location'));
    populateLocationDropdown(appContent.querySelector('#move-from-location'));
    populateLocationDropdown(appContent.querySelector('#move-to-location'));

    
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
    
    // --- *** MODIFIED: Populate Edit Form *** ---
    if (editButton) {
        editNameInput.value = product.productName;
        editPriceInput.value = price.toFixed(2);
        populateCategoryDropdown(editCategorySelect);
        editCategorySelect.value = product.category || 'Uncategorized';
        
        // Make sure edit form is hidden on render
        toggleProductEditMode(false); 
    }
    // --- *** END MODIFICATION *** ---

    const dangerZone = appContent.querySelector('#danger-zone-container');
    const updateStock = appContent.querySelector('#update-stock-container');
    const archivedMsg = appContent.querySelector('#product-archived-message');
    const deleteForm = appContent.querySelector('#delete-product-form');

    if (dangerZone) {
        dangerZone.style.display = permissionService.can('DELETE_ITEM') ? 'block' : 'none';
    }

    if (product.is_deleted) {
        if (updateStock) updateStock.style.display = 'none'; 
        if (editButton) editButton.style.display = 'none'; // <-- HIDE EDIT BUTTON
        if (dangerZone) dangerZone.style.display = 'block'; 
        if (archivedMsg) archivedMsg.style.display = 'block'; 
        if (deleteForm) deleteForm.style.display = 'none'; 
    } else {
        if (updateStock) updateStock.style.display = permissionService.can('UPDATE_STOCK') ? 'block' : 'none';
        if (editButton) editButton.style.display = permissionService.can('EDIT_ITEM') ? 'block' : 'none'; // <-- SHOW EDIT BUTTON
        if (archivedMsg) archivedMsg.style.display = 'none';
        if (deleteForm) deleteForm.style.display = 'block';
    }

    renderItemHistory(productId);
    renderItemStockChart(productId);
};

const renderItemHistory = (productId) => {
    // ... (This function is unchanged) ...
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

const renderFullLedger = () => {
    // ... (This function is unchanged) ...
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    const snapshotFormContainer = appContent.querySelector('#snapshot-form-container');
    if (snapshotFormContainer) {
        snapshotFormContainer.style.display = permissionService.can('VIEW_HISTORICAL_STATE') ? 'block' : 'none';
        snapshotFormContainer.querySelector('#snapshot-timestamp').value = new Date().toISOString().slice(0, 16);
    }

    const verifyChainContainer = appContent.querySelector('#verify-chain-container');
    if (verifyChainContainer) {
        verifyChainContainer.style.display = permissionService.can('VERIFY_CHAIN') ? 'block' : 'none';
    }

    const ledgerDisplay = appContent.querySelector('#full-ledger-display');
    ledgerDisplay.innerHTML = '';
    
    [...blockchain].reverse().forEach(block => {
        if (block.transaction.txType === 'GENESIS') return;
        ledgerDisplay.appendChild(createLedgerBlockElement(block));
    });
};

const renderAdminPanel = async () => {
    // ... (This function is unchanged) ...
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const tableBody = appContent.querySelector('#user-management-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="5" class="table-cell text-center">Loading users...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to fetch users');
        }
        
        const usersDb = await response.json();
        tableBody.innerHTML = '';

        usersDb.forEach(user => {
            const row = document.createElement('tr');
            const isCurrentUser = user.id === currentUser.id;
            
            row.innerHTML = `
                <td class="table-cell font-medium">${user.name}</td>
                <td class="table-cell text-slate-500">${user.employee_id}</td>
                <td class="table-cell">
                    <input 
                        type="email" 
                        class="user-email-input form-input-underline" 
                        data-user-id="${user.id}" 
                        data-user-name="${user.name}"
                        data-old-email="${user.email}"
                        value="${user.email}" 
                        ${isCurrentUser ? 'disabled' : ''}
                    >
                </td>
                <td class="table-cell">
                    <select 
                        class="role-select form-select-underline" 
                        data-user-id="${user.id}" 
                        data-user-name="${user.name}"
                        ${isCurrentUser ? 'disabled' : ''}
                    >
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Inventory Manager" ${user.role === 'Inventory Manager' ? 'selected' : ''}>Inventory Manager</option>
                        <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                    </select>
                </td>
                <td class="table-cell">
                    <button 
                        class="user-delete-button text-red-600 hover:text-red-800 disabled:text-slate-400" 
                        data-user-id="${user.id}"
                        data-user-name="${user.name}"
                        data-user-email="${user.email}"
                        ${isCurrentUser ? 'disabled' : ''}
                    >
                        <i class="ph-bold ph-trash text-lg"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        showError(error.message);
        tableBody.innerHTML = `<tr><td colspan="5" class="table-cell text-center text-red-600">Error loading users.</td></tr>`;
    }

    await renderLocationManagement();
    await renderCategoryManagement();
};

const renderSnapshotView = (snapshotData) => {
    // ... (This function is unchanged) ...
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const { kpis, inventory, snapshotTime } = snapshotData;

    appContent.querySelector('#snapshot-time-display').textContent = new Date(snapshotTime).toLocaleString();
    appContent.querySelector('#kpi-snapshot-total-value').textContent = `₹${kpis.totalValue.toFixed(2)}`;
    appContent.querySelector('#kpi-snapshot-total-units').textContent = kpis.totalUnits;
    appContent.querySelector('#kpi-snapshot-transactions').textContent = kpis.transactionCount;

    const productGrid = appContent.querySelector('#snapshot-product-grid');
    productGrid.innerHTML = '';

    const inventoryMap = new Map(inventory);
    
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


const renderLocationManagement = async () => {
    // ... (This function is unchanged) ...
    const container = document.getElementById('location-list-container');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';
    await fetchLocations(); // Re-fetch to get admin-only view
    container.innerHTML = '';

    globalLocations.forEach(loc => {
        const item = document.createElement('div');
        item.className = `flex items-center gap-2 ${loc.is_archived ? 'opacity-50' : ''}`;
        
        item.innerHTML = `
            <input 
                type="text" 
                class="location-name-input flex-1 form-input-underline" 
                data-id="${loc.id}" 
                data-old-name="${loc.name}" 
                value="${loc.name}" 
                ${loc.is_archived ? 'disabled' : ''}
            >
            <button 
                class="location-archive-button text-red-600 hover:text-red-800 disabled:text-slate-400" 
                data-id="${loc.id}" 
                data-name="${loc.name}" 
                ${loc.is_archived ? 'disabled' : ''}
            >
                <i class="ph-bold ph-trash"></i>
            </button>
        `;
        
        container.appendChild(item);
    });
};

const renderCategoryManagement = async () => {
    // ... (This function is unchanged) ...
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';
    await fetchCategories(); // Re-fetch
    container.innerHTML = '';

    globalCategories.forEach(cat => {
        const item = document.createElement('div');
        item.className = `flex items-center gap-2 ${cat.is_archived ? 'opacity-50' : ''}`;
        
        item.innerHTML = `
            <input 
                type="text" 
                class="category-name-input flex-1 form-input-underline" 
                data-id="${cat.id}" 
                data-old-name="${cat.name}" 
                value="${cat.name}" 
                ${cat.is_archived ? 'disabled' : ''}
            >
            <button 
                class="category-archive-button text-red-600 hover:text-red-800 disabled:text-slate-400" 
                data-id="${cat.id}" 
                data-name="${cat.name}" 
                ${cat.is_archived ? 'disabled' : ''}
            >
                <i class="ph-bold ph-trash"></i>
            </button>
        `;
        
        container.appendChild(item);
    });
};


const renderProfilePage = async () => {
    // ... (This function is unchanged) ...
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    appContent.querySelector('#profile-name').value = 'Loading...';
    appContent.querySelector('#profile-email').value = 'Loading...';
    const historyListEl = appContent.querySelector('#profile-activity-list');
    const sessionListEl = appContent.querySelector('#profile-session-list'); 
    historyListEl.innerHTML = '<p class="text-slate-500">Loading...</p>';
    sessionListEl.innerHTML = '<p class="text-slate-500">Loading...</p>'; 
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/profile-data`, {
            credentials: 'include'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to load profile data');
        }
        const data = await response.json();
        const { user, history, sessions } = data; 

        appContent.querySelector('#profile-name').value = user.name;
        appContent.querySelector('#profile-email').value = user.email;
        
        historyListEl.innerHTML = '';
        if (history.length === 0) {
            historyListEl.innerHTML = '<p class="text-slate-500">No transaction history found.</p>';
        } else {
            history.forEach(block => {
                historyListEl.appendChild(createLedgerBlockElement(block));
            });
        }

        sessionListEl.innerHTML = '';
        if (!sessions || sessions.length === 0) {
            sessionListEl.innerHTML = '<p class="text-slate-500">No session history found.</p>';
        } else {
            sessions.forEach(session => {
                const sessionElement = document.createElement('div');
                sessionElement.className = 'flex items-center justify-between text-sm p-2 bg-slate-50 rounded-md';
                
                const expireDate = new Date(session.expire);
                const isExpired = expireDate < new Date();

                sessionElement.innerHTML = `
                    <div>
                        <p class="font-medium text-slate-700">
                            ${isExpired ? 'Session Expired' : 'Session Expires'}
                        </p>
                        <p class="text-xs text-slate-500">
                            ${expireDate.toLocaleString()}
                        </p>
                    </div>
                    <span class="text-xs font-medium ${isExpired ? 'text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full' : 'text-green-600 bg-green-100 px-2 py-0.5 rounded-full'}">
                        ${isExpired ? 'Expired' : 'Active'}
                    </span>
                `;
                sessionListEl.appendChild(sessionElement);
            });
        }

    } catch (error) {
        showError(error.message);
        appContent.innerHTML = `<p class="text-red-600">Error loading profile: ${error.message}</p>`;
    }
};