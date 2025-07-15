import { LANGUAGE_NAMES } from '../config/constants.js';

export class LanguageHelper {
  static convertLanguage(language) {
    return LANGUAGE_NAMES[language] || language;
  }

  static getPrompt({ text, sourceLang, targetLang }) {
    const sourceLanguageName = this.convertLanguage(sourceLang);
    const targetLanguageName = this.convertLanguage(targetLang);

    let prompt = `- Yêu cầu: Dịch đoạn sau${
      sourceLanguageName ? " từ " + sourceLanguageName : ""
    } sang ${targetLanguageName}
- Lưu ý: `;

    prompt += `Chỉ trả về bản dịch, không kèm thông tin gì khác. `;
    prompt += `Chú ý tới văn phong cho phù hợp với đoạn văn bản.`;
    prompt += `\n- Đoạn văn bản cần dịch:\n`;
    prompt += `\`\`\`\n`;
    prompt += text;
    prompt += `\n\`\`\``;

    return prompt;
  }
}