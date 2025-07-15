import { CONFIG } from '../config/constants.js';
import { StorageService } from '../services/StorageService.js';
import { TranslationService } from '../services/TranslationService.js';

export class UIController {
  constructor() {
    this.elements = {};
    this.timeoutId = null;
    this.translationDelay = CONFIG.TRANSLATION_DELAY;
    this.isSwitching = false;
    
    this.initializeElements();
    this.setupEventListeners();
    this.restoreStoredData();
  }

  initializeElements() {
    this.elements = {
      sourceLangSelect: document.getElementById("source-lang"),
      targetLangSelect: document.getElementById("target-lang"),
      inputTextArea: document.getElementById("input-text"),
      outputTextArea: document.getElementById("output-text"),
      switchLangButton: document.getElementById("switch-lang"),
      copyButton: document.getElementById("copy-button"),
      copiedLabel: document.getElementById("copied-label"),
      settingsButton: document.getElementById("settings-button"),
      outputContainer: document.querySelector(".output-section .textarea-container")
    };
  }

  setupEventListeners() {
    this.elements.inputTextArea.addEventListener("input", () => this.handleInputChange());
    this.elements.sourceLangSelect.addEventListener('change', () => this.handleLanguageChange());
    this.elements.targetLangSelect.addEventListener('change', () => this.handleLanguageChange());
    this.elements.switchLangButton.addEventListener("click", () => this.handleLanguageSwitch());
    this.elements.copyButton.addEventListener("click", () => this.handleCopy());
    this.elements.settingsButton.addEventListener("click", () => this.handleSettingsClick());
  }

  async restoreStoredData() {
    const data = await StorageService.getStoredData();
    
    this.translationDelay = data.translationDelay;
    
    if (data.inputText) {
      this.elements.inputTextArea.value = data.inputText;
    }
    
    if (data.outputText) {
      this.elements.outputTextArea.value = data.outputText;
      this.autoResizeTextarea();
    }
    
    this.elements.sourceLangSelect.value = data.sourceLang;
    this.elements.targetLangSelect.value = data.targetLang;
    
    this.elements.inputTextArea.focus();
    if (this.elements.inputTextArea.value) {
      this.elements.inputTextArea.select();
    }
  }

  handleInputChange() {
    clearTimeout(this.timeoutId);
    const timeout = this.elements.inputTextArea.value.trim() === '' ? 0 : this.translationDelay;
    
    this.timeoutId = setTimeout(() => {
      this.saveInputText();
      this.translateText();
    }, timeout);
  }

  handleLanguageChange() {
    if (this.isSwitching) {
      return;
    }

    this.saveLanguageSettings();

    if (this.elements.inputTextArea.value.trim()) {
      clearTimeout(this.timeoutId);
      this.translateText();
    }
  }

  handleLanguageSwitch() {
    this.isSwitching = true;
    
    const sourceLang = this.elements.sourceLangSelect.value;
    this.elements.sourceLangSelect.value = this.elements.targetLangSelect.value;

    if (sourceLang !== '') {
      this.elements.targetLangSelect.value = sourceLang;
    } else {
      this.elements.targetLangSelect.value = this.elements.targetLangSelect.value === 'vi' ? 'en' : 'vi';
    }
    
    this.saveLanguageSettings();
    this.isSwitching = false;

    if (this.elements.outputTextArea.value !== '') {
      this.elements.inputTextArea.value = this.elements.outputTextArea.value;
      this.translateText();
    }
  }

  async handleCopy() {
    const outputText = this.elements.outputTextArea.value;
    if (!outputText.trim()) {
      return;
    }
    
    try {
      await navigator.clipboard.writeText(outputText);
      this.showCopiedAnimation();
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  handleSettingsClick() {
    chrome.runtime.openOptionsPage();
  }

  showCopiedAnimation() {
    this.elements.copiedLabel.classList.add("show");
    this.elements.copiedLabel.classList.remove("hidden");
    
    setTimeout(() => {
      this.elements.copiedLabel.classList.remove("show");
      this.elements.copiedLabel.classList.add("hidden");
    }, CONFIG.COPY_ANIMATION_DURATION);
  }

  showLoadingState() {
    this.elements.outputContainer.classList.add("rainbow-loading");
  }

  hideLoadingState() {
    this.elements.outputContainer.classList.remove("rainbow-loading");
  }

  async translateText() {
    const sourceLang = this.elements.sourceLangSelect.value;
    const targetLang = this.elements.targetLangSelect.value;
    const text = this.elements.inputTextArea.value.trim();

    try {
      this.showLoadingState();

      const result = await TranslationService.translate({ text, sourceLang, targetLang });
      
      this.elements.outputTextArea.value = result.message;
      await StorageService.saveOutputText(result.message);

      if (result.success && result.message) {
        this.autoResizeTextarea();
        this.scrollToBottom();
      }
    } finally {
      this.hideLoadingState();
    }
  }

  async saveInputText() {
    await StorageService.saveInputText(this.elements.inputTextArea.value);
  }

  async saveLanguageSettings() {
    await StorageService.saveLanguageSettings(
      this.elements.sourceLangSelect.value,
      this.elements.targetLangSelect.value
    );
  }

  autoResizeTextarea() {
    const textarea = this.elements.outputTextArea;
    textarea.style.height = "auto";
    const maxHeight = 20 * parseFloat(getComputedStyle(textarea).lineHeight);
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
  }

  scrollToBottom() {
    const outputSection = document.querySelector('.output-section');
    if (outputSection) {
      outputSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    }
  }
}