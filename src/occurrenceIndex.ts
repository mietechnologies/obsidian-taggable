import type { App, TFile } from 'obsidian';
import type { CompiledMatcher } from './matcher';
import type { TaggableSettings } from './settings';
import { isExcluded } from './utils';

export interface OccurrenceEntry {
	file: TFile;
	count: number;
}

export interface OccurrenceIndex {
	byTag: Map<string, OccurrenceEntry[]>;
	totalByTag: Map<string, number>;
}

export async function buildOccurrenceIndex(
	app: App,
	matchers: CompiledMatcher[],
	settings: TaggableSettings
): Promise<OccurrenceIndex> {
	const byTag = new Map<string, OccurrenceEntry[]>();
	const totalByTag = new Map<string, number>();

	for (const m of matchers) {
		byTag.set(m.tag.label, []);
		totalByTag.set(m.tag.label, 0);
	}

	if (matchers.length === 0) return { byTag, totalByTag };

	const tagDefPath = settings.tagDefinitionFile;

	for (const file of app.vault.getMarkdownFiles()) {
		if (file.path === tagDefPath) continue;
		if (isExcluded(file, settings)) continue;

		const content = await app.vault.cachedRead(file);
		const lines = content.split('\n');

		for (const matcher of matchers) {
			let count = 0;
			for (const line of lines) {
				if (matcher.editorPattern.test(line)) count++;
			}
			if (count > 0) {
				byTag.get(matcher.tag.label)!.push({ file, count });
				totalByTag.set(
					matcher.tag.label,
					(totalByTag.get(matcher.tag.label) ?? 0) + count
				);
			}
		}
	}

	// Sort each tag's file list by occurrence count descending
	for (const entries of byTag.values()) {
		entries.sort((a, b) => b.count - a.count);
	}

	return { byTag, totalByTag };
}
