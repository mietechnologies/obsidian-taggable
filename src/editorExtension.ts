import { editorInfoField } from 'obsidian';
import { ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet, ViewUpdate, PluginValue } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import type TaggablePlugin from './main';
import { hexToRgba, isExcluded } from './utils';

/**
 * Build the CM6 editor extension that decorates tagged lines in live-preview
 * and source mode. The plugin closes over the TaggablePlugin instance so it
 * always reads the current matchers and settings without needing an external
 * dispatch. It tracks plugin.matchersVersion to know when to rebuild even if
 * the document and viewport haven't changed (e.g. after a tag reload while the
 * file is already open).
 *
 * Line styling is applied via inline attributes on the .cm-line element.
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
					update.selectionSet ||
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

				const file = view.state.field(editorInfoField).file;
				if (!file || isExcluded(file, plugin.settings)) {
					return Decoration.none;
				}

				const builder = new RangeSetBuilder<Decoration>();

				for (const { from, to } of view.visibleRanges) {
					let pos = from;
					while (pos <= to) {
						const line = view.state.doc.lineAt(pos);
						this.decorateLine(view, line.text, line.from, builder);
						pos = line.to + 1;
					}
				}

				return builder.finish();
			}

			private decorateLine(
				view: EditorView,
				text: string,
				lineFrom: number,
				builder: RangeSetBuilder<Decoration>
			): void {
				for (const matcher of plugin.matchers) {
					const match = matcher.editorPattern.exec(text);
					if (!match) continue;

					const color = matcher.tag.color;
					const rgba = hexToRgba(color, plugin.settings.backgroundOpacity);
					const lineEnd = lineFrom + text.length;

					// The prefix includes indentation, bullet/numbering, and checkbox text.
					// Styling starts after that prefix so nested items keep their visual indent.
					const prefix = match[1] ?? '';
					const label = match[2] ?? '';
					const sep = match[3] ?? '';
					const contentStart = lineFrom + prefix.length;
					const markerStart = contentStart;
					const markerEnd = markerStart + label.length + sep.length;

					if (contentStart < lineEnd) {
						builder.add(
							contentStart,
							lineEnd,
							Decoration.mark({
								attributes: {
									class: 'taggable-tagged-content',
									style: `border-left: 3px solid ${color}; background-color: ${rgba}; padding-left: 0.6em; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone;`,
								},
							})
						);
					}

					// Hide or faint the marker text (label + separator) within the tagged content.
					if (markerStart < markerEnd) {
						const revealMarker =
							!plugin.settings.showMarkerFaintly &&
							this.shouldRevealMarker(view, markerStart);

						builder.add(
							markerStart,
							markerEnd,
							Decoration.mark({
								class: plugin.settings.showMarkerFaintly || revealMarker
									? 'taggable-marker taggable-marker-faint'
									: 'taggable-marker taggable-marker-hidden',
							})
						);
					}

					break; // longest match wins — stop after first match
				}
			}

			private shouldRevealMarker(view: EditorView, markerStart: number): boolean {
				const markerLine = view.state.doc.lineAt(markerStart);
				for (const range of view.state.selection.ranges) {
					const fromLine = view.state.doc.lineAt(range.from);
					const toLine = view.state.doc.lineAt(range.to);
					if (fromLine.number <= markerLine.number && toLine.number >= markerLine.number) {
						return true;
					}
				}
				return false;
			}
		},
		{ decorations: instance => instance.decorations }
	);
}
