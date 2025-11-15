// frontend/js/ui/listeners.js
import { AppState, currentUser } from '../app-state.js';
import { authService } from '../services/auth.js';
import { navigateTo, showLogin, showApp } from './router.js';
import { showError, showSuccess } from './components/notifications.js';
import { populateLoginDropdown } from './components/dropdowns.js';
import { renderProductList } from './renderers/product-list.js';
import { renderFullLedger } from './renderers/ledger.js';
import { toggleProductEditMode, renderProductDetail } from './renderers/product-detail.js';

// vvv IMPORT THE NEW SERVICE vvv
import { openImageCropper, handleCropConfirm, handleCropCancel } from '../services/image-uploader.js';
// ^^^ IMPORT THE NEW SERVICE ^^^

// --- Import all handler functions ---
import {
    handleAddUser,
    handleEmailChange,
    handleRoleChange,
    handleDeleteUser,
    handleAddLocation,
    handleArchiveLocation,
    handleRenameLocation,
    handleRestoreLocation,
    handleAddCategory,
    handleArchiveCategory,
    handleRenameCategory,
    handleRestoreCategory
} from '../handlers/admin.js';
import {
    handleSnapshotForm,
    handleVerifyChain,
    handleClearDb
} from '../handlers/ledger.js';
import {
    handleAddItem,
    handleUpdateStock,
    handleMoveStock,
    handleEditProduct,
    handleDeleteProduct
} from '../handlers/product.js';
import {
    handleUpdateProfile,
    handleChangePassword
} from '../handlers/profile.js';


export function initAppListeners() {
    
    // --- Theme Toggle Listener ---
    const themeToggleButton = document.getElementById('theme-toggle-button');
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            // Theme logic is self-contained in theme.js, just need to call it
            const currentTheme = localStorage.getItem('bims_theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('bims_theme', newTheme);
            
            // applyTheme is global via script tag in index.html
            // If theme.js were a module, we'd import and call applyTheme(newTheme)
            applyTheme(newTheme);
        });
    }

    // --- Auth Listeners ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const loginEmailInput = document.getElementById('login-email-input');
            const email = loginEmailInput.value;
            const password = document.getElementById('login-password').value;
            await authService.login(email, password, showApp, showError);
        });
    }

    const quickLoginButton = document.getElementById('quick-login-button');
    if (quickLoginButton) {
        quickLoginButton.addEventListener('click', async () => {
            const loginEmailSelect = document.getElementById('login-email-select');
            const email = loginEmailSelect.value;
            const password = "password";
            await authService.login(email, password, showApp, showError);
        });
    }

    const loginEmailSelect = document.getElementById('login-email-select');
    if (loginEmailSelect) {
        loginEmailSelect.addEventListener('change', () => {
            const loginEmailInput = document.getElementById('login-email-input');
            loginEmailInput.value = loginEmailSelect.value;
        });
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (AppState.sseConnection) {
                AppState.sseConnection.close();
                AppState.sseConnection = null;
                console.log('SSE Connection closed by logout.');
            }
            authService.logout(showLogin);
        });
    }

    // --- Cropper Modal Listeners (Global) ---
    const cropperConfirmButton = document.getElementById('cropper-confirm-button');
    if (cropperConfirmButton) {
        cropperConfirmButton.addEventListener('click', () => handleCropConfirm(showSuccess));
    }
    const cropperCancelButton = document.getElementById('cropper-cancel-button');
    if (cropperCancelButton) {
        cropperCancelButton.addEventListener('click', () => handleCropCancel());
    }
    
    // --- Navigation Listeners ---
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        products: document.getElementById('nav-products'),
        analytics: document.getElementById('nav-analytics'),
        anomaly: document.getElementById('nav-anomaly'),
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
        profile: document.getElementById('nav-profile'),
    };

    if (navLinks.dashboard) navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    if (navLinks.profile) navLinks.profile.addEventListener('click', (e) => { e.preventDefault(); navigateTo('profile'); });
    if (navLinks.products) navLinks.products.addEventListener('click', (e) => { e.preventDefault(); navigateTo('products'); });
    if (navLinks.analytics) navLinks.analytics.addEventListener('click', (e) => { e.preventDefault(); navigateTo('analytics'); });
    if (navLinks.anomaly) navLinks.anomaly.addEventListener('click', (e) => { e.preventDefault(); navigateTo('anomaly'); });
    if (navLinks.admin) navLinks.admin.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin'); });
    if (navLinks.ledger) navLinks.ledger.addEventListener('click', (e) => { e.preventDefault(); navigateTo('ledger'); });

    // --- Main Content Event Delegation ---
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    // --- FORM SUBMISSIONS ---
    appContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Product Handlers
        if (e.target.id === 'add-item-form') await handleAddItem(e.target);
        if (e.target.id === 'update-stock-form') await handleUpdateStock(e.target);
        if (e.target.id === 'move-stock-form') await handleMoveStock(e.target);
        if (e.target.id === 'product-detail-form') await handleEditProduct(e.target);

        // Admin Handlers
        if (e.target.id === 'add-user-form') await handleAddUser(e.target);
        if (e.target.id === 'add-location-form') await handleAddLocation(e.target);
        if (e.target.id === 'add-category-form') await handleAddCategory(e.target);
        
        // Ledger Handlers
        if (e.target.id === 'snapshot-form') await handleSnapshotForm(e.target, navigateTo);
        
        // Profile Handlers
        if (e.target.id === 'update-profile-form') await handleUpdateProfile(e.target);
        if (e.target.id === 'change-password-form') await handleChangePassword(e.target);
    });

    // --- CLICKS ---
    appContent.addEventListener('click', async (e) => {
        
        // --- Navigation Clicks ---
        if (e.target.closest('#back-to-list-button')) navigateTo('products');
        if (e.target.closest('#back-to-ledger-button')) navigateTo('ledger');
        if (e.target.closest('#dashboard-view-ledger')) { e.preventDefault(); navigateTo('ledger'); }
        
        // --- Product Detail Clicks ---
        const productCard = e.target.closest('.product-card');
        if (productCard && productCard.dataset.productId) {
            navigateTo('detail', { productId: productCard.dataset.productId });
        }
        const lowStockItem = e.target.closest('.low-stock-item');
        if (lowStockItem && lowStockItem.dataset.productId) {
            navigateTo('detail', { productId: lowStockItem.dataset.productId });
        }
        const clickableStat = e.target.closest('.clickable-stat-item');
        if (clickableStat && clickableStat.dataset.productId) {
            navigateTo('detail', { productId: clickableStat.dataset.productId });
        }
        if (e.target.closest('#product-edit-toggle-button')) {
            e.preventDefault();
            toggleProductEditMode(true);
        }
        if (e.target.closest('#product-edit-cancel-button')) {
            e.preventDefault();
            const productId = document.getElementById('update-product-id').value;
            renderProductDetail(productId, navigateTo); // Re-render to reset form
        }
        if (e.target.closest('#delete-product-button')) {
            const productId = document.getElementById('detail-product-id').textContent;
            const productName = document.getElementById('detail-product-name').textContent;
            await handleDeleteProduct(productId, productName);
        }

        // --- Ledger Clicks ---
        if (e.target.closest('#clear-db-button')) await handleClearDb(navigateTo);
        if (e.target.closest('#verify-chain-button')) await handleVerifyChain();

        // --- Admin Clicks ---
        const locArchive = e.target.closest('.location-archive-button');
        if (locArchive) await handleArchiveLocation(locArchive.dataset.id, locArchive.dataset.name);
        
        const locRestore = e.target.closest('.location-restore-button');
        if (locRestore) await handleRestoreLocation(locRestore.dataset.name);

        const catArchive = e.target.closest('.category-archive-button');
        if (catArchive) await handleArchiveCategory(catArchive.dataset.id, catArchive.dataset.name);

        const catRestore = e.target.closest('.category-restore-button');
        if (catRestore) await handleRestoreCategory(catRestore.dataset.name);
        
        const deleteButton = e.target.closest('.user-delete-button');
        if (deleteButton) {
            await handleDeleteUser(deleteButton.dataset.userId, deleteButton.dataset.userName, deleteButton.dataset.userEmail);
        }
        
        // --- Filter Resets ---
        if (e.target.closest('#product-filter-reset')) {
            appContent.querySelector('#product-search-input').value = '';
            appContent.querySelector('#product-category-filter').value = 'all';
            appContent.querySelector('#product-location-filter').value = 'all';
            renderProductList();
        }
        if (e.target.closest('#ledger-filter-reset')) {
            appContent.querySelector('#ledger-search-input').value = '';
            appContent.querySelector('#ledger-user-filter').value = 'all';
            appContent.querySelector('#ledger-category-filter').value = 'all';
            appContent.querySelector('#ledger-location-filter').value = 'all';
            appContent.querySelector('#ledger-tx-type-filter').value = 'all';
            appContent.querySelector('#ledger-date-from').value = '';
            appContent.querySelector('#ledger-date-to').value = '';
            renderFullLedger();
        }

        // --- Misc Clicks ---
        if (e.target.closest('.copy-hash-button')) {
            const hashToCopy = e.target.closest('.copy-hash-button').dataset.hash;
            if (!hashToCopy) return showError('No hash data found to copy.');
            try {
                await navigator.clipboard.writeText(hashToCopy);
                showSuccess('Hash copied to clipboard!');
            } catch (err) {
                showError('Failed to copy. Please copy manually.');
            }
        }

        // vvv MODIFIED CLICK LISTENERS vvv
        if (e.target.closest('#add-image-upload-button')) {
            e.preventDefault();
            appContent.querySelector('#add-image-file-input')?.click();
        }
        if (e.target.closest('#edit-image-upload-button')) {
            e.preventDefault();
            appContent.querySelector('#edit-image-file-input')?.click();
        }
        // ^^^ END OF MODIFIED CLICK LISTENERS ^^^
    });

    // --- CHANGES & INPUTS ---
    appContent.addEventListener('change', async (e) => {
        // Admin Changes
        if (e.target.classList.contains('role-select')) {
            await handleRoleChange(e.target.dataset.userId, e.target.dataset.userName, e.target.value);
        }
        if (e.target.classList.contains('user-email-input')) {
            await handleEmailChange(e.target.dataset.userId, e.target.dataset.userName, e.target.value, e.target.dataset.oldEmail, e.target);
        }
        if (e.target.classList.contains('location-name-input')) await handleRenameLocation(e.target);
        if (e.target.classList.contains('category-name-input')) await handleRenameCategory(e.target);
        
        // Filter Changes
        if (e.target.id === 'product-category-filter' || e.target.id === 'product-location-filter') {
            renderProductList();
        }
        if (e.target.id === 'ledger-user-filter' || e.target.id === 'ledger-category-filter' || e.target.id === 'ledger-location-filter' || e.target.id === 'ledger-tx-type-filter') {
            renderFullLedger();
        }

        // vvv MODIFIED CHANGE LISTENERS vvv
        if (e.target.id === 'add-image-file-input') {
            const file = e.target.files[0];
            const targetUrlInput = appContent.querySelector('#add-image-url');
            if (file && targetUrlInput) {
                try {
                    // Open the cropper and wait for it to resolve
                    const croppedBase64 = await openImageCropper(file, showSuccess, showError);
                    // Set the input value to the cropped image data
                    targetUrlInput.value = croppedBase64;
                } catch (error) {
                    if (error.message !== 'User cancelled cropping.') {
                        showError(error.message);
                    }
                    console.warn('Image selection cancelled.');
                }
                e.target.value = null; // Clear file input so user can select same file again
            }
        }
        if (e.target.id === 'edit-image-file-input') {
            const file = e.target.files[0];
            const targetUrlInput = appContent.querySelector('#edit-product-image-url');
            if (file && targetUrlInput) {
                 try {
                    // Open the cropper and wait for it to resolve
                    const croppedBase64 = await openImageCropper(file, showSuccess, showError);
                    // Set the input value to the cropped image data
                    targetUrlInput.value = croppedBase64;
                } catch (error) {
                    if (error.message !== 'User cancelled cropping.') {
                        showError(error.message);
                    }
                    console.warn('Image selection cancelled.');
                }
                e.target.value = null; // Clear file input
            }
        }
        // ^^^ END OF MODIFIED CHANGE LISTENERS ^^^
    });

    appContent.addEventListener('input', (e) => {
        if (e.target.id === 'product-search-input') renderProductList();
        if (e.target.id === 'ledger-search-input' || e.target.id === 'ledger-date-from' || e.target.id === 'ledger-date-to') {
            renderFullLedger();
        }
    });

    // --- FOCUS (for select-all-on-focus) ---
    appContent.addEventListener('focus', (e) => {
        if (e.target.tagName === 'INPUT' && (
            e.target.type === 'text' || 
            e.target.type === 'number' || 
            e.target.type === 'email' || 
            e.target.type === 'password'
        )) {
            // Exclude search and date inputs
            if (e.target.id !== 'product-search-input' && 
                e.target.id !== 'ledger-search-input' &&
                e.target.type !== 'datetime-local' && 
                e.target.type !== 'date') 
            {
                e.target.select();
            }
        }
    }, true);

    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay) {
        loginOverlay.addEventListener('focus', (e) => {
            if (e.target.tagName === 'INPUT' && (e.target.type === 'email' || e.target.type === 'password' || e.target.type === 'text')) {
                e.target.select();
            }
        }, true);
    }
}