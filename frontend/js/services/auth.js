// frontend/js/services/auth.js
// import { API_BASE_URL } from '../../config.js'; // <-- REMOVED THIS LINE
import { setCurrentUser, clearStateOnLogout } from '../app-state.js';
import { fetchLocations, fetchCategories, fetchUsers } from './data.js';

/**
 * Authentication Service
 * Communicates with the backend.
 */
export const authService = {
    /**
     * Checks for an existing server-side session.
     */
    init: async (showAppCallback, showLoginCallback) => {
        try {
            // Check if we have a valid session cookie with the server
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                credentials: 'include' // This is essential for sending cookies
            });
            
            if (!response.ok) {
                // No valid session
                throw new Error('Not authenticated');
            }
            
            const user = await response.json(); // Server sends back the user object
            setCurrentUser(user);

            await fetchLocations(); 
            await fetchCategories(); 
            await fetchUsers();
            await showAppCallback(); // User is logged in, show the app
        
        } catch (error) {
            console.warn('No active session:', error.message);
            showLoginCallback(); // No user, show login
        }
    },
    
    /**
     * Logs in by sending credentials to the backend.
     */
    login: async (email, password, showAppCallback, showErrorCallback) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            setCurrentUser(data.user); // Backend sends back the user object
            await fetchLocations(); 
            await fetchCategories(); 
            await fetchUsers();
            await showAppCallback(); // Show the app

        } catch (error) {
            showErrorCallback(error.message);
        }
    },

    /**
     * Logs out by invalidating the server session.
     */
    logout: async (showLoginCallback) => {
        try {
            // Tell the server to destroy the session
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error logging out:', error);
        } finally {
            clearStateOnLogout();
            showLoginCallback();
        }
    }
};