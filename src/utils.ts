import type { TFile } from 'obsidian';
import type { TaggableSettings } from './settings';

export function hexToRgba(hex: string, opacity: number): string {
	const h = hex.replace('#', '');
	let r: number, g: number, b: number;

	if (h.length === 3) {
		r = parseInt(h[0]! + h[0]!, 16);
		g = parseInt(h[1]! + h[1]!, 16);
		b = parseInt(h[2]! + h[2]!, 16);
	} else {
		r = parseInt(h.slice(0, 2), 16);
		g = parseInt(h.slice(2, 4), 16);
		b = parseInt(h.slice(4, 6), 16);
	}

	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidHex(color: string): boolean {
	return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}

export function isExcluded(file: TFile, settings: TaggableSettings): boolean {
	const excludedFiles = settings.excludedFiles
		.split('\n')
		.map(s => s.trim())
		.filter(Boolean);

	const excludedFolders = settings.excludedFolders
		.split('\n')
		.map(s => s.trim())
		.filter(Boolean);

	for (const pattern of excludedFiles) {
		if (file.path === pattern || file.name === pattern) return true;
	}

	for (const folder of excludedFolders) {
		const prefix = folder.endsWith('/') ? folder : folder + '/';
		if (file.path.startsWith(prefix) || file.path === folder) return true;
	}

	return false;
}
