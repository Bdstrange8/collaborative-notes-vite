// Import Fluid Framework components - Vite will handle the bundling!
import { SharedTree, TreeViewConfiguration, SchemaFactory, Tree } from "fluid-framework";
import { TinyliciousClient } from "@fluidframework/tinylicious-client";

// Global variables
let fluidContainer = null;
let notesData = null;
let currentUser = 'User' + Math.floor(Math.random() * 1000);
let listenersSetup = false; // Track if event listeners are already set up

console.log('🚀 Starting Collaborative Notes App');
console.log('👤 Current user:', currentUser);

// Initialize the Fluid Framework
async function initializeFluidFramework() {
    try {
        console.log('🔧 Initializing Fluid Framework...');
        
        // Test Tinylicious connection first
        try {
            const testResponse = await fetch('http://localhost:7070');
            if (!testResponse.ok) {
                throw new Error(`Tinylicious server responded with status: ${testResponse.status}`);
            }
            console.log('✅ Tinylicious server is reachable on port 7070');
        } catch (fetchError) {
            throw new Error(`Cannot reach Tinylicious server at localhost:7070. Make sure it's running with: npx tinylicious`);
        }
        
        const client = new TinyliciousClient();
        console.log('✅ TinyliciousClient created');
        
        // Use a versioned schema name to handle compatibility
        const SCHEMA_VERSION = "v2"; // Increment this when schema changes
        const sf = new SchemaFactory(`collaborativeNotes_${SCHEMA_VERSION}`);

        // Define schemas in the correct order
        const ActiveUser = sf.object("ActiveUser", {
            id: sf.string,
            name: sf.string,
            lastSeen: sf.string,
        });

        const Vote = sf.object("Vote", {
            id: sf.string,
            noteId: sf.string,
            userId: sf.string,
            voteType: sf.string, // 'up' or 'down'
        });

        const Comment = sf.object("Comment", {
            id: sf.string,
            noteId: sf.string,
            content: sf.string,
            author: sf.string,
            timestamp: sf.string,
        });

        const Note = sf.object("Note", {
            id: sf.string,
            title: sf.string,
            content: sf.string,
            author: sf.string,
            timestamp: sf.string,
            votes: sf.number,
            parentId: sf.string,
            level: sf.number,
        });

        const NotesDocument = sf.object("NotesDocument", {
            title: sf.string,
            notes: sf.array(Note),
            comments: sf.array(Comment),
            votes: sf.array(Vote),
            activeUsers: sf.array(ActiveUser),
            lastNoteId: sf.number,
            lastCommentId: sf.number,
            lastVoteId: sf.number,
            lastUserId: sf.number,
            schemaVersion: sf.string, // Track schema version
        });

        const containerSchema = {
            initialObjects: { notesTree: SharedTree },
        };

        const treeViewConfiguration = new TreeViewConfiguration({ schema: NotesDocument });

        let container, id;
        
        // Handle container loading/creation for real-time collaboration
        if (location.hash) {
            id = location.hash.substring(1);
            try {
                // Try to load existing container for collaboration
                const result = await client.getContainer(id, containerSchema, "2");
                container = result.container;
                console.log('✅ Loaded existing container for collaboration:', id);
            } catch (error) {
                console.log("Container load failed, creating new one:", error.message);
                const result = await client.createContainer(containerSchema, "2");
                container = result.container;
                id = await container.attach();
                location.hash = id;
                console.log('✅ Created new container:', id);
            }
        } else {
            // Create new container if no hash in URL
            const result = await client.createContainer(containerSchema, "2");
            container = result.container;
            id = await container.attach();
            location.hash = id;
            console.log('✅ Created new container:', id);
        }

        fluidContainer = container;
        notesData = container.initialObjects.notesTree.viewWith(treeViewConfiguration);
        
        // Store schema classes for global use BEFORE initialization
        window.Note = Note;
        window.Comment = Comment;
        window.Vote = Vote;
        window.ActiveUser = ActiveUser;
        window.NotesDocument = NotesDocument;
        
        console.log('✅ Classes stored globally');
        
        // Handle schema compatibility properly
        let isNewContainer = false;
        
        if (notesData.compatibility.canInitialize) {
            // New empty container - initialize it
            const initialDoc = new NotesDocument({
                title: "📚 Collaborative Notes",
                notes: [],
                comments: [],
                votes: [],
                activeUsers: [],
                lastNoteId: 0,
                lastCommentId: 0,
                lastVoteId: 0,
                lastUserId: 0,
                schemaVersion: SCHEMA_VERSION,
            });
            
            notesData.initialize(initialDoc);
            console.log('✅ Initialized new document');
            isNewContainer = true;
            
        } else if (notesData.compatibility.canUpgrade) {
            // Schema needs upgrade
            console.log('🔧 Upgrading document schema...');
            notesData.upgradeSchema();
            
            // After upgrade, check if we need to add missing fields
            if (!notesData.root.activeUsers) {
                notesData.root.activeUsers = [];
                console.log('🔧 Added activeUsers field during upgrade');
            }
            if (!notesData.root.votes) {
                notesData.root.votes = [];
                console.log('🔧 Added votes field during upgrade');
            }
            if (!notesData.root.lastUserId) {
                notesData.root.lastUserId = 0;
                console.log('🔧 Added lastUserId field during upgrade');
            }
            if (!notesData.root.lastVoteId) {
                notesData.root.lastVoteId = 0;
                console.log('🔧 Added lastVoteId field during upgrade');
            }
            if (!notesData.root.schemaVersion) {
                notesData.root.schemaVersion = SCHEMA_VERSION;
                console.log('🔧 Added schemaVersion field during upgrade');
            }
            
        } else if (notesData.root) {
            // Existing compatible container
            console.log('✅ Joined existing collaboration');
            
            // Check schema version compatibility
            const documentVersion = notesData.root.schemaVersion || "v1";
            if (documentVersion !== SCHEMA_VERSION) {
                console.log(`⚠️ Schema version mismatch: Document(${documentVersion}) vs App(${SCHEMA_VERSION})`);
                
                // Handle backward compatibility manually
                if (!notesData.root.activeUsers) {
                    // Can't add to immutable tree directly, so we'll work around it
                    console.log('⚠️ Document missing activeUsers - creating new container');
                    throw new Error('Schema incompatible - need new container');
                }
            }
            
            // Verify all required fields exist
            if (!notesData.root.votes) {
                console.log('⚠️ Document missing votes field - creating new container');
                throw new Error('Schema incompatible - need new container');
            }
            
            console.log('✅ Schema compatible - joined existing collaboration with', notesData.root.notes.length, 'notes');
            
        } else {
            // Schema incompatible - force new container creation
            console.log('⚠️ Schema incompatible, creating new container with different ID');
            
            // Generate a new ID to avoid conflicts
            const newResult = await client.createContainer(containerSchema, "2");
            container = newResult.container;
            const newId = await container.attach();
            
            // Update the URL to the new container
            location.hash = newId;
            
            fluidContainer = container;
            notesData = container.initialObjects.notesTree.viewWith(treeViewConfiguration);
            
            const initialDoc = new NotesDocument({
                title: "📚 Collaborative Notes",
                notes: [],
                comments: [],
                votes: [],
                activeUsers: [],
                lastNoteId: 0,
                lastCommentId: 0,
                lastVoteId: 0,
                lastUserId: 0,
                schemaVersion: SCHEMA_VERSION,
            });
            
            notesData.initialize(initialDoc);
            isNewContainer = true;
            console.log('✅ Created new compatible container with ID:', newId);
        }
        
        // Add current user to active users list
        addActiveUser();
        
        // Set up periodic user presence updates (very frequent)
        setInterval(updateUserPresence, 10000); // Update every 10 seconds
        
        // Clean up inactive users very frequently
        setInterval(cleanupInactiveUsers, 15000); // Check every 15 seconds
        
        // Add cleanup when user leaves the page
        window.addEventListener('beforeunload', () => {
            removeCurrentUser();
        });
        
        // Also handle visibility changes (tab switching, minimizing)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // User came back - update presence
                updateUserPresence();
            }
        });
        
        // Handle page focus/blur events
        window.addEventListener('focus', updateUserPresence);
        window.addEventListener('blur', () => {
            // Update last seen when losing focus
            updateUserPresence();
        });
        
        // Add mouse/keyboard activity listeners for more accurate presence
        let activityTimeout;
        const updateActivityPresence = () => {
            clearTimeout(activityTimeout);
            updateUserPresence();
            
            // Set a timeout to mark as less active after 30 seconds of no activity
            activityTimeout = setTimeout(() => {
                console.log('👤 User became inactive');
            }, 30000);
        };
        
        // Listen for user activity
        document.addEventListener('mousemove', updateActivityPresence);
        document.addEventListener('keydown', updateActivityPresence);
        document.addEventListener('click', updateActivityPresence);
        document.addEventListener('scroll', updateActivityPresence);
        
        // Set up event listeners for real-time updates (only once)
        if (!listenersSetup) {
            console.log('🔗 Setting up real-time event listeners...');
            
            // Add the event listener for real-time updates
            Tree.on(notesData.root, "nodeChanged", handleDataChange);
            
            // Also listen for tree changes at a higher level
            Tree.on(notesData.root.notes, "nodeChanged", () => {
                console.log('📝 Notes array changed');
                handleDataChange();
            });
            
            Tree.on(notesData.root.comments, "nodeChanged", () => {
                console.log('💬 Comments array changed');
                handleDataChange();
            });
            
            Tree.on(notesData.root.votes, "nodeChanged", () => {
                console.log('🗳️ Votes array changed');
                handleDataChange();
            });
            
            if (notesData.root.activeUsers) {
                Tree.on(notesData.root.activeUsers, "nodeChanged", () => {
                    console.log('👤 Active users changed');
                    handleDataChange();
                });
            }
            
            listenersSetup = true;
            console.log('✅ Real-time event listeners attached');
        }
        
        // Add sample data only for new containers
        if (isNewContainer) {
            addSampleNote();
            console.log('✅ Added sample notes');
        }
        
        // Initial render
        renderAllNotes();
        
        // Update UI to show success
        updateConnectionStatus('connected', '🔗 Connected to Tinylicious - Real-time collaboration active!');
        showCollaborationInfo();
        
        console.log('🎉 Fluid Framework initialized successfully!');
        console.log('🔗 Container ID:', id);
        console.log('📊 Current notes count:', notesData.root.notes.length);
        
        return id;
        
    } catch (error) {
        console.error('❌ Failed to initialize Fluid Framework:', error);
        updateConnectionStatus('error', '⚠️ Failed to connect to Tinylicious. Make sure it\'s running on localhost:7070');
        
        document.getElementById('notesContainer').innerHTML = `
            <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px;">
                <h3>🚫 Connection Failed</h3>
                <p>Could not connect to Tinylicious server.</p>
                <p><strong>To fix this:</strong></p>
                <ol style="margin: 15px 0; padding-left: 20px;">
                    <li>Stop any existing Tinylicious: <code>pkill -f tinylicious</code></li>
                    <li>Start fresh: <code>npx tinylicious</code></li>
                    <li>Refresh this page</li>
                </ol>
                <p><strong>Error:</strong> ${error.message}</p>
                ${error.message.includes('Schema incompatible') ? 
                    '<p><strong>Note:</strong> If you see "Schema incompatible", the app will create a new document with the updated features.</p>' : 
                    ''
                }
            </div>
        `;
        
        throw error;
    }
}

function addNote(title, content, parentId = "") {
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

    const newNote = new window.Note({
        id: noteId,
        title: title,
        content: content,
        author: currentUser,
        timestamp: new Date().toLocaleString(),
        votes: 0,
        parentId: parentId || "", // Use empty string instead of null
        level: level,
    });

    notesData.root.notes.insertAtEnd(newNote);
    console.log('➕ Added note:', title, level > 0 ? `(level ${level})` : '(root level)');
    
    // Don't force immediate UI update - let the event listener handle it
    // This ensures all clients update simultaneously
}

function addSampleNote() {
    // Add a hierarchical sample structure
    addNote("Project Overview", "This is the main project description with key objectives and scope.");
    
    // Wait a moment then add child notes
    setTimeout(() => {
        const notes = Array.from(notesData.root.notes);
        const parentNote = notes.find(note => note.title === "Project Overview");
        if (parentNote) {
            addNote("Phase 1: Planning", "Initial planning and requirement gathering phase.", parentNote.id);
            addNote("Phase 2: Development", "Main development and implementation phase.", parentNote.id);
            
            // Add sub-items to Phase 1
            setTimeout(() => {
                const phase1Note = Array.from(notesData.root.notes).find(note => note.title === "Phase 1: Planning");
                if (phase1Note) {
                    addNote("Requirements Analysis", "Detailed analysis of project requirements and constraints.", phase1Note.id);
                    addNote("Resource Planning", "Planning of human and technical resources needed.", phase1Note.id);
                }
            }, 100);
        }
    }, 100);
}

function handleDataChange(event) {
    console.log('🔄 Data changed - re-rendering notes');
    console.log('🔄 Event details:', event);
    console.log('📊 Current state:', {
        notes: notesData.root.notes.length,
        comments: notesData.root.comments.length,
        votes: notesData.root.votes.length,
        activeUsers: notesData.root.activeUsers ? notesData.root.activeUsers.length : 0
    });
    
    // Use setTimeout to ensure the change has been fully processed
    setTimeout(() => {
        renderAllNotes();
        updateParentOptions();
        updateActiveUsersList();
    }, 50);
}

function addActiveUser() {
    if (!notesData || !notesData.root || !window.ActiveUser) return;
    
    // Check if user already exists
    const existingUsers = Array.from(notesData.root.activeUsers || []);
    const existingUser = existingUsers.find(user => user.name === currentUser);
    
    if (!existingUser) {
        const userId = ((notesData.root.lastUserId || 0) + 1).toString();
        notesData.root.lastUserId = parseInt(userId);
        
        const newUser = new window.ActiveUser({
            id: userId,
            name: currentUser,
            lastSeen: new Date().toISOString(),
        });
        
        notesData.root.activeUsers.insertAtEnd(newUser);
        console.log('👤 Added current user to active users list');
    } else {
        // Update last seen time
        existingUser.lastSeen = new Date().toISOString();
    }
}

function updateUserPresence() {
    if (!notesData || !notesData.root || !notesData.root.activeUsers) return;
    
    const existingUsers = Array.from(notesData.root.activeUsers);
    const userIndex = existingUsers.findIndex(user => user.name === currentUser);
    
    if (userIndex !== -1) {
        // Update the lastSeen time for this user
        notesData.root.activeUsers[userIndex].lastSeen = new Date().toISOString();
        console.log('👤 Updated presence for:', currentUser);
    } else {
        // User was removed, add them back
        addActiveUser();
    }
}

function removeCurrentUser() {
    if (!notesData || !notesData.root || !notesData.root.activeUsers) return;
    
    try {
        const activeUsers = Array.from(notesData.root.activeUsers);
        const userIndex = activeUsers.findIndex(user => user.name === currentUser);
        
        if (userIndex !== -1) {
            notesData.root.activeUsers.removeAt(userIndex);
            console.log('👤 Removed current user from active users list');
        }
    } catch (error) {
        console.log('⚠️ Could not remove user on page unload:', error.message);
        // This is expected if the connection is already closed
    }
}

function cleanupInactiveUsers() {
    if (!notesData || !notesData.root || !notesData.root.activeUsers) return;
    
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000); // Very aggressive - 1 minute
    
    // Remove users inactive for more than 1 minute
    const activeUsers = Array.from(notesData.root.activeUsers);
    let removedCount = 0;
    
    for (let i = activeUsers.length - 1; i >= 0; i--) {
        const user = activeUsers[i];
        const lastSeen = new Date(user.lastSeen);
        
        if (lastSeen < oneMinuteAgo) {
            notesData.root.activeUsers.removeAt(i);
            console.log('👤 Removed inactive user:', user.name);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} inactive users`);
    }
}

function updateActiveUsersList() {
    const usersList = document.getElementById('activeUsersList');
    if (!usersList || !notesData || !notesData.root || !notesData.root.activeUsers) return;
    
    const activeUsers = Array.from(notesData.root.activeUsers);
    
    if (activeUsers.length === 0) {
        usersList.innerHTML = '<div class="user-badge">No active users</div>';
        return;
    }
    
    // Filter out users who might be stale (older than 1.5 minutes for display)
    const now = new Date();
    const oneAndHalfMinutesAgo = new Date(now.getTime() - 1.5 * 60 * 1000);
    const recentUsers = activeUsers.filter(user => {
        const lastSeen = new Date(user.lastSeen);
        return lastSeen > oneAndHalfMinutesAgo;
    });
    
    if (recentUsers.length === 0) {
        usersList.innerHTML = '<div class="user-badge">No active users</div>';
        return;
    }
    
    const usersHtml = recentUsers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(user => {
            const isCurrentUser = user.name === currentUser;
            const badgeClass = isCurrentUser ? 'user-badge is-you' : 'user-badge';
            const displayName = isCurrentUser ? 'You' : user.name;
            const lastSeen = new Date(user.lastSeen);
            const secondsAgo = Math.floor((now - lastSeen) / 1000);
            
            let statusText;
            if (secondsAgo < 30) {
                statusText = 'Active now';
            } else if (secondsAgo < 60) {
                statusText = `${secondsAgo}s ago`;
            } else {
                const minutesAgo = Math.floor(secondsAgo / 60);
                statusText = `${minutesAgo}m ago`;
            }
            
            return `
                <div class="${badgeClass}" title="Last seen: ${statusText}">
                    <div class="user-status"></div>
                    ${displayName}
                </div>
            `;
        }).join('');
    
    usersList.innerHTML = usersHtml;
}

function renderAllNotes() {
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
    // Create a map of parent -> children
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
    // Use displayLevel (from hierarchy position) instead of noteData.level
    noteElement.className = `note-item level-${displayLevel}`;
    noteElement.setAttribute('data-note-id', noteData.id);
    
    // Document-style outline numbering
    const getOutlineNumber = (noteData, displayLevel) => {
        if (displayLevel === 0) return ''; // No numbering for main headings
        
        // Get all notes and organize hierarchy to calculate proper numbering
        const notes = Array.from(notesData.root.notes);
        const organizedNotes = organizeNotesHierarchy(notes);
        
        // Find the path to this note and calculate numbering
        const numberingPath = findNoteNumberingPath(organizedNotes, noteData.id, []);
        
        if (!numberingPath || numberingPath.length === 0) return '';
        
        // Generate outline-style numbering based on level
        const levelIndex = numberingPath[numberingPath.length - 1];
        
        switch(displayLevel) {
            case 1: // Roman numerals (I, II, III, IV, V...)
                return toRoman(levelIndex + 1) + '.';
            case 2: // Capital letters (A, B, C, D...)
                return String.fromCharCode(65 + (levelIndex % 26)) + '.';
            case 3: // Numbers (1, 2, 3, 4...)
                return (levelIndex + 1) + '.';
            case 4: // Lowercase letters (a, b, c, d...)
                return String.fromCharCode(97 + (levelIndex % 26)) + ')';
            default:
                return '•';
        }
    };
    
    // Helper function to convert number to Roman numerals
    const toRoman = (num) => {
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
    };
    
    // Helper function to find the numbering path for a note
    const findNoteNumberingPath = (organizedNotes, targetId, currentPath) => {
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
    };
    
    const outlineNumber = getOutlineNumber(noteData, displayLevel);
    
    // Create flowing text structure
    const hasContent = noteData.content && noteData.title !== noteData.content;
    const separator = hasContent ? ': ' : '';
    
    // Create voting buttons with professional styling
    const getUserVote = (noteId) => {
        if (!notesData || !notesData.root || !notesData.root.votes) return null;
        const votes = Array.from(notesData.root.votes);
        const userVote = votes.find(vote => vote.noteId === noteId && vote.userId === currentUser);
        return userVote ? userVote.voteType : null;
    };
    
    const userVote = getUserVote(noteData.id);
    
    const upvoteClass = userVote === 'up' ? 'voted upvote' : 'upvote';
    const downvoteClass = userVote === 'down' ? 'voted downvote' : 'downvote';
    
    // Get comment count for this note
    const commentCount = getCommentCount(noteData.id);
    const hasComments = commentCount > 0;
    
    // Create comment button with different styling based on whether there are comments
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
        </div>
    `;
    
    // Add drag and drop functionality
    setupDragAndDrop(noteElement, noteData);
    
    // Add click handler for showing comments when clicking on the note content
    const noteMain = noteElement.querySelector('.note-main');
    noteMain.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons or comments section
        if (!e.target.closest('.note-actions') && !e.target.closest('.comments-section')) {
            toggleComments(noteData.id, noteData.title);
        }
    });
    
    return noteElement;
}

function voteNote(noteId, direction) {
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
            // Remove the current vote
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
            
            console.log(`🗳️ Removed ${newVoteType}vote on note: ${note.title} (Total: ${note.votes})`);
            
        } else {
            // User is either voting for the first time or switching votes
            
            // If user had a previous vote, remove it first
            if (currentVote) {
                const voteIndex = Array.from(notesData.root.votes).findIndex(v => v.id === currentVote.id);
                if (voteIndex !== -1) {
                    notesData.root.votes.removeAt(voteIndex);
                }
                
                if (currentVote.voteType === 'up') {
                    note.votes -= 1;
                } else if (currentVote.voteType === 'down') {
                    note.votes += 1;
                }
            }
            
            // Apply new vote
            note.votes += direction;
            
            // Create new vote record
            const voteId = (notesData.root.lastVoteId + 1).toString();
            notesData.root.lastVoteId = parseInt(voteId);
            
            const newVote = new window.Vote({
                id: voteId,
                noteId: noteId,
                userId: currentUser,
                voteType: newVoteType,
            });
            
            notesData.root.votes.insertAtEnd(newVote);
            
            const action = currentVote ? 'switched to' : 'added';
            console.log(`🗳️ ${action} ${direction > 0 ? 'up' : 'down'}vote on note: ${note.title} (Total: ${note.votes})`);
        }
        
        // Don't force immediate UI update - let the event listener handle it
        // This ensures all clients update simultaneously
    }
}

function deleteNote(noteId) {
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
    
    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete this note?\n\n"${noteToDelete.title}"`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Find and delete all child notes recursively
    const deleteNoteAndChildren = (parentId) => {
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
    };
    
    // Also delete associated comments and votes
    const deleteRelatedData = (noteId) => {
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
    };
    
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
    
    // Get all IDs that will be deleted (note + all descendants)
    const allDeletedIds = [noteId, ...getAllDescendantIds(noteId)];
    
    // Delete related data for all notes that will be deleted
    allDeletedIds.forEach(id => deleteRelatedData(id));
    
    // Delete the note and all its children
    deleteNoteAndChildren(noteId);
    
    console.log(`🗑️ Deleted note "${noteToDelete.title}" and ${allDeletedIds.length - 1} child notes`);
    
    // Don't force immediate UI update - let the event listener handle it
    // This ensures all clients update simultaneously
}

function getCommentCount(noteId) {
    if (!notesData || !notesData.root || !notesData.root.comments) return 0;
    const comments = Array.from(notesData.root.comments);
    return comments.filter(comment => comment.noteId === noteId).length;
}

function addComment(noteId, content) {
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
    
    // Don't force immediate UI update - let the event listener handle it
    // This ensures all clients update simultaneously
}

function toggleComments(noteId, noteTitle) {
    const commentsSection = document.getElementById(`comments-${noteId}`);
    
    if (commentsSection.classList.contains('expanded')) {
        // Hide comments
        hideComments(noteId);
    } else {
        // Show comments
        showComments(noteId, noteTitle);
    }
}

function showComments(noteId, noteTitle) {
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

function hideComments(noteId) {
    const commentsSection = document.getElementById(`comments-${noteId}`);
    hideCommentForm(noteId); // Also hide the comment form when closing comments
    commentsSection.classList.remove('expanded');
}

function showCommentDialog(noteId) {
    // First, show the comments section so user can see existing comments
    const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
    if (noteElement) {
        const noteTitle = noteElement.querySelector('.note-title').textContent;
        showComments(noteId, noteTitle);
        
        // Then show the comment form
        setTimeout(() => {
            showCommentForm(noteId);
        }, 200); // Small delay to let comments section expand
    }
}

function showCommentForm(noteId) {
    const commentForm = document.getElementById(`comment-form-${noteId}`);
    const commentInput = document.getElementById(`comment-input-${noteId}`);
    
    commentForm.classList.add('active');
    commentInput.focus();
}

function hideCommentForm(noteId) {
    const commentForm = document.getElementById(`comment-form-${noteId}`);
    const commentInput = document.getElementById(`comment-input-${noteId}`);
    
    commentForm.classList.remove('active');
    commentInput.value = '';
}

function submitComment(noteId) {
    const commentInput = document.getElementById(`comment-input-${noteId}`);
    const content = commentInput.value.trim();
    
    if (!content) {
        commentInput.focus();
        return;
    }
    
    addComment(noteId, content);
    hideCommentForm(noteId);
    
    // Refresh the comments display to show the new comment
    setTimeout(() => {
        const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
        if (noteElement) {
            const noteTitle = noteElement.querySelector('.note-title').textContent;
            showComments(noteId, noteTitle);
        }
    }, 100);
}

function cancelComment(noteId) {
    hideCommentForm(noteId);
}

function setupDragAndDrop(noteElement, noteData) {
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

function reorderNote(draggedId, targetId, dropAbove) {
    if (!notesData || !notesData.root) return;
    
    const notes = Array.from(notesData.root.notes);
    const draggedIndex = notes.findIndex(note => note.id === draggedId);
    const targetIndex = notes.findIndex(note => note.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Get the dragged note data
    const draggedNote = notes[draggedIndex];
    
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
    });
    
    // Remove the original note
    notesData.root.notes.removeAt(draggedIndex);
    
    // Calculate new position (adjust for removed item)
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
    
    // Don't force immediate UI update - let the event listener handle it
    // This ensures all clients update simultaneously
}

function clearAllNotes() {
    if (!notesData || !notesData.root) return;
    
    if (confirm('Are you sure you want to clear all notes? This cannot be undone.')) {
        while (notesData.root.notes.length > 0) {
            notesData.root.notes.removeAt(0);
        }
        while (notesData.root.comments.length > 0) {
            notesData.root.comments.removeAt(0);
        }
        while (notesData.root.votes.length > 0) {
            notesData.root.votes.removeAt(0);
        }
        notesData.root.lastNoteId = 0;
        notesData.root.lastVoteId = 0;
        console.log('🗑️ Cleared all notes');
        
        // Don't force immediate UI update - let the event listener handle it
        // This ensures all clients update simultaneously
    }
}

function updateConnectionStatus(status, message) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = `connection-status status-${status}`;
    statusEl.textContent = message;
}

function showCollaborationInfo() {
    const infoEl = document.getElementById('collaborationInfo');
    const urlEl = document.getElementById('shareUrl');
    
    infoEl.style.display = 'block';
    urlEl.textContent = window.location.href;
    
    // Initial update of active users list
    updateActiveUsersList();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function branchFromNote(parentId) {
    // Show the add note form and set the parent
    const form = document.getElementById('addNoteForm');
    const parentSelect = document.getElementById('parentNoteSelect');
    
    // Update parent options first
    updateParentOptions();
    
    // Set the parent
    parentSelect.value = parentId;
    
    // Show form
    form.style.display = 'block';
    form.classList.add('active');
    
    // Focus on title field
    document.getElementById('noteTitle').focus();
    
    // Update form header to show we're branching
    if (notesData && notesData.root) {
        const notes = Array.from(notesData.root.notes);
        const parentNote = notes.find(note => note.id === parentId);
        if (parentNote) {
            document.getElementById('formTitle').textContent = `Add Sub-section to: "${parentNote.title}"`;
        }
    }
}

function updateParentOptions() {
    const select = document.getElementById('parentNoteSelect');
    
    if (!notesData || !notesData.root) {
        select.innerHTML = '<option value="">Main Section</option>';
        return;
    }
    
    const notes = Array.from(notesData.root.notes);
    
    let options = '<option value="">Main Section</option>';
    
    // Build hierarchical options
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

// Make functions globally available
window.voteNote = voteNote;
window.branchFromNote = branchFromNote;
window.deleteNote = deleteNote;
window.showCommentDialog = showCommentDialog;
window.toggleComments = toggleComments;
window.showComments = showComments;
window.hideComments = hideComments;
window.showCommentForm = showCommentForm;
window.hideCommentForm = hideCommentForm;
window.submitComment = submitComment;
window.cancelComment = cancelComment;
window.setupDragAndDrop = setupDragAndDrop;
window.reorderNote = reorderNote;

// UI Event Handlers
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded - setting up event handlers');
    
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
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        document.getElementById('parentNoteSelect').value = '';
        document.getElementById('formTitle').textContent = 'Add New Section';
        const form = document.getElementById('addNoteForm');
        form.style.display = 'none';
        form.classList.remove('active');
    });
    
    // Cancel button
    document.getElementById('cancelNoteBtn').addEventListener('click', function() {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        document.getElementById('parentNoteSelect').value = '';
        document.getElementById('formTitle').textContent = 'Add New Section';
        const form = document.getElementById('addNoteForm');
        form.style.display = 'none';
        form.classList.remove('active');
    });
    
    // Add Sample Note button
    document.getElementById('addSampleBtn').addEventListener('click', function() {
        addSampleNote();
    });
    
    // Clear All button
    document.getElementById('clearAllBtn').addEventListener('click', clearAllNotes);
    
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
});

// Initialize the app
initializeFluidFramework().catch(error => {
    console.error('Failed to start app:', error);
});

console.log('📱 Collaborative Notes App Loaded');
console.log('🔧 Using Vite for module bundling');
console.log('💡 Tip: Open this URL in multiple tabs to test collaboration!');