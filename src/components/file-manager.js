import { notesData, currentUser } from '../fluid/client.js';

export function addFileAttachment(noteId, file) {
    if (!notesData || !notesData.root || !window.FileAttachment) {
        console.error('Cannot add file attachment: Fluid Framework not initialized');
        return;
    }

    // Check file size (limit to 5MB for demo purposes)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        alert('File too large. Maximum size is 5MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileId = (notesData.root.lastFileId + 1).toString();
        notesData.root.lastFileId = parseInt(fileId);

        const newFileAttachment = new window.FileAttachment({
            id: fileId,
            noteId: noteId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileData: e.target.result, // Base64 data URL
            uploadedBy: currentUser,
            uploadedAt: new Date().toLocaleString(),
        });

        notesData.root.fileAttachments.insertAtEnd(newFileAttachment);
        console.log('📎 Added file attachment:', file.name, 'to note:', noteId);
    };
    
    reader.readAsDataURL(file);
}

export function getFileAttachments(noteId) {
    if (!notesData || !notesData.root || !notesData.root.fileAttachments) return [];
    const attachments = Array.from(notesData.root.fileAttachments);
    return attachments.filter(attachment => attachment.noteId === noteId);
}

export function deleteFileAttachment(fileId) {
    if (!notesData || !notesData.root || !notesData.root.fileAttachments) return;
    
    const attachments = Array.from(notesData.root.fileAttachments);
    const attachmentIndex = attachments.findIndex(attachment => attachment.id === fileId);
    
    if (attachmentIndex !== -1) {
        const attachment = attachments[attachmentIndex];
        
        // Security check: Only the uploader can delete their own files
        if (attachment.uploadedBy !== currentUser) {
            alert('You can only delete files you uploaded!');
            return;
        }
        
        if (confirm(`Are you sure you want to delete "${attachment.fileName}"?`)) {
            notesData.root.fileAttachments.removeAt(attachmentIndex);
            console.log('🗑️ Deleted file attachment:', attachment.fileName);
        }
    }
}

export function downloadFile(fileId) {
    if (!notesData || !notesData.root || !notesData.root.fileAttachments) return;
    
    const attachments = Array.from(notesData.root.fileAttachments);
    const attachment = attachments.find(att => att.id === fileId);
    
    if (attachment) {
        const link = document.createElement('a');
        link.href = attachment.fileData;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📊';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('video')) return '🎬';
    if (fileType.includes('text')) return '📃';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📁';
}

export function showFileUploadDialog(noteId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';
    
    input.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            addFileAttachment(noteId, file);
        });
    });
    
    input.click();
}

export function updateAllFileAttachments() {
    if (!notesData || !notesData.root) return;
    
    const notes = Array.from(notesData.root.notes);
    notes.forEach(note => {
        renderFileAttachments(note.id);
    });
}

export function renderFileAttachments(noteId) {
    const attachmentsContainer = document.getElementById(`attachments-${noteId}`);
    if (!attachmentsContainer) return;
    
    const attachments = getFileAttachments(noteId);
    
    if (attachments.length === 0) {
        attachmentsContainer.innerHTML = '';
        attachmentsContainer.style.display = 'none';
        return;
    }
    
    attachmentsContainer.style.display = 'block';
    
    const attachmentsHtml = attachments.map(attachment => {
        const fileIcon = getFileIcon(attachment.fileType);
        const isImage = attachment.fileType.startsWith('image/');
        const canDelete = attachment.uploadedBy === currentUser;
        
        return `
            <div class="attachment-item" data-attachment-id="${attachment.id}">
                <div class="attachment-header">
                    <span class="attachment-icon">${fileIcon}</span>
                    <div class="attachment-info">
                        <div class="attachment-name" title="${attachment.fileName}">${attachment.fileName}</div>
                        <div class="attachment-meta">
                            ${formatFileSize(attachment.fileSize)} • 
                            ${attachment.uploadedBy} • 
                            ${attachment.uploadedAt}
                        </div>
                    </div>
                    <div class="attachment-actions">
                        <button class="attachment-btn download-btn" onclick="downloadFile('${attachment.id}')" title="Download">
                            ⬇️
                        </button>
                        ${canDelete ? 
                            `<button class="attachment-btn delete-btn" onclick="deleteFileAttachment('${attachment.id}')" title="Delete (uploader only)">
                                🗑️
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                ${isImage ? 
                    `<div class="attachment-preview">
                        <img src="${attachment.fileData}" alt="${attachment.fileName}" onclick="openImagePreview('${attachment.id}')">
                    </div>` : 
                    ''
                }
            </div>
        `;
    }).join('');
    
    attachmentsContainer.innerHTML = `
        <div class="attachments-header">
            <span class="attachments-title">📎 Attachments (${attachments.length})</span>
        </div>
        <div class="attachments-list">
            ${attachmentsHtml}
        </div>
    `;
}

export function openImagePreview(fileId) {
    if (!notesData || !notesData.root || !notesData.root.fileAttachments) return;
    
    const attachments = Array.from(notesData.root.fileAttachments);
    const attachment = attachments.find(att => att.id === fileId);
    
    if (attachment) {
        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="closeImagePreview()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-title">${attachment.fileName}</span>
                    <button class="modal-close" onclick="closeImagePreview()">✕</button>
                </div>
                <div class="modal-body">
                    <img src="${attachment.fileData}" alt="${attachment.fileName}">
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
    }
}

export function closeImagePreview() {
    const modal = document.querySelector('.image-preview-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}