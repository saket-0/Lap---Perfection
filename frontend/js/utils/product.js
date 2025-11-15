// frontend/js/utils/product.js
import { inventory } from '../app-state.js';

/**
 * Generates a unique SKU that is not already present in the inventory.
 * @returns {string} A unique SKU (e.g., "SKU-1234")
 */
export const generateUniqueSku = () => {
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