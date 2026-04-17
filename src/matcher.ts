import type { TagDefinition } from './tagParser';
import type { TaggableSettings } from './settings';
import { escapeRegex } from './utils';

export interface CompiledMatcher {
	tag: TagDefinition;
	/**
	 * Matches raw markdown lines (editor / occurrence scanning).
	 * Groups: (1) prefix, (2) label, (3) separator, (4) content
	 * Longest label wins — matchers are sorted before building.
	 */
	editorPattern: RegExp;
	/**
	 * Matches rendered text content (reading view).
	 * Groups: (1) leading whitespace, (2) label, (3) separator, (4) content
	 */
	readingPattern: RegExp;
}

/**
 * Build compiled matchers from tag definitions.
 * Labels are sorted longest-first so that multi-word labels take precedence
 * over shorter overlapping labels when iterating matchers in order.
 */
export function buildMatchers(
	tags: TagDefinition[],
	settings: TaggableSettings
): CompiledMatcher[] {
	const sorted = [...tags].sort((a, b) => b.label.length - a.label.length);
	const flags = settings.caseSensitive ? '' : 'i';

	return sorted.map(tag => {
		const el = escapeRegex(tag.label);
		const es = escapeRegex(settings.separator);

		// Editor: optional leading markdown prefix (bullets, checkboxes, blockquotes)
		const prefixPart = settings.onlyMatchNearLineStart
			? `^(\\s*(?:(?:[-*+]|\\d+\\.)\\s+)?(?:\\[[^\\]]*\\]\\s+)?(?:>\\s+)?)?`
			: `^(.*?)`;

		const editorPatternStr = `${prefixPart}(${el})(\\s*${es}\\s*)(.*)$`;

		// Reading: markdown is already rendered, text starts with label
		const readingPatternStr = `^(\\s*)(${el})(\\s*${es}\\s*)(.*)$`;

		return {
			tag,
			editorPattern: new RegExp(editorPatternStr, flags),
			readingPattern: new RegExp(readingPatternStr, flags),
		};
	});
}
