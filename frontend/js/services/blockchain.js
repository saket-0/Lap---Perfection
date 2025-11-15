// frontend/js/services/blockchain.js
import { API_BASE_URL } from '../../config.js';
import { 
    blockchain, inventory, setBlockchain, 
    setCurrentUser, clearStateOnLogout 
} from '../app-state.js';
import { authService } from './auth.js';
// We will create this file soon. For now, we stub the import.
// import { showError } from '../ui/components/notifications.js';
const showError = (msg) => console.error(msg); // Placeholder

/**
 * Sends the transaction to the server, which creates the block.
 * It **DOES NOT** modify the local blockchain array.
 */
export const addTransactionToChain = async (transaction) => {
    const response = await fetch(`${API_BASE_URL}/api/blockchain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send session cookie
        body: JSON.stringify(transaction) // Send just the transaction data
    });

    if (!response.ok) {
        const err = await response.json();
        // Throw an error to be caught by the UI handler
        throw new Error(err.message || 'Server failed to add transaction.');
    }
    
    const newBlock = await response.json(); // Server returns the new, valid block
    return newBlock; // Return the block so the form handler knows it succeeded
};


/**
 * This logic is still needed on the client-side for two reasons:
 * 1. To run a "pre-check" in the UI before sending to the server.
 * 2. To run inside rebuildInventoryState() to build the local inventory map.
 */
export const processTransaction = (transaction, suppressErrors = false, showErrorCallback) => {
    const { 
        txType, itemSku, itemName, quantity, 
        fromLocation, toLocation, location, price, category,
        newName, newPrice, newCategory
    } = transaction;

    let product;
    if (txType !== 'CREATE_ITEM' && !inventory.has(itemSku)) {
        if (showErrorCallback) showErrorCallback(`Product ${itemSku} not found.`, suppressErrors);
        return false;
    }
    
    if (txType !== 'CREATE_ITEM') {
        product = inventory.get(itemSku);
    }

    switch (txType) {
        case 'CREATE_ITEM':
            if (inventory.has(itemSku) && !suppressErrors) {
                if (showErrorCallback) showErrorCallback(`Product SKU ${itemSku} already exists.`);
                return false;
            }
            if (!inventory.has(itemSku)) {
                 inventory.set(itemSku, {
                    productName: itemName,
                    price: price || 0,
                    category: category || 'Uncategorized',
                    locations: new Map()
                });
            }
            product = inventory.get(itemSku);
            const currentAddQty = product.locations.get(toLocation) || 0;
            product.locations.set(toLocation, currentAddQty + quantity);
            return true;
    
        case 'MOVE':
            const fromQty = product.locations.get(fromLocation) || 0;
            if (fromQty < quantity) {
                if (showErrorCallback) showErrorCallback(`Insufficient stock at ${fromLocation}. Only ${fromQty} available.`, suppressErrors);
                return false;
            }
            if (fromLocation === toLocation) {
                 if (showErrorCallback) showErrorCallback(`Cannot move item to its current location.`, suppressErrors);
                 return false;
            }
            const toQty = product.locations.get(toLocation) || 0;
            product.locations.set(fromLocation, fromQty - quantity);
            product.locations.set(toLocation, toQty + quantity);
            return true;
        
        case 'STOCK_IN':
            const currentStockInQty = product.locations.get(location) || 0;
            product.locations.set(location, currentStockInQty + quantity);
            return true;
        
        case 'STOCK_OUT':
            const currentStockOutQty = product.locations.get(location) || 0;
            if (currentStockOutQty < quantity) {
                if (showErrorCallback) showErrorCallback(`Insufficient stock at ${location}. Only ${currentStockOutQty} available.`, suppressErrors);
                return false;
            }
            product.locations.set(location, currentStockOutQty - quantity);
            return true;
        
        case 'ADMIN_EDIT_ITEM':
            if (product) {
                product.productName = newName || product.productName;
                product.price = newPrice !== undefined ? newPrice : product.price;
                product.category = newCategory || product.category;
            }
            return true;

        case 'DELETE_ITEM':
            if (product.is_deleted) {
                if (showErrorCallback) showErrorCallback(`Product ${itemSku} is already deleted.`, suppressErrors);
                return false;
            }
            let totalStock = 0;
            product.locations.forEach(qty => totalStock += qty);
            if (totalStock > 0) {
                if (showErrorCallback) showErrorCallback(`Cannot delete product with remaining stock (${totalStock} units). Please stock out all units first.`, suppressErrors);
                return false;
            }
            product.is_deleted = true; // Apply the state change
            return true;
    }
    return false;
};

/**
 * Loads the blockchain from the server API.
 */
export const loadBlockchain = async () => {
    try {
        console.log('Fetching blockchain from server...');
        const response = await fetch(`${API_BASE_URL}/api/blockchain`, {
            credentials: 'include' // Send session cookie
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to fetch blockchain from server.');
        }
        const chain = await response.json();
        setBlockchain(chain);
        
        if (blockchain.length === 0) {
            throw new Error('Server returned an empty blockchain.');
        }
        console.log(`Blockchain loaded. ${blockchain.length} blocks found.`);
    } catch (e) {
        console.error("Failed to load blockchain:", e);
        alert(`CRITICAL ERROR: Could not load blockchain from server. ${e.message}. Logging out.`);
        authService.logout(() => {
            document.getElementById('login-overlay').style.display = 'flex';
            document.getElementById('app-wrapper').classList.add('hidden');
        });
    }
};

/**
 * Rebuilds the local inventory state from the local blockchain.
 */
export const rebuildInventoryState = () => {
    inventory.clear();
    for (let i = 1; i < blockchain.length; i++) { // Skip Genesis
        if (blockchain[i] && blockchain[i].transaction) {
            // Suppress errors on rebuild, as the server has already validated
            processTransaction(blockchain[i].transaction, true, null); 
        }
    }
};