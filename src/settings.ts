import { App, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import type TaggablePlugin from './main';

export interface TaggableSettings {
	tagDefinitionFile: string;
	separator: string;
	autoCreateTagFile: boolean;
	enableReadingView: boolean;
	enableEditorView: boolean;
	caseSensitive: boolean;
	onlyMatchNearLineStart: boolean;
	excludedFiles: string;
	excludedFolders: string;
	backgroundOpacity: number;
	showMarkerFaintly: boolean;
}

export const DEFAULT_SETTINGS: TaggableSettings = {
	tagDefinitionFile: 'taggable.md',
	separator: '::',
	autoCreateTagFile: true,
	enableReadingView: true,
	enableEditorView: true,
	caseSensitive: false,
	onlyMatchNearLineStart: true,
	excludedFiles: '',
	excludedFolders: '',
	backgroundOpacity: 0.15,
	showMarkerFaintly: false,
};

export class TaggableSettingTab extends PluginSettingTab {
	plugin: TaggablePlugin;

	constructor(app: App, plugin: TaggablePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Tag definitions').setHeading();

		new Setting(containerEl)
			.setName('Tag definition file')
			.setHeading()
			.setDesc('Path to the file that defines your tags.')
			.addText(text =>
				text
					.setValue(this.plugin.settings.tagDefinitionFile)
					.onChange(async value => {
						this.plugin.settings.tagDefinitionFile = value.trim() || 'taggable.md';
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName('Separator')
			.setDesc('String used to separate the label from the hex color in the definition file, and to separate the label from content in notes.')
			.addText(text =>
				text
					.setPlaceholder('::')
					.setValue(this.plugin.settings.separator)
					.onChange(async value => {
						this.plugin.settings.separator = value || '::';
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName('Auto-create tag definition file')
			.setDesc('If the tag definition file does not exist, create it automatically with example tags.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.autoCreateTagFile)
					.onChange(async value => {
						this.plugin.settings.autoCreateTagFile = value;
						await this.save();
					})
			);

		new Setting(containerEl).setName('Features').setHeading();

		new Setting(containerEl)
			.setName('Enable reading view styling')
			.setDesc('Apply colored highlights to tagged lines in reading view.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.enableReadingView)
					.onChange(async value => {
						this.plugin.settings.enableReadingView = value;
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName('Enable editor / live-preview styling')
			.setDesc('Apply colored highlights to tagged lines in the editor (source mode and live preview).')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.enableEditorView)
					.onChange(async value => {
						this.plugin.settings.enableEditorView = value;
						await this.save();
					})
			);

		new Setting(containerEl).setName('Matching').setHeading();

		new Setting(containerEl)
			.setName('Case-sensitive matching')
			.setDesc('When enabled, label matching respects exact letter casing.')
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.caseSensitive)
					.onChange(async value => {
						this.plugin.settings.caseSensitive = value;
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName('Only match near start of line in editor')
			.setDesc(
				'When enabled, editor highlighting and occurrence scanning require markers near the beginning of a line, after optional list bullets, checkboxes, or blockquote markers. Reading view always matches only plain paragraphs and list items that start with the marker.'
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.onlyMatchNearLineStart)
					.onChange(async value => {
						this.plugin.settings.onlyMatchNearLineStart = value;
						await this.save();
					})
			);

		new Setting(containerEl).setName('Visual').setHeading();

		new Setting(containerEl)
			.setName('Background opacity')
			.setDesc('Opacity of the colored background tint (0 = transparent, 1 = solid).')
			.addSlider(slider =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(this.plugin.settings.backgroundOpacity)
					.setDynamicTooltip()
					.onChange(async value => {
						this.plugin.settings.backgroundOpacity = value;
						await this.save();
					})
			);

		new Setting(containerEl)
			.setName('Show marker faintly instead of hiding')
			.setDesc(
				'When enabled, the raw marker text (e.g. TASK ::) is shown at reduced opacity instead of being hidden. ' +
				'In the editor, the marker is always shown faintly regardless of this setting.'
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showMarkerFaintly)
					.onChange(async value => {
						this.plugin.settings.showMarkerFaintly = value;
						await this.save();
					})
			);

		new Setting(containerEl).setName('Exclusions').setHeading();

		new Setting(containerEl)
			.setName('Excluded files')
			.setDesc('One file path or filename per line. These files will not be scanned or styled.')
			.addTextArea(area =>
				this.configureTextArea(
					area,
					this.plugin.settings.excludedFiles,
					async value => {
						this.plugin.settings.excludedFiles = value;
						await this.save();
					}
				)
			);

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('One folder path per line. Files inside these folders will not be scanned or styled.')
			.addTextArea(area =>
				this.configureTextArea(
					area,
					this.plugin.settings.excludedFolders,
					async value => {
						this.plugin.settings.excludedFolders = value;
						await this.save();
					}
				)
			);

		if (this.plugin.parseWarnings.length > 0) {
			new Setting(containerEl).setName('Tag definition warnings').setHeading();
			const warnEl = containerEl.createEl('div', { cls: 'taggable-warnings' });
			for (const w of this.plugin.parseWarnings) {
				warnEl.createEl('p', { text: w, cls: 'taggable-warning-item' });
			}
		}
	}

	private configureTextArea(
		area: TextAreaComponent,
		value: string,
		onChange: (v: string) => Promise<void>
	): TextAreaComponent {
		area.setValue(value);
		area.inputEl.rows = 4;
		area.inputEl.addClass('taggable-settings-textarea');
		area.onChange(onChange);
		return area;
	}

	private async save(): Promise<void> {
		await this.plugin.saveSettings();
		await this.plugin.reloadTags();
	}
}
