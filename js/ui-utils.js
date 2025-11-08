// Lap/js/ui-utils.js

// --- Toast/Notification Functions ---
let errorTimer;
const showError = (message, suppress = false) => {
    console.error(message);
    if (suppress) return;
    
    const errorMessage = document.getElementById('error-message');
    const errorToast = document.getElementById('error-toast');
    const successToast = document.getElementById('success-toast'); // Get success toast
    if (!errorMessage || !errorToast || !successToast) return;

    // *** FIX: Clear and hide success toast ***
    successToast.classList.remove('toast-show');
    clearTimeout(successTimer);
    // *** END FIX ***

    errorMessage.textContent = message;
    errorToast.classList.add('toast-show');
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => errorToast.classList.remove('toast-show'), 3000);
};

let successTimer;
const showSuccess = (message) => {
    console.log(message);
    
    const successMessage = document.getElementById('success-message');
    const successToast = document.getElementById('success-toast');
    const errorToast = document.getElementById('error-toast'); // Get error toast
    if (!successMessage || !successToast || !errorToast) return;

    // *** FIX: Clear and hide error toast ***
    errorToast.classList.remove('toast-show');
    clearTimeout(errorTimer);
    // *** END FIX ***

    successMessage.textContent = message;
    successToast.classList.add('toast-show');
    clearTimeout(successTimer);
    successTimer = setTimeout(() => successToast.classList.remove('toast-show'), 3000);
};

// --- UI Element Creators ---

const createLedgerBlockElement = (block) => {
    const blockElement = document.createElement('div');
    blockElement.className = 'border border-slate-200 rounded-lg p-3 bg-white shadow-sm';
    
    // *** MODIFIED: Destructure new fields ***
    const { 
        txType, itemSku, itemName, quantity, 
        fromLocation, toLocation, location, userName, 
        employeeId, beforeQuantity, afterQuantity, 
        price, category,
        // Admin fields
        adminUserName, adminEmployeeId,
        targetUser, targetEmail, targetRole, oldEmail,
        // User profile fields
        oldName,
        // Location/Category fields
        targetId, targetName, newName,
    } = block.transaction;
    // *** END MODIFICATION ***
    
    let transactionHtml = '';
    let detailsHtml = '';

    const actorHtml = `<li>User: <strong>${adminUserName || userName || 'N/A'}</strong> (${adminEmployeeId || employeeId || 'N/A'})</li>`;
    
    switch (txType) {
        case 'CREATE_ITEM':
            transactionHtml = `<span class="font-semibold text-green-700">CREATE</span> <strong>${quantity}</strong> of <strong>${itemName}</strong> (${itemSku}) to <strong>${toLocation}</strong>`;
            detailsHtml = `${actorHtml}
                           <li>Price: <strong>₹${(price || 0).toFixed(2)}</strong></li>
                           <li>Category: <strong>${category || 'N/A'}</strong></li>`;
            break;
        case 'MOVE':
            transactionHtml = `<span class="font-semibold text-blue-600">MOVE</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong>`;
            detailsHtml = `<li>From: <strong>${fromLocation}</strong> (Before: ${beforeQuantity.from}, After: ${afterQuantity.from})</li>
                           <li>To: <strong>${toLocation}</strong> (Before: ${beforeQuantity.to}, After: ${afterQuantity.to})</li>
                           ${actorHtml}`;
            break;
        case 'STOCK_IN':
            transactionHtml = `<span class="font-semibold text-green-600">STOCK IN</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong> at <strong>${location}</strong>`;
            detailsHtml = `<li>Before: ${beforeQuantity}, After: ${afterQuantity}</li>
                           ${actorHtml}`;
            break;
        case 'STOCK_OUT':
            transactionHtml = `<span class="font-semibold text-red-600">STOCK OUT</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong> from <strong>${location}</strong>`;
            detailsHtml = `<li>Before: ${beforeQuantity}, After: ${afterQuantity}</li>
                           ${actorHtml}`;
            break;
        
        // *** ADMIN CASES ***
        case 'ADMIN_CREATE_USER':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN CREATE USER</span>`;
            detailsHtml = `<li>Target: <strong>${targetUser}</strong> (${targetEmail})</li>
                           <li>Role: <strong>${targetRole}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_EDIT_ROLE':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN EDIT ROLE</span> for <strong>${targetUser}</strong>`;
            detailsHtml = `<li>Change: Role → <strong>${targetRole}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_EDIT_EMAIL':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN EDIT EMAIL</span> for <strong>${targetUser}</strong>`;
            detailsHtml = `<li>Change: Email → <strong>${targetEmail}</strong></li>
                           <li>Old Email: ${oldEmail}</li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_DELETE_USER':
            transactionHtml = `<span class="font-semibold text-red-700">ADMIN DELETE USER</span>`;
            detailsHtml = `<li>Target: <strong>${targetUser}</strong> (${targetEmail})</li>
                           ${actorHtml}`;
            break;
        
        // *** NEW USER PROFILE CASES ***
        case 'USER_UPDATE_PROFILE':
            transactionHtml = `<span class="font-semibold text-cyan-600">USER UPDATE PROFILE</span>`;
            detailsHtml = `<li>User: <strong>${targetUser}</strong></li>
                           ${oldName ? `<li>Old Name: ${oldName}</li>` : ''}
                           ${oldEmail ? `<li>Old Email: ${oldEmail}</li>` : ''}
                           <li>New Email: ${targetEmail}</li>
                           ${actorHtml}`;
            break;
        case 'USER_CHANGE_PASSWORD':
            transactionHtml = `<span class="font-semibold text-cyan-600">USER CHANGE PASSWORD</span>`;
            detailsHtml = `<li>User: <strong>${targetUser}</strong></li>
                           ${actorHtml}`;
            break;
        
        case 'DELETE_ITEM':
            transactionHtml = `<span class="font-semibold text-red-700">DELETE ITEM</span> <strong>${itemName || ''}</strong> (${itemSku})`;
            detailsHtml = `${actorHtml}`;
            break;

        // *** NEWLY ADDED CASES ***
        case 'ADMIN_ADD_LOCATION':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN ADD LOCATION</span>`;
            detailsHtml = `<li>Location: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_RENAME_LOCATION':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN RENAME LOCATION</span>`;
            detailsHtml = `<li>Location ID: <strong>${targetId}</strong></li>
                           <li>Old Name: ${oldName}</li>
                           <li>New Name: <strong>${newName}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_ARCHIVE_LOCATION':
            transactionHtml = `<span class="font-semibold text-red-700">ADMIN ARCHIVE LOCATION</span>`;
            detailsHtml = `<li>Location: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_ADD_CATEGORY':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN ADD CATEGORY</span>`;
            detailsHtml = `<li>Category: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_RENAME_CATEGORY':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN RENAME CATEGORY</span>`;
            detailsHtml = `<li>Category ID: <strong>${targetId}</strong></li>
                           <li>Old Name: ${oldName}</li>
                           <li>New Name: <strong>${newName}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_ARCHIVE_CATEGORY':
            transactionHtml = `<span class="font-semibold text-red-700">ADMIN ARCHIVE CATEGORY</span>`;
            detailsHtml = `<li>Category: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;
        // *** END NEW CASES ***

        default:
             transactionHtml = `Unknown transaction: ${txType}`;
    }

    blockElement.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold text-sm text-indigo-700">Block #${block.index}</h4>
            <span class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">${new Date(block.timestamp).toLocaleString()}</span>
        </div>
        <p class="text-sm text-slate-700 mb-2">${transactionHtml}</p>
        <ul class="text-xs text-slate-600 space-y-1 mb-3">
            ${detailsHtml}
        </ul>
        <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded-md">
            <p class="truncate"><strong>Hash:</strong> ${block.hash}</p>
            <p class="truncate"><strong>Prev Hash:</strong> ${block.previousHash}</p>
        </div>
    `;
    return blockElement;
};


// --- Data Populate Functions ---

// *** NEW FUNCTION ***
/**
 * Generates a unique SKU that is not already present in the inventory.
 * @returns {string} A unique SKU (e.g., "SKU-1234")
 */
const generateUniqueSku = () => {
    let newSku = '';
    let attempts = 0;
    const maxAttempts = 100; // Failsafe

    do {
        // Generate a 4-digit random number
        const randomId = Math.floor(1000 + Math.random() * 9000);
        newSku = `SKU-${randomId}`;
        attempts++;
        if (attempts > maxAttempts) {
            // Failsafe in case of a very crowded inventory
            newSku = `SKU-${Date.now()}`;
            break;
        }
    } while (inventory.has(newSku)); // Check against the global inventory map

    return newSku;
};


const populateLoginDropdown = async () => {
    const loginEmailSelect = document.getElementById('login-email-select');
    const loginEmailInput = document.getElementById('login-email-input');
    if (!loginEmailSelect || !loginEmailInput) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/users`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to fetch users');
        }
        
        const users = await response.json();
        loginEmailSelect.innerHTML = '';
        
        if (users.length === 0) {
             loginEmailSelect.innerHTML = '<option value="">No users</option>';
             loginEmailInput.value = '';
             return;
        }

        users.forEach((user, index) => {
            const option = document.createElement('option');
            option.value = user.email;
            option.textContent = `${user.name} (${user.role})`;
            loginEmailSelect.appendChild(option);

            if (index === 0) {
                loginEmailInput.value = user.email;
            }
        });
    
    } catch (error) {
        console.error(error.message);
        showError(error.message, true); // Suppress toast on login screen
        loginEmailSelect.innerHTML = '<option value="">Could not load users</option>';
        loginEmailInput.value = '';
        loginEmailInput.placeholder = 'Error loading users';
    }
};


const populateLocationDropdown = (selectElement) => {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    
    const locationsToShow = globalLocations.filter(loc => !loc.is_archived);
    if (locationsToShow.length === 0) {
        selectElement.innerHTML = '<option value="">No locations.</option>';
        return;
    }

    locationsToShow.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.name;
        option.textContent = loc.name;
        selectElement.appendChild(option);
    });
    
    if (currentValue && locationsToShow.some(l => l.name === currentValue)) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = locationsToShow[0].name;
    }
};

const populateCategoryDropdown = (selectElement) => {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    
    const categoriesToShow = globalCategories.filter(cat => !cat.is_archived);
    if (categoriesToShow.length === 0) {
        selectElement.innerHTML = '<option value="">No categories.</option>';
        return;
    }

    categoriesToShow.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        selectElement.appendChild(option);
    });
    
    if (currentValue && categoriesToShow.some(c => c.name === currentValue)) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = categoriesToShow[0].name;
    }
};