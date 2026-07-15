import { loadProviderSettings, DEFAULT_GROQ_MODEL, DEFAULT_OPENROUTER_MODEL, MAX_API_KEYS } from './providers.js';

document.addEventListener('DOMContentLoaded', function() {
    const groqModelInput = document.getElementById('groq-model');
    const openRouterModelInput = document.getElementById('openrouter-model');
    const groqSettingsGroup = document.getElementById('groq-settings');
    const openRouterSettingsGroup = document.getElementById('openrouter-settings');
    const providerRadios = document.querySelectorAll('input[name="provider"]');
    const providerCards = document.querySelectorAll('.provider-card');
    const translationDelayInput = document.getElementById('translation-delay');
    const delayValueSpan = document.getElementById('delay-value');
    const inPageTranslationInput = document.getElementById('in-page-translation');
    const saveButton = document.getElementById('save-settings');
    const successMessage = document.getElementById('success-message');

    const groqKeyList = createKeyListManager(
        document.getElementById('groq-key-list'),
        document.getElementById('add-groq-key'),
        document.getElementById('groq-key-count'),
        'Nhập Groq API Key...'
    );
    const openRouterKeyList = createKeyListManager(
        document.getElementById('openrouter-key-list'),
        document.getElementById('add-openrouter-key'),
        document.getElementById('openrouter-key-count'),
        'Nhập OpenRouter API Key...'
    );

    loadSettings();

    providerRadios.forEach(function(radio) {
        radio.addEventListener('change', updateProviderVisibility);
    });

    function updateProviderVisibility() {
        const provider = document.querySelector('input[name="provider"]:checked').value;
        groqSettingsGroup.hidden = provider !== 'groq';
        openRouterSettingsGroup.hidden = provider !== 'openrouter';
        providerCards.forEach(function(card) {
            card.classList.toggle('active', card.querySelector('input').value === provider);
        });
    }

    function createKeyListManager(listContainer, addButton, countBadge, placeholder) {
        addButton.addEventListener('click', function() {
            addRow('');
            updateAfterChange();
        });

        function addRow(value) {
            const row = document.createElement('div');
            row.className = 'api-key-row';

            const index = document.createElement('span');
            index.className = 'api-key-index';

            const inputContainer = document.createElement('div');
            inputContainer.className = 'api-key-container';

            const input = document.createElement('input');
            input.type = 'password';
            input.className = 'modern-input';
            input.placeholder = placeholder;
            input.value = value;

            const toggleButton = document.createElement('button');
            toggleButton.type = 'button';
            toggleButton.className = 'toggle-password';
            toggleButton.textContent = '👁️';
            setupPasswordToggle(input, toggleButton);

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-key-button';
            removeButton.textContent = '✕';
            removeButton.title = 'Xoá key này';
            removeButton.addEventListener('click', function() {
                row.remove();
                if (listContainer.children.length === 0) {
                    addRow('');
                }
                updateAfterChange();
            });

            inputContainer.appendChild(input);
            row.appendChild(index);
            row.appendChild(inputContainer);
            row.appendChild(toggleButton);
            row.appendChild(removeButton);
            listContainer.appendChild(row);
        }

        function updateAfterChange() {
            updateIndexes();
            updateAddButtonVisibility();
            updateCountBadge();
        }

        function updateIndexes() {
            listContainer.querySelectorAll('.api-key-row').forEach(function(row, i) {
                row.querySelector('.api-key-index').textContent = `#${i + 1}`;
            });
        }

        function updateAddButtonVisibility() {
            addButton.hidden = listContainer.children.length >= MAX_API_KEYS;
        }

        function updateCountBadge() {
            countBadge.textContent = `${listContainer.children.length}/${MAX_API_KEYS}`;
        }

        return {
            getKeys: function() {
                return Array.from(listContainer.querySelectorAll('input'))
                    .map(input => input.value.trim())
                    .filter(Boolean)
                    .slice(0, MAX_API_KEYS);
            },
            setKeys: function(keys) {
                listContainer.replaceChildren();
                const values = keys.length > 0 ? keys.slice(0, MAX_API_KEYS) : [''];
                values.forEach(addRow);
                updateAfterChange();
            }
        };
    }

    translationDelayInput.addEventListener('input', function() {
        delayValueSpan.textContent = this.value;
    });

    saveButton.addEventListener('click', function() {
        saveSettings();
    });

    async function loadSettings() {
        const providerSettings = await loadProviderSettings();

        document.querySelector(`input[name="provider"][value="${providerSettings.provider}"]`).checked = true;
        updateProviderVisibility();
        groqKeyList.setKeys(providerSettings.groqApiKeys);
        groqModelInput.value = providerSettings.groqModel;
        openRouterKeyList.setKeys(providerSettings.openRouterApiKeys);
        openRouterModelInput.value = providerSettings.openRouterModel;

        chrome.storage.sync.get({
            translationDelay: 500,
            inPageTranslationEnabled: true
        }, function(result) {
            translationDelayInput.value = result.translationDelay;
            delayValueSpan.textContent = result.translationDelay;
            inPageTranslationInput.checked = result.inPageTranslationEnabled;
        });
    }

    function saveSettings() {
        const settings = {
            provider: document.querySelector('input[name="provider"]:checked').value,
            groqApiKeys: groqKeyList.getKeys(),
            groqModel: groqModelInput.value.trim() || DEFAULT_GROQ_MODEL,
            openRouterApiKeys: openRouterKeyList.getKeys(),
            openRouterModel: openRouterModelInput.value.trim() || DEFAULT_OPENROUTER_MODEL,
            translationDelay: Number.parseInt(translationDelayInput.value, 10),
            inPageTranslationEnabled: inPageTranslationInput.checked
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

function setupPasswordToggle(input, button) {
    button.addEventListener('click', function() {
        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
        } else {
            input.type = 'password';
            button.textContent = '👁️';
        }
    });
}
