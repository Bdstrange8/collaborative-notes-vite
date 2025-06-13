import { notesData, currentUser } from '../fluid/client.js';
import { escapeHtml } from '../ui/ui-utils.js';

export function addComment(noteId, content) {
    if (!notesData || !notesData.root || !window.Comment) {
        console.error('Cannot add comment: Fluid Framework not initialized');
        return;
    }
    
    const commentId = (notesData.root.lastCommentId + 1).toString();
    notesData.root.lastCommentId = parseInt(commentId);

    const newComment = new window.Comment({
        id: commentId,
        noteId: noteId,
        content: content,
        author: currentUser,
        timestamp: new Date().toLocaleString(),
    });

    notesData.root.comments.insertAtEnd(newComment);
    console.log('💬 Added comment to note:', noteId);
}

export function toggleComments(noteId, noteTitle) {
    const commentsSection = document.getElementById(`comments-${noteId}`);
    
    if (commentsSection.classList.contains('expanded')) {
        hideComments(noteId);
    } else {
        showComments(noteId, noteTitle);
    }
}

export function showComments(noteId, noteTitle) {
    const commentsSection = document.getElementById(`comments-${noteId}`);
    const commentsList = document.getElementById(`comments-list-${noteId}`);
    
    if (!notesData || !notesData.root) return;
    
    const comments = Array.from(notesData.root.comments).filter(comment => comment.noteId === noteId);
    
    if (comments.length === 0) {
        commentsList.innerHTML = '<div style="color: #999; font-style: italic; padding: 4px 0;">No comments yet. Click the 💬 button to add the first comment!</div>';
    } else {
        const commentsHtml = comments
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map(comment => `
                <div class="comment-item">
                    <div class="comment-content">${escapeHtml(comment.content)}</div>
                    <div class="comment-meta">— ${escapeHtml(comment.author)}, ${comment.timestamp}</div>
                </div>
            `).join('');
        
        commentsList.innerHTML = commentsHtml;
    }
    
    commentsSection.classList.add('expanded');
}

export function hideComments(noteId) {
    const commentsSection = document.getElementById(`comments-${noteId}`);
    hideCommentForm(noteId);
    commentsSection.classList.remove('expanded');
}

export function showCommentDialog(noteId) {
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    if (noteElement) {
        const noteTitle = noteElement.querySelector('.note-title').textContent;
        showComments(noteId, noteTitle);
        
        setTimeout(() => {
            showCommentForm(noteId);
        }, 200);
    }
}

export function showCommentForm(noteId) {
    const commentForm = document.getElementById(`comment-form-${noteId}`);
    const commentInput = document.getElementById(`comment-input-${noteId}`);
    
    commentForm.classList.add('active');
    commentInput.focus();
}

export function hideCommentForm(noteId) {
    const commentForm = document.getElementById(`comment-form-${noteId}`);
    const commentInput = document.getElementById(`comment-input-${noteId}`);
    
    commentForm.classList.remove('active');
    commentInput.value = '';
}

export function submitComment(noteId) {
    const commentInput = document.getElementById(`comment-input-${noteId}`);
    const content = commentInput.value.trim();
    
    if (!content) {
        commentInput.focus();
        return;
    }
    
    addComment(noteId, content);
    hideCommentForm(noteId);
    
    setTimeout(() => {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteElement) {
            const noteTitle = noteElement.querySelector('.note-title').textContent;
            showComments(noteId, noteTitle);
        }
    }, 100);
}

export function cancelComment(noteId) {
    hideCommentForm(noteId);
}