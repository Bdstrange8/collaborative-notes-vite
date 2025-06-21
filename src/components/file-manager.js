import { notesData, currentUser } from '../fluid/client.js';
import { escapeHtml } from '../ui/ui-utils.js';

// File upload handling for new notes
export async function handleFileUpload(files) {
    const fileAttachments = [];
    
    for (const file of files) {
        // Check file size (limit to 10MB for performance)
        if (file.size > 10 * 1024 * 1024) {
            alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
            continue;
        }
        
        try {
            const fileData = await readFileAsDataURL(file);
            const fileAttachment = {
                id: generateFileId(),
                name: file.name,
                type: file.type,
                size: file.size,
                data: fileData,
                uploadedBy: currentUser,
                uploadedAt: new Date().toLocaleString(),
            };
            
            fileAttachments.push(fileAttachment);
            console.log('📎 Processed file for upload:', file.name);
        } catch (error) {
            console.error('Error reading file:', file.name, error);
            alert(`Error reading file "${file.name}"`);
        }
    }
    
    return fileAttachments;
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

function generateFileId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Create inline file preview for a note
export function createFilesSection(noteData) {
    if (!noteData.files || noteData.files.length === 0) {
        return '';
    }

    const filesHtml = Array.from(noteData.files).map(file => {
        return createFilePreview(file, noteData.id);
    }).join('');

    return `
        <div class="files-section">
            ${filesHtml}
        </div>
    `;
}

function createFilePreview(file, noteId) {
    const fileType = file.type.toLowerCase();
    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf';
    const isVideo = fileType.startsWith('video/');
    const isAudio = fileType.startsWith('audio/');
    
    const fileSizeFormatted = formatFileSize(file.size);
    const fileName = escapeHtml(file.name);
    const fileId = file.id;
    const canDelete = file.uploadedBy === currentUser;

    if (isImage) {
        return `
            <div class="file-preview image-preview">
                <div class="file-header">
                    <span class="file-icon">🖼️</span>
                    <span class="file-name">${fileName}</span>
                    <span class="file-size">(${fileSizeFormatted})</span>
                    <div class="file-actions">
                        <button class="file-action-btn download-btn" onclick="downloadFileFromNote('${noteId}', '${fileId}')" title="Download ${fileName}">
                            📥
                        </button>
                        ${canDelete ? 
                            `<button class="file-action-btn delete-btn" onclick="deleteFileFromNote('${noteId}', '${fileId}')" title="Delete file">
                                🗑️
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                <div class="image-container">
                    <img src="${file.data}" alt="${fileName}" class="preview-image" onclick="openImageModal('${noteId}', '${fileId}')" loading="lazy">
                </div>
                <div class="file-meta">
                    Uploaded by ${escapeHtml(file.uploadedBy)} on ${file.uploadedAt}
                </div>
            </div>
        `;
    } else if (isPDF) {
        return `
            <div class="file-preview pdf-preview">
                <div class="file-header">
                    <span class="file-icon">📄</span>
                    <span class="file-name">${fileName}</span>
                    <span class="file-size">(${fileSizeFormatted})</span>
                    <div class="file-actions">
                        <button class="file-action-btn view-btn" onclick="viewFileFromNote('${noteId}', '${fileId}')" title="View ${fileName}">
                            👁️
                        </button>
                        <button class="file-action-btn download-btn" onclick="downloadFileFromNote('${noteId}', '${fileId}')" title="Download ${fileName}">
                            📥
                        </button>
                        ${canDelete ? 
                            `<button class="file-action-btn delete-btn" onclick="deleteFileFromNote('${noteId}', '${fileId}')" title="Delete file">
                                🗑️
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                <div class="pdf-container">
                    <iframe src="${file.data}" class="pdf-preview-frame" title="${fileName}"></iframe>
                </div>
                <div class="file-meta">
                    Uploaded by ${escapeHtml(file.uploadedBy)} on ${file.uploadedAt}
                </div>
            </div>
        `;
    } else if (isVideo) {
        return `
            <div class="file-preview video-preview">
                <div class="file-header">
                    <span class="file-icon">🎥</span>
                    <span class="file-name">${fileName}</span>
                    <span class="file-size">(${fileSizeFormatted})</span>
                    <div class="file-actions">
                        <button class="file-action-btn download-btn" onclick="downloadFileFromNote('${noteId}', '${fileId}')" title="Download ${fileName}">
                            📥
                        </button>
                        ${canDelete ? 
                            `<button class="file-action-btn delete-btn" onclick="deleteFileFromNote('${noteId}', '${fileId}')" title="Delete file">
                                🗑️
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                <div class="video-container">
                    <video controls class="preview-video" preload="metadata">
                        <source src="${file.data}" type="${file.type}">
                        Your browser does not support the video tag.
                    </video>
                </div>
                <div class="file-meta">
                    Uploaded by ${escapeHtml(file.uploadedBy)} on ${file.uploadedAt}
                </div>
            </div>
        `;
    } else if (isAudio) {
        return `
            <div class="file-preview audio-preview">
                <div class="file-header">
                    <span class="file-icon">🎵</span>
                    <span class="file-name">${fileName}</span>
                    <span class="file-size">(${fileSizeFormatted})</span>
                    <div class="file-actions">
                        <button class="file-action-btn download-btn" onclick="downloadFileFromNote('${noteId}', '${fileId}')" title="Download ${fileName}">
                            📥
                        </button>
                        ${canDelete ? 
                            `<button class="file-action-btn delete-btn" onclick="deleteFileFromNote('${noteId}', '${fileId}')" title="Delete file">
                                🗑️
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                <div class="audio-container">
                    <audio controls class="preview-audio" preload="metadata">
                        <source src="${file.data}" type="${file.type}">
                        Your browser does not support the audio tag.
                    </audio>
                </div>
                <div class="file-meta">
                    Uploaded by ${escapeHtml(file.uploadedBy)} on ${file.uploadedAt}
                </div>
            </div>
        `;
    } else {
        // Generic file preview
        const fileIcon = getFileIcon(fileType);
        return `
            <div class="file-preview generic-preview">
                <div class="file-header">
                    <span class="file-icon">${fileIcon}</span>
                    <span class="file-name">${fileName}</span>
                    <span class="file-size">(${fileSizeFormatted})</span>
                    <div class="file-actions">
                        <button class="file-action-btn download-btn" onclick="downloadFileFromNote('${noteId}', '${fileId}')" title="Download ${fileName}">
                            📥
                        </button>
                        ${canDelete ? 
                            `<button class="file-action-btn delete-btn" onclick="deleteFileFromNote('${noteId}', '${fileId}')" title="Delete file">
                                🗑️
                            </button>` : 
                            ''
                        }
                    </div>
                </div>
                <div class="file-meta">
                    Uploaded by ${escapeHtml(file.uploadedBy)} on ${file.uploadedAt}
                </div>
            </div>
        `;
    }
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(fileType) {
    if (fileType.includes('text')) return '📝';
    if (fileType.includes('word') || fileType.includes('document')) return '📄';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    if (fileType.includes('zip') || fileType.includes('archive')) return '🗜️';
    if (fileType.includes('code') || fileType.includes('script')) return '💻';
    return '📎';
}

// File actions for embedded files
export function downloadFileFromNote(noteId, fileId) {
    const file = findFileInNote(noteId, fileId);
    if (file) {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('📥 Downloaded file:', file.name);
    }
}

export function viewFileFromNote(noteId, fileId) {
    const file = findFileInNote(noteId, fileId);
    if (file) {
        window.open(file.data, '_blank');
    }
}

export function deleteFileFromNote(noteId, fileId) {
    const notes = Array.from(notesData.root.notes);
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
        console.error('Note not found for file deletion:', noteId);
        return;
    }
    
    const note = notes[noteIndex];
    const files = Array.from(note.files);
    const fileIndex = files.findIndex(file => file.id === fileId);
    
    if (fileIndex === -1) {
        console.error('File not found for deletion:', fileId);
        return;
    }
    
    const file = files[fileIndex];
    
    // Security check: Only the uploader can delete their own files
    if (file.uploadedBy !== currentUser) {
        alert('You can only delete files you uploaded!');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
        // Create new FileAttachment objects from remaining files (avoid node reuse)
        const remainingFiles = files.filter(f => f.id !== fileId);
        const newFileAttachments = remainingFiles.map(f => new window.FileAttachment({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            data: f.data,
            uploadedBy: f.uploadedBy,
            uploadedAt: f.uploadedAt,
        }));
        
        const newNote = new window.Note({
            id: note.id,
            title: note.title,
            content: note.content,
            author: note.author,
            timestamp: note.timestamp,
            votes: note.votes,
            parentId: note.parentId,
            level: note.level,
            files: newFileAttachments, // Use new file attachment objects
        });
        
        // Replace the note
        notesData.root.notes.removeAt(noteIndex);
        notesData.root.notes.insertAt(noteIndex, newNote);
        
        console.log('🗑️ Deleted file from note:', file.name);
    }
}

export function openImageModal(noteId, fileId) {
    const file = findFileInNote(noteId, fileId);
    
    if (file) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="image-modal-overlay" onclick="closeImageModal()">
                <div class="image-modal-content" onclick="event.stopPropagation()">
                    <div class="image-modal-header">
                        <h3>${escapeHtml(file.name)}</h3>
                        <button onclick="closeImageModal()" class="image-modal-close">✕</button>
                    </div>
                    <div class="image-modal-body">
                        <img src="${file.data}" alt="${escapeHtml(file.name)}" class="modal-image">
                    </div>
                    <div class="image-modal-footer">
                        <button onclick="downloadFileFromNote('${noteId}', '${fileId}')" class="btn btn-primary">📥 Download</button>
                        <span class="file-info">
                            ${formatFileSize(file.size)} • Uploaded by ${escapeHtml(file.uploadedBy)} on ${file.uploadedAt}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add escape key listener
        document.addEventListener('keydown', handleImageModalKeydown);
    }
}

export function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', handleImageModalKeydown);
    }
}

function handleImageModalKeydown(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
}

function findFileInNote(noteId, fileId) {
    const notes = Array.from(notesData.root.notes);
    const note = notes.find(note => note.id === noteId);
    
    if (note && note.files) {
        const files = Array.from(note.files);
        return files.find(file => file.id === fileId);
    }
    
    return null;
}

// Legacy compatibility functions (for existing file attachments)
export function getFileAttachments(noteId) {
    if (!notesData || !notesData.root || !notesData.root.fileAttachments) return [];
    const attachments = Array.from(notesData.root.fileAttachments);
    return attachments.filter(attachment => attachment.noteId === noteId);
}

export function updateAllFileAttachments() {
    // This function is called by the data change handler but not needed for inline files
    // Files are rendered automatically as part of note rendering
    console.log('📎 File attachments updated (inline files render automatically)');
}

// Global function exports for HTML onclick handlers
window.downloadFileFromNote = downloadFileFromNote;
window.viewFileFromNote = viewFileFromNote;
window.deleteFileFromNote = deleteFileFromNote;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;