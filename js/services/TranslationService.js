import { GoogleGenerativeAI } from '../../libs/google-generative-ai.mjs';
import { CONFIG, ERROR_MESSAGES } from '../config/constants.js';
import { LanguageHelper } from './LanguageHelper.js';
import { StorageService } from './StorageService.js';

export class TranslationService {
  static async validateInput(text) {
    if (!text) {
      return { isValid: true, message: '' };
    }

    if (text.length > CONFIG.MAX_TEXT_LENGTH) {
      return {
        isValid: false,
        message: ERROR_MESSAGES.TEXT_TOO_LONG(text.length, CONFIG.MAX_TEXT_LENGTH)
      };
    }

    return { isValid: true, message: '' };
  }

  static async validateApiKey() {
    const apiKey = await StorageService.getApiKey();
    
    if (!apiKey) {
      return {
        isValid: false,
        message: ERROR_MESSAGES.API_KEY_MISSING
      };
    }

    return { isValid: true, apiKey };
  }

  static async translateByGemini(prompt, apiKey) {
    try {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('API_KEY_MISSING');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: CONFIG.GEMINI_MODEL,
        generationConfig: {
          temperature: CONFIG.GEMINI_TEMPERATURE,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim().replace(/,$/, '');
      return responseText;
    } catch (error) {
      console.log(error);
      if (error.message && error.message.includes('API key')) {
        throw new Error('API_KEY_INVALID');
      }
      throw error;
    }
  }

  static async translate({ text, sourceLang, targetLang }) {
    const inputValidation = await this.validateInput(text);
    if (!inputValidation.isValid) {
      return { success: false, message: inputValidation.message };
    }

    if (!text) {
      return { success: true, message: '' };
    }

    const apiKeyValidation = await this.validateApiKey();
    if (!apiKeyValidation.isValid) {
      return { success: false, message: apiKeyValidation.message };
    }

    try {
      const prompt = LanguageHelper.getPrompt({ text, sourceLang, targetLang });
      const translatedText = await this.translateByGemini(prompt, apiKeyValidation.apiKey);
      
      return { success: true, message: translatedText };
    } catch (error) {
      console.error("Translation error:", error);
      
      if (error.message.includes('API_KEY')) {
        return { success: false, message: ERROR_MESSAGES.API_KEY_INVALID };
      } else {
        return { success: false, message: ERROR_MESSAGES.TRANSLATION_ERROR };
      }
    }
  }
}