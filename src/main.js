// Main entry point - much cleaner now!
import { initializeFluidFramework } from './fluid/client.js';
import { setupUIEventHandlers } from './ui/ui-utils.js';
import { setupGlobalFunctions } from './components/notes-renderer.js';
import './styles/main.css';

console.log('🚀 Starting Collaborative Notes App');

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded - setting up application');
    
    // Set up UI event handlers
    setupUIEventHandlers();
    
    // Make functions globally available for HTML onclick handlers
    setupGlobalFunctions();
    
    // Initialize Fluid Framework
    initializeFluidFramework().catch(error => {
        console.error('Failed to start app:', error);
    });
});

console.log('📱 Collaborative Notes App Loaded');
console.log('🔧 Using Vite for module bundling');
console.log('💡 Tip: Open this URL in multiple tabs to test collaboration!');