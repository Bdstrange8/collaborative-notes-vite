import { notesData, currentUser } from '../fluid/client.js';

export function voteNote(noteId, direction) {
    if (!notesData || !notesData.root) return;
    
    const votes = Array.from(notesData.root.votes);
    const currentVote = votes.find(vote => vote.noteId === noteId && vote.userId === currentUser);
    const newVoteType = direction > 0 ? 'up' : 'down';
    
    const notes = Array.from(notesData.root.notes);
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex !== -1) {
        const note = notes[noteIndex];
        
        // If user clicks the same vote button they already voted, remove the vote (unvote)
        if (currentVote && currentVote.voteType === newVoteType) {
            removeVote(currentVote, note);
            console.log(`🗳️ Removed ${newVoteType}vote on note: ${note.title} (Total: ${note.votes})`);
            
        } else {
            // User is either voting for the first time or switching votes
            if (currentVote) {
                // Remove previous vote first
                removeVote(currentVote, note);
            }
            
            // Apply new vote
            addVote(noteId, newVoteType, direction, note);
            
            const action = currentVote ? 'switched to' : 'added';
            console.log(`🗳️ ${action} ${direction > 0 ? 'up' : 'down'}vote on note: ${note.title} (Total: ${note.votes})`);
        }
    }
}

function removeVote(currentVote, note) {
    const voteIndex = Array.from(notesData.root.votes).findIndex(v => v.id === currentVote.id);
    if (voteIndex !== -1) {
        notesData.root.votes.removeAt(voteIndex);
    }
    
    // Update the note's vote count
    if (currentVote.voteType === 'up') {
        note.votes -= 1;
    } else if (currentVote.voteType === 'down') {
        note.votes += 1;
    }
}

function addVote(noteId, voteType, direction, note) {
    // Apply new vote to note
    note.votes += direction;
    
    // Create new vote record
    const voteId = (notesData.root.lastVoteId + 1).toString();
    notesData.root.lastVoteId = parseInt(voteId);
    
    const newVote = new window.Vote({
        id: voteId,
        noteId: noteId,
        userId: currentUser,
        voteType: voteType,
    });
    
    notesData.root.votes.insertAtEnd(newVote);
}

export function getUserVote(noteId) {
    if (!notesData || !notesData.root || !notesData.root.votes) return null;
    const votes = Array.from(notesData.root.votes);
    const userVote = votes.find(vote => vote.noteId === noteId && vote.userId === currentUser);
    return userVote ? userVote.voteType : null;
}

export function getVoteCount(noteId) {
    if (!notesData || !notesData.root || !notesData.root.notes) return 0;
    const notes = Array.from(notesData.root.notes);
    const note = notes.find(n => n.id === noteId);
    return note ? note.votes : 0;
}