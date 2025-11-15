// frontend/js/services/image-uploader.js

// Set a reasonable size limit (e.g., 5MB)
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// --- State for the Cropper ---
let cropperInstance = null;
let currentResolveCallback = null;
let currentRejectCallback = null;

const modal = document.getElementById('image-cropper-modal');
const image = document.getElementById('cropper-image');
const confirmButton = document.getElementById('cropper-confirm-button');
const cancelButton = document.getElementById('cropper-cancel-button');

/**
 * Opens the cropper modal with the selected image.
 * @param {File} file The file from the input.
 * @param {function} showSuccess Callback for success messages.
 * @param {function} showError Callback for error messages.
 * @returns {Promise<string>} A promise that resolves with the cropped Base64 string.
 */
export const openImageCropper = (file, showSuccess, showError) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error('No file provided.'));
        }

        // --- 1. Validation ---
        if (!file.type.startsWith('image/')) {
            showError('Invalid file type. Please upload an image (PNG, JPG).');
            return reject(new Error('Invalid file type.'));
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            showError(`File is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
            return reject(new Error('File is too large.'));
        }

        // Store the callbacks to be used by the button handlers
        currentResolveCallback = resolve;
        currentRejectCallback = reject;

        // --- 2. File Reading ---
        const reader = new FileReader();

        reader.onload = (e) => {
            image.src = e.target.result;
            modal.classList.remove('hidden');

            // Destroy old instance if it exists
            if (cropperInstance) {
                cropperInstance.destroy();
            }

            // --- 3. Initialize Cropper.js ---
            cropperInstance = new Cropper(image, {
                aspectRatio: 1 / 1, // Enforce 1:1 square
                viewMode: 1,        // Restrict crop box to canvas
                background: false,  // Hide grid background
                autoCropArea: 0.9,  // Start with 90% of the image selected
            });
            showSuccess(`Image "${file.name}" loaded. Please crop.`);
        };

        reader.onerror = () => {
            console.error('File reading error:', reader.error);
            showError('Failed to read the selected file.');
            return reject(new Error('Failed to read file.'));
        };

        reader.readAsDataURL(file);
    });
};

/**
 * Hides the modal and cleans up the cropper instance.
 */
const closeCropper = () => {
    modal.classList.add('hidden');
    if (cropperInstance) {
        cropperInstance.destroy();
    }
    cropperInstance = null;
    image.src = '';
    currentResolveCallback = null;
    currentRejectCallback = null;
};

/**
 * Handles the "Confirm Crop" button click.
 */
export const handleCropConfirm = (showSuccess) => {
    if (!cropperInstance || !currentResolveCallback) {
        return;
    }

    // Get the cropped canvas
    const croppedCanvas = cropperInstance.getCroppedCanvas({
        width: 400, // Standardize output width
        height: 400,
        imageSmoothingQuality: 'high',
    });

    // Convert canvas to Base64 Data URL
    const croppedBase64 = croppedCanvas.toDataURL('image/jpeg', 0.9); // 90% quality JPEG

    showSuccess('Crop applied!');
    currentResolveCallback(croppedBase64); // Resolve the promise with the Base64 string
    closeCropper();
};

/**
 * Handles the "Cancel" button click.
 */
export const handleCropCancel = () => {
    if (currentRejectCallback) {
        currentRejectCallback(new Error('User cancelled cropping.'));
    }
    closeCropper();
};