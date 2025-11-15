// frontend/js/handlers/profile.js
// import { API_BASE_URL } from '../../config.js';
import { currentUser, setCurrentUser } from '../app-state.js';
import { addTransactionToChain } from '../services/blockchain.js';
import { showError, showSuccess } from '../ui/components/notifications.js';
import { populateLoginDropdown } from '../ui/components/dropdowns.js';
import { renderProfilePage } from '../ui/renderers/profile.js'; // We will create this

export const handleUpdateProfile = async (form) => {
    const name = form.querySelector('#profile-name').value;
    const email = form.querySelector('#profile-email').value;
    
    if (name === currentUser.name && email === currentUser.email) {
        return showSuccess("No changes to save.");
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to update profile');
        }
        
        showSuccess('Profile updated! Updating system...');
        
        const oldName = currentUser.name;
        const oldEmail = currentUser.email;
        setCurrentUser(data.user);
        document.getElementById('user-name').textContent = currentUser.name;

        await populateLoginDropdown();

        await addTransactionToChain({
            txType: "USER_UPDATE_PROFILE",
            targetUserId: currentUser.id,
            targetUser: currentUser.name,
            targetEmail: currentUser.email,
            oldName: oldName,
            oldEmail: oldEmail
        });

    } catch (error) {
        showError(error.message);
        await renderProfilePage();
    }
};

export const handleChangePassword = async (form) => {
    const currentPassword = form.querySelector('#profile-current-password').value;
    const newPassword = form.querySelector('#profile-new-password').value;
    const confirmPassword = form.querySelector('#profile-confirm-password').value;

    if (newPassword !== confirmPassword) {
        return showError("New passwords do not match.");
    }
    if (!currentPassword || !newPassword) {
        return showError("All fields are required.");
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to change password');
        }
        
        showSuccess('Password changed successfully!');
        form.reset();

        await addTransactionToChain({
            txType: "USER_CHANGE_PASSWORD",
            targetUserId: currentUser.id,
            targetUser: currentUser.name
        });

    } catch (error) {
        showError(error.message);
    }
};