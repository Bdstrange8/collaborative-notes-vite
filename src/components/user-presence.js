import { notesData, currentUser } from '../fluid/client.js';

export function addActiveUser() {
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

export function updateUserPresence() {
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

export function removeCurrentUser() {
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

export function cleanupInactiveUsers() {
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

export function updateActiveUsersList() {
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