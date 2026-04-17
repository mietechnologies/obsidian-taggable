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

export function refreshReadingViewElement(
	el: HTMLElement,
	matchers: CompiledMatcher[],
	settings: TaggableSettings
): void {
	clearReadingViewElement(el);
	processReadingViewElement(el, matchers, settings);
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

function clearReadingViewElement(el: HTMLElement): void {
	const processed = Array.from(
		el.querySelectorAll<HTMLElement>('.taggable-tagged-line, [data-taggable-processed], [data-taggable-label]')
	);

	if (
		el.matches('.taggable-tagged-line, [data-taggable-processed], [data-taggable-label]')
	) {
		processed.unshift(el);
	}

	for (const lineEl of processed) {
		lineEl.removeAttribute('data-taggable-processed');
		lineEl.removeAttribute('data-taggable-label');
		lineEl.classList.remove('taggable-tagged-line');
		lineEl.style.removeProperty('border-left');
		lineEl.style.removeProperty('background-color');
	}

	const markers = Array.from(el.querySelectorAll<HTMLElement>('.taggable-marker'));
	for (const marker of markers) {
		marker.replaceWith(document.createTextNode(marker.textContent ?? ''));
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

function wrapMarkerText(
	el: HTMLElement,
	markerText: string,
	settings: TaggableSettings
): void {
	const markerLower = markerText.toLowerCase();
	const textNodes = getInlineTextNodes(el);

	for (const node of textNodes) {
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

		node.parentNode?.replaceChild(frag, node);
		return;
	}
}

function getInlineTextNodes(el: HTMLElement): Text[] {
	const nodes: Text[] = [];
	const stack: Node[] = Array.from(el.childNodes).reverse();

	while (stack.length > 0) {
		const node = stack.pop()!;
		if (node.nodeType === Node.TEXT_NODE) {
			nodes.push(node as Text);
			continue;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			continue;
		}

		const child = node as HTMLElement;
		if (BLOCK_TAGS.has(child.tagName)) {
			continue;
		}

		for (const grandchild of Array.from(child.childNodes).reverse()) {
			stack.push(grandchild);
		}
	}

	return nodes;
}
