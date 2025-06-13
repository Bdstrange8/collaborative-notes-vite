import { notesData, currentUser } from '../fluid/client.js';
import { addNote } from '../fluid/data-handlers.js';
import { setupDragAndDrop } from '../ui/drag-drop.js';
import { escapeHtml } from '../ui/ui-utils.js';

export function renderAllNotes() {
    const container = document.getElementById('notesContainer');
    
    if (!notesData || !notesData.root) {
        container.innerHTML = '<div class="loading">Fluid Framework not initialized</div>';
        return;
    }

    const notes = Array.from(notesData.root.notes);
    
    if (notes.length === 0) {
        container.innerHTML = '<div class="loading">No notes yet. Click "Add Section" to get started!</div>';
        return;
    }
    
    container.innerHTML = '';
    
    // Build hierarchy and render in order
    const organizedNotes = organizeNotesHierarchy(notes);
    renderNotesHierarchy(organizedNotes, container);
}

function organizeNotesHierarchy(notes) {
    const noteMap = new Map();
    const rootNotes = [];
    
    // First pass: create map and find root notes
    notes.forEach(note => {
        if (!note.parentId || note.parentId === "") {
            rootNotes.push(note);
        }
        noteMap.set(note.id, { ...note, children: [] });
    });
    
    // Second pass: build parent-child relationships
    notes.forEach(note => {
        if (note.parentId && note.parentId !== "" && noteMap.has(note.parentId)) {
            noteMap.get(note.parentId).children.push(noteMap.get(note.id));
        }
    });
    
    return rootNotes.map(note => noteMap.get(note.id));
}

function renderNotesHierarchy(organizedNotes, container, level = 0) {
    organizedNotes.forEach(noteData => {
        const noteElement = createNoteElement(noteData, level);
        container.appendChild(noteElement);
        
        // Recursively render children with incremented level
        if (noteData.children && noteData.children.length > 0) {
            renderNotesHierarchy(noteData.children, container, level + 1);
        }
    });
}

function createNoteElement(noteData, displayLevel) {
    const noteElement = document.createElement('div');
    noteElement.className = `note-item level-${displayLevel}`;
    noteElement.setAttribute('data-note-id', noteData.id);
    
    const outlineNumber = getOutlineNumber(noteData, displayLevel);
    const hasContent = noteData.content && noteData.title !== noteData.content;
    const separator = hasContent ? ': ' : '';
    
    // Voting system
    const userVote = getUserVote(noteData.id);
    const upvoteClass = userVote === 'up' ? 'voted upvote' : 'upvote';
    const downvoteClass = userVote === 'down' ? 'voted downvote' : 'downvote';
    
    // Comment system
    const commentCount = getCommentCount(noteData.id);
    const hasComments = commentCount > 0;
    let commentButtonClass = 'action-btn comment-btn';
    let commentButtonText = '';
    
    if (hasComments) {
        commentButtonClass += ' has-comments';
        commentButtonText = `<i class="bi bi-chat-right-fill comment-icon"></i> ${commentCount}`;
    } else {
        commentButtonText = '<i class="bi bi-chat-right-fill comment-icon"></i> Comment';
    }
    
    noteElement.innerHTML = `
        <div class="drag-handle">⋮⋮</div>
        ${outlineNumber ? `<div class="note-bullet">${outlineNumber}</div>` : ''}
        <div class="note-main">
            <div class="note-text">
                <span class="note-title">${escapeHtml(noteData.title)}</span>${hasContent ? 
                    `<span class="note-content">${separator}${escapeHtml(noteData.content)}</span>` : ''}
            </div>
            <div class="note-meta">
                <span class="author-info">— ${escapeHtml(noteData.author)}, ${noteData.timestamp}</span>
                <div class="note-actions">
                    <button class="action-btn branch-btn" onclick="branchFromNote('${noteData.id}')" title="Add sub-section">
                        + Add
                    </button>
                    <button class="action-btn file-btn" onclick="showFileUploadDialog('${noteData.id}')" title="Attach file">
                        📎 File
                    </button>
                    ${noteData.author === currentUser ? 
                        `<button class="action-btn delete-btn" onclick="deleteNote('${noteData.id}')" title="Delete this note (author only)">
                            🗑️ Delete
                        </button>` : 
                        ''
                    }
                    <button class="${commentButtonClass}" onclick="showCommentDialog('${noteData.id}')" title="${hasComments ? 'View and add comments' : 'Add first comment'}">
                        ${commentButtonText}
                    </button>
                    <div class="note-votes">
                        <button class="vote-btn ${upvoteClass}" onclick="voteNote('${noteData.id}', 1)" title="Helpful">
                            ▲
                        </button>
                        <span class="vote-count">${noteData.votes}</span>
                        <button class="vote-btn ${downvoteClass}" onclick="voteNote('${noteData.id}', -1)" title="Not helpful">
                            ▼
                        </button>
                    </div>
                </div>
            </div>
            <div class="comments-section" id="comments-${noteData.id}">
                <div class="comments-header">
                    Comments
                    <button class="close-comments-btn" onclick="hideComments('${noteData.id}')">✕</button>
                </div>
                <div class="comments-list" id="comments-list-${noteData.id}">
                    <!-- Comments will be populated here -->
                </div>
                <div class="comment-form" id="comment-form-${noteData.id}">
                    <textarea class="comment-input" id="comment-input-${noteData.id}" placeholder="Add a comment..."></textarea>
                    <div class="comment-form-actions">
                        <button class="comment-cancel-btn" onclick="cancelComment('${noteData.id}')">Cancel</button>
                        <button class="comment-submit-btn" onclick="submitComment('${noteData.id}')">Post</button>
                    </div>
                </div>
            </div>
            <div class="attachments-section" id="attachments-${noteData.id}">
                <!-- File attachments will be populated here -->
            </div>
        </div>
    `;
    
    // Add drag and drop functionality
    setupDragAndDrop(noteElement, noteData);
    
    // Add click handler for showing comments
    const noteMain = noteElement.querySelector('.note-main');
    noteMain.addEventListener('click', (e) => {
        if (!e.target.closest('.note-actions') && !e.target.closest('.comments-section')) {
            window.toggleComments(noteData.id, noteData.title);
        }
    });
    
    return noteElement;
}

function getOutlineNumber(noteData, displayLevel) {
    if (displayLevel === 0) return '';
    
    const notes = Array.from(notesData.root.notes);
    const organizedNotes = organizeNotesHierarchy(notes);
    const numberingPath = findNoteNumberingPath(organizedNotes, noteData.id, []);
    
    if (!numberingPath || numberingPath.length === 0) return '';
    
    const levelIndex = numberingPath[numberingPath.length - 1];
    
    switch(displayLevel) {
        case 1: return toRoman(levelIndex + 1) + '.';
        case 2: return String.fromCharCode(65 + (levelIndex % 26)) + '.';
        case 3: return (levelIndex + 1) + '.';
        case 4: return String.fromCharCode(97 + (levelIndex % 26)) + ')';
        default: return '•';
    }
}

function toRoman(num) {
    const romanNumerals = [
        { value: 10, symbol: 'X' },
        { value: 9, symbol: 'IX' },
        { value: 5, symbol: 'V' },
        { value: 4, symbol: 'IV' },
        { value: 1, symbol: 'I' }
    ];
    
    let result = '';
    for (let i = 0; i < romanNumerals.length; i++) {
        while (num >= romanNumerals[i].value) {
            result += romanNumerals[i].symbol;
            num -= romanNumerals[i].value;
        }
    }
    return result;
}

function findNoteNumberingPath(organizedNotes, targetId, currentPath) {
    for (let i = 0; i < organizedNotes.length; i++) {
        const note = organizedNotes[i];
        const newPath = [...currentPath, i];
        
        if (note.id === targetId) {
            return newPath;
        }
        
        if (note.children && note.children.length > 0) {
            const childPath = findNoteNumberingPath(note.children, targetId, newPath);
            if (childPath) {
                return childPath;
            }
        }
    }
    return null;
}

function getUserVote(noteId) {
    if (!notesData || !notesData.root || !notesData.root.votes) return null;
    const votes = Array.from(notesData.root.votes);
    const userVote = votes.find(vote => vote.noteId === noteId && vote.userId === currentUser);
    return userVote ? userVote.voteType : null;
}

function getCommentCount(noteId) {
    if (!notesData || !notesData.root || !notesData.root.comments) return 0;
    const comments = Array.from(notesData.root.comments);
    return comments.filter(comment => comment.noteId === noteId).length;
}

export function branchFromNote(parentId) {
    const form = document.getElementById('addNoteForm');
    const parentSelect = document.getElementById('parentNoteSelect');
    
    updateParentOptions();
    parentSelect.value = parentId;
    
    form.style.display = 'block';
    form.classList.add('active');
    document.getElementById('noteTitle').focus();
    
    if (notesData && notesData.root) {
        const notes = Array.from(notesData.root.notes);
        const parentNote = notes.find(note => note.id === parentId);
        if (parentNote) {
            document.getElementById('formTitle').textContent = `Add Sub-section to: "${parentNote.title}"`;
        }
    }
}

export function updateParentOptions() {
    const select = document.getElementById('parentNoteSelect');
    
    if (!notesData || !notesData.root) {
        select.innerHTML = '<option value="">Main Section</option>';
        return;
    }
    
    const notes = Array.from(notesData.root.notes);
    let options = '<option value="">Main Section</option>';
    
    const organizedNotes = organizeNotesHierarchy(notes);
    options += buildParentOptions(organizedNotes, 0);
    
    select.innerHTML = options;
}

function buildParentOptions(organizedNotes, level) {
    let options = '';
    const indent = '  '.repeat(level);
    const levelPrefix = level > 0 ? '└ ' : '';
    
    organizedNotes.forEach(note => {
        const displayTitle = note.title.length > 40 ? note.title.substring(0, 40) + '...' : note.title;
        options += `<option value="${note.id}">${indent}${levelPrefix}${displayTitle}</option>`;
        
        if (note.children && note.children.length > 0) {
            options += buildParentOptions(note.children, level + 1);
        }
    });
    
    return options;
}

// Setup global functions for HTML onclick handlers
export function setupGlobalFunctions() {
    // Import and expose all the functions that HTML needs
    import('../components/voting-system.js').then(module => {
        window.voteNote = module.voteNote;
    });
    
    import('../components/comments-manager.js').then(module => {
        window.showCommentDialog = module.showCommentDialog;
        window.toggleComments = module.toggleComments;
        window.showComments = module.showComments;
        window.hideComments = module.hideComments;
        window.showCommentForm = module.showCommentForm;
        window.hideCommentForm = module.hideCommentForm;
        window.submitComment = module.submitComment;
        window.cancelComment = module.cancelComment;
    });
    
    import('../components/file-manager.js').then(module => {
        window.showFileUploadDialog = module.showFileUploadDialog;
        window.downloadFile = module.downloadFile;
        window.deleteFileAttachment = module.deleteFileAttachment;
        window.openImagePreview = module.openImagePreview;
        window.closeImagePreview = module.closeImagePreview;
    });
    
    import('../fluid/data-handlers.js').then(module => {
        window.deleteNote = module.deleteNote;
        window.reorderNote = module.reorderNote;
    });
    
    // Expose renderer functions
    window.branchFromNote = branchFromNote;
}