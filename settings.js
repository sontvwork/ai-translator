document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('api-key');
    const togglePasswordButton = document.getElementById('toggle-password');
    const translationDelayInput = document.getElementById('translation-delay');
    const delayValueSpan = document.getElementById('delay-value');
    const saveButton = document.getElementById('save-settings');
    const successMessage = document.getElementById('success-message');

    loadSettings();

    // Toggle password visibility
    togglePasswordButton.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            togglePasswordButton.textContent = '🙈';
        } else {
            apiKeyInput.type = 'password';
            togglePasswordButton.textContent = '👁️';
        }
    });

    translationDelayInput.addEventListener('input', function() {
        delayValueSpan.textContent = this.value;
    });

    saveButton.addEventListener('click', function() {
        saveSettings();
    });

    function loadSettings() {
        chrome.storage.sync.get({
            apiKey: '',
            translationDelay: 500
        }, function(result) {
            apiKeyInput.value = result.apiKey;
            translationDelayInput.value = result.translationDelay;
            delayValueSpan.textContent = result.translationDelay;
        });
    }

    function saveSettings() {
        const settings = {
            apiKey: apiKeyInput.value.trim(),
            translationDelay: parseInt(translationDelayInput.value)
        };

        chrome.storage.sync.set(settings, function() {
            showSuccessMessage();
        });
    }

    function showSuccessMessage() {
        successMessage.classList.remove('hide');
        successMessage.classList.add('show');
        
        setTimeout(function() {
            successMessage.classList.remove('show');
            successMessage.classList.add('hide');
            
            // Remove hide class after animation completes
            setTimeout(function() {
                successMessage.classList.remove('hide');
            }, 300);
        }, 3000);
    }

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveSettings();
        }
    });
}); 