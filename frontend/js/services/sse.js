// frontend/js/services/sse.js
import { AppState, blockchain, currentUser } from '../app-state.js';
import { rebuildInventoryState } from './blockchain.js';
import { showSuccess } from '../ui/components/notifications.js';

/**
 * Establishes the Server-Sent Events (SSE) connection.
 * @param {function} refreshCurrentViewCallback - The router's function to refresh the view.
 */
export const startSSEConnection = (refreshCurrentViewCallback) => {
    if (AppState.sseConnection) {
        AppState.sseConnection.close();
    }

    // Use the global API_BASE_URL from config.js
    AppState.sseConnection = new EventSource(`${API_BASE_URL}/api/events`, { withCredentials: true });

    AppState.sseConnection.onopen = () => {
        console.log('SSE Connection Established.');
    };

    AppState.sseConnection.onerror = (error) => {
        console.error('SSE Error:', error);
    };

    // Listen for our custom 'new-block' event from the server
    AppState.sseConnection.addEventListener('new-block', (event) => {
        const newBlock = JSON.parse(event.data);

        const blockExists = blockchain.some(block => block.hash === newBlock.hash);
        if (blockExists) {
            console.log('SSE: Block echo detected, ignoring.');
            return;
        }

        console.log('SSE: Received new block from server.', newBlock);
        blockchain.push(newBlock);
        rebuildInventoryState();

        const actor = newBlock.transaction.adminUserName || 'System';
        if (newBlock.transaction.adminUserId !== currentUser.id) {
            showSuccess(`System updated in real-time by ${actor}.`);
        }

        // Call the router's refresh function
        if (refreshCurrentViewCallback) {
            refreshCurrentViewCallback(newBlock);
        }
    });
    
    AppState.sseConnection.addEventListener('connected', (event) => {
        console.log('SSE: Server confirmed connection.');
    });
};

// --- The duplicate refreshCurrentView function has been REMOVED ---