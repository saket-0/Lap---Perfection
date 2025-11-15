// frontend/js/ui/renderers/ledger.js
import { blockchain } from '../../app-state.js';
import { permissionService } from '../../services/permissions.js';
import { populateUserDropdown, populateCategoryDropdown, populateLocationDropdown } from '../components/dropdowns.js';
import { createLedgerBlockElement } from '../components/ledger-block.js';

export const renderFullLedger = () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    // 1. Populate Admin Widgets
    const snapshotFormContainer = appContent.querySelector('#snapshot-form-container');
    if (snapshotFormContainer) {
        snapshotFormContainer.style.display = permissionService.can('VIEW_HISTORICAL_STATE') ? 'block' : 'none';
        const timestampInput = snapshotFormContainer.querySelector('#snapshot-timestamp');
        if (!timestampInput.value) {
            timestampInput.value = new Date().toISOString().slice(0, 16);
        }
    }

    const verifyChainContainer = appContent.querySelector('#verify-chain-container');
    if (verifyChainContainer) {
        verifyChainContainer.style.display = permissionService.can('VERIFY_CHAIN') ? 'block' : 'none';
    }

    // 2. Populate Filter Dropdowns
    populateUserDropdown(appContent.querySelector('#ledger-user-filter'), true);
    populateCategoryDropdown(appContent.querySelector('#ledger-category-filter'), true);
    populateLocationDropdown(appContent.querySelector('#ledger-location-filter'), true);

    // 3. Get All Filter Values
    const searchTerm = (appContent.querySelector('#ledger-search-input')?.value || '').toLowerCase();
    const userFilter = appContent.querySelector('#ledger-user-filter')?.value || 'all';
    const categoryFilter = appContent.querySelector('#ledger-category-filter')?.value || 'all';
    const locationFilter = appContent.querySelector('#ledger-location-filter')?.value || 'all';
    const txTypeFilter = appContent.querySelector('#ledger-tx-type-filter')?.value || 'all';
    const dateFrom = appContent.querySelector('#ledger-date-from')?.value;
    const dateTo = appContent.querySelector('#ledger-date-to')?.value;
    
    const dateFromObj = dateFrom ? new Date(dateFrom) : null;
    const dateToObj = dateTo ? new Date(dateTo) : null;
    if (dateFromObj) dateFromObj.setHours(0, 0, 0, 0);
    if (dateToObj) dateToObj.setHours(23, 59, 59, 999);

    // 4. Filter the Blockchain
    const ledgerDisplay = appContent.querySelector('#full-ledger-display');
    ledgerDisplay.innerHTML = '';
    
    const filteredBlockchain = [...blockchain].reverse().filter(block => {
        if (block.transaction.txType === 'GENESIS') return false;

        const tx = block.transaction;
        const blockTimestamp = new Date(block.timestamp);

        // Date Filters
        if (dateFromObj && blockTimestamp < dateFromObj) return false;
        if (dateToObj && blockTimestamp > dateToObj) return false;

        // User Filter
        if (userFilter !== 'all' && tx.adminUserId != userFilter) return false;

        // Category Filter
        if (categoryFilter !== 'all') {
            const txCategory = tx.category || tx.newCategory || tx.oldCategory;
            if (!txCategory || txCategory !== categoryFilter) return false;
        }
        
        // Location Filter
        if (locationFilter !== 'all') {
            const txLocations = [tx.location, tx.fromLocation, tx.toLocation, tx.targetName];
            if (!txLocations.includes(locationFilter)) return false;
        }

        // Tx Type Filter
        if (txTypeFilter !== 'all' && tx.txType !== txTypeFilter) return false;
        
        // Text Search Filter
        if (searchTerm) {
            let searchableText = `${tx.txType} ${tx.itemSku} ${tx.itemName} ${tx.adminUserName} ${tx.targetUser} ${tx.targetEmail}`;
            searchableText = searchableText.toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }

        return true; // Block passes all filters
    });

    // 5. Render the Filtered Blocks
    if (filteredBlockchain.length === 0) {
        ledgerDisplay.innerHTML = '<p class="text-slate-500">No transactions match the current filters.</p>';
    } else {
        filteredBlockchain.forEach(block => {
            ledgerDisplay.appendChild(createLedgerBlockElement(block));
        });
    }

    // 6. Update Count
    const resultsCountEl = appContent.querySelector('#ledger-results-count');
    if (resultsCountEl) {
        resultsCountEl.textContent = `Showing ${filteredBlockchain.length} matching transactions (Newest block on top).`;
    }
};