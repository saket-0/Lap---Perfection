// frontend/js/ui/components/notifications.js

let errorTimer;
export const showError = (message, suppress = false) => {
    console.error(message);
    if (suppress) return;
    
    const errorMessage = document.getElementById('error-message');
    const errorToast = document.getElementById('error-toast');
    const successToast = document.getElementById('success-toast'); // Get success toast
    if (!errorMessage || !errorToast || !successToast) return;

    // Clear and hide success toast
    successToast.classList.remove('toast-show');
    clearTimeout(successTimer);

    errorMessage.textContent = message;
    errorToast.classList.add('toast-show');
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => errorToast.classList.remove('toast-show'), 3000);
};

let successTimer;
export const showSuccess = (message) => {
    console.log(message);
    
    const successMessage = document.getElementById('success-message');
    const successToast = document.getElementById('success-toast');
    const errorToast = document.getElementById('error-toast'); // Get error toast
    if (!successMessage || !successToast || !errorToast) return;

    // Clear and hide error toast
    errorToast.classList.remove('toast-show');
    clearTimeout(errorTimer);

    successMessage.textContent = message;
    successToast.classList.add('toast-show');
    clearTimeout(successTimer);
    successTimer = setTimeout(() => successToast.classList.remove('toast-show'), 3000);
};