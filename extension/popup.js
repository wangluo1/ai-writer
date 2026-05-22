// Popup — 设置 & 手动输入 & 多语言

const I18N = {
  zh: {
    title: 'AI 写作助手',
    subtitle: '选中文字 · 一键润色 · 中英互译',
    model_label: '模型',
    model_deepseek: 'DeepSeek（推荐 · 最便宜）',
    model_openai: 'OpenAI（质量好）',
    model_custom: '自定义 API（兼容 OpenAI 格式）',
    ui_lang_label: '界面语言',
    lang_zh: '中文',
    lang_en: 'English',
    get_key: '获取 Key',
    cost_ds: '~¥0.002/次',
    cost_oai: '~$0.005/次',
    custom_endpoint: 'API 地址',
    custom_model: '模型名称',
    save: '保存设置',
    manual_label: '手动输入（粘贴文字直接处理）',
    manual_placeholder: '在此粘贴或输入文字...',
    polish: '润色',
    translate: '翻译',
    saved: '已保存 ✓',
    enter_key: '请输入 API Key',
    enter_text: '请先输入文字',
    processing: '处理中...',
    done: '完成 ✓',
  },
  en: {
    title: 'AI Writing Assistant',
    subtitle: 'Select text · Polish · Translate',
    model_label: 'Model',
    model_deepseek: 'DeepSeek (Recommended · Cheapest)',
    model_openai: 'OpenAI (Best quality)',
    model_custom: 'Custom API (OpenAI compatible)',
    ui_lang_label: 'UI Language',
    lang_zh: '中文',
    lang_en: 'English',
    get_key: 'Get Key',
    cost_ds: '~¥0.002/req',
    cost_oai: '~$0.005/req',
    custom_endpoint: 'API Endpoint',
    custom_model: 'Model Name',
    save: 'Save Settings',
    manual_label: 'Manual Input (paste text)',
    manual_placeholder: 'Paste or type text here...',
    polish: 'Polish',
    translate: 'Translate',
    saved: 'Saved ✓',
    enter_key: 'Please enter API Key',
    enter_text: 'Please enter text',
    processing: 'Processing...',
    done: 'Done ✓',
  },
};

let lang = 'zh';

function t(key) {
  return I18N[lang]?.[key] || I18N.zh[key] || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.tagName === 'OPTION') {
      // For select options, we need to update textContent
      el.textContent = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

const provider = document.getElementById('provider');
const uiLangSelect = document.getElementById('ui-lang');
const deepseekSection = document.getElementById('deepseek-section');
const openaiSection = document.getElementById('openai-section');
const customSection = document.getElementById('custom-section');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');
const manualInput = document.getElementById('manual-input');
const polishBtn = document.getElementById('polish-btn');
const translateBtn = document.getElementById('translate-btn');
const manualStatus = document.getElementById('manual-status');

// 模型切换
provider.addEventListener('change', () => {
  const v = provider.value;
  deepseekSection.style.display = v === 'deepseek' ? '' : 'none';
  openaiSection.style.display = v === 'openai' ? '' : 'none';
  customSection.style.display = v === 'custom' ? '' : 'none';
});

// 语言切换
uiLangSelect.addEventListener('change', () => {
  lang = uiLangSelect.value;
  applyI18n();
  // Also update the provider options (which get reset by applyI18n)
  provider.value = provider.dataset.lastValue || 'deepseek';
  provider.dispatchEvent(new Event('change'));
});

// 加载已保存设置
async function load() {
  const data = await chrome.storage.local.get([
    'provider', 'deepseekKey', 'openaiKey', 'customEndpoint', 'customModel', 'customKey', 'uiLang',
  ]);
  if (data.provider) {
    provider.value = data.provider;
    provider.dataset.lastValue = data.provider;
  }
  if (data.deepseekKey) document.getElementById('deepseek-key').value = data.deepseekKey;
  if (data.openaiKey) document.getElementById('openai-key').value = data.openaiKey;
  if (data.customEndpoint) document.getElementById('custom-endpoint').value = data.customEndpoint;
  if (data.customModel) document.getElementById('custom-model').value = data.customModel;
  if (data.customKey) document.getElementById('custom-key').value = data.customKey;
  if (data.uiLang) {
    lang = data.uiLang;
    uiLangSelect.value = data.uiLang;
  }
  applyI18n();
  provider.dispatchEvent(new Event('change'));
}
load();

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
}

// 保存
saveBtn.addEventListener('click', async () => {
  const p = provider.value;
  const settings = { provider: p };

  if (p === 'deepseek') {
    settings.deepseekKey = document.getElementById('deepseek-key').value.trim();
    if (!settings.deepseekKey) return setStatus(statusEl, t('enter_key'), 'err');
  } else if (p === 'openai') {
    settings.openaiKey = document.getElementById('openai-key').value.trim();
    if (!settings.openaiKey) return setStatus(statusEl, t('enter_key'), 'err');
  } else {
    settings.customEndpoint = document.getElementById('custom-endpoint').value.trim();
    settings.customModel = document.getElementById('custom-model').value.trim();
    settings.customKey = document.getElementById('custom-key').value.trim();
    if (!settings.customKey) return setStatus(statusEl, t('enter_key'), 'err');
  }

  settings.uiLang = uiLangSelect.value;

  await chrome.storage.local.set(settings);
  setStatus(statusEl, t('saved'), 'ok');
});

// 手动输入处理
async function doManual(action) {
  const text = manualInput.value.trim();
  if (!text) return setStatus(manualStatus, t('enter_text'), 'err');

  const msgType = action === 'polish' ? 'POLISH' : 'TRANSLATE';
  manualStatus.textContent = t('processing');
  manualStatus.className = 'status';

  try {
    const resp = await chrome.runtime.sendMessage({ type: msgType, text });
    if (resp.success) {
      manualInput.value = resp.final;
      setStatus(manualStatus, t('done'), 'ok');
    } else {
      setStatus(manualStatus, resp.error, 'err');
    }
  } catch (e) {
    setStatus(manualStatus, e.message, 'err');
  }
}

polishBtn.addEventListener('click', () => doManual('polish'));
translateBtn.addEventListener('click', () => doManual('translate'));
