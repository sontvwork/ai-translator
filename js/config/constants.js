export const CONFIG = {
  TRANSLATION_DELAY: 500,
  MAX_TEXT_LENGTH: 8000,
  COPY_ANIMATION_DURATION: 2000,
  DEFAULT_TARGET_LANGUAGE: 'vi',
  GEMINI_MODEL: 'gemini-2.0-flash',
  GEMINI_TEMPERATURE: 0.2
};

export const ERROR_MESSAGES = {
  TEXT_TOO_LONG: (current, max) => 
    `❌ Văn bản quá dài!\n\nĐộ dài hiện tại: ${current} ký tự\nGiới hạn tối đa: ${max} ký tự`,
  API_KEY_MISSING: "❌ Chưa cài đặt API Key!\n\nVui lòng nhấn vào nút cài đặt và làm theo hướng dẫn",
  API_KEY_INVALID: "❌ API Key không hợp lệ!\n\nVui lòng kiểm tra lại API Key trong phần Cài đặt.",
  TRANSLATION_ERROR: "❌ Lỗi khi dịch!\n\nVui lòng thử lại hoặc kiểm tra kết nối mạng."
};

export const LANGUAGE_NAMES = {
  en: "tiếng Anh",
  vi: "tiếng Việt", 
  ja: "tiếng Nhật",
  zh: "tiếng Trung",
  ko: "tiếng Hàn"
};

export const STORAGE_KEYS = {
  INPUT_TEXT: 'inputText',
  OUTPUT_TEXT: 'outputText',
  SOURCE_LANG: 'sourceLang',
  TARGET_LANG: 'targetLang',
  API_KEY: 'apiKey',
  TRANSLATION_DELAY: 'translationDelay'
};