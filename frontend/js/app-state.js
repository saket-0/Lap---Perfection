// frontend/js/app-state.js

/**
 * A simple object to hold shared application state,
 * preventing pollution of the global namespace.
 */
export const AppState = {
    sseConnection: null,
    currentViewId: 'dashboard', // Keep track of the current view
};

// --- State Variables (from core.js) ---
export let blockchain = [];
export let inventory = new Map(); // The "World State"
export let currentUser = null;
export let globalLocations = [];
export let globalCategories = [];
export let globalUsers = [];
export let newProductCounter = 1;

// --- State Mutators ---
// These functions modify the state and are exported
// so other modules can use them.

export function setBlockchain(newChain) {
    blockchain = newChain;
}

export function setInventory(newInventory) {
    inventory = newInventory;
}

export function setCurrentUser(newUser) {
    currentUser = newUser;
}

export function setGlobalLocations(newLocations) {
    globalLocations = newLocations;
}

export function setGlobalCategories(newCategories) {
    globalCategories = newCategories;
}

export function setGlobalUsers(newUsers) {
    globalUsers = newUsers;
}

export function incrementNewProductCounter() {
    newProductCounter++;
}

export function resetNewProductCounter() {
    newProductCounter = 1;
}

export function clearStateOnLogout() {
    blockchain = [];
    inventory.clear();
    currentUser = null;
    globalLocations = [];
    globalCategories = [];
    globalUsers = [];
    newProductCounter = 1;
}