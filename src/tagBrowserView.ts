import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TaggablePlugin from './main';
import { hexToRgba } from './utils';

export const TAG_BROWSER_VIEW_TYPE = 'taggable-tag-browser';

export class TagBrowserView extends ItemView {
	private plugin: TaggablePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: TaggablePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TAG_BROWSER_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Tag browser';
	}

	getIcon(): string {
		return 'tag';
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	async render(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('taggable-browser');

		const { matchers, occurrenceIndex } = this.plugin;

		if (matchers.length === 0) {
			contentEl.createEl('p', {
				text: 'No tags defined. Open your tag definition file and add some tags.',
				cls: 'taggable-empty-state',
			});
			return;
		}

		contentEl.createEl('div', { cls: 'taggable-browser-header' }).createEl('h5', {
			text: 'Custom tags',
		});

		const list = contentEl.createEl('div', { cls: 'taggable-tag-list' });

		for (const matcher of matchers) {
			const label = matcher.tag.label;
			const color = matcher.tag.color;
			const total = occurrenceIndex?.totalByTag.get(label) ?? 0;
			const entries = occurrenceIndex?.byTag.get(label) ?? [];

			const row = list.createEl('div', { cls: 'taggable-tag-row' });

			// Header: swatch + label + count — click to toggle file list
			const header = row.createEl('div', { cls: 'taggable-tag-header' });

			const swatch = header.createEl('span', { cls: 'taggable-swatch' });
			swatch.style.backgroundColor = color;

			header.createEl('span', { text: label, cls: 'taggable-tag-label-text' });

			const badge = header.createEl('span', {
				text: String(total),
				cls: 'taggable-count-badge',
			});
			badge.style.backgroundColor = hexToRgba(color, 0.2);
			badge.style.color = color;

			// File list, hidden by default
			const fileList = row.createEl('div', { cls: 'taggable-file-list' });

			if (entries.length === 0) {
				fileList.createEl('div', {
					text: 'No occurrences found.',
					cls: 'taggable-no-occurrences',
				});
			} else {
				for (const entry of entries) {
					const fileRow = fileList.createEl('div', { cls: 'taggable-file-row' });

					fileRow.createEl('span', {
						text: entry.file.basename,
						cls: 'taggable-file-name',
					});
					fileRow.createEl('span', {
						text: `${entry.count}`,
						cls: 'taggable-file-count',
					});

					fileRow.addEventListener('click', () => {
						void this.app.workspace.getLeaf(false).openFile(entry.file);
					});
				}
			}

			let expanded = false;
			header.addEventListener('click', () => {
				expanded = !expanded;
				fileList.style.display = expanded ? 'block' : 'none';
				header.classList.toggle('taggable-tag-header-expanded', expanded);
			});
		}
	}
}
