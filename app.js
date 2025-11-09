// --- Theme Toggle Logic (GLOBAL) ---
const htmlEl = document.documentElement;

/**
 * Applies the selected theme to the <html> tag and Chart.js defaults.
 * @param {string} theme - 'light' or 'dark'
 */
const applyTheme = (theme) => {
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');

    if (theme === 'dark') {
        htmlEl.classList.add('dark');
        if (sunIcon && moonIcon) {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
        // Update Chart.js defaults for dark mode
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = '#d1d5db'; // slate-300
            Chart.defaults.borderColor = '#374151'; // slate-700
        }
    } else {
        htmlEl.classList.remove('dark');
        if (sunIcon && moonIcon) {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
        // Update Chart.js defaults for light mode
        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = '#6b7280'; // slate-500
            Chart.defaults.borderColor = '#e2e8f0'; // slate-200
        }
    }
    
    // Force any existing charts to update with new colors
    if (typeof currentCharts !== 'undefined') {
        currentCharts.forEach(chart => chart.update());
    }
};

// Apply saved theme *immediately* on script load to prevent FOUC
applyTheme(localStorage.getItem('bims_theme') || 'light');
// --- End Global Theme Logic ---

// Lap/app.js
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Theme Toggle Listener ---
    const themeToggleButton = document.getElementById('theme-toggle-button');
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('bims_theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('bims_theme', newTheme);
            applyTheme(newTheme);
        });
    }
    // --- End Theme ---
    
    // --- DOM ELEMENTS ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    
    const loginEmailInput = document.getElementById('login-email-input');
    const loginEmailSelect = document.getElementById('login-email-select');
    const quickLoginButton = document.getElementById('quick-login-button');
    
    const appWrapper = document.getElementById('app-wrapper');
    const appContent = document.getElementById('app-content');
    const logoutButton = document.getElementById('logout-button');
    
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        products: document.getElementById('nav-products'),
        analytics: document.getElementById('nav-analytics'),
        anomaly: document.getElementById('nav-anomaly'),
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
        profile: document.getElementById('nav-profile'),
    };
    
    // --- ** NEW: SSE Connection State ** ---
    let sseConnection = null;
    let currentViewId = 'dashboard'; // Keep track of the current view
    // --- ** END NEW ** ---
    
    // --- NAVIGATION & UI CONTROL ---
    const showLogin = () => {
        loginOverlay.style.display = 'flex';
        appWrapper.classList.add('hidden');
    };

    const showApp = async () => {
        loginOverlay.style.display = 'none';
        appWrapper.classList.remove('hidden');
        
        const user = currentUser;
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-role').textContent = user.role;
        document.getElementById('user-employee-id').textContent = user.employee_id;

        navLinks.admin.style.display = permissionService.can('VIEW_ADMIN_PANEL') ? 'flex' : 'none';
        navLinks.ledger.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';
        navLinks.anomaly.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';
        navLinks.analytics.style.display = 'flex';
        navLinks.profile.style.display = 'flex';

        await loadBlockchain();
        rebuildInventoryState();
        
        // --- ** NEW: Start SSE Connection ** ---
        startSSEConnection();
        // --- ** END NEW ** ---
        
        navigateTo('dashboard');
    };

    /**
     * NEW: Fetches an HTML view from the server.
     * @param {string} viewName - The name of the html file (e.g., 'dashboard')
     * @returns {Promise<string>} HTML content as a string.
     */
    const loadView = async (viewName) => {
        try {
            const response = await fetch(`views/${viewName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load view: ${viewName}.html`);
            }
            return await response.text();
        } catch (error) {
            console.error(error);
            // Use the global showError utility from ui-utils.js
            showError(error.message);
            return `<p class="text-red-600 p-4">Error loading view: ${error.message}. Please try again.</p>`;
        }
    };

    /**
     * UPDATED: Rewritten to fetch views dynamically.
     */
    const navigateTo = async (view, context = {}) => {
        // 1. Clear state
        destroyCurrentCharts();
        appContent.innerHTML = ''; // Clear content
        Object.values(navLinks).forEach(link => link.classList.remove('active'));

        // 2. Define all views, their files, render functions, and permissions
        const viewMap = {
            'dashboard': { file: 'dashboard', renderer: renderDashboard, nav: navLinks.dashboard },
            'products': { file: 'product-list', renderer: renderProductList, nav: navLinks.products },
            'detail': { file: 'product-detail', renderer: () => renderProductDetail(context.productId), nav: navLinks.products },
            'admin': { file: 'admin', renderer: renderAdminPanel, nav: navLinks.admin, permission: 'VIEW_ADMIN_PANEL' },
            'ledger': { file: 'ledger', renderer: renderFullLedger, nav: navLinks.ledger, permission: 'VIEW_LEDGER' },
            'analytics': { file: 'analytics', renderer: renderAnalyticsPage, nav: navLinks.analytics },
            'anomaly': { file: 'anomaly', renderer: renderAnomalyPage, nav: navLinks.anomaly, permission: 'VIEW_LEDGER' },
            'profile': { file: 'profile', renderer: renderProfilePage, nav: navLinks.profile },
            'snapshot': { file: 'snapshot', renderer: () => renderSnapshotView(context.snapshotData), nav: navLinks.ledger }
        };

        // 3. Get the configuration for the requested view, or default to dashboard
        let viewConfig = viewMap[view] || viewMap.dashboard;
        
        // *** NEW: Track the current view ***
        currentViewId = view; 

        // 4. Check permissions
        if (viewConfig.permission && !permissionService.can(viewConfig.permission)) {
            showError("Access Denied.");
            // *** MODIFIED: Set currentViewId before recursive call ***
            currentViewId = 'dashboard';
            return navigateTo('dashboard'); // Redirect to dashboard
        }

        // 5. Set active nav link
        if (viewConfig.nav) {
            viewConfig.nav.classList.add('active');
        }

        // 6. Fetch and inject the HTML
        const htmlContent = await loadView(viewConfig.file);
        appContent.innerHTML = htmlContent;

        // 7. Call the corresponding render function *after* HTML is in the DOM
        try {
            if (viewConfig.renderer) {
                await viewConfig.renderer();
            }
        } catch (error) {
            console.error(`Error rendering view ${view}:`, error);
            if (view === 'detail') {
                // This is a special case: if rendering a detail page fails
                // (e.g., product was deleted by another user), go to product list
                showError(`Could not load product. It may have been deleted.`);
                navigateTo('products');
            } else {
                showError(`Error rendering ${view} page: ${error.message}`);
            }
        }
    };
    
    // --- EVENT HANDLERS (Delegated & Static) ---

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmailInput.value;
        const password = document.getElementById('login-password').value;
        await authService.login(email, password, showApp, showError);
    });

    quickLoginButton.addEventListener('click', async () => {
        const email = loginEmailSelect.value;
        const password = "password";
        await authService.login(email, password, showApp, showError);
    });

    loginEmailSelect.addEventListener('change', () => {
        loginEmailInput.value = loginEmailSelect.value;
    });

    logoutButton.addEventListener('click', () => {
        // --- ** NEW: Close SSE connection on logout ** ---
        if (sseConnection) {
            sseConnection.close();
            sseConnection = null;
            console.log('SSE Connection closed by logout.');
        }
        // --- ** END NEW ** ---
        authService.logout(showLogin);
    });
    
    navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    navLinks.profile.addEventListener('click', (e) => { e.preventDefault(); navigateTo('profile'); });
    navLinks.products.addEventListener('click', (e) => { e.preventDefault(); navigateTo('products'); });
    navLinks.analytics.addEventListener('click', (e) => { e.preventDefault(); navigateTo('analytics'); });
    navLinks.anomaly.addEventListener('click', (e) => { e.preventDefault(); navigateTo('anomaly'); });
    navLinks.admin.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin'); });
    navLinks.ledger.addEventListener('click', (e) => { e.preventDefault(); navigateTo('ledger'); });

    appContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (e.target.id === 'add-item-form') {
            await handleAddItem(e.target);
        }
        
        if (e.target.id === 'update-stock-form') {
            await handleUpdateStock(e.target);
        }

        if (e.target.id === 'move-stock-form') {
            await handleMoveStock(e.target);
        }

        if (e.target.id === 'add-user-form') {
            await handleAddUser(e.target);
        }

        if (e.target.id === 'snapshot-form') {
            await handleSnapshotForm(e.target, navigateTo);
        }
        
        if (e.target.id === 'update-profile-form') {
            await handleUpdateProfile(e.target);
        }
        if (e.target.id === 'change-password-form') {
            await handleChangePassword(e.target);
        }

        if (e.target.id === 'add-location-form') {
            await handleAddLocation(e.target);
        }
        if (e.target.id === 'add-category-form') {
            await handleAddCategory(e.target);
        }
    });

    appContent.addEventListener('input', (e) => {
        if (e.target.id === 'product-search-input') {
            renderProductList();
        }
    });

    // ... (focus event listeners as before) ...
    appContent.addEventListener('focus', (e) => {
        if (e.target.tagName === 'INPUT') {
            if (e.target.id === 'product-search-input') {
                return;
            }
            if (e.target.type === 'datetime-local') {
                return;
            }
            if (e.target.type === 'text' || 
                e.target.type === 'number' || 
                e.target.type === 'email' || 
                e.target.type === 'password') 
            {
                e.target.select();
            }
        }
    }, true);

    loginOverlay.addEventListener('focus', (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'email' || e.target.type === 'password' || e.target.type === 'text')) {
            e.target.select();
        }
    }, true);


    appContent.addEventListener('click', async (e) => {
        
        // ... (copy-hash-button listener as before) ...
        if (e.target.closest('.copy-hash-button')) {
            const button = e.target.closest('.copy-hash-button');
            const hashToCopy = button.dataset.hash;
            if (!hashToCopy) {
                return showError('No hash data found to copy.');
            }
            try {
                await navigator.clipboard.writeText(hashToCopy);
                showSuccess('Hash copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy hash:', err);
                showError('Failed to copy. Please copy manually.');
            }
            return;
        }

        if (e.target.closest('#back-to-list-button')) {
            navigateTo('products');
            return;
        }

        if (e.target.closest('#back-to-ledger-button')) {
            navigateTo('ledger');
            return;
        }
        
        if (e.target.closest('#dashboard-view-ledger')) {
            e.preventDefault();
            navigateTo('ledger');
            return;
        }

        const productCard = e.target.closest('.product-card');
        if (productCard && productCard.dataset.productId) {
            navigateTo('detail', { productId: productCard.dataset.productId });
            return;
        }

        const lowStockItem = e.target.closest('.low-stock-item');
        if (lowStockItem && lowStockItem.dataset.productId) {
            navigateTo('detail', { productId: lowStockItem.dataset.productId });
            return;
        }

        const clickableStat = e.target.closest('.clickable-stat-item');
        if (clickableStat && clickableStat.dataset.productId) {
            navigateTo('detail', { productId: clickableStat.dataset.productId });
            return;
        }

        if (e.target.closest('#clear-db-button')) {
            await handleClearDb(navigateTo);
        }
        
        if (e.target.closest('#verify-chain-button')) {
            await handleVerifyChain();
        }

        if (e.target.closest('#delete-product-button')) {
            const productId = document.getElementById('detail-product-id').textContent;
            const productName = document.getElementById('detail-product-name').textContent;
            await handleDeleteProduct(productId, productName, navigateTo);
            return;
        }

        // ... (archive and delete listeners as before) ...
        const locArchive = e.target.closest('.location-archive-button');
        if (locArchive) {
            await handleArchiveLocation(locArchive.dataset.id, locArchive.dataset.name);
        }
        const catArchive = e.target.closest('.category-archive-button');
        if (catArchive) {
            await handleArchiveCategory(catArchive.dataset.id, catArchive.dataset.name);
        }
        const deleteButton = e.target.closest('.user-delete-button');
        if (deleteButton) {
            const userId = deleteButton.dataset.userId;
            const userName = deleteButton.dataset.userName;
            const userEmail = deleteButton.dataset.userEmail;
            await handleDeleteUser(userId, userName, userEmail);
        }
    });

    appContent.addEventListener('change', async (e) => {
        if (e.target.classList.contains('role-select')) {
            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;
            const newRole = e.target.value;
            await handleRoleChange(userId, userName, newRole);
        }

        if (e.target.classList.contains('user-email-input')) {
            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;
            const oldEmail = e.target.dataset.oldEmail;
            const newEmail = e.target.value;
            await handleEmailChange(userId, userName, newEmail, oldEmail, e.target);
        }

        if (e.target.classList.contains('location-name-input')) {
            await handleRenameLocation(e.target);
        }
        if (e.target.classList.contains('category-name-input')) {
            await handleRenameCategory(e.target);
        }
    });
    
    
    // --- ** NEW: SSE HELPER FUNCTIONS ** ---
    
    /**
     * Establishes the Server-Sent Events (SSE) connection.
     */
    const startSSEConnection = () => {
        if (sseConnection) {
            sseConnection.close();
        }

        // Use the API_BASE_URL from config.js
        // The { withCredentials: true } is vital for sending the session cookie
        sseConnection = new EventSource(`${API_BASE_URL}/api/events`, { withCredentials: true });

        sseConnection.onopen = () => {
            console.log('SSE Connection Established.');
        };

        sseConnection.onerror = (error) => {
            console.error('SSE Error:', error);
            // This can happen on server restart or network loss.
            // EventSource will automatically try to reconnect.
        };

        // Listen for our custom 'new-block' event from the server
        sseConnection.addEventListener('new-block', (event) => {
            const newBlock = JSON.parse(event.data);

            // Double-check we don't already have this block
            // (This prevents echo from our own submissions)
            const blockExists = blockchain.some(block => block.hash === newBlock.hash);
            if (blockExists) {
                console.log('SSE: Block echo detected, ignoring.');
                return;
            }

            // --- This is the core logic ---
            // 1. Add the new block to our local state
            console.log('SSE: Received new block from server.', newBlock);
            blockchain.push(newBlock);
            
            // 2. Rebuild the inventory from the updated chain
            rebuildInventoryState();

            // 3. Show a notification (unless it was us)
            const actor = newBlock.transaction.adminUserName || 'System';
            if (newBlock.transaction.adminUserId !== currentUser.id) {
                showSuccess(`System updated in real-time by ${actor}.`);
            }

            // 4. Intelligently refresh the current view
            refreshCurrentView(newBlock);
        });
        
        // This is the confirmation event we added in server.js
        sseConnection.addEventListener('connected', (event) => {
            console.log('SSE: Server confirmed connection.');
        });
    };

    /**
     * Intelligently refreshes only the current view based on the new block.
     */
    const refreshCurrentView = (newBlock) => {
        // We use the 'currentViewId' variable we set in navigateTo
        console.log(`SSE: Refreshing current view: ${currentViewId}`);
        switch (currentViewId) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'products':
                renderProductList();
                break;
            case 'detail':
                // We are on a detail page. Does this block affect this product?
                const detailIdEl = document.getElementById('detail-product-id');
                if (detailIdEl) {
                    const currentProductId = detailIdEl.textContent;
                    if (newBlock.transaction.itemSku === currentProductId) {
                        // If item was deleted, go back to list
                        if (newBlock.transaction.txType === 'DELETE_ITEM') {
                            showError('This product was just deleted.');
                            navigateTo('products');
                        } else {
                            destroyCurrentCharts(); // Destroy old chart
                            renderProductDetail(currentProductId); // Re-render all details
                        }
                    }
                }
                break;
            case 'ledger':
                renderFullLedger();
                break;
            case 'admin':
                // Any admin action, or a user profile action (which is on the same chain)
                if (newBlock.transaction.txType.startsWith('ADMIN_') || newBlock.transaction.txType.startsWith('USER_')) {
                    // Also need to re-fetch locations/categories if they were changed
                    if (newBlock.transaction.txType.includes('LOCATION')) {
                        fetchLocations().then(renderAdminPanel);
                    } else if (newBlock.transaction.txType.includes('CATEGORY')) {
                        fetchCategories().then(renderAdminPanel);
                    } else {
                        renderAdminPanel();
                    }
                }
                break;
            case 'analytics':
                destroyCurrentCharts();
                renderAnalyticsPage();
                break;
            case 'anomaly':
                destroyCurrentCharts();
                renderAnomalyPage();
                break;
            case 'profile':
                // Check if this block belongs to the current user
                if (newBlock.transaction.adminUserId === currentUser.id) {
                    renderProfilePage();
                }
                break;
            // 'snapshot' is a read-only historical view, no refresh needed.
        }
    };
    // --- ** END NEW SSE FUNCTIONS ** ---


    // --- INITIALIZATION ---
    await populateLoginDropdown();
    await authService.init(showApp, showLogin);
});