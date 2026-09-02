import { loadProviderSettings, DEFAULT_GROQ_MODEL, DEFAULT_MISTRAL_MODEL, DEFAULT_OPENROUTER_MODEL, MAX_API_KEYS } from './providers.js';

const MODEL_OPTIONS = {
    'groq-model': [
        { id: 'qwen/qwen3.8-27b', desc: 'Chất lượng dịch rất tốt (9/10) · Tốc độ tuyệt vời  ⭐' },
        { id: 'openai/gpt-oss-120b', desc: 'Chất lượng dịch tốt (8/10)' },
    ],
    'mistral-model': [
        { id: 'mistral-medium-3-5', desc: 'Chất lượng dịch tốt (9/10)  ⭐' },
        { id: 'mistral-small-2603', desc: 'Nhanh · Phù hợp dịch cơ bản' }
    ],
    'openrouter-model': [
        { id: 'google/gemini-2.5-flash-lite', desc: 'Chất lượng dịch tốt (9/10)  ⭐' },
        { id: 'inclusionai/ling-2.6-flash', desc: 'Siêu rẻ · Chất lượng cơ bản, dùng dự phòng' }
    ]
};
const CUSTOM_MODEL = { id: '__custom__', name: '✏️ Tự nhập model', desc: 'Nhập ID model bất kỳ của nhà cung cấp' };

document.addEventListener('DOMContentLoaded', function() {
    const groqModelInput = document.getElementById('groq-model');
    const mistralModelInput = document.getElementById('mistral-model');
    const openRouterModelInput = document.getElementById('openrouter-model');
    const groqSettingsGroup = document.getElementById('groq-settings');
    const mistralSettingsGroup = document.getElementById('mistral-settings');
    const openRouterSettingsGroup = document.getElementById('openrouter-settings');
    const providerRadios = document.querySelectorAll('input[name="provider"]');
    const providerCards = document.querySelectorAll('.provider-card');
    const providerTrigger = document.getElementById('provider-trigger');
    const providerMenu = document.getElementById('provider-menu');
    const providerTriggerMono = document.getElementById('provider-trigger-mono');
    const providerTriggerName = document.getElementById('provider-trigger-name');
    const providerTriggerSub = document.getElementById('provider-trigger-sub');
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
    const mistralKeyList = createKeyListManager(
        document.getElementById('mistral-key-list'),
        document.getElementById('add-mistral-key'),
        document.getElementById('mistral-key-count'),
        'Nhập Mistral API Key...'
    );
    const openRouterKeyList = createKeyListManager(
        document.getElementById('openrouter-key-list'),
        document.getElementById('add-openrouter-key'),
        document.getElementById('openrouter-key-count'),
        'Nhập OpenRouter API Key...'
    );

    const modelSelects = {};
    document.querySelectorAll('.model-select').forEach(function(root) {
        modelSelects[root.dataset.input] = setupModelSelect(root);
    });

    loadSettings();

    providerRadios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            updateProviderVisibility();
            setMenuOpen(false);
        });
    });

    providerTrigger.addEventListener('click', function() {
        setMenuOpen(providerMenu.hidden);
    });

    document.addEventListener('click', function(e) {
        closeMenusOutside(e.target);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeMenusOutside(null);
        }
    });

    function closeMenusOutside(target) {
        document.querySelectorAll('.provider-select').forEach(function(select) {
            if (target && select.contains(target)) return;
            select.querySelector('.provider-menu').hidden = true;
            select.querySelector('.provider-trigger').setAttribute('aria-expanded', 'false');
        });
    }

    function setMenuOpen(open) {
        providerMenu.hidden = !open;
        providerTrigger.setAttribute('aria-expanded', String(open));
    }

    function setupModelSelect(root) {
        const input = document.getElementById(root.dataset.input);
        const trigger = root.querySelector('.provider-trigger');
        const triggerName = root.querySelector('.provider-card-name');
        const triggerSub = root.querySelector('.provider-card-subtitle');
        const menu = root.querySelector('.provider-menu');
        const options = MODEL_OPTIONS[root.dataset.input].concat(CUSTOM_MODEL);

        const cards = options.map(function(option) {
            const card = document.createElement('div');
            card.className = 'provider-card';
            card.setAttribute('role', 'option');

            const text = document.createElement('span');
            text.className = 'provider-card-text';
            const name = document.createElement('span');
            name.className = 'provider-card-name';
            name.textContent = option.name || option.id;
            const subtitle = document.createElement('span');
            subtitle.className = 'provider-card-subtitle';
            subtitle.textContent = option.desc;
            text.appendChild(name);
            text.appendChild(subtitle);

            const check = document.createElement('span');
            check.className = 'provider-check';
            check.textContent = '✓';

            card.appendChild(text);
            card.appendChild(check);
            card.addEventListener('click', function() {
                select(option, true);
                menu.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
            });
            menu.appendChild(card);
            return card;
        });

        trigger.addEventListener('click', function() {
            const willOpen = menu.hidden;
            closeMenusOutside(null);
            menu.hidden = !willOpen;
            trigger.setAttribute('aria-expanded', String(willOpen));
        });

        function select(option, fromClick) {
            const isCustom = option.id === CUSTOM_MODEL.id;
            options.forEach(function(o, i) {
                cards[i].classList.toggle('active', o.id === option.id);
            });
            triggerName.textContent = option.name || option.id;
            triggerSub.textContent = option.desc;
            input.hidden = !isCustom;
            if (fromClick) {
                if (isCustom) {
                    input.value = '';
                    input.focus();
                } else {
                    input.value = option.id;
                }
            }
        }

        return {
            setValue: function(model) {
                const preset = options.find(function(o) { return o.id === model; });
                input.value = model;
                select(preset || CUSTOM_MODEL, false);
            }
        };
    }

    function updateSavedProviderBadge(savedProvider) {
        providerCards.forEach(function(card) {
            card.classList.toggle('is-saved', card.querySelector('input').value === savedProvider);
        });
    }

    function updateProviderVisibility() {
        const provider = document.querySelector('input[name="provider"]:checked').value;
        groqSettingsGroup.hidden = provider !== 'groq';
        mistralSettingsGroup.hidden = provider !== 'mistral';
        openRouterSettingsGroup.hidden = provider !== 'openrouter';
        providerCards.forEach(function(card) {
            const isActive = card.querySelector('input').value === provider;
            card.classList.toggle('active', isActive);
            if (isActive) {
                providerTriggerMono.src = card.querySelector('.provider-mono').src;
                providerTriggerName.textContent = card.querySelector('.provider-card-name').textContent;
                providerTriggerSub.textContent = card.querySelector('.provider-card-subtitle').textContent;
            }
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
        updateSavedProviderBadge(providerSettings.provider);
        groqKeyList.setKeys(providerSettings.groqApiKeys);
        modelSelects['groq-model'].setValue(providerSettings.groqModel);
        mistralKeyList.setKeys(providerSettings.mistralApiKeys);
        modelSelects['mistral-model'].setValue(providerSettings.mistralModel);
        openRouterKeyList.setKeys(providerSettings.openRouterApiKeys);
        modelSelects['openrouter-model'].setValue(providerSettings.openRouterModel);

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
            mistralApiKeys: mistralKeyList.getKeys(),
            mistralModel: mistralModelInput.value.trim() || DEFAULT_MISTRAL_MODEL,
            openRouterApiKeys: openRouterKeyList.getKeys(),
            openRouterModel: openRouterModelInput.value.trim() || DEFAULT_OPENROUTER_MODEL,
            translationDelay: Number.parseInt(translationDelayInput.value, 10),
            inPageTranslationEnabled: inPageTranslationInput.checked
        };

        chrome.storage.sync.set(settings, function() {
            updateSavedProviderBadge(settings.provider);
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
