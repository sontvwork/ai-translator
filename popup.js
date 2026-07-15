import { loadProviderSettings, translate, getApiKeys, getProviderName } from "./providers.js";

document.addEventListener("DOMContentLoaded", function () {
  const targetLangSelect = document.getElementById("target-lang");
  const toneSelect = document.getElementById("tone-select");
  const inputTextArea = document.getElementById("input-text");
  const outputTextArea = document.getElementById("output-text");
  const copyButton = document.getElementById("copy-button");
  const copiedLabel = document.getElementById("copied-label");
  const settingsButton = document.getElementById("settings-button");
  const checkQuotaLink = document.getElementById("check-quota-link");

  let timeoutId;
  let translationDelay = 500; // default delay - matches settings default

  restoreStoredData();

  inputTextArea.addEventListener("input", () => {
    clearTimeout(timeoutId);
    const timeout = inputTextArea.value.trim() === '' ? 0 : translationDelay;

    timeoutId = setTimeout(() => {
      saveInputText();
      translateText();
    }, timeout);
  });

  function saveInputText() {
    chrome.storage.local.set({
      inputText: inputTextArea.value
    });
  }

  function setOutput(text) {
    outputTextArea.value = text;
    saveOutputText();
  }

  function saveOutputText() {
    chrome.storage.local.set({
      outputText: outputTextArea.value
    });
  }

  function saveLanguageSettings() {
    chrome.storage.local.set({
      targetLang: targetLangSelect.value,
      tone: toneSelect.value
    });
  }

  function restoreStoredData() {
    chrome.storage.sync.get({
      translationDelay: 1000
    }, (syncResult) => {
      translationDelay = syncResult.translationDelay;

      chrome.storage.local.get(['inputText', 'outputText', 'targetLang', 'tone', 'selectedText', 'fromInPageTranslation'], (result) => {
        // Check if this is from in-page translation
        if (result.fromInPageTranslation && result.selectedText) {
          // Auto-fill with selected text
          inputTextArea.value = result.selectedText;

          targetLangSelect.value = result.targetLang !== undefined ? result.targetLang : 'vi';
          toneSelect.value = result.tone !== undefined ? result.tone : 'auto';

          // Save the new settings
          saveInputText();
          saveLanguageSettings();

          // Auto-translate
          setTimeout(() => {
            translateText();
          }, 100);

          // Clear the in-page translation flags
          chrome.storage.local.remove(['selectedText', 'fromInPageTranslation']);
        } else {
          // Normal restore behavior
          if (result.inputText) {
            inputTextArea.value = result.inputText;
          }
          if (result.outputText) {
            outputTextArea.value = result.outputText;
            autoResizeTextarea();
          }

          targetLangSelect.value = result.targetLang !== undefined ? result.targetLang : 'vi';
          toneSelect.value = result.tone !== undefined ? result.tone : 'auto';
        }

        inputTextArea.focus();
        if (inputTextArea.value) {
          inputTextArea.select();
        }
      });
    });
  }

  targetLangSelect.addEventListener('change', () => {
    saveLanguageSettings();

    if (inputTextArea.value.trim()) {
      clearTimeout(timeoutId);
      translateText();
    }
  });

  toneSelect.addEventListener('change', () => {
    saveLanguageSettings();

    if (inputTextArea.value.trim()) {
      clearTimeout(timeoutId);
      translateText();
    }
  });

  async function translateText(retryCount = 0) {
    const targetLang = targetLangSelect.value;
    const tone = toneSelect.value;
    const text = inputTextArea.value.trim();

    if (!text) {
      setOutput("");
      return;
    }

    const maxLength = 8000;
    if (text.length > maxLength) {
      setOutput(`❌ Văn bản quá dài!\n\nĐộ dài hiện tại: ${text.length} ký tự\nGiới hạn tối đa: ${maxLength} ký tự`);
      return;
    }

    const settings = await loadProviderSettings();

    if (getApiKeys(settings).length === 0) {
      setOutput("❌ Chưa cài đặt API Key!\n\nVui lòng nhấn vào nút cài đặt và làm theo hướng dẫn");
      return;
    }

    // Hide quota link when starting new translation
    toggleQuotaLink(false);

    try {
      const outputContainer = document.querySelector(".output-section .textarea-container");

      if (retryCount === 0) {
        outputContainer.classList.add("rainbow-loading");
      }

      const prompt = getPrompt({ text, targetLang, tone });
      const response = await translate(prompt, settings, (partialText) => {
        // First token arrived: stop the loading effect and show the stream
        outputContainer.classList.remove("rainbow-loading");
        outputTextArea.value = partialText;
        autoResizeTextarea();
      });

      setOutput(response);

      autoResizeTextarea();
      scrollToBottom();
    } catch (error) {
      console.error("Error:", error);
      handleTranslateError(error, settings.provider, retryCount);
    } finally {
      const outputContainer = document.querySelector(".output-section .textarea-container");
      outputContainer.classList.remove("rainbow-loading");
    }
  }

  const QUOTA_URLS = {
    groq: 'https://console.groq.com/settings/limits',
    openrouter: 'https://openrouter.ai/activity'
  };

  function toggleQuotaLink(show, provider) {
    if (typeof checkQuotaLink !== 'undefined' && checkQuotaLink) {
      if (show) {
        checkQuotaLink.href = QUOTA_URLS[provider] || QUOTA_URLS.groq;
        checkQuotaLink.classList.remove('hidden');
      } else {
        checkQuotaLink.classList.add('hidden');
      }
    }
  }

  function handleTranslateError(error, provider, retryCount) {
    const providerName = getProviderName(provider);

    switch (error.code) {
      case 'API_KEY_MISSING':
        setOutput("❌ Chưa cài đặt API Key!\n\nVui lòng nhấn vào nút cài đặt và làm theo hướng dẫn");
        return;

      case 'API_KEY_INVALID': {
        const keyLabel = error.keyIndex >= 0 ? ` (Key số ${error.keyIndex + 1})` : '';
        setOutput(`❌ API Key không hợp lệ!${keyLabel}\n\nVui lòng kiểm tra lại API Key trong phần Cài đặt.`);
        return;
      }

      case 'RATE_LIMIT': {
        toggleQuotaLink(true, provider);
        const waitTime = formatDuration(error.retryAfterMs);

        if (error.scope === 'day') {
          setOutput(`⚠️ Đã hết hạn mức trong ngày!\n\nTất cả API Key ${providerName} đã chạm giới hạn theo ngày. Key khả dụng lại sau ~${waitTime}.`);
        } else {
          setOutput(`⚠️ Quá giới hạn theo phút!\n\nTất cả API Key ${providerName} đang bị giới hạn. Vui lòng thử lại sau ~${waitTime}.`);
        }
        return;
      }

      case 'NO_CREDITS':
        setOutput("❌ Tài khoản OpenRouter đã hết credits!\n\nVui lòng nạp thêm tại openrouter.ai/credits");
        return;

      case 'MODEL_INVALID':
        setOutput(`❌ Model không hợp lệ!\n\nVui lòng kiểm tra lại tên model ${providerName} trong phần Cài đặt.`);
        return;

      case 'SERVER_ERROR':
        if (retryCount < 2) {
          setOutput(`⌛ Máy chủ ${providerName} hiện đang bận! Đang thử lại...`);

          setTimeout(() => {
            translateText(retryCount + 1);
          }, 1000);
        } else {
          setOutput(`❌ Máy chủ ${providerName} hiện đang bận! Vui lòng thử lại sau.`);
        }
        return;

      // Generic Errors
      default:
        setOutput(`❌ Lỗi khi dịch: ${error.message || ''}\n\nVui lòng thử lại hoặc kiểm tra kết nối mạng.`);
    }
  }

  copyButton.addEventListener("click", async () => {
    const outputText = document.getElementById("output-text").value;
    if (!outputText.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);

      // Copied animation
      copiedLabel.classList.add("show");
      copiedLabel.classList.remove("hidden");
      setTimeout(function () {
        copiedLabel.classList.remove("show");
        copiedLabel.classList.add("hidden");
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  });

  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});

const TONE_INSTRUCTIONS = {
  auto: "Match the tone and style appropriate to the source text.",
  formal: "Use a formal, polite tone suitable for official, business, or professional writing.",
  casual: "Use a casual, friendly, conversational tone like chat or social media.",
  technical: "Use a precise, technical tone; preserve technical terminology and translate closely to the literal meaning."
};

function getPrompt({ text, targetLang, tone = 'auto' }) {
  targetLang = convertLanguage(targetLang);

  return `<instructions>
Translate the following text into ${targetLang}.
</instructions>
<constraints>
- Return only the translation, nothing else.
- ${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.auto}
</constraints>
<source_text>
${text}
</source_text>`;
}

function convertLanguage(language) {
  let output = "";

  switch (language) {
    case "en":
      output = "tiếng Anh";
      break;
    case "vi":
      output = "tiếng Việt";
      break;
    case "ja":
      output = "tiếng Nhật";
      break;
    case "zh":
      output = "tiếng Trung";
      break;
    case "ko":
      output = "tiếng Hàn";
      break;
    default:
      output = language;
      break;
  }

  return output;
}

function formatDuration(ms) {
  const seconds = Math.ceil((ms || 60000) / 1000);
  if (seconds < 90) {
    return `${seconds} giây`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) {
    return `${minutes} phút`;
  }
  return `${Math.ceil(minutes / 60)} giờ`;
}

function autoResizeTextarea() {
  const textarea = document.getElementById("output-text");
  textarea.style.height = "auto";
  const maxHeight = 20 * parseFloat(getComputedStyle(textarea).lineHeight);
  textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
}

function scrollToBottom() {
  // Scroll the container to bring the output section into view
  const outputSection = document.querySelector('.output-section');
  if (outputSection) {
    outputSection.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }
}
