import { reorderNote } from '../fluid/data-handlers.js';

export function setupDragAndDrop(noteElement, noteData) {
    noteElement.draggable = true;
    
    // Drag start
    noteElement.addEventListener('dragstart', (e) => {
        noteElement.classList.add('dragging');
        e.dataTransfer.setData('text/plain', noteData.id);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    // Drag end
    noteElement.addEventListener('dragend', (e) => {
        noteElement.classList.remove('dragging');
        // Remove all drag-over classes
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('drag-over', 'drag-over-bottom');
        });
    });
    
    // Drag over
    noteElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const draggingElement = document.querySelector('.dragging');
        if (draggingElement === noteElement) return;
        
        // Remove previous drag-over classes
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('drag-over', 'drag-over-bottom');
        });
        
        // Determine if we should drop above or below
        const rect = noteElement.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        
        if (e.clientY < midY) {
            noteElement.classList.add('drag-over');
        } else {
            noteElement.classList.add('drag-over-bottom');
        }
    });
    
    // Drag leave
    noteElement.addEventListener('dragleave', (e) => {
        // Only remove if we're leaving the element entirely
        if (!noteElement.contains(e.relatedTarget)) {
            noteElement.classList.remove('drag-over', 'drag-over-bottom');
        }
    });
    
    // Drop
    noteElement.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = noteData.id;
        
        if (draggedId === targetId) return;
        
        // Determine drop position
        const rect = noteElement.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dropAbove = e.clientY < midY;
        
        reorderNote(draggedId, targetId, dropAbove);
        
        // Clean up
        noteElement.classList.remove('drag-over', 'drag-over-bottom');
    });
}