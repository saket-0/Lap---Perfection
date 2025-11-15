// frontend/app.js
import { initAppListeners } from './js/ui/listeners.js';
import { populateLoginDropdown } from './js/ui/components/dropdowns.js';
import { authService } from './js/services/auth.js';
import { showApp, showLogin } from './js/ui/router.js';

// --- Main App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Attach all global event listeners
    initAppListeners();

    // 2. Populate the login dropdown with user emails
    await populateLoginDropdown();
    
    // 3. Check if the user is already logged in
    await authService.init(showApp, showLogin);
});