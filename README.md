# Local Proxy Switcher

Chromium Manifest V3 extension for routing browser traffic through local or remote proxy ports (such as SOCKS5 `127.0.0.1:60009`, HTTP, HTTPS, or SOCKS4). Supports global proxying, selective domain-based routing, and exclusion lists. Designed for Brave, Chrome, and Chromium-based browsers.

## Architecture

The extension interfaces directly with Chromium's `chrome.proxy` API:

- **Global Mode**: Dispatches `fixed_servers` configuration to Chromium core with optional local subnet bypass (`<local>`, `127.0.0.1`, `localhost`).
- **Selective / Exclude Modes**: Generates an in-memory PAC (Proxy Auto-Configuration) script containing optimized regex and wildcard pattern matchers, evaluated inside Chromium's PAC runner.
- **Disabled State**: Calls `chrome.proxy.settings.clear({ scope: 'regular' })`, releasing proxy control back to browser defaults or OS network settings.
- **State Synchronization**: Persistent configuration is held in `chrome.storage.local`. Background service worker reconciles proxy state on startup and storage mutation events.

## Permissions

- `proxy`: Required to read and write browser proxy configuration via `chrome.proxy`.
- `storage`: Required for persisting endpoint configuration, mode settings, and rule sets across sessions.
- `tabs`: Required to extract hostname from the active tab for single-click rule creation.

## Installation (Brave / Chromium)

1. Open Brave and navigate to `brave://extensions` (or `chrome://extensions` in Google Chrome).
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the project directory (`Chrome Proxy Port`).
5. Pin the extension icon to the toolbar for quick access.

## Routing Modes

### 1. Global (All Traffic)
Routes all browser HTTP, HTTPS, and WebSocket traffic through the configured proxy port.
- Uses native `fixed_servers` Chromium mode.
- Does not run JavaScript PAC evaluation per request, minimizing CPU and memory overhead.

### 2. Selective (Whitelist)
Routes matching domains and URLs through the proxy. All non-matching traffic connects directly (`DIRECT`).
- Uses dynamic `pac_script` generation.
- Ideal for directing blocked sites or internal services through a local tunnel (e.g. V2Ray, Xray, Clash, SSH tunnel) while leaving normal browsing untouched.

### 3. Exclude (Blacklist)
Routes all traffic through the proxy *except* matching domains and local network ranges.
- Matching targets bypass the proxy and connect directly (`DIRECT`).

### 4. Disabled
Turns off proxy injection and clears extension overrides.

## Domain Pattern Syntax

When adding domains in Selective or Exclude modes, the following syntax is supported:

- `domain.com`: Matches `domain.com` and all subdomains (e.g. `api.domain.com`, `www.domain.com`).
- `*.domain.com`: Explicit wildcard subdomain match.
- `sub.domain.com`: Matches exact subdomain only.
- `*pattern*`: Glob wildcard matching via Chromium PAC `shExpMatch`.
- `domain.com/path/*`: URL-level path filtering.

## Interface Controls

- **Master Switch**: Global toggle for activating or deactivating proxy interception.
- **Protocol**: `SOCKS5` (default), `HTTP`, `HTTPS`, `SOCKS4`.
- **Host & Port**: Editable target endpoint (e.g. `127.0.0.1`, port `60009`).
- **Current Tab Button**: Automatically parses active tab hostname and provides one-click rule insertion.
- **Bulk Edit**: Multi-line textarea for batch pasting, updating, or exporting domain lists.
- **Rule Tester**: Interactive real-time simulator to verify whether an arbitrary domain or URL resolves to `PROXIED` or `DIRECT` under current rules.
- **Bypass Local Addresses**: Excludes `localhost`, `127.0.0.1`, and intranet hosts.
- **Fallback to Direct**: Optional flag configuring PAC script to fall back to `DIRECT` if the proxy port is unreachable.

## Diagnostics and Troubleshooting

### Proxy Precedence Conflict
Chromium allows only one extension to control proxy settings at a time. If another extension (e.g., a commercial VPN extension) holds proxy authority, the extension displays a warning alert:
- Check `brave://extensions` and disable competing proxy extensions.
- Use the **Re-apply Proxy** button in the popup footer to reclaim control.

### Connection Refused (`ERR_PROXY_CONNECTION_FAILED`)
If proxy is active but target port is closed:
- Verify that your local proxy daemon (Clash, Sing-box, Xray, SSH `-D`, Tor, etc.) is running and listening on the specified port:
  ```bash
  ss -tulpn | grep 60009
  # or
  lsof -i :60009
  ```
- If testing SOCKS5 connectivity via curl:
  ```bash
  curl -x socks5h://127.0.0.1:60009 https://api.ipify.org
  ```

### Inspecting Extension Logs
1. Navigate to `brave://extensions`.
2. Find **Local Proxy Switcher**.
3. Click `Inspect views: service worker` to inspect background execution, PAC generation, and storage events.
