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

function buildPacScript(config) {
  const scheme = config.scheme || 'socks5';
  const host = config.host || '127.0.0.1';
  const port = config.port || 60009;

  let proxyKeyword = 'SOCKS5';
  if (scheme === 'socks4') {
    proxyKeyword = 'SOCKS';
  } else if (scheme === 'http') {
    proxyKeyword = 'PROXY';
  } else if (scheme === 'https') {
    proxyKeyword = 'HTTPS';
  }

  const proxyTarget = `${proxyKeyword} ${host}:${port}`;
  const targetWithFallback = config.fallbackDirect ? `${proxyTarget}; DIRECT` : proxyTarget;
  const rules = (config.rules || []).map((r) => r.trim()).filter(Boolean);
  const bypass = config.bypassLocal ? ['<local>', 'localhost', '127.0.0.1'] : [];
  const rulesJson = JSON.stringify(rules);
  const bypassJson = JSON.stringify(bypass);
  const isSelective = config.mode === 'selective';

  return `function FindProxyForURL(url, host) {
  var proxy = "${targetWithFallback}";
  var rules = ${rulesJson};
  var bypass = ${bypassJson};
  var hostLower = host.toLowerCase();
  var urlLower = url.toLowerCase();

  for (var b = 0; b < bypass.length; b++) {
    var bp = bypass[b].toLowerCase();
    if (bp === "<local>" && isPlainHostName(host)) return "DIRECT";
    if (hostLower === bp) return "DIRECT";
  }

  function matches(pattern) {
    if (!pattern) return false;
    pattern = pattern.toLowerCase();
    if (hostLower === pattern) return true;
    if (pattern.indexOf('/') !== -1) return shExpMatch(urlLower, pattern);
    if (pattern.indexOf('*') !== -1) return shExpMatch(hostLower, pattern);
    if (pattern.charAt(0) === '.') {
      var suffix = pattern.substring(1);
      return hostLower === suffix || (hostLower.length > suffix.length && hostLower.slice(-suffix.length - 1) === '.' + suffix);
    }
    return hostLower === pattern || (hostLower.length > pattern.length && hostLower.slice(-pattern.length - 1) === '.' + pattern);
  }

  var matched = false;
  for (var i = 0; i < rules.length; i++) {
    if (matches(rules[i])) {
      matched = true;
      break;
    }
  }

  ${isSelective ? 'return matched ? proxy : "DIRECT";' : 'return matched ? "DIRECT" : proxy;'}
}`;
}

async function updateBadge(config) {
  if (!config.enabled || config.mode === 'direct') {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Proxy: Disabled' });
    return;
  }

  let badgeText = 'ALL';
  let badgeColor = '#10b981';
  let title = `Proxy: Global (${config.scheme}://${config.host}:${config.port})`;

  if (config.mode === 'selective') {
    badgeText = 'RULE';
    badgeColor = '#3b82f6';
    const ruleCount = Array.isArray(config.rules) ? config.rules.length : 0;
    title = `Proxy: Selective (${ruleCount} rules -> ${config.scheme}://${config.host}:${config.port})`;
  } else if (config.mode === 'exclude') {
    badgeText = 'EXCL';
    badgeColor = '#f59e0b';
    const ruleCount = Array.isArray(config.rules) ? config.rules.length : 0;
    title = `Proxy: Exclude (${ruleCount} excluded -> ${config.scheme}://${config.host}:${config.port})`;
  }

  await chrome.action.setBadgeText({ text: badgeText });
  await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  await chrome.action.setTitle({ title });
}

function setProxy(configValue) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value: configValue, scope: 'regular' }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function clearProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear({ scope: 'regular' }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

async function applyConfig(config) {
  if (!config.enabled || config.mode === 'direct') {
    await clearProxy();
    await updateBadge(config);
    return;
  }

  if (config.mode === 'global') {
    const bypass = config.bypassLocal ? ['<local>', 'localhost', '127.0.0.1'] : [];
    const proxyConfig = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: config.scheme || 'socks5',
          host: config.host || '127.0.0.1',
          port: Number(config.port) || 60009
        },
        bypassList: bypass
      }
    };
    await setProxy(proxyConfig);
  } else {
    const pacScriptData = buildPacScript(config);
    const pacConfig = {
      mode: 'pac_script',
      pacScript: {
        data: pacScriptData
      }
    };
    await setProxy(pacConfig);
  }

  await updateBadge(config);
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const merged = Object.assign({}, DEFAULT_CONFIG, current);
  await chrome.storage.local.set(merged);
  try {
    await applyConfig(merged);
  } catch (err) {
    await chrome.storage.local.set({ lastError: err.message });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const merged = Object.assign({}, DEFAULT_CONFIG, current);
  try {
    await applyConfig(merged);
  } catch (err) {
    await chrome.storage.local.set({ lastError: err.message });
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  const keys = Object.keys(changes);
  if (keys.length === 1 && keys[0] === 'lastError') return;

  const current = await chrome.storage.local.get(null);
  const merged = Object.assign({}, DEFAULT_CONFIG, current);
  try {
    await applyConfig(merged);
    await chrome.storage.local.remove('lastError');
  } catch (err) {
    await chrome.storage.local.set({ lastError: err.message });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'APPLY_NOW') {
    (async () => {
      try {
        const current = await chrome.storage.local.get(null);
        const merged = Object.assign({}, DEFAULT_CONFIG, current);
        await applyConfig(merged);
        await chrome.storage.local.remove('lastError');
        sendResponse({ ok: true });
      } catch (err) {
        await chrome.storage.local.set({ lastError: err.message });
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'CHECK_PROXY_STATUS') {
    chrome.proxy.settings.get({ incognito: false }, (details) => {
      sendResponse({
        ok: true,
        details,
        lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null
      });
    });
    return true;
  }
});
