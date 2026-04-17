# Taggable

Taggable provides customizable, user-defined visual line tags for Obsidian notes.

You define named markers with colors in a single markdown file. Any note line that starts with a matching marker gets a colored left-border and tinted background highlight. The file content is **never modified** — all styling is purely visual.

---

## How it works

1. Create a tag definition file (default: `taggable.md`) at the root of your vault.
2. Add tag definitions, one per line:

```
TASK :: ff33aa
IDEA :: 33ccff
WAITING :: ffaa00
NEXT ACTION :: 66cc66
```

3. In any note, prefix a line with a defined marker:

```markdown
- [ ] TASK :: Get groceries
- IDEA :: Build a plugin
1. WAITING :: Hear back from vendor
> NEXT ACTION :: Review the proposal
```

The marker (`TASK ::`) is hidden (or faintly shown) and the line receives a colored left-border and tinted background.

---

## Tag definition file format

```
LABEL <separator> <hex color>
```

- **LABEL** — any text, including spaces (multi-word labels supported)
- **separator** — defaults to `::`, configurable in settings
- **hex color** — `RGB` or `RRGGBB` format is preferred; `#RGB` and `#RRGGBB` are still accepted for compatibility

Lines beginning with `#` or `//` are treated as comments and ignored. Blank lines are ignored.

### Example

```
# Status tags
TASK :: ff33aa
IDEA :: 33ccff
WAITING :: ffaa00
NEXT ACTION :: 66cc66

// Project tags
BLOCKED :: ff4444
DONE :: 44cc44
```

---

## Matching rules

- **Longest label wins.** If you have both `ACTION` and `NEXT ACTION`, a line starting with `NEXT ACTION ::` will match `NEXT ACTION`, not `ACTION`.
- **Case-insensitive by default** — `task ::` and `TASK ::` are treated as the same marker.
- **Near-line-start matching in the editor** (enabled by default) — editor highlighting and vault occurrence scanning expect the marker after optional markdown syntax: list bullets (`-`, `*`, `+`, `1.`), task checkboxes (`[ ]`, `[x]`), or blockquote markers (`>`).
- **Reading view is stricter** — it styles only plain paragraphs and list items whose visible text starts with the marker.

Lines in these formats all match:

```
TASK :: Plain line
- TASK :: List item
- [ ] TASK :: Task checkbox
1. TASK :: Numbered list
```

---

## Building

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Tag definition file | `taggable.md` | Path to the tag definition file |
| Separator | `::` | Separator between label and color (definition file) and between label and content (notes) |
| Auto-create tag file | on | Create the definition file with examples if it doesn't exist |
| Enable reading view styling | on | Highlight tagged lines in reading view |
| Enable editor styling | on | Highlight tagged lines in the editor |
| Case-sensitive matching | off | Treat `TASK` and `task` as distinct |
| Only match near line start in editor | on | Require marker near the beginning of a line for editor highlighting and occurrence scanning |
| Background opacity | 0.15 | Opacity of the colored background tint (0–1) |
| Show marker faintly | off | Dim the marker instead of hiding it; when off, editor markers reappear on the active tagged line |
| Excluded files | _(empty)_ | One file path or name per line — skipped for scanning and styling |
| Excluded folders | _(empty)_ | One folder path per line — skipped for scanning and styling |

---

## Commands

- **Reload custom tags** — re-read the tag definition file and rebuild all matchers
- **Open tag definition file** — open your `taggable.md` in the editor
- **Open tag browser** — open the sidebar panel
- **Create tag definition file if missing** — manually trigger file creation

---

## Tag browser (sidebar)

The tag browser lists all defined tags with:
- A colored swatch
- The label name
- Total occurrence count across the vault

Click any tag row to expand a list of files that contain it, sorted by occurrence count. Click a file name to open it.

---

## Reading view vs editor view

| | Reading view | Editor / live preview |
|---|---|---|
| Marker hiding | Hidden completely (or faint, per setting) | Hidden completely (or faint, per setting); hidden markers reappear on the active tagged line |
| Reliability | High — DOM post-processing on rendered HTML | Good — CM6 ViewPlugin; decorations rebuild on document, selection, viewport, or matcher changes |
| When styled | On note render | On every visible-range update (next interaction after tag reload) |

---

## Known limitations

- **Visual settings** (opacity, faint marker toggle) take effect when notes are re-opened in reading view. Editor styling updates on the next user interaction.
- **Marker inside inline markup** (e.g. `**TASK** :: content`) — marker hiding in reading view only works on plain text nodes; inline-markup markers will not be hidden.
- **Nested list items** may inherit the parent item's background tint color.
- The **occurrence index** is built asynchronously after each tag reload. The sidebar count may briefly show 0 while indexing.
- **Excluded files / folders** use simple path prefix and exact-name matching, not full glob patterns.

---

## Future ideas

- Richer glob pattern support for exclusions
- Click-to-filter: show only lines matching a given tag within an open file
- Export tag occurrence report
- Tag color picker in settings UI
- Hover preview showing where a tag is defined
