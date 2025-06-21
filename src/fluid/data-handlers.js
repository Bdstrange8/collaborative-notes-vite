import { notesData, currentUser } from './client.js';
import { renderAllNotes, updateParentOptions } from '../components/notes-renderer.js';
import { updateActiveUsersList } from '../components/user-presence.js';
import { updateAllFileAttachments } from '../components/file-manager.js';

export function handleDataChange(event) {
    console.log('🔄 Data changed - re-rendering notes');
    console.log('🔄 Event details:', event);
    console.log('📊 Current state:', {
        notes: notesData.root.notes.length,
        comments: notesData.root.comments.length,
        votes: notesData.root.votes.length,
        fileAttachments: notesData.root.fileAttachments ? notesData.root.fileAttachments.length : 0,
        activeUsers: notesData.root.activeUsers ? notesData.root.activeUsers.length : 0
    });
    
    // Use setTimeout to ensure the change has been fully processed
    setTimeout(() => {
        renderAllNotes();
        updateParentOptions();
        updateActiveUsersList();
        updateAllFileAttachments();
    }, 50);
}

// Updated addNote function with file support
export function addNote(title, content, parentId = "", files = []) {
    if (!notesData || !notesData.root || !window.Note) {
        console.error('Cannot add note: Fluid Framework not initialized');
        return;
    }
    
    // Calculate level based on parent
    let level = 0;
    if (parentId && parentId !== "") {
        const notes = Array.from(notesData.root.notes);
        const parentNote = notes.find(note => note.id === parentId);
        if (parentNote) {
            level = Math.min(parentNote.level + 1, 4); // Max 5 levels (0-4)
        }
    }
    
    const noteId = (notesData.root.lastNoteId + 1).toString();
    notesData.root.lastNoteId = parseInt(noteId);

    // Create file attachments with proper IDs
    const fileAttachments = files.map(file => {
        return new window.FileAttachment({
            id: file.id || generateFileId(),
            name: file.name,
            type: file.type,
            size: file.size,
            data: file.data,
            uploadedBy: file.uploadedBy || currentUser,
            uploadedAt: file.uploadedAt || new Date().toLocaleString(),
        });
    });

    const newNote = new window.Note({
        id: noteId,
        title: title,
        content: content,
        author: currentUser,
        timestamp: new Date().toLocaleString(),
        votes: 0,
        parentId: parentId || "",
        level: level,
        files: fileAttachments, // Embed files directly in the note
    });

    notesData.root.notes.insertAtEnd(newNote);
    console.log('➕ Added note:', title, level > 0 ? `(level ${level})` : '(root level)', 
                files.length > 0 ? `with ${files.length} files` : '');
}

function generateFileId() {
    const fileId = (notesData.root.lastFileId + 1).toString();
    notesData.root.lastFileId = parseInt(fileId);
    return fileId;
}

export function addSampleNote() {
    addNote("Project Overview", "This is the main project description with key objectives and scope.", "", []);
    
    setTimeout(() => {
        const notes = Array.from(notesData.root.notes);
        const parentNote = notes.find(note => note.title === "Project Overview");
        if (parentNote) {
            addNote("Phase 1: Planning", "Initial planning and requirement gathering phase.", parentNote.id, []);
            addNote("Phase 2: Development", "Main development and implementation phase.", parentNote.id, []);
            
            setTimeout(() => {
                const phase1Note = Array.from(notesData.root.notes).find(note => note.title === "Phase 1: Planning");
                if (phase1Note) {
                    addNote("Requirements Analysis", "Detailed analysis of project requirements and constraints.", phase1Note.id, []);
                    addNote("Resource Planning", "Planning of human and technical resources needed.", phase1Note.id, []);
                }
            }, 100);
        }
    }, 100);
}

export function deleteNote(noteId) {
    if (!notesData || !notesData.root || !notesData.root.notes) {
        console.error('Cannot delete note: Fluid Framework not initialized');
        return;
    }
    
    const notes = Array.from(notesData.root.notes);
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
        console.error('Note not found for deletion:', noteId);
        return;
    }
    
    const noteToDelete = notes[noteIndex];
    
    // Security check: Only the author can delete their own note
    if (noteToDelete.author !== currentUser) {
        alert('You can only delete your own notes!');
        console.warn('Delete attempt blocked: User', currentUser, 'tried to delete note by', noteToDelete.author);
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete this note?\n\n"${noteToDelete.title}"`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Get all descendant note IDs for cleanup
    const getAllDescendantIds = (parentId) => {
        const descendants = [];
        const children = Array.from(notesData.root.notes).filter(note => note.parentId === parentId);
        
        children.forEach(child => {
            descendants.push(child.id);
            descendants.push(...getAllDescendantIds(child.id));
        });
        
        return descendants;
    };
    
    const allDeletedIds = [noteId, ...getAllDescendantIds(noteId)];
    
    // Delete related data (comments, votes) for all notes that will be deleted
    allDeletedIds.forEach(id => deleteRelatedData(id));
    
    // Delete the note and all its children
    deleteNoteAndChildren(noteId);
    
    console.log(`🗑️ Deleted note "${noteToDelete.title}" and ${allDeletedIds.length - 1} child notes`);
}

function deleteNoteAndChildren(parentId) {
    const childNotes = Array.from(notesData.root.notes).filter(note => note.parentId === parentId);
    
    // Delete children first (deepest first)
    childNotes.forEach(childNote => {
        deleteNoteAndChildren(childNote.id);
    });
    
    // Delete the parent note
    const currentNotes = Array.from(notesData.root.notes);
    const currentIndex = currentNotes.findIndex(note => note.id === parentId);
    if (currentIndex !== -1) {
        notesData.root.notes.removeAt(currentIndex);
        console.log('🗑️ Deleted note:', currentNotes[currentIndex].title);
    }
}

function deleteRelatedData(noteId) {
    // Delete comments for this note
    const comments = Array.from(notesData.root.comments);
    for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i].noteId === noteId) {
            notesData.root.comments.removeAt(i);
            console.log('🗑️ Deleted comment for note:', noteId);
        }
    }
    
    // Delete votes for this note
    const votes = Array.from(notesData.root.votes);
    for (let i = votes.length - 1; i >= 0; i--) {
        if (votes[i].noteId === noteId) {
            notesData.root.votes.removeAt(i);
            console.log('🗑️ Deleted vote for note:', noteId);
        }
    }

    // Delete legacy file attachments for this note (backward compatibility)
    if (notesData.root.fileAttachments) {
        const attachments = Array.from(notesData.root.fileAttachments);
        for (let i = attachments.length - 1; i >= 0; i--) {
            if (attachments[i].noteId === noteId) {
                notesData.root.fileAttachments.removeAt(i);
                console.log('🗑️ Deleted legacy file attachment for note:', noteId);
            }
        }
    }
    
    // Note: Files embedded in notes will be deleted automatically when the note is deleted
}

export function clearAllNotes() {
    if (!notesData || !notesData.root) return;
    
    if (confirm('Are you sure you want to clear all notes? This cannot be undone.')) {
        const arraysToClear = ['notes', 'comments', 'votes'];
        if (notesData.root.fileAttachments) {
            arraysToClear.push('fileAttachments');
        }
        
        arraysToClear.forEach(arrayName => {
            while (notesData.root[arrayName].length > 0) {
                notesData.root[arrayName].removeAt(0);
            }
        });
        
        // Reset counters
        notesData.root.lastNoteId = 0;
        notesData.root.lastVoteId = 0;
        notesData.root.lastCommentId = 0;
        if (notesData.root.lastFileId !== undefined) {
            notesData.root.lastFileId = 0;
        }
        
        console.log('🗑️ Cleared all notes');
    }
}

export function reorderNote(draggedId, targetId, dropAbove) {
    if (!notesData || !notesData.root) return;
    
    const notes = Array.from(notesData.root.notes);
    const draggedIndex = notes.findIndex(note => note.id === draggedId);
    const targetIndex = notes.findIndex(note => note.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const draggedNote = notes[draggedIndex];
    
    // Create new FileAttachment objects from existing files (avoid node reuse)
    const newFileAttachments = [];
    if (draggedNote.files && draggedNote.files.length > 0) {
        const existingFiles = Array.from(draggedNote.files);
        existingFiles.forEach(file => {
            const newFileAttachment = new window.FileAttachment({
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                data: file.data,
                uploadedBy: file.uploadedBy,
                uploadedAt: file.uploadedAt,
            });
            newFileAttachments.push(newFileAttachment);
        });
    }
    
    // Create a new note object with the same data (required by Fluid Framework)
    const newNote = new window.Note({
        id: draggedNote.id,
        title: draggedNote.title,
        content: draggedNote.content,
        author: draggedNote.author,
        timestamp: draggedNote.timestamp,
        votes: draggedNote.votes,
        parentId: draggedNote.parentId,
        level: draggedNote.level,
        files: newFileAttachments, // Use new file attachment objects
    });
    
    // Remove the original note
    notesData.root.notes.removeAt(draggedIndex);
    
    // Calculate new position
    let newIndex = targetIndex;
    if (draggedIndex < targetIndex) {
        newIndex = targetIndex - 1;
    }
    
    if (!dropAbove) {
        newIndex += 1;
    }
    
    // Ensure newIndex is within bounds
    newIndex = Math.max(0, Math.min(newIndex, notesData.root.notes.length));
    
    // Insert the new note at the calculated position
    notesData.root.notes.insertAt(newIndex, newNote);
    
    console.log(`📝 Moved note "${draggedNote.title}" to position ${newIndex}`);
}