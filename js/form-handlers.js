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
    
    // We add the user from the frontend, but the backend will
    // overwrite this with the verified session user.
    transaction.userName = currentUser.name;
    transaction.employeeId = currentUser.employee_id;

    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            renderProductList(); // This will re-render, but we'll fix the form values
            showSuccess(`Product ${itemName} added!`);
            
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
            rebuildInventoryState();
        }
    }
};

const handleUpdateStock = async (form) => {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");

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
        const locationIn = form.querySelector('#update-location').value;
        beforeQuantity = product.locations.get(locationIn) || 0;
        afterQuantity = beforeQuantity + quantity;

        transaction = { 
            txType: "STOCK_IN", itemSku, quantity, 
            location: locationIn, 
            beforeQuantity, afterQuantity,
            userName: currentUser.name, 
            employeeId: currentUser.employee_id
        };
        success = processTransaction(transaction, false, showError);

    } else if (actionType === 'STOCK_OUT') {
        const locationOut = form.querySelector('#update-location').value;
        beforeQuantity = product.locations.get(locationOut) || 0;
        afterQuantity = beforeQuantity - quantity;
        
        transaction = { 
            txType: "STOCK_OUT", itemSku, quantity, 
            location: locationOut, 
            beforeQuantity, afterQuantity,
            userName: currentUser.name,
            employeeId: currentUser.employee_id
        };
        success = processTransaction(transaction, false, showError);
    }

    if (success) {
        try {
            await addTransactionToChain(transaction);
            destroyCurrentCharts();
            renderProductDetail(itemSku);
            showSuccess(`Stock for ${itemSku} updated!`);
        
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState();
            renderProductDetail(itemSku);
        }
    }
};

const handleMoveStock = async (form) => {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");

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
        afterQuantity: { from: beforeFromQty - quantity, to: beforeToQty + quantity },
        userName: currentUser.name,
        employeeId: currentUser.employee_id
    };

    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            destroyCurrentCharts();
            renderProductDetail(itemSku);
            showSuccess(`Moved ${quantity} units of ${itemSku}.`);
        
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState();
            renderProductDetail(itemSku);
        }
    }
};

const handleClearDb = async (navigateTo) => {
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

// *** Helper function to log admin actions (to avoid repetition) ***
const logAdminActionToBlockchain = async (transaction) => {
    try {
        // We don't need to await this for the UI,
        // but we await to catch errors.
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
        blockchain.push(newBlock); // Add to local chain
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
        
        // *** ADDED: Log to blockchain ***
        await logAdminActionToBlockchain({
            txType: "ADMIN_EDIT_ROLE",
            targetUserId: data.user.id,
            targetUser: data.user.name,
            targetRole: data.user.role
        });

        if (data.user.id === currentUser.id) { 
            currentUser = data.user;
            document.getElementById('user-role').textContent = currentUser.role;
            document.getElementById('nav-admin').style.display = permissionService.can('VIEW_ADMIN_PANEL') ? 'flex' : 'none';
            document.getElementById('nav-ledger').style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';
        }
    } catch (error) {
        showError(error.message);
        renderAdminPanel(); // Re-render to reset on failure
    }
};

// *** NEW FUNCTION ***
const handleEmailChange = async (userId, userName, newEmail, oldEmail, inputElement) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    
    // Do nothing if email hasn't changed
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
        
        // Update the 'oldEmail' data attribute to the new email
        if (inputElement) {
            inputElement.dataset.oldEmail = newEmail;
        }

        // *** ADDED: Log to blockchain ***
        await logAdminActionToBlockchain({
            txType: "ADMIN_EDIT_EMAIL",
            targetUserId: data.user.id,
            targetUser: data.user.name,
            targetEmail: data.user.email,
            oldEmail: oldEmail
        });

        // Update the login dropdown if it's visible
        await populateLoginDropdown();

    } catch (error) {
        showError(error.message);
        // Reset the input value to the old email on failure
        if (inputElement) {
            inputElement.value = oldEmail;
        }
    }
};

// *** MODIFIED ***
const handleAddUser = async (form) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");

    const name = form.querySelector('#add-user-name').value;
    const email = form.querySelector('#add-user-email').value;
    const employeeId = form.querySelector('#add-user-employee-id').value;
    const role = form.querySelector('#add-user-role').value;
    const password = form.querySelector('#add-user-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, employeeId, role, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to create user');
        }
        
        showSuccess(`User ${data.user.name} created successfully!`);
        form.reset();
        
        // *** ADDED: Log to blockchain ***
        await logAdminActionToBlockchain({
            txType: "ADMIN_CREATE_USER",
            targetUserId: data.user.id,
            targetUser: data.user.name,
            targetEmail: data.user.email,
            targetRole: data.user.role,
            targetEmployeeId: data.user.employee_id
        });

        renderAdminPanel(); // Now call render *after* logging
        await populateLoginDropdown();
        
    } catch (error) {
        showError(error.message);
    }
};

// *** NEW FUNCTION ***
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

        // *** ADDED: Log to blockchain ***
        await logAdminActionToBlockchain({
            txType: "ADMIN_DELETE_USER",
            targetUserId: userId,
            targetUser: userName,
            targetEmail: userEmail
        });

        renderAdminPanel(); // Re-render the list
        await populateLoginDropdown(); // Update the login dropdown

    } catch (error) {
        showError(error.message);
    }
};


const handleSnapshotForm = async (form, navigateTo) => {
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

// --- LOCATION HANDLERS ---
const handleAddLocation = async (form) => {
    const nameInput = form.querySelector('#add-location-name');
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: nameInput.value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showSuccess(`Location "${data.name}" added.`);
        nameInput.value = '';
        await fetchLocations(); 
        await renderAdminPanel();
    } catch (error) { showError(error.message); }
};

const handleRenameLocation = async (id, newName) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: newName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showSuccess(`Location renamed to "${data.name}".`);
        await fetchLocations();
    } catch (error) { showError(error.message); renderAdminPanel(); }
};

const handleArchiveLocation = async (id, name) => {
    if (!confirm(`Archive "${name}"? This hides it from new transactions.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (!response.ok) throw new Error((await response.json()).message);
        showSuccess(`Location "${name}" archived.`);
        await fetchLocations();
        await renderAdminPanel();
    } catch (error) { showError(error.message); }
};

// --- CATEGORY HANDLERS ---
const handleAddCategory = async (form) => {
    const nameInput = form.querySelector('#add-category-name');
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: nameInput.value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showSuccess(`Category "${data.name}" added.`);
        nameInput.value = '';
        await fetchCategories();
        await renderAdminPanel();
    } catch (error) { showError(error.message); }
};

const handleRenameCategory = async (id, newName) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: newName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showSuccess(`Category renamed to "${data.name}".`);
        await fetchCategories();
    } catch (error) { showError(error.message); renderAdminPanel(); }
};

const handleArchiveCategory = async (id, name) => {
    if (!confirm(`Archive "${name}"? This hides it from new transactions.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (!response.ok) throw new Error((await response.json()).message);
        showSuccess(`Category "${name}" archived.`);
        await fetchCategories();
        await renderAdminPanel();
    } catch (error) { showError(error.message); }
};


// *** NEW FUNCTION: Handle Profile Update ***
const handleUpdateProfile = async (form) => {
    const name = form.querySelector('#profile-name').value;
    const email = form.querySelector('#profile-email').value;
    
    // Prevent accidental update if unchanged
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
        
        showSuccess('Profile updated!');
        
        // CRITICAL: Update local state
        const oldName = currentUser.name; // Store old name for logging
        const oldEmail = currentUser.email; // Store old email for logging
        currentUser = data.user;
        document.getElementById('user-name').textContent = currentUser.name;

        // Also update the login dropdown
        await populateLoginDropdown();

        // Log this action to the blockchain (using addTransactionToChain, not the admin helper)
        await addTransactionToChain({
            txType: "USER_UPDATE_PROFILE",
            targetUserId: currentUser.id,
            targetUser: currentUser.name,
            targetEmail: currentUser.email,
            oldName: oldName, // Add old data for traceability
            oldEmail: oldEmail
        });

    } catch (error) {
        showError(error.message);
        // Re-render to reset form to old values on failure
        await renderProfilePage();
    }
};

// *** NEW FUNCTION: Handle Password Change ***
const handleChangePassword = async (form) => {
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

        // Log this action to the blockchain
        await addTransactionToChain({
            txType: "USER_CHANGE_PASSWORD",
            targetUserId: currentUser.id,
            targetUser: currentUser.name
        });

    } catch (error) {
        showError(error.message);
    }
};