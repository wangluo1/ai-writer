// AI 写作助手 — 润色 & 中英互译
// 3-Agent 流水线: Writer→Checker→Editor

// ─── 模型配置 ───

const MODELS = {
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
  },
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
};

async function getConfig() {
  const { provider, deepseekKey, openaiKey, customEndpoint, customModel, customKey } =
    await chrome.storage.local.get([
      'provider', 'deepseekKey', 'openaiKey', 'customEndpoint', 'customModel', 'customKey',
    ]);

  let apiKey, endpoint, model;
  if (provider === 'openai') {
    apiKey = openaiKey;
    endpoint = MODELS.openai.endpoint;
    model = MODELS.openai.model;
  } else if (provider === 'custom') {
    apiKey = customKey;
    endpoint = customEndpoint || 'https://api.openai.com/v1/chat/completions';
    model = customModel || 'gpt-4o-mini';
  } else {
    // default: deepseek
    apiKey = deepseekKey;
    endpoint = MODELS.deepseek.endpoint;
    model = MODELS.deepseek.model;
  }

  if (!apiKey) throw new Error('请先设置 API Key（点扩展图标 → 粘贴 → 保存）');
  return { apiKey, endpoint, model };
}

// ─── LLM 调用 ───

async function chat(messages, temperature = 0.7) {
  const { apiKey, endpoint, model } = await getConfig();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 2048 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── 语言检测 ───

function isChinese(text) {
  // 中文字符占比 > 30% 判定为中文
  const chinese = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  return total > 0 && chinese / total > 0.3;
}

// ─── 润色 Pipeline (同语言提升) ───

const POLISH_PROMPTS = {
  writer: {
    zh: `你是专业中文写作者。润色以下文字，使其更流畅、更有力，但保持原意和风格。

原文：
"""
{text}
"""

润色后：`,
    en: `You are a professional English writer. Polish the following text to be clearer, more engaging, and impactful. Keep the original meaning.

Original:
"""
{text}
"""

Polished:`,
  },
  checker: {
    zh: `你是严格的中文编辑。对照原文，审查润色稿是否有问题：
- 是否保持原意？有无歪曲？
- 有没有生硬的表达？
- 有没有可以改进的地方？
- 语气是否合适？

原文：
"""
{original}
"""

润色稿：
"""
{rewritten}
"""

列出问题（如无问题写"无"）。要挑剔。`,
    en: `You are a meticulous English editor. Compare the polished version against the original. Find ANY issues:
- Does it preserve the original meaning?
- Any awkward phrasing?
- Anything that could be improved?
- Tone appropriate?

Original:
"""
{original}
"""

Polished:
"""
{rewritten}
"""

List issues (or "NONE" if perfect). Be critical.`,
  },
  editor: {
    zh: `你是资深中文编辑。根据以下问题修复文本。

问题：
"""
{issues}
"""

文本：
"""
{rewritten}
"""

输出修复后的终稿（只输出文本）：`,
    en: `You are a senior English editor. Fix the issues identified below.

Issues:
"""
{issues}
"""

Text:
"""
{rewritten}
"""

Output the final corrected version (text only):`,
  },
};

async function polish(text) {
  const zh = isChinese(text);
  const lang = zh ? 'zh' : 'en';

  const rewritten = await chat([
    { role: 'system', content: zh ? '你是一名专业中文写作者，只输出润色后的文本。' : 'You are a professional writer. Output only the polished text.' },
    { role: 'user', content: POLISH_PROMPTS.writer[lang].replace('{text}', text) },
  ], 0.7);

  const issues = await chat([
    { role: 'system', content: zh ? '你是一名严格的中文编辑，挑剔地审查文本。' : 'You are a meticulous editor. Be critical.' },
    { role: 'user', content: POLISH_PROMPTS.checker[lang].replace('{original}', text).replace('{rewritten}', rewritten) },
  ], 0.3);

  const final = issues.includes('无') || issues.toUpperCase().includes('NONE')
    ? rewritten
    : await chat([
        { role: 'system', content: zh ? '你是一名资深中文编辑，只输出修复后的文本。' : 'You are a senior editor. Output only the final text.' },
        { role: 'user', content: POLISH_PROMPTS.editor[lang].replace('{issues}', issues).replace('{rewritten}', rewritten) },
      ], 0.5);

  return { rewritten, issues, final };
}

// ─── 翻译 Pipeline (中↔英) ───

async function translate(text) {
  const zh = isChinese(text);
  const sourceLang = zh ? '中文' : 'English';
  const targetLang = zh ? 'English' : '中文';

  // Writer: 翻译
  const translated = await chat([
    { role: 'system', content: `你是一名专业翻译，将${sourceLang}翻译成${targetLang}。只输出译文。` },
    { role: 'user', content: `将以下${sourceLang}翻译成自然、地道的${targetLang}：\n\n"""\n${text}\n"""` },
  ], 0.3);

  // Checker: 审查翻译准确性
  const issues = await chat([
    { role: 'system', content: `你是翻译审校，对照原文检查译文。用${targetLang}列出问题。` },
    { role: 'user', content: `对照原文，审查译文：
- 意思翻译准确吗？
- 有没有漏译或添油加醋？
- 表达自然吗？像母语者写的吗？
- 专有名词/数字是否正确？

原文（${sourceLang}）：
"""
${text}
"""

译文（${targetLang}）：
"""
${translated}
"""

列出问题（精确翻译无误、表达自然则写"无"）：` },
  ], 0.3);

  // Editor: 修复
  const final = issues.includes('无') || issues.toUpperCase().includes('NONE')
    ? translated
    : await chat([
        { role: 'system', content: `你是资深翻译编辑，只输出修正后的译文。` },
        { role: 'user', content: `修复以下译文的问题，用${targetLang}输出：\n\n问题：\n"""\n${issues}\n"""\n\n译文：\n"""\n${translated}\n"""` },
      ], 0.4);

  return { rewritten: translated, issues, final };
}

// ─── 首次安装：自动打开设置页 ───

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html'),
    });
  }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'POLISH') {
    polish(req.text).then(r => sendResponse({ success: true, ...r })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (req.type === 'TRANSLATE') {
    translate(req.text).then(r => sendResponse({ success: true, ...r })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (req.type === 'DETECT_LANG') {
    sendResponse({ isChinese: isChinese(req.text) });
    return false;
  }
});
