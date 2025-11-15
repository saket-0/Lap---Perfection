// frontend/js/handlers/admin.js
// import { API_BASE_URL } from '../../config.js'; // <-- REMOVED THIS LINE
import { permissionService } from '../services/permissions.js';
import { showError, showSuccess } from '../ui/components/notifications.js';
import { populateLoginDropdown } from '../ui/components/dropdowns.js';
import { renderAdminPanel } from '../ui/renderers/admin.js';

/**
 * Helper function to log admin-only (non-inventory) actions to the blockchain.
 * This triggers the SSE refresh for all clients.
 */
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
        console.log('Admin action logged to blockchain:', newBlock);
    } catch (error) {
        showError(`Action was successful, but logging to blockchain failed: ${error.message}`);
    }
};

// --- User Management Handlers ---

export const handleRoleChange = async (userId, userName, newRole) => {
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
    } catch (error) {
        showError(error.message);
        renderAdminPanel(); // Re-render to reset on failure
    }
};

export const handleEmailChange = async (userId, userName, newEmail, oldEmail, inputElement) => {
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

        await populateLoginDropdown();
    } catch (error) {
        showError(error.message);
        if (inputElement) {
            inputElement.value = oldEmail;
        }
    }
};

export const handleAddUser = async (form) => {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");

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

        await populateLoginDropdown();
    } catch (error) {
        showError(error.message);
    }
};

export const handleDeleteUser = async (userId, userName, userEmail) => {
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

        await populateLoginDropdown();
    } catch (error) {
        showError(error.message);
    }
};

// --- Location Management Handlers ---

export const handleAddLocation = async (form) => {
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
        
        showSuccess(`Location "${data.name}" added/restored.`);
        nameInput.value = '';

        await logAdminActionToBlockchain({
            txType: "ADMIN_ADD_LOCATION",
            targetId: data.id,
            targetName: data.name
        });
    } catch (error) { showError(error.message); }
};

export const handleRestoreLocation = async (name) => {
    if (!name) return showError("Location name is missing.");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showSuccess(`Location "${data.name}" restored.`);

        await logAdminActionToBlockchain({
            txType: "ADMIN_RESTORE_LOCATION",
            targetId: data.id,
            targetName: data.name
        });
    } catch (error) { showError(error.message); }
};

export const handleRenameLocation = async (inputElement) => {
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
    } catch (error) { 
        showError(error.message); 
        inputElement.value = oldName;
        renderAdminPanel(); 
    }
};

export const handleArchiveLocation = async (id, name) => {
    if (!confirm(`Archive or Delete "${name}"?\n\n- If it has history, it will be ARCHIVED.\n- If it has no history, it will be PERMANENTLY DELETED.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
            method: 'DELETE', credentials: 'include'
        });
        
        let data = {};
        let successMessage = `Location "${name}" archived.`;

        if (response.status === 200) {
            data = await response.json();
            successMessage = data.message;
        } else if (response.status !== 204 && !response.ok) {
            data = await response.json();
            throw new Error(data.message);
        }
        
        showSuccess(successMessage);

        await logAdminActionToBlockchain({
            txType: "ADMIN_ARCHIVE_LOCATION",
            targetId: id,
            targetName: name
        });
    } catch (error) { showError(error.message); }
};

// --- Category Management Handlers ---

export const handleAddCategory = async (form) => {
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
        
        showSuccess(`Category "${data.name}" added/restored.`);
        nameInput.value = '';
        
        await logAdminActionToBlockchain({
            txType: "ADMIN_ADD_CATEGORY",
            targetId: data.id,
            targetName: data.name
        });
    } catch (error) { showError(error.message); }
};

export const handleRestoreCategory = async (name) => {
    if (!name) return showError("Category name is missing.");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ name: name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showSuccess(`Category "${data.name}" restored.`);
        
        await logAdminActionToBlockchain({
            txType: "ADMIN_RESTORE_CATEGORY",
            targetId: data.id,
            targetName: data.name
        });
    } catch (error) { showError(error.message); }
};

export const handleRenameCategory = async (inputElement) => {
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
    } catch (error) { 
        showError(error.message); 
        inputElement.value = oldName;
        renderAdminPanel(); 
    }
};

export const handleArchiveCategory = async (id, name) => {
    if (!confirm(`Archive or Delete "${name}"?\n\n- If it has history, it will be ARCHIVED.\n- If it has no history, it will be PERMANENTLY DELETED.`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
            method: 'DELETE', credentials: 'include'
        });
        
        let data = {};
        let successMessage = `Category "${name}" archived.`;

        if (response.status === 200) {
            data = await response.json();
            successMessage = data.message;
        } else if (response.status !== 204 && !response.ok) {
            data = await response.json();
            throw new Error(data.message);
        }

        showSuccess(successMessage);

        await logAdminActionToBlockchain({
            txType: "ADMIN_ARCHIVE_CATEGORY",
            targetId: id,
            targetName: name
        });
    } catch (error) { showError(error.message); }
};