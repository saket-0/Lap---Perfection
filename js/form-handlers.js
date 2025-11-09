// Lap/js/form-handlers.js

const handleAddItem = async (form) => {
    if (!permissionService.can('CREATE_ITEM')) return showError("Access Denied.");

    const itemSku = form.querySelector('#add-product-id').value;
    const itemName = form.querySelector('#add-product-name').value;
    const quantity = parseInt(form.querySelector('#add-quantity').value, 10);
    const toLocation = form.querySelector('#add-to').value;
    const price = parseFloat(form.querySelector('#add-price').value);
    const category = form.querySelector('#add-product-category').value;

    if (!itemSku || !itemName || !category || !quantity || quantity <= 0 || !price || price < 0) {
        return showError("Please fill out all fields with valid data (Price/Qty > 0).");
    }
    
    // *** ADDED: Store the selected values before processing ***
    const stickyCategory = category;
    const stickyLocation = toLocation;
    
    const transaction = {
        txType: "CREATE_ITEM", itemSku, itemName, quantity,
        price, category,
        beforeQuantity: 0, 
        afterQuantity: quantity, 
        toLocation
    };

    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            
            // *** MODIFICATION: renderProductList() removed ***
            // The UI will update via the SSE event
            showSuccess(`Product ${itemName} added! Updating system...`);
            
            // --- MODIFIED: Form reset logic ---
            form.reset(); // Clear basic fields like Qty and Price
            
            // Increment and set new serialized name
            newProductCounter++;
            form.querySelector('#add-product-name').value = `New Product ${newProductCounter}`;
            
            // Set new unique SKU
            form.querySelector('#add-product-id').value = generateUniqueSku();
            
            // Re-apply sticky values
            form.querySelector('#add-product-category').value = stickyCategory;
            form.querySelector('#add-to').value = stickyLocation;
            // --- END MODIFICATION ---

        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState(); // Roll back the local pre-check
        }
    }
};

const handleUpdateStock = async (form) => {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
    // ... (logic to get itemSku, quantity, etc. as before) ...
    const itemSku = document.getElementById('update-product-id').value;
    const quantity = parseInt(form.querySelector('#update-quantity').value, 10);
    const clickedButton = document.activeElement;
    const actionType = clickedButton.id === 'stock-in-button' ? 'STOCK_IN' : 'STOCK_OUT';

    if (!itemSku || !quantity || quantity <= 0) return showError("Please enter a valid quantity.");
    
    const product = inventory.get(itemSku);
    let transaction = {};
    let success = false;
    let beforeQuantity, afterQuantity;

    if (actionType === 'STOCK_IN') {
        // ... (transaction setup as before) ...
        const locationIn = form.querySelector('#update-location').value;
        beforeQuantity = product.locations.get(locationIn) || 0;
        afterQuantity = beforeQuantity + quantity;

        transaction = { 
            txType: "STOCK_IN", itemSku, quantity, 
            location: locationIn, 
            beforeQuantity, afterQuantity
        };
        success = processTransaction(transaction, false, showError);

    } else if (actionType === 'STOCK_OUT') {
        // ... (transaction setup as before) ...
        const locationOut = form.querySelector('#update-location').value;
        beforeQuantity = product.locations.get(locationOut) || 0;
        afterQuantity = beforeQuantity - quantity;
        
        transaction = { 
            txType: "STOCK_OUT", itemSku, quantity, 
            location: locationOut, 
            beforeQuantity, afterQuantity
        };
        success = processTransaction(transaction, false, showError);
    }

    if (success) {
        try {
            await addTransactionToChain(transaction);
            
            // *** MODIFICATION: Render calls removed ***
            // destroyCurrentCharts();
            // renderProductDetail(itemSku);
            showSuccess(`Stock for ${itemSku} updated! Updating system...`);
        
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState(); // Roll back pre-check
            renderProductDetail(itemSku); // Re-render on error
        }
    }
};

const handleMoveStock = async (form) => {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
    // ... (logic to get itemSku, quantity, etc. as before) ...
    const itemSku = document.getElementById('update-product-id').value;
    const quantity = parseInt(form.querySelector('#move-quantity').value, 10);
    const fromLocation = form.querySelector('#move-from-location').value;
    const toLocation = form.querySelector('#move-to-location').value;

    if (fromLocation === toLocation) {
        return showError("Cannot move stock to the same location.");
    }
    if (!itemSku || !quantity || quantity <= 0) {
        return showError("Please enter a valid quantity.");
    }

    const product = inventory.get(itemSku);
    const beforeFromQty = product.locations.get(fromLocation) || 0;
    const beforeToQty = product.locations.get(toLocation) || 0;
    
    const transaction = {
        txType: "MOVE", itemSku, quantity,
        fromLocation, toLocation,
        beforeQuantity: { from: beforeFromQty, to: beforeToQty },
        afterQuantity: { from: beforeFromQty - quantity, to: beforeToQty + quantity }
    };
    
    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            
            // *** MODIFICATION: Render calls removed ***
            // destroyCurrentCharts();
            // renderProductDetail(itemSku);
            showSuccess(`Moved ${quantity} units of ${itemSku}. Updating system...`);
        
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState(); // Roll back pre-check
            renderProductDetail(itemSku); // Re-render on error
        }
    }
};

const handleClearDb = async (navigateTo) => {
    // ... (This function does NOT call addTransactionToChain, so it's unchanged) ...
    if (!permissionService.can('CLEAR_DB')) return showError("Access Denied.");
    if (confirm('Are you sure you want to clear the entire blockchain? This cannot be undone.')) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/blockchain`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to clear database');
            }
            
            blockchain = data.chain;
            rebuildInventoryState();
            navigateTo('dashboard');
            showSuccess("Server blockchain cleared.");
            
        } catch (error) {
            showError(error.message);
        }
    }
};

const handleVerifyChain = async () => {
    // ... (This function is unchanged) ...
    if (!permissionService.can('VERIFY_CHAIN')) return showError("Access Denied.");
    try {
        const response = await fetch(`${API_BASE_URL}/api/blockchain/verify`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Verification check failed');
        }
        
        if (data.isValid) {
            showSuccess("Verification complete: Blockchain is valid!");
        } else {
            showError("CRITICAL: Blockchain is invalid! Tampering detected.");
        }
    } catch (error) {
        showError(error.message);
    }
};

const handleDeleteProduct = async (productId, productName, navigateTo) => {
    if (!permissionService.can('DELETE_ITEM')) return showError("Access Denied.");

    if (!confirm(`Are you sure you want to delete "${productName}" (${productId})?\n\nThis action can only be done if stock is 0 and will be permanently recorded.`)) {
        return;
    }

    const transaction = {
        txType: "DELETE_ITEM",
        itemSku: productId,
        itemName: productName // Include name for ledger readability
    };

    // Run client-side pre-check
    if (processTransaction(transaction, false, showError)) {
        try {
            // If pre-check passes, send to server
            await addTransactionToChain(transaction);
            
            // *** MODIFICATION: navigateTo() removed ***
            showSuccess(`Product ${productName} deleted! Updating system...`);
            // The SSE listener will navigate the user by refreshing the view
            // (which will fail to find the product and go to 'products' list)
            // or by refreshing the 'products' list directly.

        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState(); // Roll back the local state change
            renderProductDetail(productId); // Re-render the detail page on error
        }
    }
};


// *** MODIFIED: This helper now ONLY logs to console ***
// It no longer pushes to the local blockchain array.
const logAdminActionToBlockchain = async (transaction) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/blockchain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(transaction)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Blockchain logging failed');
        }
        const newBlock = await response.json();
        
        // *** MODIFICATION: blockchain.push() removed ***
        // blockchain.push(newBlock); // <-- REMOVED
        
        console.log('Admin action logged to blockchain:', newBlock);
    } catch (error) {
        // Log the error, but don't block the user
        showError(`Action was successful, but logging to blockchain failed: ${error.message}`);
    }
};

// *** MODIFIED ***
const handleRoleChange = async (userId, userName, newRole) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role: newRole })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to update role');
        }
        showSuccess(`Role for ${data.user.name} updated to ${newRole}.`);
        
        await logAdminActionToBlockchain({
            txType: "ADMIN_EDIT_ROLE",
            targetUserId: data.user.id,
            targetUser: data.user.name,
            targetRole: data.user.role
        });
        
        // *** MODIFICATION: Local state update removed ***
        // We let the SSE listener refresh the admin panel
    } catch (error) {
        showError(error.message);
        renderAdminPanel(); // Re-render to reset on failure
    }
};

// *** MODIFIED ***
const handleEmailChange = async (userId, userName, newEmail, oldEmail, inputElement) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    if (newEmail === oldEmail) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/email`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: newEmail })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to update email');
        }
        showSuccess(`Email for ${data.user.name} updated.`);
        
        if (inputElement) {
            inputElement.dataset.oldEmail = newEmail;
        }

        await logAdminActionToBlockchain({
            txType: "ADMIN_EDIT_EMAIL",
            targetUserId: data.user.id,
            targetUser: data.user.name,
            targetEmail: data.user.email,
            oldEmail: oldEmail
        });

        await populateLoginDropdown(); // This is OK, it's not part of the blockchain state

    } catch (error) {
        showError(error.message);
        if (inputElement) {
            inputElement.value = oldEmail;
        }
    }
};

// *** MODIFIED ***
const handleAddUser = async (form) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    // ... (validation as before) ...
    const name = form.querySelector('#add-user-name').value;
    const email = form.querySelector('#add-user-email').value;
    const role = form.querySelector('#add-user-role').value;
    const password = form.querySelector('#add-user-password').value;
    const confirmPassword = form.querySelector('#add-user-confirm-password').value;
    if (!name || !email || !role || !password || !confirmPassword) {
        return showError("All fields are required.");
    }
    if (password !== confirmPassword) {
        return showError("Passwords do not match.");
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, role, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to create user');
        }
        
        showSuccess(`User ${data.user.name} created successfully!`);
        form.reset();
        
        await logAdminActionToBlockchain({
            txType: "ADMIN_CREATE_USER",
            targetUserId: data.user.id,
            targetUser: data.user.name,
            targetEmail: data.user.email,
            targetRole: data.user.role,
            targetEmployeeId: data.user.employee_id
        });

        // *** MODIFICATION: Render calls removed ***
        // renderAdminPanel(); // <-- REMOVED
        await populateLoginDropdown(); // This is OK
        
    } catch (error) {
        showError(error.message);
    }
};

// *** MODIFIED ***
const handleDeleteUser = async (userId, userName, userEmail) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    if (!confirm(`Are you sure you want to permanently delete ${userName} (${userEmail})?\n\nThis action is irreversible and will be logged to the blockchain.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to delete user');
        }
        
        showSuccess(`User ${userName} deleted.`);

        await logAdminActionToBlockchain({
            txType: "ADMIN_DELETE_USER",
            targetUserId: userId,
            targetUser: userName,
            targetEmail: userEmail
        });

        // *** MODIFICATION: Render calls removed ***
        // renderAdminPanel(); // <-- REMOVED
        await populateLoginDropdown(); // This is OK

    } catch (error) {
        showError(error.message);
    }
};


const handleSnapshotForm = async (form, navigateTo) => {
    // ... (This function is unchanged) ...
    if (!permissionService.can('VIEW_HISTORICAL_STATE')) return showError("Access Denied.");
    const timestamp = form.querySelector('#snapshot-timestamp').value;
    if (!timestamp) return showError("Please select a date and time.");
    const button = form.querySelector('#generate-snapshot-button');
    button.disabled = true;
    button.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Generating...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/blockchain/state-at?timestamp=${timestamp}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to generate snapshot');
        }
        navigateTo('snapshot', { snapshotData: data });

    } catch (error) {
        showError(error.message);
        button.disabled = false;
        button.innerHTML = '<i class="ph-bold ph-timer"></i> Generate Snapshot';
    }
};

// --- LOCATION HANDLERS (MODIFIED) ---
const handleAddLocation = async (form) => {
    const nameInput = form.querySelector('#add-location-name');
    const name = nameInput.value;
    if (!name) return showError("Location name is required.");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showSuccess(`Location "${data.name}" added.`);
        nameInput.value = '';

        await logAdminActionToBlockchain({
            txType: "ADMIN_ADD_LOCATION",
            targetId: data.id,
            targetName: data.name
        });
        
        // *** MODIFICATION: Render calls removed ***
        // await fetchLocations(); 
        // await renderAdminPanel();
    } catch (error) { showError(error.message); }
};

const handleRenameLocation = async (inputElement) => {
    // ... (logic as before) ...
    const id = inputElement.dataset.id;
    const newName = inputElement.value;
    const oldName = inputElement.dataset.oldName;
    if (newName === oldName) return;
    if (!newName) {
        showError("Location name cannot be empty.");
        inputElement.value = oldName;
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: newName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showSuccess(`Location renamed to "${data.name}".`);
        inputElement.dataset.oldName = data.name;
        
        await logAdminActionToBlockchain({
            txType: "ADMIN_RENAME_LOCATION",
            targetId: id,
            oldName: oldName,
            newName: data.name
        });

        // *** MODIFICATION: fetchLocations() removed ***
        // await fetchLocations();
    } catch (error) { 
        showError(error.message); 
        inputElement.value = oldName; 
        renderAdminPanel(); // Re-render on failure
    }
};

const handleArchiveLocation = async (id, name) => {
    if (!confirm(`Archive "${name}"? This hides it from new transactions.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (!response.ok) throw new Error((await response.json()).message);
        
        showSuccess(`Location "${name}" archived.`);

        await logAdminActionToBlockchain({
            txType: "ADMIN_ARCHIVE_LOCATION",
            targetId: id,
            targetName: name
        });
        
        // *** MODIFICATION: Render calls removed ***
        // await fetchLocations();
        // await renderAdminPanel();
    } catch (error) { showError(error.message); }
};

// --- CATEGORY HANDLERS (MODIFIED) ---
const handleAddCategory = async (form) => {
    const nameInput = form.querySelector('#add-category-name');
    const name = nameInput.value;
    if (!name) return showError("Category name is required.");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showSuccess(`Category "${data.name}" added.`);
        nameInput.value = '';
        
        await logAdminActionToBlockchain({
            txType: "ADMIN_ADD_CATEGORY",
            targetId: data.id,
            targetName: data.name
        });

        // *** MODIFICATION: Render calls removed ***
        // await fetchCategories();
        // await renderAdminPanel();
    } catch (error) { showError(error.message); }
};

const handleRenameCategory = async (inputElement) => {
    // ... (logic as before) ...
    const id = inputElement.dataset.id;
    const newName = inputElement.value;
    const oldName = inputElement.dataset.oldName;
    if (newName === oldName) return;
    if (!newName) {
        showError("Category name cannot be empty.");
        inputElement.value = oldName;
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: newName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showSuccess(`Category renamed to "${data.name}".`);
        inputElement.dataset.oldName = data.name;

        await logAdminActionToBlockchain({
            txType: "ADMIN_RENAME_CATEGORY",
            targetId: id,
            oldName: oldName,
            newName: data.name
        });
        
        // *** MODIFICATION: fetchCategories() removed ***
        // await fetchCategories();
    } catch (error) { 
        showError(error.message); 
        inputElement.value = oldName; 
        renderAdminPanel(); // Re-render on failure
    }
};

const handleArchiveCategory = async (id, name) => {
    if (!confirm(`Archive "${name}"? This hides it from new transactions.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (!response.ok) throw new Error((await response.json()).message);
        
        showSuccess(`Category "${name}" archived.`);

        await logAdminActionToBlockchain({
            txType: "ADMIN_ARCHIVE_CATEGORY",
            targetId: id,
            targetName: name
        });
        
        // *** MODIFICATION: Render calls removed ***
        // await fetchCategories();
        // await renderAdminPanel();
    } catch (error) { showError(error.message); }
};


// *** PROFILE HANDLERS (MODIFIED) ***
const handleUpdateProfile = async (form) => {
    // ... (logic as before) ...
    const name = form.querySelector('#profile-name').value;
    const email = form.querySelector('#profile-email').value;
    if (name === currentUser.name && email === currentUser.email) {
        return showSuccess("No changes to save.");
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to update profile');
        }
        
        showSuccess('Profile updated! Updating system...');
        
        const oldName = currentUser.name;
        const oldEmail = currentUser.email;
        currentUser = data.user;
        document.getElementById('user-name').textContent = currentUser.name;

        await populateLoginDropdown(); // This is OK

        await addTransactionToChain({
            txType: "USER_UPDATE_PROFILE",
            targetUserId: currentUser.id,
            targetUser: currentUser.name,
            targetEmail: currentUser.email,
            oldName: oldName, 
            oldEmail: oldEmail
        });
        // *** MODIFICATION: Render call removed ***
        // (SSE listener will refresh the profile page)

    } catch (error) {
        showError(error.message);
        await renderProfilePage(); // Re-render on error
    }
};

const handleChangePassword = async (form) => {
    // ... (logic as before) ...
    const currentPassword = form.querySelector('#profile-current-password').value;
    const newPassword = form.querySelector('#profile-new-password').value;
    const confirmPassword = form.querySelector('#profile-confirm-password').value;

    if (newPassword !== confirmPassword) {
        return showError("New passwords do not match.");
    }
    if (!currentPassword || !newPassword) {
        return showError("All fields are required.");
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to change password');
        }
        
        showSuccess('Password changed successfully!');
        form.reset();

        await addTransactionToChain({
            txType: "USER_CHANGE_PASSWORD",
            targetUserId: currentUser.id,
            targetUser: currentUser.name
        });
        // *** MODIFICATION: Render call removed ***
        // (SSE listener will refresh the profile page)

    } catch (error) {
        showError(error.message);
    }
};