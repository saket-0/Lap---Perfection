// frontend/js/services/data.js
// import { API_BASE_URL } from '../../config.js'; // <-- REMOVED THIS LINE
import { setGlobalLocations, setGlobalCategories, setGlobalUsers } from '../app-state.js';
import { showError } from '../ui/components/notifications.js';

/**
 * Fetches all active locations from the server.
 */
export const fetchLocations = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch locations');
        const locations = await response.json();
        setGlobalLocations(locations);
    } catch (e) {
        console.error(e);
        setGlobalLocations([{ name: "Supplier" }, { name: "Warehouse" }, { name: "Retailer" }]);
        showError('Could not load dynamic locations.');
    }
};

/**
 * Fetches all active categories from the server.
 */
export const fetchCategories = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const categories = await response.json();
        setGlobalCategories(categories);
    } catch (e) {
        console.error(e);
        setGlobalCategories([{ name: "Electronics" }, { name: "Uncategorized" }]);
        showError('Could not load dynamic categories.');
    }
};

/**
 * Fetches all users from the server.
 */
export const fetchUsers = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch users');
        const users = await response.json();
        setGlobalUsers(users);
    } catch (e) {
        console.error(e);
        setGlobalUsers([]);
        showError('Could not load users for filter.');
    }
};