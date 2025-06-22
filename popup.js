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

  let timeoutId;
  let translationDelay = 500; // default delay - matches settings default
  let isSwitching = false; // flag để ngăn chặn sự kiện dư thừa khi switch language

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
      
      chrome.storage.local.get(['inputText', 'outputText', 'sourceLang', 'targetLang'], (result) => {
        if (result.inputText) {
          inputTextArea.value = result.inputText;
        }
        if (result.outputText) {
          outputTextArea.value = result.outputText;
          autoResizeTextarea();
        }
        
        sourceLangSelect.value = result.sourceLang !== undefined ? result.sourceLang : '';
        targetLangSelect.value = result.targetLang !== undefined ? result.targetLang : 'vi';
        
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

  async function translateText() {
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;
    const text = inputTextArea.value.trim();

    if (!text) {
      outputTextArea.value = "";
      saveOutputText();
      return;
    }

    const apiKey = await getApiKey();

    if (!apiKey) {
      outputTextArea.value = "❌ Chưa cài đặt API Key!\n\nVui lòng nhấn vào nút cài đặt và làm theo hướng dẫn";
      saveOutputText();
      return;
    }

    try {
      const outputContainer = document.querySelector(".output-section .textarea-container");
      outputContainer.classList.add("rainbow-loading");

      const prompt = getPrompt({ text, sourceLang, targetLang });
      const response = await translateByGemini(prompt, apiKey);

      if (!response) {
        throw new Error("Network response was not ok");
      }

      outputTextArea.value = response;
      saveOutputText();

      autoResizeTextarea();
      scrollToBottom();
    } catch (error) {
      console.error("Error:", error);
      if (error.message.includes('API_KEY')) {
        outputTextArea.value = "❌ API Key không hợp lệ!\n\nVui lòng kiểm tra lại API Key trong phần Cài đặt.";
      } else {
        outputTextArea.value = "❌ Lỗi khi dịch!\n\nVui lòng thử lại hoặc kiểm tra kết nối mạng.";
      }
      saveOutputText();
    } finally {
      const outputContainer = document.querySelector(".output-section .textarea-container");
      outputContainer.classList.remove("rainbow-loading");
    }
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
      setTimeout(function(){
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

  let prompt = `- Yêu cầu: Dịch đoạn sau${
    sourceLang ? " từ " + sourceLang : ""
  } sang ${targetLang}
- Lưu ý: `;

  prompt += `Chỉ trả về bản dịch, không kèm thông tin gì khác. `;
  prompt += `Chú ý tới văn phong cho phù hợp với đoạn văn bản.`
  prompt += `\n- Đoạn văn bản cần dịch:\n`;
  prompt += `\`\`\`\n`;
  prompt += text;
  prompt += `\n\`\`\``;

  return prompt;
}

function convertLanguage(language) {
  let output = "";

  switch(language) {
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

    // Access your API key from settings
    const genAI = new GoogleGenerativeAI(apiKey);

    // The Gemini 2.0 models are versatile and work with most use cases
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
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
