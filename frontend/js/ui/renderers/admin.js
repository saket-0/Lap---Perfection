// frontend/js/ui/renderers/admin.js
// import { API_BASE_URL } from '../../../config.js';
import { currentUser, globalLocations, globalCategories } from '../../app-state.js';
import { showError } from '../components/notifications.js';
import { fetchLocations, fetchCategories } from '../../services/data.js';

const renderLocationManagement = async () => {
    const container = document.getElementById('location-list-container');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-500">Loading...</p>';
    await fetchLocations(); // Re-fetch to get admin-only view
    container.innerHTML = '';

    globalLocations.forEach(loc => {
        const item = document.createElement('div');
        const isArchived = loc.is_archived;
        item.className = `flex items-center gap-2 ${isArchived ? 'opacity-50' : ''}`;
        
        item.innerHTML = `
            <input 
                type="text" 
                class="location-name-input flex-1 form-input-underline" 
                data-id="${loc.id}" 
                data-old-name="${loc.name}" 
                value="${loc.name}" 
                ${isArchived ? 'disabled' : ''}
            >
            <button 
                class="location-archive-button text-red-600 hover:text-red-800 disabled:text-slate-400" 
                data-id="${loc.id}" 
                data-name="${loc.name}" 
                title="Archive Location"
                ${isArchived ? 'style="display: none;"' : ''}
            >
                <i class="ph-bold ph-trash"></i>
            </button>
            <button 
                class="location-restore-button text-green-600 hover:text-green-800" 
                data-name="${loc.name}" 
                title="Restore Location"
                ${!isArchived ? 'style="display: none;"' : ''}
            >
                <i class="ph-bold ph-arrow-counter-clockwise"></i>
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
        const isArchived = cat.is_archived;
        item.className = `flex items-center gap-2 ${isArchived ? 'opacity-50' : ''}`;
        
        item.innerHTML = `
            <input 
                type="text" 
                class="category-name-input flex-1 form-input-underline" 
                data-id="${cat.id}" 
                data-old-name="${cat.name}" 
                value="${cat.name}" 
                ${isArchived ? 'disabled' : ''}
            >
            <button 
                class="category-archive-button text-red-600 hover:text-red-800 disabled:text-slate-400" 
                data-id="${cat.id}" 
                data-name="${cat.name}" 
                title="Archive Category"
                ${isArchived ? 'style="display: none;"' : ''}
            >
                <i class="ph-bold ph-trash"></i>
            </button>
            <button 
                class="category-restore-button text-green-600 hover:text-green-800" 
                data-name="${cat.name}" 
                title="Restore Category"
                ${!isArchived ? 'style="display: none;"' : ''}
            >
                <i class="ph-bold ph-arrow-counter-clockwise"></i>
            </button>
        `;
        container.appendChild(item);
    });
};

export const renderAdminPanel = async () => {
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

    // Render the sub-sections
    await renderLocationManagement();
    await renderCategoryManagement();
};