(function() {
    let translatorIcon = null;
    let isFeatureEnabled = true;
    let currentSelectedText = '';

    // Debounce function to limit the rate at which a function gets called.
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

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
        const iconY = rect.top - 36; // Position above the selection
        
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
        currentSelectedText = '';
    }

    // Handle icon click
    function handleIconClick(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!currentSelectedText) return;

        chrome.storage.local.set({
            selectedText: currentSelectedText,
            fromInPageTranslation: true
        });

        hideIcon();
        window.getSelection().removeAllRanges();

        // Open the extension popup (this will trigger the popup to auto-fill and translate)
        chrome.runtime.sendMessage({
            action: 'openPopup',
            selectedText: currentSelectedText
        });
    }

    // Handle text selection changes
    function handleSelectionChange() {
        if (!isFeatureEnabled) return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0 && selectedText.length <= 8000) {
            currentSelectedText = selectedText;
            showIcon(selection);
        } else {
            hideIcon();
        }
    }

    // Debounced version of the selection handler
    const debouncedSelectionHandler = debounce(handleSelectionChange, 200);

    // Event listeners
    document.addEventListener('selectionchange', debouncedSelectionHandler);

    // Hide icon when clicking elsewhere, ensuring icon click is still possible
    document.addEventListener('mousedown', (event) => {
        if (translatorIcon && !translatorIcon.contains(event.target)) {
            const selection = window.getSelection();
            if (!selection.toString().trim()) {
                hideIcon();
            }
        }
    });
})();