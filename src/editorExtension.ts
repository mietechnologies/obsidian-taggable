import { ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate, PluginValue } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import type TaggablePlugin from './main';
import { hexToRgba } from './utils';

/**
 * Build the CM6 editor extension that decorates tagged lines in live-preview
 * and source mode. The plugin closes over the TaggablePlugin instance so it
 * always reads the current matchers and settings without needing an external
 * dispatch. It tracks plugin.matchersVersion to know when to rebuild even if
 * the document and viewport haven't changed (e.g. after a tag reload while the
 * file is already open).
 *
 * Tradeoffs vs reading view:
 * - The marker is dimmed rather than hidden to avoid cursor-navigation issues
 *   caused by `display:none` inside CM6 decorations.
 * - Line styling is applied via inline attributes on the .cm-line element.
 */
export function buildEditorExtension(plugin: TaggablePlugin): Extension {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet = Decoration.none;
			private knownVersion = -1;

			constructor(view: EditorView) {
				this.decorations = this.rebuild(view);
				this.knownVersion = plugin.matchersVersion;
			}

			update(update: ViewUpdate) {
				if (
					update.docChanged ||
					update.viewportChanged ||
					this.knownVersion !== plugin.matchersVersion
				) {
					this.knownVersion = plugin.matchersVersion;
					this.decorations = this.rebuild(update.view);
				}
			}

			destroy() { /* nothing to clean up */ }

			private rebuild(view: EditorView): DecorationSet {
				if (!plugin.settings.enableEditorView || plugin.matchers.length === 0) {
					return Decoration.none;
				}

				const builder = new RangeSetBuilder<Decoration>();

				for (const { from, to } of view.visibleRanges) {
					let pos = from;
					while (pos <= to) {
						const line = view.state.doc.lineAt(pos);
						this.decorateLine(line.text, line.from, builder);
						pos = line.to + 1;
					}
				}

				return builder.finish();
			}

			private decorateLine(
				text: string,
				lineFrom: number,
				builder: RangeSetBuilder<Decoration>
			): void {
				for (const matcher of plugin.matchers) {
					const match = matcher.editorPattern.exec(text);
					if (!match) continue;

					const color = matcher.tag.color;
					const rgba = hexToRgba(color, plugin.settings.backgroundOpacity);

					// Line decoration — applies styling to the entire .cm-line element
					builder.add(
						lineFrom,
						lineFrom,
						Decoration.line({
							attributes: {
								class: 'taggable-tagged-line',
								style: `border-left: 3px solid ${color}; background-color: ${rgba}; padding-left: 0.6em;`,
							},
						})
					);

					// Mark decoration — dims the marker text (label + separator)
					const prefix = match[1] ?? '';
					const label = match[2] ?? '';
					const sep = match[3] ?? '';
					const markerStart = lineFrom + prefix.length;
					const markerEnd = markerStart + label.length + sep.length;

					if (markerStart < markerEnd) {
						// Always use faint in the editor — hiding via display:none in CM6
						// breaks cursor navigation, so we dim instead.
						builder.add(
							markerStart,
							markerEnd,
							Decoration.mark({ class: 'taggable-marker taggable-marker-faint' })
						);
					}

					break; // longest match wins — stop after first match
				}
			}
		},
		{ decorations: instance => instance.decorations }
	);
}
