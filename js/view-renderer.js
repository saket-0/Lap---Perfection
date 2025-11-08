// Lap/js/view-renderer.js

// --- View Rendering Functions ---

const renderDashboard = async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    let totalUnits = 0;
    let totalValue = 0;
    inventory.forEach(product => {
        let totalStock = 0;
        product.locations.forEach(qty => totalStock += qty);
        totalUnits += totalStock;
        totalValue += (product.price || 0) * totalStock;
    });

    appContent.querySelector('#kpi-total-value').textContent = `₹${totalValue.toFixed(2)}`;
    appContent.querySelector('#kpi-total-units').textContent = totalUnits;
    appContent.querySelector('#kpi-transactions').textContent = blockchain.length;
    
    appContent.querySelector('#clear-db-button').style.display = permissionService.can('CLEAR_DB') ? 'flex' : 'none';
    appContent.querySelector('#verify-chain-button').style.display = permissionService.can('VERIFY_CHAIN') ? 'flex' : 'none';
    
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

    // --- MODIFIED SECTION FOR PREDICTIVE LOW-STOCK ---
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
            lowStockList.innerHTML = ''; // Clear loading message

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


const renderProductList = () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    const productGrid = appContent.querySelector('#product-grid');
    if (!productGrid) return;
    
    const searchInput = appContent.querySelector('#product-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    productGrid.innerHTML = ''; 
    
    appContent.querySelector('#add-item-container').style.display = permissionService.can('CREATE_ITEM') ? 'block' : 'none';
    
    // --- ADD THIS SECTION ---
    // Populate the "Add Product" form dropdowns
    const addForm = appContent.querySelector('#add-item-form');
    if (addForm) {
        populateLocationDropdown(addForm.querySelector('#add-to'));
        populateCategoryDropdown(addForm.querySelector('#add-product-category'));
        
        addForm.querySelector('#add-product-id').value = generateUniqueSku();
        addForm.querySelector('#add-product-name').value = `New Product ${newProductCounter}`;
    }
    // --- END ADD ---

    let productsFound = 0;

    // --- MODIFICATION: Reverse the inventory list ---
    // Convert map entries to an array
    const productsArray = Array.from(inventory.entries());
    // Reverse the array to show newest first
    productsArray.reverse(); 

    // Iterate over the reversed array
    productsArray.forEach(([productId, product]) => {
    // --- END MODIFICATION ---
        const productName = product.productName.toLowerCase();
        const sku = productId.toLowerCase();

        if (searchTerm && !productName.includes(searchTerm) && !sku.includes(searchTerm)) {
            return;
        }
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
        if (inventory.size === 0) {
            productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">No products in inventory. ${permissionService.can('CREATE_ITEM') ? 'Add one above!' : ''}</p>`;
        } else {
            productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">No products found matching "${searchTerm}".</p>`;
        }
    }
};

const renderProductDetail = (productId) => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    const product = inventory.get(productId);
    if (!product) {
        showError(`Product ${productId} not found.`);
        // Note: We can't call navigateTo here directly, but the app.js handler will.
        return; 
    }

    appContent.querySelector('#detail-product-name').textContent = product.productName;
    appContent.querySelector('#detail-product-id').textContent = productId;
    appContent.querySelector('#update-product-id').value = productId;

    const price = product.price || 0;
    appContent.querySelector('#detail-product-price').textContent = `₹${price.toFixed(2)}`;
    appContent.querySelector('#detail-product-category').textContent = product.category || 'Uncategorized';

    // --- ADD THIS SECTION ---
    // Populate the three dropdowns on this page
    populateLocationDropdown(appContent.querySelector('#update-location'));
    populateLocationDropdown(appContent.querySelector('#move-from-location'));
    populateLocationDropdown(appContent.querySelector('#move-to-location'));
    // --- END ADD ---

    
    const stockLevelsDiv = appContent.querySelector('#detail-stock-levels');
    stockLevelsDiv.innerHTML = '';
    let totalStock = 0;

    // --- REPLACE THE HARD-CODED ["Supplier", "Warehouse", "Retailer"] ---
    const allProductLocations = new Set(globalLocations.map(l => l.name));
    product.locations.forEach((qty, loc) => allProductLocations.add(loc));

    allProductLocations.forEach(location => {
        const qty = product.locations.get(location) || 0;
        totalStock += qty;

        const locData = globalLocations.find(l => l.name === location);
        const isArchived = locData ? locData.is_archived : false;

        // Only show if it has stock, or if it's a known, non-archived location
        if (qty > 0 || (locData && !isArchived)) {
            stockLevelsDiv.innerHTML += `
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">${location}:</span>
                    <span class="font-medium text-slate-800">${qty} units</span>
                </div>`;
        }
    });
    // --- END REPLACEMENT ---

    appContent.querySelector('#detail-total-stock').textContent = `${totalStock} units`;
    
    appContent.querySelector('#update-stock-container').style.display = permissionService.can('UPDATE_STOCK') ? 'block' : 'none';

    renderItemHistory(productId);
    
    // Call chart renderer (from chart-renderer.js)
    renderItemStockChart(productId);
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

const renderFullLedger = () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    const snapshotFormContainer = appContent.querySelector('#snapshot-form-container');
    if (snapshotFormContainer) {
        snapshotFormContainer.style.display = permissionService.can('VIEW_HISTORICAL_STATE') ? 'block' : 'none';
        // Set default time to now
        snapshotFormContainer.querySelector('#snapshot-timestamp').value = new Date().toISOString().slice(0, 16);
    }

    const ledgerDisplay = appContent.querySelector('#full-ledger-display');
    ledgerDisplay.innerHTML = '';
    
    [...blockchain].reverse().forEach(block => {
        if (block.transaction.txType === 'GENESIS') return;
        ledgerDisplay.appendChild(createLedgerBlockElement(block));
    });
};

const renderAdminPanel = async () => {
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
            
            // *** THIS IS THE FIX ***
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
            // *** END FIX ***
            tableBody.appendChild(row);
        });

    } catch (error) {
        showError(error.message);
        tableBody.innerHTML = `<tr><td colspan="5" class="table-cell text-center text-red-600">Error loading users.</td></tr>`;
    }

    // --- ADD THIS AT THE END OF THE FUNCTION ---
    await renderLocationManagement();
    await renderCategoryManagement();
};

const renderSnapshotView = (snapshotData) => {
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


// --- ADD THESE TWO NEW FUNCTIONS ---
const renderLocationManagement = async () => {
    const container = document.getElementById('location-list-container');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';
    await fetchLocations(); // Re-fetch to get admin-only view
    container.innerHTML = '';

    globalLocations.forEach(loc => {
        const item = document.createElement('div');
        item.className = `flex items-center gap-2 ${loc.is_archived ? 'opacity-50' : ''}`;
        item.innerHTML = `
            <input type="text" class="location-name-input flex-1 form-input-underline" data-id="${loc.id}" value="${loc.name}" ${loc.is_archived ? 'disabled' : ''}>
            <button class="location-archive-button text-red-600 hover:text-red-800 disabled:text-slate-400" data-id="${loc.id}" data-name="${loc.name}" ${loc.is_archived ? 'disabled' : ''}>
                <i class="ph-bold ph-trash"></i>
            </button>
        `;
        container.appendChild(item);
    });
};

const renderCategoryManagement = async () => {
    const container = document.getElementById('category-list-container');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';
    await fetchCategories(); // Re-fetch
    container.innerHTML = '';

    globalCategories.forEach(cat => {
        const item = document.createElement('div');
        item.className = `flex items-center gap-2 ${cat.is_archived ? 'opacity-50' : ''}`;
        item.innerHTML = `
            <input type="text" class="category-name-input flex-1 form-input-underline" data-id="${cat.id}" value="${cat.name}" ${cat.is_archived ? 'disabled' : ''}>
            <button class="category-archive-button text-red-600 hover:text-red-800 disabled:text-slate-400" data-id="${cat.id}" data-name="${cat.name}" ${cat.is_archived ? 'disabled' : ''}>
                <i class="ph-bold ph-trash"></i>
            </button>
        `;
        container.appendChild(item);
    });
};


// *** UPDATED FUNCTION: Render the Profile Page ***
const renderProfilePage = async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    // Show loading state
    appContent.querySelector('#profile-name').value = 'Loading...';
    appContent.querySelector('#profile-email').value = 'Loading...';
    const historyListEl = appContent.querySelector('#profile-activity-list');
    historyListEl.innerHTML = '<p class="text-slate-500">Loading...</p>';
    
    try {
        // Fetch all profile data from the new endpoint
        const response = await fetch(`${API_BASE_URL}/api/users/me/profile-data`, {
            credentials: 'include'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to load profile data');
        }
        const data = await response.json();
        const { user, history } = data; // Destructure data

        // 1. Populate forms
        appContent.querySelector('#profile-name').value = user.name;
        appContent.querySelector('#profile-email').value = user.email;
        
        // 2. Render History "Commits"
        historyListEl.innerHTML = '';
        if (history.length === 0) {
            historyListEl.innerHTML = '<p class="text-slate-500">No transaction history found.</p>';
        } else {
            history.forEach(block => {
                historyListEl.appendChild(createLedgerBlockElement(block));
            });
        }

    } catch (error) {
        showError(error.message);
        appContent.innerHTML = `<p class="text-red-600">Error loading profile: ${error.message}</p>`;
    }
};