import { GoogleGenerativeAI } from "./libs/google-generative-ai.mjs";

document.addEventListener("DOMContentLoaded", function () {
  const sourceLangSelect = document.getElementById("source-lang");
  const targetLangSelect = document.getElementById("target-lang");
  const inputTextArea = document.getElementById("input-text");
  const outputTextArea = document.getElementById("output-text");
  const switchLangButton = document.getElementById("switch-lang");
  const copyButton = document.getElementById("copy-button");
  const copiedLabel = document.getElementById("copied-label");
  const settingsButton = document.getElementById("settings-button");
  const checkQuotaLink = document.getElementById("check-quota-link");

  let timeoutId;
  let translationDelay = 500; // default delay - matches settings default
  let isSwitching = false; // prevent multiple event calls

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
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value
    });
  }

  function restoreStoredData() {
    chrome.storage.sync.get({
      translationDelay: 1000
    }, (syncResult) => {
      translationDelay = syncResult.translationDelay;

      chrome.storage.local.get(['inputText', 'outputText', 'sourceLang', 'targetLang', 'selectedText', 'fromInPageTranslation'], (result) => {
        // Check if this is from in-page translation
        if (result.fromInPageTranslation && result.selectedText) {
          // Auto-fill with selected text
          inputTextArea.value = result.selectedText;

          // Set source language to auto-detect
          sourceLangSelect.value = '';
          targetLangSelect.value = result.targetLang !== undefined ? result.targetLang : 'vi';

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

          sourceLangSelect.value = result.sourceLang !== undefined ? result.sourceLang : '';
          targetLangSelect.value = result.targetLang !== undefined ? result.targetLang : 'vi';
        }

        inputTextArea.focus();
        if (inputTextArea.value) {
          inputTextArea.select();
        }
      });
    });
  }

  sourceLangSelect.addEventListener('change', () => {
    if (isSwitching) {
      return;
    }

    saveLanguageSettings();

    if (inputTextArea.value.trim()) {
      clearTimeout(timeoutId);
      translateText();
    }
  });

  targetLangSelect.addEventListener('change', () => {
    if (isSwitching) {
      return;
    }

    saveLanguageSettings();

    if (inputTextArea.value.trim()) {
      clearTimeout(timeoutId);
      translateText();
    }
  });

  async function getApiKey() {
    const apiKeyResult = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey'], resolve);
    });

    return apiKeyResult.apiKey ? apiKeyResult.apiKey.trim() : '';
  }

  async function translateText(retryCount = 0) {
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;
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

    const apiKey = await getApiKey();

    if (!apiKey) {
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

      const prompt = getPrompt({ text, sourceLang, targetLang });
      const response = await translateByGemini(prompt, apiKey);

      if (!response) {
        throw new Error("Network response was not ok");
      }

      setOutput(response);

      autoResizeTextarea();
      scrollToBottom();
    } catch (error) {
      console.error("Error:", error);
      handleGeminiError(error, retryCount);
    } finally {
      const outputContainer = document.querySelector(".output-section .textarea-container");
      outputContainer.classList.remove("rainbow-loading");
    }
  }

  function toggleQuotaLink(show) {
    if (typeof checkQuotaLink !== 'undefined' && checkQuotaLink) {
      if (show) {
        checkQuotaLink.classList.remove('hidden');
      } else {
        checkQuotaLink.classList.add('hidden');
      }
    }
  }

  function handleGeminiError(error, retryCount) {
    const errorMessage = error.message || '';

    if (errorMessage.includes('API_KEY')) {
      setOutput("❌ API Key không hợp lệ!\n\nVui lòng kiểm tra lại API Key trong phần Cài đặt.");
      return;
    }

    // Check for Rate Limits (429)
    if (errorMessage.includes('429') || errorMessage.includes('Quota exceeded')) {
      // Show "Check Quota" link
      toggleQuotaLink(true);

      setOutput("⚠️ Quá giới hạn sử dụng!\n\nVui lòng kiểm tra hạn mức sử dụng (nút Kiểm tra bên trên) hoặc thử lại sau.");
      return;
    }

    // Check for Server Errors (503)
    if (errorMessage.includes('503') || errorMessage.includes('The service is currently unavailable')) {
      if (retryCount < 2) {
        setOutput("⌛ Máy chủ Google hiện đang bận! Đang thử lại...");

        setTimeout(() => {
          translateText(retryCount + 1);
        }, 1000);
        return;
      } else {
        setOutput("❌ Máy chủ Google hiện đang bận! Vui lòng thử lại sau.");
        return;
      }
    }

    // Generic Errors
    setOutput(`❌ Lỗi khi dịch: ${errorMessage}\n\nVui lòng thử lại hoặc kiểm tra kết nối mạng.`);
  }

  switchLangButton.addEventListener("click", () => {
    // prevent multiple event calls
    isSwitching = true;

    const sourceLang = sourceLangSelect.value;
    sourceLangSelect.value = targetLangSelect.value;

    if (sourceLang !== '') {
      targetLangSelect.value = sourceLang;
    } else {
      targetLangSelect.value = targetLangSelect.value === 'vi' ? 'en' : 'vi';
    }

    saveLanguageSettings();

    isSwitching = false;

    if (outputTextArea.value !== '') {
      inputTextArea.value = outputTextArea.value;
      translateText();
    }
  });

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

function getPrompt({ text, sourceLang, targetLang }) {
  sourceLang = convertLanguage(sourceLang);
  targetLang = convertLanguage(targetLang);

  return `<instructions>
Translate the following text${sourceLang ? ` from ${sourceLang}` : ""} into ${targetLang}.
</instructions>
<constraints>
- Return only the translation, nothing else.
- Match the tone and style appropriate to the source text.
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

async function translateByGemini(prompt, apiKey) {
  try {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('API_KEY_MISSING');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // The Gemini 2.5-flash-lite models are versatile and work with most use cases
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.2,
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
