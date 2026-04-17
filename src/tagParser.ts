import { isValidHex, normalizeHex } from './utils';

export interface TagDefinition {
	label: string;
	color: string;
}

export interface ParseResult {
	tags: TagDefinition[];
	warnings: string[];
}

export function parseTagFile(content: string, separator: string): ParseResult {
	const tags: TagDefinition[] = [];
	const warnings: string[] = [];
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!.trim();

		if (!line) continue;
		if (line.startsWith('#') || line.startsWith('//')) continue;

		const sepIdx = line.indexOf(separator);
		if (sepIdx === -1) {
			warnings.push(`Line ${i + 1}: Missing separator '${separator}' — skipping: ${line}`);
			continue;
		}

		const label = line.substring(0, sepIdx).trim();
		const color = line.substring(sepIdx + separator.length).trim();

		if (!label) {
			warnings.push(`Line ${i + 1}: Empty label — skipping: ${line}`);
			continue;
		}

		if (!isValidHex(color)) {
			warnings.push(`Line ${i + 1}: Invalid hex color '${color}' — skipping: ${line}`);
			continue;
		}

		tags.push({ label, color: normalizeHex(color) });
	}

	return { tags, warnings };
}
