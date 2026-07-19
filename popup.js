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
  const historyButton = document.getElementById("history-button");
  const historyPopover = document.getElementById("history-popover");
  const historyList = document.getElementById("history-list");
  const historyClearButton = document.getElementById("history-clear-button");

  let timeoutId;
  let translationDelay = 500; // default delay - matches settings default
  let clearConfirmTimeoutId;
  let renderedHistory = []; // records currently shown, keeps click indices in sync

  setupSelectPopover(targetLangSelect);
  setupSelectPopover(toneSelect);

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
      saveToHistory(text, response);

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

  function saveToHistory(source, translated) {
    if (!source || !translated || !translated.trim()) {
      return;
    }

    chrome.storage.local.get({ translationHistory: [] }, (result) => {
      const history = Array.isArray(result.translationHistory) ? result.translationHistory : [];
      const record = { source, translated, timestamp: Date.now() };
      const newest = history[0];

      if (newest && (newest.source.startsWith(source) || source.startsWith(newest.source))) {
        // Typing continuation: replace newest instead of adding
        history[0] = record;
      } else {
        const dupIndex = history.findIndex((item) => item.source === source);
        if (dupIndex !== -1) {
          history.splice(dupIndex, 1);
        }
        history.unshift(record);
      }

      chrome.storage.local.set({ translationHistory: history.slice(0, 5) }, () => {
        if (!historyPopover.classList.contains("hidden")) {
          renderHistory();
        }
      });
    });
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
      }, 1000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  });

  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  function renderHistory() {
    chrome.storage.local.get({ translationHistory: [] }, (result) => {
      renderedHistory = Array.isArray(result.translationHistory) ? result.translationHistory : [];
      historyList.replaceChildren();

      if (renderedHistory.length === 0) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Chưa có lịch sử dịch";
        historyList.appendChild(empty);
        return;
      }

      renderedHistory.forEach((record, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "history-item";
        item.dataset.index = index;

        const top = document.createElement("div");
        top.className = "history-item-top";

        const source = document.createElement("span");
        source.className = "history-item-source";
        source.textContent = record.source;

        const time = document.createElement("span");
        time.className = "history-item-time";
        time.textContent = formatRelativeTime(record.timestamp);

        top.append(source, time);

        const translated = document.createElement("div");
        translated.className = "history-item-translated";
        translated.textContent = record.translated;

        item.append(top, translated);
        historyList.appendChild(item);
      });
    });
  }

  function openHistoryPopover() {
    renderHistory();
    historyPopover.classList.remove("hidden");
  }

  function closeHistoryPopover() {
    historyPopover.classList.add("hidden");
    resetClearConfirm();
  }

  historyButton.addEventListener("click", () => {
    if (historyPopover.classList.contains("hidden")) {
      openHistoryPopover();
    } else {
      closeHistoryPopover();
    }
  });

  document.addEventListener("click", (event) => {
    if (historyPopover.classList.contains("hidden")) {
      return;
    }
    if (historyPopover.contains(event.target) || historyButton.contains(event.target)) {
      return;
    }
    closeHistoryPopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !historyPopover.classList.contains("hidden")) {
      closeHistoryPopover();
    }
  });

  historyList.addEventListener("click", (event) => {
    const item = event.target.closest(".history-item");
    if (!item) {
      return;
    }

    const record = renderedHistory[Number(item.dataset.index)];
    if (!record) {
      return;
    }

    clearTimeout(timeoutId); // cancel pending debounce so it can't re-translate
    inputTextArea.value = record.source;
    saveInputText();
    setOutput(record.translated);
    autoResizeTextarea();
    closeHistoryPopover();
  });

  function resetClearConfirm() {
    clearTimeout(clearConfirmTimeoutId);
    historyClearButton.classList.remove("confirming");
    historyClearButton.textContent = "Xóa hết";
  }

  historyClearButton.addEventListener("click", () => {
    if (historyClearButton.classList.contains("confirming")) {
      chrome.storage.local.set({ translationHistory: [] }, () => {
        resetClearConfirm();
        renderHistory();
      });
    } else {
      historyClearButton.classList.add("confirming");
      historyClearButton.textContent = "Xác nhận?";
      clearConfirmTimeoutId = setTimeout(resetClearConfirm, 3000);
    }
  });
});

const selectPopoverClosers = [];

// Replaces the native dropdown of a <select> with a custom popover.
// The <select> stays as the trigger and source of truth, so .value,
// change events and programmatic restores keep working unchanged.
function setupSelectPopover(select) {
  const container = select.parentElement;
  const popover = document.createElement("div");
  popover.className = "select-popover hidden";

  Array.from(select.options).forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "select-popover-item";
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    popover.appendChild(item);
  });

  container.appendChild(popover);

  function syncSelectedItem() {
    popover.querySelectorAll(".select-popover-item").forEach((item) => {
      item.classList.toggle("selected", item.dataset.value === select.value);
    });
  }

  function openPopover() {
    selectPopoverClosers.forEach((closeOther) => closeOther());
    syncSelectedItem();
    popover.classList.remove("hidden");
  }

  function closePopover() {
    popover.classList.add("hidden");
  }

  function togglePopover() {
    if (popover.classList.contains("hidden")) {
      openPopover();
    } else {
      closePopover();
    }
  }

  selectPopoverClosers.push(closePopover);

  select.addEventListener("mousedown", (event) => {
    event.preventDefault(); // block the native dropdown
    select.focus();
    togglePopover();
  });

  select.addEventListener("keydown", (event) => {
    const isToggleKey = event.key === "Enter" || event.key === " " ||
      (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp"));

    if (isToggleKey) {
      event.preventDefault();
      togglePopover();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // Keep arrow-key value cycling without opening the native picker
      event.preventDefault();
      const nextIndex = select.selectedIndex + (event.key === "ArrowDown" ? 1 : -1);
      if (nextIndex >= 0 && nextIndex < select.options.length) {
        select.selectedIndex = nextIndex;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  select.addEventListener("change", syncSelectedItem);

  popover.addEventListener("click", (event) => {
    const item = event.target.closest(".select-popover-item");
    if (!item) {
      return;
    }

    if (select.value !== item.dataset.value) {
      select.value = item.dataset.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closePopover();
  });

  document.addEventListener("click", (event) => {
    if (popover.classList.contains("hidden") || container.contains(event.target)) {
      return;
    }
    closePopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popover.classList.contains("hidden")) {
      closePopover();
    }
  });
}

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

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return "vừa xong";
  }

  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

  if (minutes < 60) {
    return rtf.format(-minutes, "minute");
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return rtf.format(-hours, "hour");
  }

  const days = Math.floor(hours / 24);
  if (days <= 3) {
    return rtf.format(-days, "day");
  }

  const date = new Date(timestamp);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function autoResizeTextarea() {
  const textarea = document.getElementById("output-text");
  textarea.style.height = "auto";
  const maxHeight = 20 * parseFloat(getComputedStyle(textarea).lineHeight);
  textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
}

function scrollToBottom() {
  // The popup has two clipped scrollers: .container (overflow-y: auto) and the
  // popup viewport (Chrome caps the window at 600px while .container can be
  // taller). Scroll both all the way down.
  const container = document.querySelector('.container');
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: 'smooth'
  });
}
