// Lap/app.js
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- DOM ELEMENTS ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    
    const loginEmailInput = document.getElementById('login-email-input');
    const loginEmailSelect = document.getElementById('login-email-select');
    const quickLoginButton = document.getElementById('quick-login-button');
    
    const appWrapper = document.getElementById('app-wrapper');
    const appContent = document.getElementById('app-content');
    const logoutButton = document.getElementById('logout-button');
    
    // *** UPDATED navLinks ORDER ***
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        products: document.getElementById('nav-products'),
        analytics: document.getElementById('nav-analytics'),
        anomaly: document.getElementById('nav-anomaly'),
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
        profile: document.getElementById('nav-profile'),
    };
    const templates = {
        dashboard: document.getElementById('dashboard-view-template'),
        profile: document.getElementById('profile-view-template'),
        productList: document.getElementById('product-list-view-template'),
        productDetail: document.getElementById('product-detail-view-template'),
        analytics: document.getElementById('analytics-view-template'),
        anomaly: document.getElementById('anomaly-view-template'),
        admin: document.getElementById('admin-view-template'),
        ledger: document.getElementById('ledger-view-template'),
        snapshot: document.getElementById('snapshot-view-template'),
    };
    
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
        navigateTo('dashboard');
    };

    const navigateTo = async (view, context = {}) => {
        // Destroy old charts (function from chart-renderer.js)
        destroyCurrentCharts();

        appContent.innerHTML = '';
        Object.values(navLinks).forEach(link => link.classList.remove('active'));

        let viewTemplate;
        switch (view) {
            case 'products':
                navLinks.products.classList.add('active');
                viewTemplate = templates.productList.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderProductList();
                break;
            
            case 'detail':
                navLinks.products.classList.add('active');
                viewTemplate = templates.productDetail.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderProductDetail(context.productId);
                break;

            case 'admin':
                if (!permissionService.can('VIEW_ADMIN_PANEL')) return navigateTo('dashboard');
                navLinks.admin.classList.add('active');
                viewTemplate = templates.admin.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderAdminPanel();
                break;

            case 'ledger':
                if (!permissionService.can('VIEW_LEDGER')) return navigateTo('dashboard');
                navLinks.ledger.classList.add('active');
                viewTemplate = templates.ledger.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderFullLedger();
                break;
            
            case 'analytics':
                navLinks.analytics.classList.add('active');
                viewTemplate = templates.analytics.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                await renderAnalyticsPage();
                break;

            case 'anomaly':
                if (!permissionService.can('VIEW_LEDGER')) return navigateTo('dashboard');
                navLinks.anomaly.classList.add('active');
                viewTemplate = templates.anomaly.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                await renderAnomalyPage();
                break;
            
            case 'profile':
                navLinks.profile.classList.add('active');
                viewTemplate = templates.profile.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                await renderProfilePage();
                break;

            case 'snapshot':
                navLinks.ledger.classList.add('active');
                viewTemplate = templates.snapshot.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderSnapshotView(context.snapshotData);
                break;

            case 'dashboard':
            default:
                navLinks.dashboard.classList.add('active');
                viewTemplate = templates.dashboard.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                await renderDashboard();
                break;
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

    logoutButton.addEventListener('click', () => authService.logout(showLogin));
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

    appContent.addEventListener('click', async (e) => {
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
            await handleRenameLocation(e.target.dataset.id, e.target.value);
        }
        if (e.target.classList.contains('category-name-input')) {
            await handleRenameCategory(e.target.dataset.id, e.target.value);
        }

    });

    // --- INITIALIZATION ---
    await populateLoginDropdown();
    await authService.init(showApp, showLogin);
});