// frontend/js/ui/components/dropdowns.js
// import { API_BASE_URL } from '../../config.js'; // <-- REMOVED THIS LINE
import { globalLocations, globalCategories, globalUsers } from '../../app-state.js';
import { showError } from './notifications.js';

export const populateLoginDropdown = async () => {
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

export const populateLocationDropdown = (selectElement, includeAll = false) => {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    
    if (includeAll) {
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Locations';
        selectElement.appendChild(allOption);
    }
    
    const locationsToShow = globalLocations.filter(loc => !loc.is_archived);
    if (locationsToShow.length === 0 && !includeAll) {
        selectElement.innerHTML = '<option value="">No locations.</option>';
        return;
    }

    locationsToShow.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.name;
        option.textContent = loc.name;
        selectElement.appendChild(option);
    });
    
    if (currentValue && (locationsToShow.some(l => l.name === currentValue) || (includeAll && currentValue === 'all'))) {
        selectElement.value = currentValue;
    } else if (!includeAll) {
        selectElement.value = locationsToShow[0]?.name || '';
    } else {
        selectElement.value = 'all'; // Default to "all" for filters
    }
};

export const populateCategoryDropdown = (selectElement, includeAll = false) => {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';

    if (includeAll) {
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Categories';
        selectElement.appendChild(allOption);
    }
    
    const categoriesToShow = globalCategories.filter(cat => !cat.is_archived);
    if (categoriesToShow.length === 0 && !includeAll) {
        selectElement.innerHTML = '<option value="">No categories.</option>';
        return;
    }

    categoriesToShow.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        selectElement.appendChild(option);
    });
    
    if (currentValue && (categoriesToShow.some(c => c.name === currentValue) || (includeAll && currentValue === 'all'))) {
        selectElement.value = currentValue;
    } else if (!includeAll) {
        selectElement.value = categoriesToShow[0]?.name || '';
    } else {
        selectElement.value = 'all'; // Default to "all" for filters
    }
};

export const populateUserDropdown = (selectElement, includeAll = false) => {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';

    if (includeAll) {
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Users';
        selectElement.appendChild(allOption);
    }
    
    if (globalUsers.length === 0) {
        selectElement.innerHTML = '<option value="">No users.</option>';
        return;
    }

    globalUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id; // Use user ID as the value
        option.textContent = user.name;
        selectElement.appendChild(option);
    });
    
    if (currentValue && (globalUsers.some(u => u.id == currentValue) || (includeAll && currentValue === 'all'))) {
        selectElement.value = currentValue;
    } else {
        selectElement.value = 'all'; // Default to "all"
    }
};