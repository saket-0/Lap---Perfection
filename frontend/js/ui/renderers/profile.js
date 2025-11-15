// frontend/js/ui/renderers/profile.js
// import { API_BASE_URL } from '../../../config.js';
import { showError } from '../components/notifications.js';
import { createLedgerBlockElement } from '../components/ledger-block.js';

export const renderProfilePage = async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;
    
    appContent.querySelector('#profile-name').value = 'Loading...';
    appContent.querySelector('#profile-email').value = 'Loading...';
    const historyListEl = appContent.querySelector('#profile-activity-list');
    const sessionListEl = appContent.querySelector('#profile-session-list'); 
    historyListEl.innerHTML = '<p class="text-slate-500">Loading...</p>';
    sessionListEl.innerHTML = '<p class="text-slate-500">Loading...</p>'; 
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/profile-data`, {
            credentials: 'include'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to load profile data');
        }
        const data = await response.json();
        const { user, history, sessions } = data; 

        appContent.querySelector('#profile-name').value = user.name;
        appContent.querySelector('#profile-email').value = user.email;
        
        historyListEl.innerHTML = '';
        if (history.length === 0) {
            historyListEl.innerHTML = '<p class="text-slate-500">No transaction history found.</p>';
        } else {
            history.forEach(block => {
                historyListEl.appendChild(createLedgerBlockElement(block));
            });
        }

        sessionListEl.innerHTML = '';
        if (!sessions || sessions.length === 0) {
            sessionListEl.innerHTML = '<p class="text-slate-500">No login history found.</p>';
        } else {
            sessions.forEach(login => {
                const sessionElement = document.createElement('div');
                sessionElement.className = 'flex items-center justify-between text-sm p-2 bg-slate-50 rounded-md';
                
                const loginDate = new Date(login.login_time);
                const isLoggedOut = login.status === 'Logged Out';
                
                const statusText = login.isCurrent ? 'Current Session' : (isLoggedOut ? 'Logged Out' : 'Active');
                const statusColor = login.isCurrent ? 'text-green-600 bg-green-100' : (isLoggedOut ? 'text-slate-500 bg-slate-100' : 'text-green-600 bg-green-100');
                
                let timeDisplayHtml = `<p class="text-xs text-slate-500">Login: ${loginDate.toLocaleString()}</p>`;
                
                if (login.logout_time) {
                    const logoutDate = new Date(login.logout_time);
                    if (isLoggedOut) {
                        timeDisplayHtml += `<p class="text-xs text-slate-500">Logout: ${logoutDate.toLocaleString()}</p>`;
                    } else {
                        timeDisplayHtml += `<p class="text-xs text-slate-500">Expires: ${logoutDate.toLocaleString()}</p>`;
                    }
                } else {
                    timeDisplayHtml += `<p class="text-xs text-slate-500">Logout: (Session data purged)</p>`;
                }

                sessionElement.innerHTML = `
                    <div>
                        <p class="font-medium text-slate-700">
                            ${login.isCurrent ? 'This Session' : 'Past Session'}
                        </p>
                        ${timeDisplayHtml}
                    </div>
                    <span class="text-xs font-medium ${statusColor} px-2 py-0.5 rounded-full">
                        ${statusText}
                    </span>
                `;
                sessionListEl.appendChild(sessionElement);
            });
        }

    } catch (error) {
        showError(error.message);
        appContent.innerHTML = `<p class="text-red-600">Error loading profile: ${error.message}</p>`;
    }
};