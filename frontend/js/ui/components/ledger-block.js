// frontend/js/ui/components/ledger-block.js

export const createLedgerBlockElement = (block) => {
    const blockElement = document.createElement('div');
    blockElement.className = 'border border-slate-200 rounded-lg p-3 bg-white shadow-sm';
    
    const { 
        txType, itemSku, itemName, quantity, 
        fromLocation, toLocation, location, userName, 
        employeeId, beforeQuantity, afterQuantity, 
        price, category,
        adminUserName, adminEmployeeId,
        targetUser, targetEmail, targetRole, oldEmail,
        oldName,
        targetId, targetName, newName,
        oldPrice, oldCategory, newPrice, newCategory
    } = block.transaction;
    
    let transactionHtml = '';
    let detailsHtml = '';

    const actorHtml = `<li>User: <strong>${adminUserName || userName || 'N/A'}</strong> (${adminEmployeeId || employeeId || 'N/A'})</li>`;
    
    switch (txType) {
        case 'CREATE_ITEM':
            transactionHtml = `<span class="font-semibold text-green-700">CREATE</span> <strong>${quantity}</strong> of <strong>${itemName}</strong> (${itemSku}) to <strong>${toLocation}</strong>`;
            detailsHtml = `${actorHtml}
                           <li>Price: <strong>₹${(price || 0).toFixed(2)}</strong></li>
                           <li>Category: <strong>${category || 'N/A'}</strong></li>`;
            break;
        case 'MOVE':
            transactionHtml = `<span class="font-semibold text-blue-600">MOVE</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong>`;
            detailsHtml = `<li>From: <strong>${fromLocation}</strong> (Before: ${beforeQuantity.from}, After: ${afterQuantity.from})</li>
                           <li>To: <strong>${toLocation}</strong> (Before: ${beforeQuantity.to}, After: ${afterQuantity.to})</li>
                           ${actorHtml}`;
            break;
        case 'STOCK_IN':
            transactionHtml = `<span class="font-semibold text-green-600">STOCK IN</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong> at <strong>${location}</strong>`;
            detailsHtml = `<li>Before: ${beforeQuantity}, After: ${afterQuantity}</li>
                           ${actorHtml}`;
            break;
        case 'STOCK_OUT':
            transactionHtml = `<span class="font-semibold text-red-600">STOCK OUT</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong> from <strong>${location}</strong>`;
            detailsHtml = `<li>Before: ${beforeQuantity}, After: ${afterQuantity}</li>
                           ${actorHtml}`;
            break;
        
        case 'ADMIN_EDIT_ITEM':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN EDIT ITEM</span> for <strong>${itemSku}</strong>`;
            if (newName !== oldName) {
                detailsHtml += `<li>Name: ${oldName} → <strong>${newName}</strong></li>`;
            }
            if (newPrice !== oldPrice) {
                detailsHtml += `<li>Price: ₹${(oldPrice || 0).toFixed(2)} → <strong>₹${(newPrice || 0).toFixed(2)}</strong></li>`;
            }
            if (newCategory !== oldCategory) {
                detailsHtml += `<li>Category: ${oldCategory} → <strong>${newCategory}</strong></li>`;
            }
            detailsHtml += actorHtml;
            break;
        
        case 'ADMIN_CREATE_USER':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN CREATE USER</span>`;
            detailsHtml = `<li>Target: <strong>${targetUser}</strong> (${targetEmail})</li>
                           <li>Role: <strong>${targetRole}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_EDIT_ROLE':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN EDIT ROLE</span> for <strong>${targetUser}</strong>`;
            detailsHtml = `<li>Change: Role → <strong>${targetRole}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_EDIT_EMAIL':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN EDIT EMAIL</span> for <strong>${targetUser}</strong>`;
            detailsHtml = `<li>Change: Email → <strong>${targetEmail}</strong></li>
                           <li>Old Email: ${oldEmail}</li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_DELETE_USER':
            transactionHtml = `<span class="font-semibold text-red-700">ADMIN DELETE USER</span>`;
            detailsHtml = `<li>Target: <strong>${targetUser}</strong> (${targetEmail})</li>
                           ${actorHtml}`;
            break;
        
        case 'USER_UPDATE_PROFILE':
            transactionHtml = `<span class="font-semibold text-cyan-600">USER UPDATE PROFILE</span>`;
            detailsHtml = `<li>User: <strong>${targetUser}</strong></li>
                           ${oldName ? `<li>Old Name: ${oldName}</li>` : ''}
                           ${oldEmail ? `<li>Old Email: ${oldEmail}</li>` : ''}
                           <li>New Email: ${targetEmail}</li>
                           ${actorHtml}`;
            break;
        case 'USER_CHANGE_PASSWORD':
            transactionHtml = `<span class="font-semibold text-cyan-600">USER CHANGE PASSWORD</span>`;
            detailsHtml = `<li>User: <strong>${targetUser}</strong></li>
                           ${actorHtml}`;
            break;
        
        case 'DELETE_ITEM':
            transactionHtml = `<span class="font-semibold text-red-700">DELETE ITEM</span> <strong>${itemName || ''}</strong> (${itemSku})`;
            detailsHtml = `${actorHtml}`;
            break;

        case 'ADMIN_ADD_LOCATION':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN ADD LOCATION</span>`;
            detailsHtml = `<li>Location: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;
        
        case 'ADMIN_RESTORE_LOCATION':
            transactionHtml = `<span class="font-semibold text-green-600">ADMIN RESTORE LOCATION</span>`;
            detailsHtml = `<li>Location: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;

        case 'ADMIN_RENAME_LOCATION':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN RENAME LOCATION</span>`;
            detailsHtml = `<li>Location ID: <strong>${targetId}</strong></li>
                           <li>Old Name: ${oldName}</li>
                           <li>New Name: <strong>${newName}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_ARCHIVE_LOCATION':
            transactionHtml = `<span class="font-semibold text-red-700">ADMIN ARCHIVE LOCATION</span>`;
            detailsHtml = `<li>Location: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_ADD_CATEGORY':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN ADD CATEGORY</span>`;
            detailsHtml = `<li>Category: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;

        case 'ADMIN_RESTORE_CATEGORY':
            transactionHtml = `<span class="font-semibold text-green-600">ADMIN RESTORE CATEGORY</span>`;
            detailsHtml = `<li>Category: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;

        case 'ADMIN_RENAME_CATEGORY':
            transactionHtml = `<span class="font-semibold text-purple-600">ADMIN RENAME CATEGORY</span>`;
            detailsHtml = `<li>Category ID: <strong>${targetId}</strong></li>
                           <li>Old Name: ${oldName}</li>
                           <li>New Name: <strong>${newName}</strong></li>
                           ${actorHtml}`;
            break;
        case 'ADMIN_ARCHIVE_CATEGORY':
            transactionHtml = `<span class="font-semibold text-red-700">ADMIN ARCHIVE CATEGORY</span>`;
            detailsHtml = `<li>Category: <strong>${targetName}</strong> (ID: ${targetId})</li>
                           ${actorHtml}`;
            break;

        default:
             transactionHtml = `Unknown transaction: ${txType}`;
    }

    blockElement.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold text-sm text-indigo-700">Block #${block.index}</h4>
            <span class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">${new Date(block.timestamp).toLocaleString()}</span>
        </div>
        <p class="text-sm text-slate-700 mb-2">${transactionHtml}</p>
        <ul class="text-xs text-slate-600 space-y-1 mb-3">
            ${detailsHtml}
        </ul>
        <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded-md space-y-1">
            <div class="hash-container">
                <strong class="flex-shrink-0">Hash:</strong>
                <span class="truncate">${block.hash}</span>
                <button class="copy-hash-button" data-hash="${block.hash}" title="Copy Hash">
                    <i class="ph-bold ph-copy"></i>
                </button>
            </div>
            <div class="hash-container">
                <strong class="flex-shrink-0">Prev Hash:</strong>
                <span class="truncate">${block.previousHash}</span>
                <button class="copy-hash-button" data-hash="${block.previousHash}" title="Copy Previous Hash">
                    <i class="ph-bold ph-copy"></i>
                </button>
            </div>
        </div>
    `;
    
    return blockElement;
};