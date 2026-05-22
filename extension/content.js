// AI 写作助手 — 选中任意文字，一键润色或翻译

// 调试标记：右下角小紫点 = content script 已加载
(function() {
  const dot = document.createElement('div');
  dot.id = 'aiw-loaded-dot';
  dot.style.cssText = 'position:fixed;bottom:8px;right:8px;width:8px;height:8px;background:#7c3aed;border-radius:50%;z-index:2147483647;opacity:0.6';
  document.documentElement.appendChild(dot);
  console.log('[AI Writer] content script loaded, dot visible at bottom-right');
})();

let menu = null;
let panel = null;
let selectedText = '';
let selRange = null;
let replaceTarget = null;
let replaceStart = 0;
let replaceEnd = 0;
let uiLang = 'zh'; // 界面语言，默认中文

// 加载界面语言设置
chrome.storage.local.get('uiLang').then(({ uiLang: lang }) => {
  if (lang) uiLang = lang;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.uiLang) uiLang = changes.uiLang.newValue || 'zh';
});

// 标签映射
const LABELS = {
  zh: { polish: '润色', translateToEn: '译成英文', translateToZh: '译成中文' },
  en: { polish: 'Polish', translateToEn: 'Translate to English', translateToZh: 'Translate to Chinese' },
};

function getLabel(key) { return LABELS[uiLang]?.[key] || LABELS.zh[key]; }

// ═══════════════════════════════════════════
// 浮动菜单
// ═══════════════════════════════════════════

function createMenu() {
  if (menu) return;
  menu = document.createElement('div');
  menu.id = 'aiw-menu';
  menu.innerHTML = `
    <button data-action="polish" class="aiw-menu-btn aiw-menu-polish"></button>
    <button data-action="translate" class="aiw-menu-btn aiw-menu-translate"></button>
  `;
  menu.addEventListener('mousedown', e => e.preventDefault());
  menu.addEventListener('click', handleMenuClick);
  document.body.appendChild(menu);
}

function showMenu(x, y, isChinese) {
  createMenu();
  const polishBtn = menu.querySelector('[data-action="polish"]');
  const translateBtn = menu.querySelector('[data-action="translate"]');

  if (isChinese) {
    polishBtn.textContent = getLabel('polish');
    translateBtn.textContent = getLabel('translateToEn');
  } else {
    polishBtn.textContent = getLabel('polish');
    translateBtn.textContent = getLabel('translateToZh');
  }

  // 确保不超出屏幕
  const mw = 160, mh = 36;
  const vw = window.innerWidth, vy = window.scrollY, vh = window.innerHeight;

  let left = x, top = y;
  if (left + mw > vw - 8) left = vw - mw - 8;
  if (top < vy + 8) top = vy + 8;
  if (top + mh > vy + vh - 8) top = vy + vh - mh - 8;
  if (left < 8) left = 8;

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.classList.add('visible');
}

function hideMenu() {
  if (menu) menu.classList.remove('visible');
}

// ═══════════════════════════════════════════
// 结果面板
// ═══════════════════════════════════════════

function createPanel() {
  if (panel) return;
  panel = document.createElement('div');
  panel.id = 'aiw-panel';
  panel.innerHTML = `
    <div class="aiw-panel-header">
      <div class="aiw-panel-label">
        <div class="aiw-panel-dot"></div>
        <span class="aiw-panel-label-text"></span>
      </div>
      <button class="aiw-panel-close">✕</button>
    </div>
    <div class="aiw-output">
      <div class="aiw-loading">
        <div class="aiw-spinner"></div>
        <div class="aiw-step-label">处理中...</div>
      </div>
    </div>
    <div class="aiw-actions" style="display:none">
      <button class="aiw-act-btn aiw-act-copy">复制</button>
      <button class="aiw-act-btn aiw-act-replace">替换原文</button>
    </div>
  `;
  panel.querySelector('.aiw-panel-close').addEventListener('click', hidePanel);
  panel.querySelector('.aiw-act-copy').addEventListener('click', copyResult);
  panel.querySelector('.aiw-act-replace').addEventListener('click', replaceText);
  document.body.appendChild(panel);
}

function showPanel(x, y, label) {
  createPanel();
  // 更新标签
  panel.querySelector('.aiw-panel-label-text').textContent = label;
  // 重置加载状态
  const output = panel.querySelector('.aiw-output');
  output.innerHTML = `
    <div class="aiw-loading">
      <div class="aiw-spinner"></div>
      <div class="aiw-step-label">处理中...</div>
    </div>
  `;
  panel.querySelector('.aiw-actions').style.display = 'none';

  // 贴着选中区域
  const vw = window.innerWidth, vy = window.scrollY, vh = window.innerHeight;
  const margin = 12;
  let left = x, top = y;
  if (left + 480 > vw - margin) left = vw - 480 - margin;
  if (left < margin) left = margin;
  if (top + 300 > vy + vh - margin) top = y - 300;
  if (top < vy + margin) top = vy + margin;

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.classList.add('visible');
}

function hidePanel() {
  if (panel) panel.classList.remove('visible');
}

// ═══════════════════════════════════════════
// 语言检测
// ═══════════════════════════════════════════

function detectLang(text) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  return total > 0 && cjk / total > 0.3;
}

// ═══════════════════════════════════════════
// 选中文字 → 弹出菜单
// ═══════════════════════════════════════════

function onSelection() {
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || text.length < 2) { hideMenu(); return; }

  selectedText = text;
  try { selRange = sel.getRangeAt(0); } catch { return; }
  let rect = selRange.getBoundingClientRect();

  // 文本框内的选区可能返回 zero rect，用元素位置代替
  if (!rect || !rect.width) {
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
      rect = active.getBoundingClientRect();
    }
    if (!rect || !rect.width) return;
  }

  const isChinese = detectLang(text);
  showMenu(rect.right + window.scrollX + 6, rect.top + window.scrollY - 40, isChinese);

  // 记录替换目标（选区所在元素 + 位置）
  const active = document.activeElement;
  if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
    replaceTarget = active;
    replaceStart = active.selectionStart;
    replaceEnd = active.selectionEnd;
  } else if (active?.isContentEditable) {
    replaceTarget = active;
    replaceStart = 0;
    replaceEnd = 0;
  } else {
    replaceTarget = null;
  }
}

// selectionchange 更可靠（包括输入框内选中）
document.addEventListener('selectionchange', onSelection);

// mouseup 作为双保险
document.addEventListener('mouseup', () => setTimeout(onSelection, 10));

// 点击空白关闭
document.addEventListener('mousedown', e => {
  if (menu && !menu.contains(e.target)) hideMenu();
  if (panel && !panel.contains(e.target)) hidePanel();
});

// ESC 关闭
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hideMenu(); hidePanel(); }
});

// ═══════════════════════════════════════════
// 输入框内：快捷键直接处理全部内容
// ═══════════════════════════════════════════

let activeTextareaForReplace = null;

document.addEventListener('keydown', e => {
  if (!e.metaKey && !e.ctrlKey) return;
  const active = document.activeElement;
  const isInput = active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable);
  if (!isInput) return;

  const text = (active.value || active.textContent || '').trim();
  if (!text) return;

  e.preventDefault();
  e.stopPropagation();

  // 使用当前选中文本（如有），否则用全部内容
  const target = selectedText && selectedText.length > 0 ? selectedText : text;
  if (target === text) {
    // 没选中特定文字，对全部内容操作
    selectedText = text;
    selRange = null;
    activeTextareaForReplace = active;
    replaceTarget = active;
    replaceStart = 0;
    replaceEnd = active.value ? active.value.length : 0;
  }

  if (e.key === 'e' || e.key === 'E') {
    const rect = active.getBoundingClientRect();
    showPanel(rect.right + window.scrollX + 8, rect.top + window.scrollY, getLabel('polish'));
    doRewrite('POLISH');
  } else if (e.key === 't' || e.key === 'T') {
    const rect = active.getBoundingClientRect();
    const label = detectLang(selectedText || (active.value || active.textContent || ''))
      ? getLabel('translateToEn') : getLabel('translateToZh');
    showPanel(rect.right + window.scrollX + 8, rect.top + window.scrollY, label);
    doRewrite('TRANSLATE');
  }
});

// ═══════════════════════════════════════════
// 菜单点击
// ═══════════════════════════════════════════

async function handleMenuClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const action = btn.dataset.action;
  const isChinese = detectLang(selectedText);
  const label = action === 'polish'
    ? getLabel('polish')
    : (isChinese ? getLabel('translateToEn') : getLabel('translateToZh'));

  hideMenu();

  const rect = selRange?.getBoundingClientRect();
  const sx = rect ? rect.right + window.scrollX + 8 : 200;
  const sy = rect ? rect.top + window.scrollY : 200;
  showPanel(sx, sy, label);

  await doRewrite(action === 'polish' ? 'POLISH' : 'TRANSLATE');
}

async function doRewrite(msgType) {
  if (!panel) return;
  const output = panel.querySelector('.aiw-output');
  const actions = panel.querySelector('.aiw-actions');
  const label = panel.querySelector('.aiw-step-label');
  const spinner = panel.querySelector('.aiw-spinner');

  try {
    if (!chrome?.runtime?.sendMessage) {
      // 扩展已重载，自动刷新页面
      window.location.reload();
      return;
    }

    const resp = await chrome.runtime.sendMessage({ type: msgType, text: selectedText });

    if (!resp.success) {
      output.innerHTML = `<div class="aiw-error">${resp.error}</div>`;
      return;
    }

    // 用 loading 区的 spinner 和 label 引用，清掉后填入结果
    output.textContent = resp.final;
    actions.style.display = 'flex';
  } catch (err) {
    output.innerHTML = `<div class="aiw-error">${err.message}</div>`;
  }
}

// ═══════════════════════════════════════════
// 面板按钮
// ═══════════════════════════════════════════

function copyResult() {
  const el = panel?.querySelector('.aiw-output');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = panel.querySelector('.aiw-act-copy');
    if (btn) { btn.textContent = '已复制 ✓'; setTimeout(() => { btn.textContent = '复制'; }, 2000); }
  });
}

function replaceText() {
  const el = panel?.querySelector('.aiw-output');
  if (!el) return;
  const text = el.textContent;

  try {
    // 优先用保存的替换目标
    const target = replaceTarget || activeTextareaForReplace;

    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
      // 用保存的选区位置替换
      const s = replaceStart, e = replaceEnd;
      if (s !== e) {
        // 有选区：替换选中部分
        target.value = target.value.slice(0, s) + text + target.value.slice(e);
      } else {
        // 无选区：替换全部内容
        target.value = text;
      }
      target.focus();
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (target?.isContentEditable) {
      target.focus();
      document.execCommand('selectAll');
      document.execCommand('insertText', false, text);
    } else if (selRange) {
      // 普通网页文本
      selRange.deleteContents();
      selRange.insertNode(document.createTextNode(text));
    } else {
      navigator.clipboard.writeText(text);
    }
  } catch {
    navigator.clipboard.writeText(text);
  }

  replaceTarget = null;
  replaceStart = 0;
  replaceEnd = 0;
  activeTextareaForReplace = null;
  hidePanel();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
