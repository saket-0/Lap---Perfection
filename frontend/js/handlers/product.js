// frontend/js/handlers/product.js
import { inventory, newProductCounter, incrementNewProductCounter } from '../app-state.js';
import { permissionService } from '../services/permissions.js';
import { addTransactionToChain, processTransaction, rebuildInventoryState } from '../services/blockchain.js';
import { generateUniqueSku } from '../utils/product.js';
import { showError, showSuccess } from '../ui/components/notifications.js';
import { renderProductDetail } from '../ui/renderers/product-detail.js';

export const handleAddItem = async (form) => {
    if (!permissionService.can('CREATE_ITEM')) return showError("Access Denied.");

    const itemSku = form.querySelector('#add-product-id').value;
    const itemName = form.querySelector('#add-product-name').value;
    const quantity = parseInt(form.querySelector('#add-quantity').value, 10);
    const toLocation = form.querySelector('#add-to').value;
    const price = parseFloat(form.querySelector('#add-price').value);
    const category = form.querySelector('#add-product-category').value;

    if (!itemSku || !itemName || !category || !quantity || quantity <= 0 || !price || price < 0) {
        return showError("Please fill out all fields with valid data (Price/Qty > 0).");
    }
    
    const stickyCategory = category;
    const stickyLocation = toLocation;
    
    const transaction = {
        txType: "CREATE_ITEM", itemSku, itemName, quantity,
        price, category,
        beforeQuantity: 0, 
        afterQuantity: quantity, 
        toLocation
    };
    
    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            showSuccess(`Product ${itemName} added! Updating system...`);
            
            form.reset();
            incrementNewProductCounter();
            form.querySelector('#add-product-name').value = `New Product ${newProductCounter}`;
            form.querySelector('#add-product-id').value = generateUniqueSku();
            form.querySelector('#add-product-category').value = stickyCategory;
            form.querySelector('#add-to').value = stickyLocation;

        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState();
        }
    }
};

export const handleUpdateStock = async (form) => {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");

    const itemSku = document.getElementById('update-product-id').value;
    const quantity = parseInt(form.querySelector('#update-quantity').value, 10);
    const clickedButton = document.activeElement;
    const actionType = clickedButton.id === 'stock-in-button' ? 'STOCK_IN' : 'STOCK_OUT';

    if (!itemSku || !quantity || quantity <= 0) return showError("Please enter a valid quantity.");
    
    const product = inventory.get(itemSku);
    let transaction = {};
    let success = false;
    let beforeQuantity, afterQuantity;

    if (actionType === 'STOCK_IN') {
        const locationIn = form.querySelector('#update-location').value;
        beforeQuantity = product.locations.get(locationIn) || 0;
        afterQuantity = beforeQuantity + quantity;

        transaction = { 
            txType: "STOCK_IN", itemSku, quantity, 
            location: locationIn, 
            beforeQuantity, afterQuantity
        };
        success = processTransaction(transaction, false, showError);

    } else if (actionType === 'STOCK_OUT') {
        const locationOut = form.querySelector('#update-location').value;
        beforeQuantity = product.locations.get(locationOut) || 0;
        afterQuantity = beforeQuantity - quantity;
        
        transaction = { 
            txType: "STOCK_OUT", itemSku, quantity, 
            location: locationOut, 
            beforeQuantity, afterQuantity
        };
        success = processTransaction(transaction, false, showError);
    }

    if (success) {
        try {
            await addTransactionToChain(transaction);
            showSuccess(`Stock for ${itemSku} updated! Updating system...`);
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState();
            renderProductDetail(itemSku);
        }
    }
};

export const handleMoveStock = async (form) => {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");

    const itemSku = document.getElementById('update-product-id').value;
    const quantity = parseInt(form.querySelector('#move-quantity').value, 10);
    const fromLocation = form.querySelector('#move-from-location').value;
    const toLocation = form.querySelector('#move-to-location').value;

    if (fromLocation === toLocation) {
        return showError("Cannot move stock to the same location.");
    }
    if (!itemSku || !quantity || quantity <= 0) {
        return showError("Please enter a valid quantity.");
    }

    const product = inventory.get(itemSku);
    const beforeFromQty = product.locations.get(fromLocation) || 0;
    const beforeToQty = product.locations.get(toLocation) || 0;
    
    const transaction = {
        txType: "MOVE", itemSku, quantity,
        fromLocation, toLocation,
        beforeQuantity: { from: beforeFromQty, to: beforeToQty },
        afterQuantity: { from: beforeFromQty - quantity, to: beforeToQty + quantity }
    };

    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            showSuccess(`Moved ${quantity} units of ${itemSku}. Updating system...`);
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState();
            renderProductDetail(itemSku);
        }
    }
};

export const handleEditProduct = async (form) => {
    if (!permissionService.can('EDIT_ITEM')) return showError("Access Denied.");

    const itemSku = document.getElementById('update-product-id').value;
    const newName = form.querySelector('#edit-product-name').value;
    const newPrice = parseFloat(form.querySelector('#edit-product-price').value);
    const newCategory = form.querySelector('#edit-product-category').value;

    const product = inventory.get(itemSku);
    
    if (product.productName === newName && product.price === newPrice && product.category === newCategory) {
        return showSuccess("No changes to save.");
    }

    const transaction = {
        txType: "ADMIN_EDIT_ITEM",
        itemSku: itemSku,
        oldName: product.productName,
        oldPrice: product.price,
        oldCategory: product.category,
        newName: newName,
        newPrice: newPrice,
        newCategory: newCategory
    };

    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            showSuccess(`Product ${itemSku} updated! Updating system...`);
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState(); 
            renderProductDetail(itemSku);
        }
    }
};

export const handleDeleteProduct = async (productId, productName) => {
    if (!permissionService.can('DELETE_ITEM')) return showError("Access Denied.");

    if (!confirm(`Are you sure you want to delete "${productName}" (${productId})?\n\nThis action can only be done if stock is 0 and will be permanently recorded.`)) {
        return;
    }

    const transaction = {
        txType: "DELETE_ITEM",
        itemSku: productId,
        itemName: productName
    };

    if (processTransaction(transaction, false, showError)) {
        try {
            await addTransactionToChain(transaction);
            showSuccess(`Product ${productName} deleted! Updating system...`);
            // SSE will handle navigation
        } catch (error) {
            showError(`Server error: ${error.message}`);
            rebuildInventoryState();
            renderProductDetail(productId);
        }
    }
};