// Welcome page — 首次安装设置

const provider = document.getElementById('provider');
const dsSection = document.getElementById('ds-section');
const oaSection = document.getElementById('oa-section');
const cuSection = document.getElementById('cu-section');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');

provider.addEventListener('change', () => {
  const v = provider.value;
  dsSection.style.display = v === 'deepseek' ? '' : 'none';
  oaSection.style.display = v === 'openai' ? '' : 'none';
  cuSection.style.display = v === 'custom' ? '' : 'none';
});

async function load() {
  const data = await chrome.storage.local.get([
    'provider', 'deepseekKey', 'openaiKey', 'customEndpoint', 'customModel', 'customKey',
  ]);
  if (data.provider) provider.value = data.provider;
  if (data.deepseekKey) document.getElementById('ds-key').value = data.deepseekKey;
  if (data.openaiKey) document.getElementById('oa-key').value = data.openaiKey;
  if (data.customEndpoint) document.getElementById('cu-endpoint').value = data.customEndpoint;
  if (data.customModel) document.getElementById('cu-model').value = data.customModel;
  if (data.customKey) document.getElementById('cu-key').value = data.customKey;
  provider.dispatchEvent(new Event('change'));
}
load();

saveBtn.addEventListener('click', async () => {
  const p = provider.value;
  const settings = { provider: p };

  if (p === 'deepseek') {
    settings.deepseekKey = document.getElementById('ds-key').value.trim();
    if (!settings.deepseekKey) return setStatus('请输入 API Key', 'err');
  } else if (p === 'openai') {
    settings.openaiKey = document.getElementById('oa-key').value.trim();
    if (!settings.openaiKey) return setStatus('请输入 API Key', 'err');
  } else {
    settings.customEndpoint = document.getElementById('cu-endpoint').value.trim();
    settings.customModel = document.getElementById('cu-model').value.trim();
    settings.customKey = document.getElementById('cu-key').value.trim();
    if (!settings.customKey) return setStatus('请输入 API Key', 'err');
  }

  await chrome.storage.local.set(settings);
  setStatus('配置完成！', 'ok');

  // 1.5秒后关闭页面
  setTimeout(() => window.close(), 1500);
});

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}
