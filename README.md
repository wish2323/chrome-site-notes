# Site Notes

A Chrome extension that attaches a sidebar notepad to any webpage, with notes linked to the exact URL you're viewing.

## Features

**Free**
- Notes per page (hostname + path)
- Unlimited notes across all sites
- All Notes list view with quick navigation
- Toolbar badge when a note exists on the current page
- Keyboard shortcut `Alt+Shift+N` to toggle sidebar
- Resizable sidebar (260–480px)

**Premium**
- Everything in Free
- Cross-device sync via Google Account (Chrome Storage Sync)
- Live sync status badge in the sidebar header

## Storage Limits

This extension uses two Chrome storage backends. Understanding their limits helps avoid data loss.

### Free — `chrome.storage.local`

| Limit | Value |
|-------|-------|
| Total size | ~5 MB (unlimited in practice for extensions with `unlimitedStorage` permission — this extension does **not** request it, so the default ~5 MB applies) |
| Per-item size | No per-item limit |
| Number of items | No item limit |

In practice the 5 MB cap is generous: a 5 MB note is roughly 5 million characters of plain text. You are unlikely to hit it.

### Premium — `chrome.storage.sync`

Chrome Sync has much tighter limits because data is synced through Google's servers.

| Limit | Value | Notes |
|-------|-------|-------|
| **Total size** | **102,400 bytes (~100 KB)** | Across all `pn:*` keys combined |
| **Per-item size** | **8,192 bytes (~8 KB)** | Per URL key |
| Max items | 512 | Per extension |
| Write quota | 1,800 bytes/sec (sustained) | Burst is higher; debounced saves at 500ms are safe |

#### What this means in practice

- **Per note**: each note is limited to **~8,000 characters** (8 KB). If you exceed this, the save call will fail silently in the textarea (the extension catches the error and shows "Saved ✓" only on success — a future version will surface this error).
- **Total across all notes**: all your notes combined must stay under **~100 KB**. If you have 20 pages worth of notes, that is ~5 KB per note on average.
- **If migration fails on activation**: the extension will show an error and leave your notes in local storage. Nothing is deleted. You can try again after clearing some notes.

#### Recommendations for Premium users

- Keep individual notes concise. Bullet points and short paragraphs stay well under 8 KB.
- If you write extensive research notes, consider splitting them across multiple subpath URLs rather than one homepage note.
- Use the All Notes list (≡ button) to audit and delete notes you no longer need before upgrading if you have a lot of data.

## Installation

### Chrome Web Store
*(link once published)*

### Manual (Developer Mode)
1. Clone or download this repository
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `chrome-site-notes` folder

### Naver Whale Store
*(link once published)*

## Usage

| Action | How |
|--------|-----|
| Open / close sidebar | Click toolbar icon or `Alt+Shift+N` |
| Save a note | Type in the sidebar — saves automatically after 0.5s |
| See all notes | Click ≡ in the sidebar header |
| Navigate to a note's page | Click the note in the list |
| Delete current note | Click **Clear** in the sidebar |
| Delete any note | Hover over it in the list → click × |
| Resize sidebar | Drag the left edge |
| Open settings | Click ⚙ in the sidebar header |

## Storage key format

Notes are stored with the key `pn:{hostname}{pathname}`:

| URL | Key |
|-----|-----|
| `https://github.com/` | `pn:github.com/` |
| `https://github.com/user/repo` | `pn:github.com/user/repo` |
| `https://news.ycombinator.com/item?id=123` | `pn:news.ycombinator.com/item` |

Query strings (`?...`) and fragments (`#...`) are ignored. Notes on `github.com/user/repo` and `github.com/user/repo/issues` are separate.

## Privacy

Notes never leave your own device or Google account. There is no backend server. See [Privacy Policy](https://wish2323.github.io/chrome-site-notes/privacy-policy.html).

## License

MIT — see [LICENSE](LICENSE)
