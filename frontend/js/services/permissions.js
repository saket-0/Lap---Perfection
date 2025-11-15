// frontend/js/services/permissions.js
import { currentUser } from '../app-state.js';

/**
 * Permission Service
 * Checks permissions based on the currentUser object.
 */
export const permissionService = {
    can: (action) => {
        if (!currentUser) return false;
        const role = currentUser.role;

        switch (action) {
            case 'VIEW_DASHBOARD':
                return true;
            case 'VIEW_PRODUCTS':
                return true;
            case 'CREATE_ITEM':
                return role === 'Admin';
            case 'EDIT_ITEM':
                return role === 'Admin';
            case 'UPDATE_STOCK': // Add, Remove, Move
                return role === 'Admin' || role === 'Inventory Manager';
            case 'VIEW_ITEM_HISTORY':
                return true;
            case 'VIEW_ADMIN_PANEL':
                return role === 'Admin';
            case 'MANAGE_USERS':
                return role === 'Admin';
            case 'VIEW_LEDGER':
                return role === 'Admin' || role === 'Auditor';
            case 'VERIFY_CHAIN':
                return role === 'Admin' || role === 'Auditor';
            case 'CLEAR_DB':
                return role === 'Admin';
            case 'DELETE_ITEM':
                return role === 'Admin';
            case 'VIEW_HISTORICAL_STATE':
                return role === 'Admin' || role === 'Auditor';
            default:
                return false;
        }
    }
};