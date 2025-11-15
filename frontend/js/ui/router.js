// frontend/js/ui/router.js
import { AppState, currentUser, blockchain } from '../app-state.js';
// import { authService } from '../services/auth.js';
import { permissionService } from '../services/permissions.js';
import { loadBlockchain, rebuildInventoryState } from '../services/blockchain.js';
import { startSSEConnection } from '../services/sse.js';
import { showError } from './components/notifications.js';
import { destroyCurrentCharts } from '../lib/charts/helpers.js';

// --- Import all View Renderers ---
import { renderDashboard } from './renderers/dashboard.js';
import { renderProductList } from './renderers/product-list.js';
import { renderProductDetail } from './renderers/product-detail.js';
import { renderAdminPanel } from './renderers/admin.js';
import { renderFullLedger } from './renderers/ledger.js';
import { renderAnalyticsPage } from '../lib/charts/analytics.js';
// import { renderAnomalyPage } from './renderers/anomaly.js';
import { renderAnomalyPage } from './anomaly-renderer.js';
import { renderProfilePage } from './renderers/profile.js';
import { renderSnapshotView } from './renderers/snapshot.js';

// --- App Initialization ---

export const showLogin = () => {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-wrapper').classList.add('hidden');
};

export const showApp = async () => {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-wrapper').classList.remove('hidden');
    
    const user = currentUser;
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.role;
    document.getElementById('user-employee-id').textContent = user.employee_id;

    // Set nav link visibility based on permissions
    const navLinks = {
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
        anomaly: document.getElementById('nav-anomaly'),
        analytics: document.getElementById('nav-analytics'),
        profile: document.getElementById('nav-profile'),
    };

    navLinks.admin.style.display = permissionService.can('VIEW_ADMIN_PANEL') ? 'flex' : 'none';
    navLinks.ledger.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';
    navLinks.anomaly.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';
    navLinks.analytics.style.display = 'flex';
    navLinks.profile.style.display = 'flex';

    // Load core data
    await loadBlockchain();
    rebuildInventoryState();
    
    // Start SSE Connection
    startSSEConnection(refreshCurrentView); // Pass refresh callback
    
    navigateTo('dashboard');
};

// --- View Loading & Routing ---

/**
 * Fetches an HTML view from the server.
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
        showError(error.message);
        return `<p class="text-red-600 p-4">Error loading view: ${error.message}. Please try again.</p>`;
    }
};

// Map view IDs to their configuration
const viewMap = {
    'dashboard': { file: 'dashboard', renderer: renderDashboard, navId: 'nav-dashboard' },
    'products': { file: 'product-list', renderer: renderProductList, navId: 'nav-products' },
    'detail': { file: 'product-detail', renderer: (ctx) => renderProductDetail(ctx.productId, navigateTo), navId: 'nav-products' },
    'admin': { file: 'admin', renderer: renderAdminPanel, navId: 'nav-admin', permission: 'VIEW_ADMIN_PANEL' },
    'ledger': { file: 'ledger', renderer: renderFullLedger, navId: 'nav-ledger', permission: 'VIEW_LEDGER' },
    'analytics': { file: 'analytics', renderer: renderAnalyticsPage, navId: 'nav-analytics' },
    'anomaly': { file: 'anomaly', renderer: renderAnomalyPage, navId: 'nav-anomaly', permission: 'VIEW_LEDGER' },
    'profile': { file: 'profile', renderer: renderProfilePage, navId: 'nav-profile' },
    'snapshot': { file: 'snapshot', renderer: (ctx) => renderSnapshotView(ctx.snapshotData), navId: 'nav-ledger' }
};

/**
 * Navigates to a new view, renders it, and calls its setup function.
 * @param {string} view - The key of the view to navigate to (e.g., 'dashboard')
 * @param {object} context - Any data to pass to the renderer (e.g., { productId: 'SKU-123' })
 */
export const navigateTo = async (view, context = {}) => {
    // 1. Clear state
    destroyCurrentCharts();
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.innerHTML = ''; // Clear content
    }
    
    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // 2. Get view config
    let viewConfig = viewMap[view] || viewMap.dashboard;
    AppState.currentViewId = view; 

    // 3. Check permissions
    if (viewConfig.permission && !permissionService.can(viewConfig.permission)) {
        showError("Access Denied.");
        AppState.currentViewId = 'dashboard';
        return navigateTo('dashboard'); // Redirect
    }

    // 4. Set active nav link
    if (viewConfig.navId) {
        const navLink = document.getElementById(viewConfig.navId);
        if (navLink) navLink.classList.add('active');
    }

    // 5. Fetch and inject HTML
    const htmlContent = await loadView(viewConfig.file);
    if (appContent) {
        appContent.innerHTML = htmlContent;
    }

    // 6. Call the renderer
    try {
        if (viewConfig.renderer) {
            // Pass the context to the renderer
            await viewConfig.renderer(context);
        }
    } catch (error) {
        console.error(`Error rendering view ${view}:`, error);
        if (view === 'detail') {
            showError(`Could not load product. It may have been deleted.`);
            navigateTo('products');
        } else {
            showError(`Error rendering ${view} page: ${error.message}`);
        }
    }
};

/**
 * Intelligently refreshes only the current view based on a new block.
 * This function is passed to the SSE service.
 */
const refreshCurrentView = (newBlock) => {
    const viewId = AppState.currentViewId;
    console.log(`SSE: Refreshing current view: ${viewId}`);

    switch (viewId) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'products':
            renderProductList();
            break;
        case 'detail':
            const detailIdEl = document.getElementById('update-product-id');
            if (detailIdEl) {
                const currentProductId = detailIdEl.value;
                if (newBlock.transaction.itemSku === currentProductId) {
                    if (newBlock.transaction.txType === 'DELETE_ITEM') {
                        showError('This product was just deleted.');
                        navigateTo('products');
                    } else {
                        destroyCurrentCharts();
                        renderProductDetail(currentProductId, navigateTo); // Pass router
                    }
                }
            }
            break;
        case 'ledger':
            renderFullLedger();
            break;
        case 'admin':
            if (newBlock.transaction.txType.startsWith('ADMIN_') || newBlock.transaction.txType.startsWith('USER_')) {
                // Re-fetch locations/categories if they were changed, then render admin
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
            // Anomalies are based on the full chain, so re-render
            renderAnomalyPage();
            break;
        case 'profile':
            if (newBlock.transaction.adminUserId === currentUser.id) {
                renderProfilePage();
            }
            break;
        // 'snapshot' is a read-only historical view, no refresh needed.
    }
};