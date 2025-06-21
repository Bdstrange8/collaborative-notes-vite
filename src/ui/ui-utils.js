import { addNote } from '../fluid/data-handlers.js';
import { updateParentOptions } from '../components/notes-renderer.js';
import { handleFileUpload } from '../components/file-manager.js';

export function setupUIEventHandlers() {
    console.log('🎨 Setting up UI event handlers');
    
    // Add Note button
    document.getElementById('addNoteBtn').addEventListener('click', function() {
        const form = document.getElementById('addNoteForm');
        form.style.display = 'block';
        form.classList.add('active');
        document.getElementById('noteTitle').focus();
        
        // Reset form to add root-level note
        document.getElementById('formTitle').textContent = 'Add New Section';
        document.getElementById('parentNoteSelect').value = '';
        document.getElementById('noteFiles').value = '';
        updateParentOptions();
    });
    
    // Save Note button - Updated with file handling
    document.getElementById('saveNoteBtn').addEventListener('click', async function() {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        const parentId = document.getElementById('parentNoteSelect').value || "";
        const fileInput = document.getElementById('noteFiles');
        
        if (!title || !content) {
            alert('Please fill in both title and content');
            return;
        }
        
        // Show loading state
        const saveBtn = document.getElementById('saveNoteBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '⏳ Processing...';
        saveBtn.disabled = true;
        
        try {
            // Handle file uploads
            let fileAttachments = [];
            if (fileInput.files.length > 0) {
                console.log('📎 Processing', fileInput.files.length, 'file(s)...');
                fileAttachments = await handleFileUpload(Array.from(fileInput.files));
                console.log('✅ Processed', fileAttachments.length, 'file(s) successfully');
            }
            
            // Create the note with embedded files
            addNote(title, content, parentId, fileAttachments);
            
            // Clear form and hide
            clearAndHideForm();
            
        } catch (error) {
            console.error('Error creating note:', error);
            alert('Error creating note. Please try again.');
        } finally {
            // Restore button state
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    });
    
    // Cancel button
    document.getElementById('cancelNoteBtn').addEventListener('click', function() {
        clearAndHideForm();
    });
    
    // Add Sample Note button
    document.getElementById('addSampleBtn').addEventListener('click', function() {
        import('../fluid/data-handlers.js').then(module => {
            module.addSampleNote && module.addSampleNote();
        });
    });
    
    // Clear All button
    document.getElementById('clearAllBtn').addEventListener('click', function() {
        import('../fluid/data-handlers.js').then(module => {
            module.clearAllNotes && module.clearAllNotes();
        });
    });
    
    // Enter key support in form
    document.getElementById('noteTitle').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('noteContent').focus();
        }
    });
    
    document.getElementById('noteContent').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            document.getElementById('saveNoteBtn').click();
        }
    });
    
    // File input validation and preview
    document.getElementById('noteFiles').addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        const maxSize = 10 * 1024 * 1024; // 10MB
        const oversizedFiles = files.filter(file => file.size > maxSize);
        
        if (oversizedFiles.length > 0) {
            alert(`Some files are too large (max 10MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
            // Remove oversized files
            const validFiles = files.filter(file => file.size <= maxSize);
            updateFileInput(validFiles);
        }
        
        // Show file count in UI
        updateFileInputDisplay(files.filter(file => file.size <= maxSize));
    });
}

function clearAndHideForm() {
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('parentNoteSelect').value = '';
    document.getElementById('noteFiles').value = '';
    document.getElementById('formTitle').textContent = 'Add New Section';
    
    // Clear file display
    updateFileInputDisplay([]);
    
    const form = document.getElementById('addNoteForm');
    form.style.display = 'none';
    form.classList.remove('active');
}

function updateFileInput(validFiles) {
    const fileInput = document.getElementById('noteFiles');
    const dt = new DataTransfer();
    
    validFiles.forEach(file => {
        dt.items.add(file);
    });
    
    fileInput.files = dt.files;
}

function updateFileInputDisplay(files) {
    // Create or update file preview in the form
    let filePreview = document.getElementById('filePreview');
    
    if (!filePreview) {
        filePreview = document.createElement('div');
        filePreview.id = 'filePreview';
        filePreview.className = 'file-preview-container';
        
        const fileGroup = document.querySelector('#noteFiles').closest('.form-group');
        fileGroup.appendChild(filePreview);
    }
    
    if (files.length === 0) {
        filePreview.innerHTML = '';
        return;
    }
    
    const fileList = files.map(file => {
        const fileIcon = getFileTypeIcon(file.type);
        const fileSize = formatFileSize(file.size);
        return `
            <div class="file-preview-item">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-name">${escapeHtml(file.name)}</span>
                <span class="file-size">(${fileSize})</span>
            </div>
        `;
    }).join('');
    
    filePreview.innerHTML = `
        <div class="file-preview-header">📎 ${files.length} file(s) selected:</div>
        ${fileList}
    `;
}

function getFileTypeIcon(fileType) {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    return '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function updateConnectionStatus(status, message) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = `connection-status status-${status}`;
    statusEl.textContent = message;
}

export function showCollaborationInfo() {
    const infoEl = document.getElementById('collaborationInfo');
    const urlEl = document.getElementById('shareUrl');
    
    infoEl.style.display = 'block';
    urlEl.textContent = window.location.href;
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}