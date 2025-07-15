import { STORAGE_KEYS, CONFIG } from '../config/constants.js';

export class StorageService {
  static async saveInputText(text) {
    return chrome.storage.local.set({
      [STORAGE_KEYS.INPUT_TEXT]: text
    });
  }

  static async saveOutputText(text) {
    return chrome.storage.local.set({
      [STORAGE_KEYS.OUTPUT_TEXT]: text
    });
  }

  static async saveLanguageSettings(sourceLang, targetLang) {
    return chrome.storage.local.set({
      [STORAGE_KEYS.SOURCE_LANG]: sourceLang,
      [STORAGE_KEYS.TARGET_LANG]: targetLang
    });
  }

  static async getApiKey() {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEYS.API_KEY], resolve);
    });
    
    return result[STORAGE_KEYS.API_KEY] ? result[STORAGE_KEYS.API_KEY].trim() : '';
  }

  static async getTranslationDelay() {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get({
        [STORAGE_KEYS.TRANSLATION_DELAY]: CONFIG.TRANSLATION_DELAY
      }, resolve);
    });
    
    return result[STORAGE_KEYS.TRANSLATION_DELAY];
  }

  static async getStoredData() {
    const syncData = await new Promise((resolve) => {
      chrome.storage.sync.get({
        [STORAGE_KEYS.TRANSLATION_DELAY]: CONFIG.TRANSLATION_DELAY
      }, resolve);
    });

    const localData = await new Promise((resolve) => {
      chrome.storage.local.get([
        STORAGE_KEYS.INPUT_TEXT,
        STORAGE_KEYS.OUTPUT_TEXT,
        STORAGE_KEYS.SOURCE_LANG,
        STORAGE_KEYS.TARGET_LANG
      ], resolve);
    });

    return {
      translationDelay: syncData[STORAGE_KEYS.TRANSLATION_DELAY],
      inputText: localData[STORAGE_KEYS.INPUT_TEXT] || '',
      outputText: localData[STORAGE_KEYS.OUTPUT_TEXT] || '',
      sourceLang: localData[STORAGE_KEYS.SOURCE_LANG] !== undefined ? localData[STORAGE_KEYS.SOURCE_LANG] : '',
      targetLang: localData[STORAGE_KEYS.TARGET_LANG] !== undefined ? localData[STORAGE_KEYS.TARGET_LANG] : CONFIG.DEFAULT_TARGET_LANGUAGE
    };
  }
}