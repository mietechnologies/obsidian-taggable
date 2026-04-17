import { debounce, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, TaggableSettingTab, TaggableSettings } from './settings';
import { parseTagFile, TagDefinition } from './tagParser';
import { buildMatchers, CompiledMatcher } from './matcher';
import { buildOccurrenceIndex, OccurrenceIndex } from './occurrenceIndex';
import { processReadingViewElement, refreshReadingViewElement } from './readingViewRenderer';
import { buildEditorExtension } from './editorExtension';
import { TagBrowserView, TAG_BROWSER_VIEW_TYPE } from './tagBrowserView';
import { isExcluded } from './utils';

const DEFAULT_TAG_FILE_CONTENT =
`TASK :: ff33aa
IDEA :: 33ccff
WAITING :: ffaa00
NEXT ACTION :: 66cc66
`;

export default class TaggablePlugin extends Plugin {
	settings: TaggableSettings = { ...DEFAULT_SETTINGS };
	tags: TagDefinition[] = [];
	matchers: CompiledMatcher[] = [];
	occurrenceIndex: OccurrenceIndex | null = null;
	parseWarnings: string[] = [];
	private buildIndexVersion = 0;

	/**
	 * Incremented each time matchers are rebuilt so the CM6 ViewPlugin can
	 * detect that a re-decoration is needed without an external StateEffect.
	 */
	matchersVersion = 0;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.ensureTagFile();
		await this.reloadTags();

		// Reading view post-processor
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (!this.settings.enableReadingView) return;
			const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
			if (file instanceof TFile && isExcluded(file, this.settings)) return;
			processReadingViewElement(el, this.matchers, this.settings);
		});

		// Editor / live-preview extension
		this.registerEditorExtension(buildEditorExtension(this));

		// Sidebar view
		this.registerView(
			TAG_BROWSER_VIEW_TYPE,
			leaf => new TagBrowserView(leaf, this)
		);

		// Ribbon icon
		this.addRibbonIcon('tag', 'Open tag browser', () => {
			void this.openTagBrowser();
		});

		// Commands
		this.addCommand({
			id: 'reload-tags',
			name: 'Reload custom tags',
			callback: async () => {
				await this.reloadTags();
				new Notice('Taggable: tags reloaded.');
			},
		});

		this.addCommand({
			id: 'open-tag-definition-file',
			name: 'Open tag definition file',
			callback: async () => {
				const file = this.app.vault.getAbstractFileByPath(this.settings.tagDefinitionFile);
				if (file instanceof TFile) {
					await this.app.workspace.getLeaf(false).openFile(file);
				} else {
					new Notice(`Taggable: file not found — ${this.settings.tagDefinitionFile}`);
				}
			},
		});

		this.addCommand({
			id: 'open-tag-browser',
			name: 'Open tag browser',
			callback: () => void this.openTagBrowser(),
		});

		this.addCommand({
			id: 'create-tag-definition-file',
			name: 'Create tag definition file if missing',
			callback: async () => {
				await this.ensureTagFile(true);
				new Notice(`Taggable: tag definition file ready at ${this.settings.tagDefinitionFile}`);
			},
		});

		// Watch for changes to the tag definition file
		const debouncedReload = debounce(async () => {
			await this.reloadTags();
		}, 500, true);

		this.registerEvent(
			this.app.vault.on('modify', file => {
				if (file instanceof TFile && file.path === this.settings.tagDefinitionFile) {
					debouncedReload();
				}
			})
		);

		this.addSettingTab(new TaggableSettingTab(this.app, this));
	}

	onunload(): void {
		// Registered views and events are cleaned up automatically by Obsidian.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TaggableSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async reloadTags(): Promise<void> {
		const path = this.settings.tagDefinitionFile;
		const abstract = this.app.vault.getAbstractFileByPath(path);

		if (!(abstract instanceof TFile)) {
			this.tags = [];
			this.matchers = [];
			this.parseWarnings = [];
			this.occurrenceIndex = null;
			this.matchersVersion++;
			this.refreshTagBrowser();
			this.refreshReadingViews();
			return;
		}

		const content = await this.app.vault.cachedRead(abstract);
		const { tags, warnings } = parseTagFile(content, this.settings.separator);

		for (const w of warnings) {
			console.warn(`[Taggable] ${w}`);
		}

		this.parseWarnings = warnings;
		this.tags = tags;
		this.matchers = buildMatchers(tags, this.settings);
		this.matchersVersion++;

		this.refreshTagBrowser();
		this.refreshReadingViews();

		// Build occurrence index asynchronously so we don't block the UI
		void this.buildIndex(++this.buildIndexVersion);
	}

	private async buildIndex(version: number): Promise<void> {
		const index = await buildOccurrenceIndex(
			this.app,
			this.matchers,
			this.settings
		);

		if (version !== this.buildIndexVersion) {
			return;
		}

		this.occurrenceIndex = index;
		this.refreshTagBrowser();
	}

	private refreshTagBrowser(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(TAG_BROWSER_VIEW_TYPE)) {
			if (leaf.view instanceof TagBrowserView) {
				void leaf.view.render();
			}
		}
	}

	private refreshReadingViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
				refreshReadingViewElement(leaf.view.previewMode.containerEl, this.matchers, this.settings);
			}
		}
	}

	async openTagBrowser(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(TAG_BROWSER_VIEW_TYPE);
		if (existing.length > 0) {
			void this.app.workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: TAG_BROWSER_VIEW_TYPE, active: true });
			void this.app.workspace.revealLeaf(leaf);
		}
	}

	private async ensureTagFile(force = false): Promise<void> {
		if (!this.settings.autoCreateTagFile && !force) return;

		const path = this.settings.tagDefinitionFile;
		if (this.app.vault.getAbstractFileByPath(path)) return;

		try {
			// Create intermediate folders if needed
			const dir = path.includes('/')
				? path.substring(0, path.lastIndexOf('/'))
				: null;
			if (dir) {
				await this.ensureFolders(dir);
			}
			await this.app.vault.create(path, DEFAULT_TAG_FILE_CONTENT);
		} catch (e) {
			console.error('[Taggable] Failed to create tag definition file:', e);
		}
	}

	private async ensureFolders(path: string): Promise<void> {
		const segments = path.split('/').filter(Boolean);
		let current = '';

		for (const segment of segments) {
			current = current ? `${current}/${segment}` : segment;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
