import { SchemaFactory, TreeViewConfiguration } from "fluid-framework";

export function createSchemas() {
    const SCHEMA_VERSION = "v2";
    const sf = new SchemaFactory(`collaborativeNotes_${SCHEMA_VERSION}`);

    // Define all schemas
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

    const FileAttachment = sf.object("FileAttachment", {
        id: sf.string,
        noteId: sf.string,
        fileName: sf.string,
        fileType: sf.string,
        fileSize: sf.number,
        fileData: sf.string, // Base64 encoded file data
        uploadedBy: sf.string,
        uploadedAt: sf.string,
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
        fileAttachments: sf.array(FileAttachment),
        activeUsers: sf.array(ActiveUser),
        lastNoteId: sf.number,
        lastCommentId: sf.number,
        lastVoteId: sf.number,
        lastUserId: sf.number,
        lastFileId: sf.number,
        schemaVersion: sf.string,
    });

    const treeViewConfiguration = new TreeViewConfiguration({ schema: NotesDocument });

    const schemas = {
        ActiveUser,
        Vote,
        Comment,
        FileAttachment,
        Note,
        NotesDocument
    };

    return { schemas, treeViewConfiguration };
}