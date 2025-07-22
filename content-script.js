(function() {
    let translatorIcon = null;
    let isFeatureEnabled = true;
    let hideTimeout = null;

    // Load settings from storage
    function loadSettings() {
        chrome.storage.sync.get({
            inPageTranslationEnabled: true
        }, (result) => {
            isFeatureEnabled = result.inPageTranslationEnabled;
        });
    }

    // Initialize the feature
    loadSettings();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.inPageTranslationEnabled) {
            isFeatureEnabled = changes.inPageTranslationEnabled.newValue;
            if (!isFeatureEnabled && translatorIcon) {
                hideIcon();
            }
        }
    });

    // Create the translator icon element
    function createTranslatorIcon() {
        if (translatorIcon) {
            translatorIcon.remove();
        }

        translatorIcon = document.createElement('div');
        translatorIcon.className = 'ai-translator-icon';
        translatorIcon.setAttribute('title', 'Dịch văn bản đã chọn');
        
        // Add click event listener
        translatorIcon.addEventListener('click', handleIconClick);
        
        document.body.appendChild(translatorIcon);
        return translatorIcon;
    }

    // Position the icon near the selected text
    function positionIcon(selection) {
        if (!translatorIcon) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position the icon above the selection
        const iconX = rect.left + (rect.width / 2) - 16; // Center horizontally
        const iconY = rect.top - 40; // Position above the selection
        
        // Ensure the icon stays within viewport bounds
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollX = window.pageXOffset;
        const scrollY = window.pageYOffset;
        
        let finalX = Math.max(10, Math.min(iconX, viewportWidth - 42));
        let finalY = iconY;
        
        // If there's not enough space above, position below
        if (finalY < scrollY + 10) {
            finalY = rect.bottom + 10;
        }
        
        translatorIcon.style.left = (finalX + scrollX) + 'px';
        translatorIcon.style.top = (finalY + scrollY) + 'px';
    }

    // Show the translator icon
    function showIcon(selection) {
        if (!isFeatureEnabled) return;

        if (!translatorIcon) {
            createTranslatorIcon();
        }

        positionIcon(selection);
        
        // Clear any existing hide timeout
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        // Show the icon with animation
        requestAnimationFrame(() => {
            translatorIcon.classList.add('show');
        });
    }

    // Hide the translator icon
    function hideIcon() {
        if (translatorIcon) {
            translatorIcon.classList.remove('show');
        }
    }

    // Handle icon click
    function handleIconClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const selectedText = window.getSelection().toString().trim();
        if (!selectedText) return;

        // Store the selected text and open popup
        chrome.storage.local.set({
            selectedText: selectedText,
            fromInPageTranslation: true
        });

        // Hide the icon
        hideIcon();

        // Clear selection
        window.getSelection().removeAllRanges();

        // Open the extension popup (this will trigger the popup to auto-fill and translate)
        chrome.runtime.sendMessage({
            action: 'openPopup',
            selectedText: selectedText
        });
    }

    // Handle text selection
    function handleSelection() {
        if (!isFeatureEnabled) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0 && selectedText.length <= 8000) {
            // Show icon after a short delay to avoid showing it during drag
            setTimeout(() => {
                const currentSelection = window.getSelection();
                const currentText = currentSelection.toString().trim();
                
                if (currentText === selectedText && currentText.length > 0) {
                    showIcon(currentSelection);
                }
            }, 100);
        } else {
            // Schedule hide with delay to allow for icon clicking
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
            
            hideTimeout = setTimeout(() => {
                hideIcon();
            }, 200);
        }
    }

    // Event listeners
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', (event) => {
        // Handle keyboard selection (Shift + arrow keys, Ctrl+A, etc.)
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            setTimeout(handleSelection, 10);
        }
    });

    // Hide icon when clicking elsewhere
    document.addEventListener('click', (event) => {
        if (translatorIcon && !translatorIcon.contains(event.target)) {
            // Add delay to allow for icon clicking
            setTimeout(() => {
                const selection = window.getSelection();
                if (!selection.toString().trim()) {
                    hideIcon();
                }
            }, 100);
        }
    });

    // Hide icon when scrolling
    let scrollTimeout = null;
    document.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
            const selection = window.getSelection();
            if (selection.toString().trim() && translatorIcon) {
                positionIcon(selection);
            }
        }, 100);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        const selection = window.getSelection();
        if (selection.toString().trim() && translatorIcon) {
            positionIcon(selection);
        }
    });
})();