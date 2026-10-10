const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'global',
  scheme: 'socks5',
  host: '127.0.0.1',
  port: 60009,
  fallbackDirect: false,
  bypassLocal: true,
  rules: [
    '*.notion.so',
    'chatgpt.com',
    'github.com'
  ],
  bypassList: [
    '<local>',
    'localhost',
    '127.0.0.1'
  ]
};

let currentConfig = { ...DEFAULT_CONFIG };
let currentActiveTabHost = '';

const masterToggle = document.getElementById('masterToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const conflictAlert = document.getElementById('conflictAlert');
const schemeSelect = document.getElementById('schemeSelect');
const hostInput = document.getElementById('hostInput');
const portInput = document.getElementById('portInput');
const segmentBtns = document.querySelectorAll('.segment-btn');
const ruleCount = document.getElementById('ruleCount');
const listViewBtn = document.getElementById('listViewBtn');
const bulkViewBtn = document.getElementById('bulkViewBtn');
const rulesListView = document.getElementById('rulesListView');
const rulesBulkView = document.getElementById('rulesBulkView');
const rulesList = document.getElementById('rulesList');
const bulkRulesArea = document.getElementById('bulkRulesArea');
const saveBulkBtn = document.getElementById('saveBulkBtn');
const newRuleInput = document.getElementById('newRuleInput');
const addRuleBtn = document.getElementById('addRuleBtn');
const currentTabContainer = document.getElementById('currentTabContainer');
const currentTabHost = document.getElementById('currentTabHost');
const addCurrentTabBtn = document.getElementById('addCurrentTabBtn');
const testerToggle = document.getElementById('testerToggle');
const testerArrow = document.getElementById('testerArrow');
const testerBody = document.getElementById('testerBody');
const testerInput = document.getElementById('testerInput');
const testerResult = document.getElementById('testerResult');
const optionsToggle = document.getElementById('optionsToggle');
const optionsArrow = document.getElementById('optionsArrow');
const optionsBody = document.getElementById('optionsBody');
const bypassLocalCheck = document.getElementById('bypassLocalCheck');
const fallbackDirectCheck = document.getElementById('fallbackDirectCheck');
const toastMessage = document.getElementById('toastMessage');
const reapplyBtn = document.getElementById('reapplyBtn');
const openTabBtn = document.getElementById('openTabBtn');

function showToast(text, duration = 2000) {
  toastMessage.textContent = text;
  toastMessage.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastMessage.classList.add('hidden');
  }, duration);
}

function cleanRulePattern(raw) {
  let val = raw.trim();
  if (!val) return '';
  try {
    if (val.startsWith('http://') || val.startsWith('https://')) {
      const u = new URL(val);
      val = u.hostname;
    }
  } catch (e) {}
  val = val.replace(new RegExp('^[a-z]+://', 'i'), '');
  if (val.indexOf('/') !== -1 && !val.includes('*')) {
    val = val.split('/')[0];
  }
  return val.toLowerCase();
}

function updateStatusUI() {
  if (!currentConfig.enabled) {
    statusDot.className = 'tag';
    statusDot.textContent = '[OFF]';
    statusDot.style.color = '#8b949e';
    statusText.textContent = 'daemon inactive';
    return;
  }

  statusDot.style.color = '';
  const ep = `${currentConfig.scheme}://${currentConfig.host}:${currentConfig.port}`;
  if (currentConfig.mode === 'global') {
    statusDot.className = 'tag ok';
    statusDot.textContent = '[GLOBAL]';
    statusText.textContent = ep;
  } else if (currentConfig.mode === 'selective') {
    statusDot.className = 'tag info';
    statusDot.textContent = '[RULES]';
    const total = currentConfig.rules?.length || 0;
    statusText.textContent = `${ep} (${total} active)`;
  } else if (currentConfig.mode === 'exclude') {
    statusDot.className = 'tag warn';
    statusDot.textContent = '[EXCL]';
    const total = currentConfig.rules?.length || 0;
    statusText.textContent = `${ep} (${total} bypass)`;
  }
}

function renderModeUI() {
  segmentBtns.forEach((btn) => {
    if (btn.dataset.mode === currentConfig.mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderRules() {
  const rules = currentConfig.rules || [];
  ruleCount.textContent = String(rules.length);
  bulkRulesArea.value = rules.join('\n');
  rulesList.innerHTML = '';

  if (rules.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-rules';
    empty.textContent = 'No rules active. Add targets.';
    rulesList.appendChild(empty);
    return;
  }

  rules.forEach((rule, index) => {
    const item = document.createElement('div');
    item.className = 'binding';

    const span = document.createElement('span');
    span.className = 'rule-name';
    span.textContent = rule;

    const delBtn = document.createElement('button');
    delBtn.className = 'rule-delete-btn';
    delBtn.textContent = '[x]';
    delBtn.title = 'Remove rule';
    delBtn.addEventListener('click', async () => {
      currentConfig.rules.splice(index, 1);
      await saveConfig({ rules: currentConfig.rules });
      renderRules();
      evaluateTester();
    });

    item.appendChild(span);
    item.appendChild(delBtn);
    rulesList.appendChild(item);
  });
}

async function saveConfig(partial) {
  currentConfig = { ...currentConfig, ...partial };
  await chrome.storage.local.set(currentConfig);
  updateStatusUI();
  showToast('$ config saved & synced');
}

function evaluateTester() {
  const val = testerInput.value.trim();
  if (!val) {
    testerResult.textContent = 'ready';
    testerResult.className = 'tester-result dir';
    return;
  }

  let host = val.toLowerCase();
  let url = val.toLowerCase();
  try {
    if (val.startsWith('http://') || val.startsWith('https://')) {
      const u = new URL(val);
      host = u.hostname.toLowerCase();
    }
  } catch (e) {}

  if (currentConfig.bypassLocal) {
    if (host === 'localhost' || host === '127.0.0.1' || !host.includes('.')) {
      testerResult.textContent = '[DIRECT] bypassed local host';
      testerResult.className = 'tester-result dir';
      return;
    }
  }

  if (!currentConfig.enabled) {
    testerResult.textContent = '[DIRECT] daemon inactive';
    testerResult.className = 'tester-result dir';
    return;
  }

  const ep = `${currentConfig.scheme}://${currentConfig.host}:${currentConfig.port}`;
  if (currentConfig.mode === 'global') {
    testerResult.textContent = `[PROXIED] ${ep} (global)`;
    testerResult.className = 'tester-result ok';
    return;
  }

  function matches(pattern) {
    pattern = pattern.toLowerCase();
    if (host === pattern) return true;
    if (pattern.includes('/')) {
      const regex = '^' + pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
      return new RegExp(regex, 'i').test(url);
    }
    if (pattern.includes('*')) {
      const regex = '^' + pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
      return new RegExp(regex, 'i').test(host);
    }
    if (pattern.startsWith('.')) {
      const suffix = pattern.substring(1);
      return host === suffix || host.endsWith('.' + suffix);
    }
    return host === pattern || host.endsWith('.' + pattern);
  }

  let matched = false;
  let matchedRule = '';
  for (const r of currentConfig.rules || []) {
    if (matches(r)) {
      matched = true;
      matchedRule = r;
      break;
    }
  }

  if (currentConfig.mode === 'selective') {
    if (matched) {
      testerResult.textContent = `[PROXIED] ${ep} (match: ${matchedRule})`;
      testerResult.className = 'tester-result ok';
    } else {
      testerResult.textContent = '[DIRECT] no matching rule';
      testerResult.className = 'tester-result dir';
    }
  } else if (currentConfig.mode === 'exclude') {
    if (matched) {
      testerResult.textContent = `[DIRECT] excluded by: ${matchedRule}`;
      testerResult.className = 'tester-result dir';
    } else {
      testerResult.textContent = `[PROXIED] ${ep} (not excluded)`;
      testerResult.className = 'tester-result ok';
    }
  }
}

async function checkControlStatus() {
  chrome.runtime.sendMessage({ type: 'CHECK_PROXY_STATUS' }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) return;
    const ctrl = res.details?.levelOfControl;
    if (ctrl === 'controlled_by_other_extensions') {
      conflictAlert.textContent = '[WARN] Another extension controls proxy settings';
      conflictAlert.classList.remove('hidden');
    } else if (ctrl === 'not_controllable') {
      conflictAlert.textContent = '[WARN] Proxy settings locked by browser policy';
      conflictAlert.classList.remove('hidden');
    } else {
      conflictAlert.classList.add('hidden');
    }
  });
}

async function init() {
  const stored = await chrome.storage.local.get(null);
  currentConfig = Object.assign({}, DEFAULT_CONFIG, stored);

  masterToggle.checked = Boolean(currentConfig.enabled);
  schemeSelect.value = currentConfig.scheme || 'socks5';
  hostInput.value = currentConfig.host || '127.0.0.1';
  portInput.value = currentConfig.port || 60009;
  bypassLocalCheck.checked = Boolean(currentConfig.bypassLocal);
  fallbackDirectCheck.checked = Boolean(currentConfig.fallbackDirect);

  renderModeUI();
  renderRules();
  updateStatusUI();
  await checkControlStatus();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const u = new URL(tab.url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        currentActiveTabHost = u.hostname.toLowerCase();
        currentTabHost.textContent = currentActiveTabHost;
        currentTabContainer.classList.remove('hidden');
      }
    }
  } catch (e) {}

  masterToggle.addEventListener('change', async () => {
    await saveConfig({ enabled: masterToggle.checked });
    evaluateTester();
  });

  schemeSelect.addEventListener('change', async () => {
    await saveConfig({ scheme: schemeSelect.value });
    evaluateTester();
  });

  const commitEndpoint = async () => {
    const rawHost = hostInput.value.trim() || '127.0.0.1';
    let rawPort = parseInt(portInput.value, 10);
    if (isNaN(rawPort) || rawPort < 1 || rawPort > 65535) {
      rawPort = 60009;
      portInput.value = rawPort;
    }
    await saveConfig({ host: rawHost, port: rawPort });
    evaluateTester();
  };

  hostInput.addEventListener('change', commitEndpoint);
  portInput.addEventListener('change', commitEndpoint);

  segmentBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      await saveConfig({ mode });
      renderModeUI();
      evaluateTester();
    });
  });

  listViewBtn.addEventListener('click', () => {
    listViewBtn.classList.add('active');
    bulkViewBtn.classList.remove('active');
    rulesListView.classList.remove('hidden');
    rulesBulkView.classList.add('hidden');
  });

  bulkViewBtn.addEventListener('click', () => {
    bulkViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
    rulesBulkView.classList.remove('hidden');
    rulesListView.classList.add('hidden');
    bulkRulesArea.value = (currentConfig.rules || []).join('\n');
  });

  const handleAddRule = async (val) => {
    const clean = cleanRulePattern(val);
    if (!clean) return;
    const rules = currentConfig.rules || [];
    if (!rules.includes(clean)) {
      rules.push(clean);
      await saveConfig({ rules });
      renderRules();
      evaluateTester();
    }
    newRuleInput.value = '';
  };

  addRuleBtn.addEventListener('click', () => {
    handleAddRule(newRuleInput.value);
  });

  newRuleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddRule(newRuleInput.value);
    }
  });

  addCurrentTabBtn.addEventListener('click', () => {
    if (currentActiveTabHost) {
      handleAddRule(currentActiveTabHost);
    }
  });

  saveBulkBtn.addEventListener('click', async () => {
    const lines = bulkRulesArea.value
      .split('\n')
      .map((l) => cleanRulePattern(l))
      .filter((l) => Boolean(l));
    const deduped = Array.from(new Set(lines));
    await saveConfig({ rules: deduped });
    renderRules();
    evaluateTester();
    listViewBtn.click();
  });

  testerToggle.addEventListener('click', () => {
    const isHidden = testerBody.classList.toggle('hidden');
    testerArrow.classList.toggle('rotated', !isHidden);
  });

  testerInput.addEventListener('input', evaluateTester);

  optionsToggle.addEventListener('click', () => {
    const isHidden = optionsBody.classList.toggle('hidden');
    optionsArrow.classList.toggle('rotated', !isHidden);
  });

  bypassLocalCheck.addEventListener('change', async () => {
    await saveConfig({ bypassLocal: bypassLocalCheck.checked });
    evaluateTester();
  });

  fallbackDirectCheck.addEventListener('change', async () => {
    await saveConfig({ fallbackDirect: fallbackDirectCheck.checked });
  });

  reapplyBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'APPLY_NOW' }, (res) => {
      if (res && res.ok) {
        showToast('$ proxy rules synced');
      } else {
        showToast('$ error applying proxy');
      }
    });
  });

  openTabBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

document.addEventListener('DOMContentLoaded', init);
