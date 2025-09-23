import { SharedTree, TreeViewConfiguration, Tree } from "fluid-framework";
import { AzureClient } from "@fluidframework/azure-client";
import { createSchemas } from './schemas.js';
import { handleDataChange, addSampleNote } from './data-handlers.js';
import { addActiveUser, updateUserPresence, removeCurrentUser, cleanupInactiveUsers } from '../components/user-presence.js';
import { renderAllNotes } from '../components/notes-renderer.js';
import { updateConnectionStatus, showCollaborationInfo } from '../ui/ui-utils.js';
import { AzureConfig } from './config.js';

// Global variables
export let fluidContainer = null;
export let notesData = null;
export let currentUser = 'User' + Math.floor(Math.random() * 1000);

console.log('👤 Current user:', currentUser);

export async function initializeFluidFramework() {
    try {
        console.log('🔧 Initializing Fluid Framework with Azure...');
        
        const client = new AzureClient({
            connection: {
                tenantId: AzureConfig.tenantId,
                endpoint: AzureConfig.serviceEndpoint,
                type: "remote",
                tokenProvider: async () => {
                    const token = await AzureConfig.getToken();
                    return {
                        token: token.jwt,
                        expiresOn: token.expiresOn
                    };
                },
            },
        });
        console.log('✅ Azure Fluid Relay client created');
        
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
        updateConnectionStatus('connected', '🔗 Connected to Azure Fluid Relay - Real-time collaboration active!');
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

async function getOrCreateContainer(client, containerSchema) {
    let container, id;
    
    if (location.hash) {
        id = location.hash.substring(1);
        try {
            container = await client.getContainer(id, containerSchema);
            console.log('✅ Loaded existing container for collaboration:', id);
        } catch (error) {
            console.log("Container load failed, creating new one:", error.message);
            const createResponse = await client.createContainer(containerSchema);
            container = createResponse.container;
            id = createResponse.id;
            location.hash = id;
            console.log('✅ Created new container:', id);
        }
    } else {
        const createResponse = await client.createContainer(containerSchema);
        container = createResponse.container;
        id = createResponse.id;
        location.hash = id;
        console.log('✅ Created new container:', id);
    }
    
    return { container, id };
}

async function handleSchemaCompatibility(schemas) {
    const SCHEMA_VERSION = "v3"; // Updated to v3 for file support
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
        console.log('✅ Initialized new document with file support');
        isNewContainer = true;
        
    } else if (notesData.compatibility.canUpgrade) {
        console.log('🔧 Upgrading document schema...');
        notesData.upgradeSchema();
        addMissingFields(SCHEMA_VERSION);
        
        // Upgrade existing notes to include files array
        upgradeNotesToIncludeFiles();
        
    } else if (notesData.root) {
        console.log('✅ Joined existing collaboration');
        validateExistingSchema(SCHEMA_VERSION);
        
        // Ensure existing notes have files array
        upgradeNotesToIncludeFiles();
        
    } else {
        throw new Error('Schema incompatible - need new container');
    }
    
    return isNewContainer;
}

function upgradeNotesToIncludeFiles() {
    if (!notesData.root.notes) return;
    
    const notes = Array.from(notesData.root.notes);
    let upgradedCount = 0;
    
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (!note.files) {
            // Create empty files array for the upgrade
            const emptyFiles = [];
            
            // Create a new note with files array
            const upgradedNote = new window.Note({
                id: note.id,
                title: note.title,
                content: note.content,
                author: note.author,
                timestamp: note.timestamp,
                votes: note.votes || 0,
                parentId: note.parentId || "",
                level: note.level || 0,
                files: emptyFiles, // Add empty files array
            });
            
            // Replace the old note
            notesData.root.notes.removeAt(i);
            notesData.root.notes.insertAt(i, upgradedNote);
            upgradedCount++;
        }
    }
    
    if (upgradedCount > 0) {
        console.log(`🔧 Upgraded ${upgradedCount} notes to include files support`);
    }
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
    
    const requiredFields = ['votes'];
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
    updateConnectionStatus('error', '⚠️ Failed to connect to Azure Fluid Relay');
    
    document.getElementById('notesContainer').innerHTML = `
        <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px;">
            <h3>🚫 Connection Failed</h3>
            <p>Could not connect to Azure Fluid Relay.</p>
            <p><strong>Error:</strong> ${error.message}</p>
            ${error.message.includes('Schema incompatible') ? 
                '<p><strong>Note:</strong> If you see "Schema incompatible", the app will create a new document with the updated features.</p>' : 
                ''
            }
        </div>
    `;
}