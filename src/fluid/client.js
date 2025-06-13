import { SharedTree, TreeViewConfiguration, Tree } from "fluid-framework";
import { TinyliciousClient } from "@fluidframework/tinylicious-client";
import { createSchemas } from './schemas.js';
import { handleDataChange, addSampleNote } from './data-handlers.js';
import { addActiveUser, updateUserPresence, removeCurrentUser, cleanupInactiveUsers } from '../components/user-presence.js';
import { renderAllNotes } from '../components/notes-renderer.js';
import { updateConnectionStatus, showCollaborationInfo } from '../ui/ui-utils.js';

// Global variables
export let fluidContainer = null;
export let notesData = null;
export let currentUser = 'User' + Math.floor(Math.random() * 1000);

console.log('👤 Current user:', currentUser);

export async function initializeFluidFramework() {
    try {
        console.log('🔧 Initializing Fluid Framework...');
        
        // Test Tinylicious connection first
        await testTinyliciousConnection();
        
        const client = new TinyliciousClient();
        console.log('✅ TinyliciousClient created');
        
        const { schemas, treeViewConfiguration } = createSchemas();
        const containerSchema = {
            initialObjects: { notesTree: SharedTree },
        };

        const { container, id } = await getOrCreateContainer(client, containerSchema);
        
        fluidContainer = container;
        notesData = container.initialObjects.notesTree.viewWith(treeViewConfiguration);
        
        // Store schema classes globally
        Object.assign(window, schemas);
        console.log('✅ Classes stored globally');
        
        const isNewContainer = await handleSchemaCompatibility(schemas);
        
        setupUserPresence();
        setupEventListeners();
        
        if (isNewContainer) {
            addSampleNote();
            console.log('✅ Added sample notes');
        }
        
        renderAllNotes();
        updateConnectionStatus('connected', '🔗 Connected to Tinylicious - Real-time collaboration active!');
        showCollaborationInfo();
        
        console.log('🎉 Fluid Framework initialized successfully!');
        console.log('🔗 Container ID:', id);
        
        return id;
        
    } catch (error) {
        console.error('❌ Failed to initialize Fluid Framework:', error);
        handleInitializationError(error);
        throw error;
    }
}

async function testTinyliciousConnection() {
    try {
        const testResponse = await fetch('http://localhost:7070');
        if (!testResponse.ok) {
            throw new Error(`Tinylicious server responded with status: ${testResponse.status}`);
        }
        console.log('✅ Tinylicious server is reachable on port 7070');
    } catch (fetchError) {
        throw new Error(`Cannot reach Tinylicious server at localhost:7070. Make sure it's running with: npx tinylicious`);
    }
}

async function getOrCreateContainer(client, containerSchema) {
    let container, id;
    
    if (location.hash) {
        id = location.hash.substring(1);
        try {
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
        const result = await client.createContainer(containerSchema, "2");
        container = result.container;
        id = await container.attach();
        location.hash = id;
        console.log('✅ Created new container:', id);
    }
    
    return { container, id };
}

async function handleSchemaCompatibility(schemas) {
    const SCHEMA_VERSION = "v2";
    let isNewContainer = false;
    
    if (notesData.compatibility.canInitialize) {
        // New empty container
        const initialDoc = new schemas.NotesDocument({
            title: "📚 Collaborative Notes",
            notes: [],
            comments: [],
            votes: [],
            fileAttachments: [],
            activeUsers: [],
            lastNoteId: 0,
            lastCommentId: 0,
            lastVoteId: 0,
            lastUserId: 0,
            lastFileId: 0,
            schemaVersion: SCHEMA_VERSION,
        });
        
        notesData.initialize(initialDoc);
        console.log('✅ Initialized new document');
        isNewContainer = true;
        
    } else if (notesData.compatibility.canUpgrade) {
        console.log('🔧 Upgrading document schema...');
        notesData.upgradeSchema();
        addMissingFields(SCHEMA_VERSION);
        
    } else if (notesData.root) {
        console.log('✅ Joined existing collaboration');
        validateExistingSchema(SCHEMA_VERSION);
        
    } else {
        throw new Error('Schema incompatible - need new container');
    }
    
    return isNewContainer;
}

function addMissingFields(schemaVersion) {
    const fieldsToAdd = [
        { field: 'activeUsers', defaultValue: [] },
        { field: 'votes', defaultValue: [] },
        { field: 'fileAttachments', defaultValue: [] },
        { field: 'lastUserId', defaultValue: 0 },
        { field: 'lastVoteId', defaultValue: 0 },
        { field: 'lastFileId', defaultValue: 0 },
        { field: 'schemaVersion', defaultValue: schemaVersion }
    ];
    
    fieldsToAdd.forEach(({ field, defaultValue }) => {
        if (!notesData.root[field]) {
            notesData.root[field] = defaultValue;
            console.log(`🔧 Added ${field} field during upgrade`);
        }
    });
}

function validateExistingSchema(schemaVersion) {
    const documentVersion = notesData.root.schemaVersion || "v1";
    if (documentVersion !== schemaVersion) {
        console.log(`⚠️ Schema version mismatch: Document(${documentVersion}) vs App(${schemaVersion})`);
    }
    
    const requiredFields = ['votes', 'fileAttachments'];
    for (const field of requiredFields) {
        if (!notesData.root[field]) {
            console.log(`⚠️ Document missing ${field} field - creating new container`);
            throw new Error('Schema incompatible - need new container');
        }
    }
    
    console.log('✅ Schema compatible - joined existing collaboration with', notesData.root.notes.length, 'notes');
}

function setupUserPresence() {
    addActiveUser();
    
    // Set up periodic user presence updates
    setInterval(updateUserPresence, 10000);
    setInterval(cleanupInactiveUsers, 15000);
    
    // Handle page lifecycle events
    window.addEventListener('beforeunload', removeCurrentUser);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateUserPresence();
        }
    });
    
    window.addEventListener('focus', updateUserPresence);
    window.addEventListener('blur', updateUserPresence);
    
    // Activity tracking
    let activityTimeout;
    const updateActivityPresence = () => {
        clearTimeout(activityTimeout);
        updateUserPresence();
        activityTimeout = setTimeout(() => {
            console.log('👤 User became inactive');
        }, 30000);
    };
    
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        document.addEventListener(event, updateActivityPresence);
    });
}

function setupEventListeners() {
    if (window.listenersSetup) return;
    
    console.log('🔗 Setting up real-time event listeners...');
    
    Tree.on(notesData.root, "nodeChanged", handleDataChange);
    
    const arrayFields = ['notes', 'comments', 'votes', 'fileAttachments', 'activeUsers'];
    arrayFields.forEach(field => {
        if (notesData.root[field]) {
            Tree.on(notesData.root[field], "nodeChanged", () => {
                console.log(`📊 ${field} array changed`);
                handleDataChange();
            });
        }
    });
    
    window.listenersSetup = true;
    console.log('✅ Real-time event listeners attached');
}

function handleInitializationError(error) {
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
}