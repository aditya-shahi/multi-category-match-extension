# Fundographics Category Matcher

A Chrome extension that scans the current webpage for keywords grouped into
customizable categories (Technology, Sports, Business, Health, Entertainment,
etc.), reports which categories match, and lets you jump to and highlight
every occurrence of a matched keyword directly on the page.

## Features

- **Custom categories & keywords** — add, edit, or delete categories and
  their keyword lists from the popup. Changes are saved to `chrome.storage.local`
  and persist across sessions.
- **Whole-word or partial matching** — toggle between:
  - **Whole word** (default): matches `cat` as a standalone word only —
    won't match it inside `catalog` or `catastrophe`. This also correctly
    ignores compound/kebab-case tokens common in raw HTML (e.g. `ai` inside
    `class="ai-powered-widget"` is *not* treated as a match).
  - **Partial**: matches the keyword anywhere it appears as a substring.
- **Scans both visible text and raw HTML** — so keywords used in hidden
  metadata, class names, or attributes are also detected, with a clear
  indicator of where each match was found (page content vs. HTML source).
- **Jump-to-keyword highlighting** — click "Jump to this word" next to any
  matched keyword to highlight every instance of it on the page and scroll
  to the first one.
- **Persisted preferences** — your categories and match-mode choice are
  remembered the next time you open the popup.

## Installation (unpacked / developer mode)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the extension's folder.
5. The extension icon should now appear in your toolbar.

> **Note:** After making changes to the extension and reloading it at
> `chrome://extensions`, any tabs that were already open will keep running
> the *old* content script. Refresh those tabs (or open a new one) to pick
> up the changes.

## Usage

1. Navigate to any webpage.
2. Click the extension icon to open the popup.
3. **Categories tab** — review, edit, or add keyword categories. Keywords
   are comma-separated and case-insensitive.
4. **Results tab** — click **Scan Page** (or switch to this tab) to see
   which categories matched on the current page.
5. Toggle **Match partial words** to switch between whole-word and partial
   matching; the scan re-runs automatically.
6. Click **Jump to this word** on any keyword badge to highlight all
   occurrences on the page and scroll to the first one.

## File structure

```
├── manifest.json     # Manifest V3 configuration
├── background.js     # Service worker: seeds default categories on install
├── content.js        # Injected into every page: scanning & highlighting logic
├── popup.html         # Popup UI markup and styles
├── popup.js          # Popup logic: category management, scanning, messaging
└── icon.png          # Extension icon (16/48/128)
```

## Permissions

- `storage` — save categories and match-mode preference.
- `activeTab`, `scripting` — read the active tab's content and inject the
  content script on demand if it isn't already running.
- `host_permissions: <all_urls>` — the content script runs on every page so
  scanning works anywhere.

## Known limitations

- Content inside `<script>`, `<style>`, and `<noscript>` tags is skipped.
- Text inside iframes or shadow DOM is not scanned (the tool only walks the
  main document's DOM).
- Extension pages (`chrome://`, `edge://`, `about:`) can't be scanned, since
  Chrome blocks content-script injection there.

## Contributing / Issues

For bugs or feature suggestions, contact: aditya.shahi@forage.ai
