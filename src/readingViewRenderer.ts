import type { CompiledMatcher } from './matcher';
import type { TaggableSettings } from './settings';
import { hexToRgba } from './utils';

const BLOCK_TAGS = new Set(['UL', 'OL', 'LI', 'DIV', 'P', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR']);

export function processReadingViewElement(
	el: HTMLElement,
	matchers: CompiledMatcher[],
	settings: TaggableSettings
): void {
	if (!settings.enableReadingView || matchers.length === 0) return;

	const candidates = Array.from(el.querySelectorAll<HTMLElement>('p, li'));

	// If el itself is a candidate (e.g. post-processor called directly on a <p>)
	if (el.tagName === 'P' || el.tagName === 'LI') {
		candidates.unshift(el);
	}

	for (const candidate of candidates) {
		processLineElement(candidate, matchers, settings);
	}
}

function processLineElement(
	lineEl: HTMLElement,
	matchers: CompiledMatcher[],
	settings: TaggableSettings
): void {
	if (lineEl.hasAttribute('data-taggable-processed')) return;

	const text = getDirectText(lineEl).trim();
	if (!text) return;

	for (const matcher of matchers) {
		const match = matcher.readingPattern.exec(text);
		if (!match) continue;

		const label = match[2] ?? '';
		const sep = match[3] ?? '';
		const markerText = label + sep;
		const color = matcher.tag.color;

		lineEl.setAttribute('data-taggable-processed', '1');
		lineEl.setAttribute('data-taggable-label', matcher.tag.label);
		lineEl.classList.add('taggable-tagged-line');
		lineEl.setCssStyles({
			borderLeft: `3px solid ${color}`,
			backgroundColor: hexToRgba(color, settings.backgroundOpacity),
		});

		wrapMarkerText(lineEl, markerText, settings);
		break;
	}
}

/**
 * Returns concatenated text from direct children, stopping at the first
 * block-level descendant so we don't pull in nested list content.
 */
function getDirectText(el: HTMLElement): string {
	let text = '';
	for (const node of Array.from(el.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			text += node.textContent ?? '';
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const child = node as HTMLElement;
			if (BLOCK_TAGS.has(child.tagName)) break;
			text += child.textContent ?? '';
		}
	}
	return text;
}

/**
 * Finds the first text node in el that contains markerText and wraps it in a
 * styled span. Case-insensitive. Does nothing if the text node is not found.
 */
function wrapMarkerText(
	el: HTMLElement,
	markerText: string,
	settings: TaggableSettings
): void {
	const markerLower = markerText.toLowerCase();

	for (const node of Array.from(el.childNodes)) {
		if (node.nodeType !== Node.TEXT_NODE) continue;

		const raw = node.textContent ?? '';
		const idx = raw.toLowerCase().indexOf(markerLower);
		if (idx === -1) continue;

		const before = raw.substring(0, idx);
		const marker = raw.substring(idx, idx + markerText.length);
		const after = raw.substring(idx + markerText.length);

		const frag = document.createDocumentFragment();
		if (before) frag.appendChild(document.createTextNode(before));

		const span = document.createElement('span');
		span.className = settings.showMarkerFaintly
			? 'taggable-marker taggable-marker-faint'
			: 'taggable-marker taggable-marker-hidden';
		span.textContent = marker;
		frag.appendChild(span);

		if (after) frag.appendChild(document.createTextNode(after));

		el.replaceChild(frag, node);
		return;
	}
}
