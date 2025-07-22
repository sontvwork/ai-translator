// Background script for AI Translator extension

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openPopup') {
        // Open the popup when requested from content script
        chrome.action.openPopup();
    }
});