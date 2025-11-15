// frontend/js/services/image-uploader.js

// Set a reasonable size limit (e.g., 2MB)
// Base64 encoding adds ~33% overhead, so 2MB binary becomes ~2.66MB text.
// Your database's `text` column can handle this easily.
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Processes a file upload, converts to Base64, and populates a target input.
 * @param {File} file The file from the input.
 * @param {HTMLInputElement} targetUrlInput The <input type="url"> to populate.
 * @param {function} showSuccess Callback for success messages.
 * @param {function} showError Callback for error messages.
 */
export const processImageUpload = (file, targetUrlInput, showSuccess, showError) => {
    if (!file) return;

    // --- 1. Validation ---
    if (!file.type.startsWith('image/')) {
        return showError('Invalid file type. Please upload an image (PNG, JPG).');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return showError(`File is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
    }

    // --- 2. File Reading ---
    const reader = new FileReader();

    reader.onload = () => {
        // reader.result contains the Base64 Data URL (e.g., "data:image/png;base64,...")
        targetUrlInput.value = reader.result;
        showSuccess(`Image "${file.name}" loaded and ready to save.`);
    };

    reader.onerror = () => {
        console.error('File reading error:', reader.error);
        return showError('Failed to read the selected file.');
    };

    // This triggers the 'onload' event when done
    reader.readAsDataURL(file);
};