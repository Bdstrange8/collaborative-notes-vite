import { addNote } from '../fluid/data-handlers.js';
import { updateParentOptions } from '../components/notes-renderer.js';

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
        updateParentOptions();
    });
    
    // Save Note button
    document.getElementById('saveNoteBtn').addEventListener('click', function() {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        const parentId = document.getElementById('parentNoteSelect').value || "";
        
        if (!title || !content) {
            alert('Please fill in both title and content');
            return;
        }
        
        addNote(title, content, parentId);
        
        // Clear form and hide
        clearAndHideForm();
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
}

function clearAndHideForm() {
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('parentNoteSelect').value = '';
    document.getElementById('formTitle').textContent = 'Add New Section';
    const form = document.getElementById('addNoteForm');
    form.style.display = 'none';
    form.classList.remove('active');
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