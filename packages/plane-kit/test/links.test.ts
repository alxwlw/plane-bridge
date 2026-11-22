import { describe, expect, test } from 'bun:test';
import { workItemUrl } from '../src/links.ts';

describe('workItemUrl', () => {
	test('joins the web address, workspace and key without double slashes', () => {
		expect(workItemUrl('https://plane.example.com', 'example-ws', 'LAB-41')).toBe(
			'https://plane.example.com/example-ws/browse/LAB-41/',
		);
		expect(workItemUrl('https://plane.example.com//', 'example-ws', 'LAB-41')).toBe(
			'https://plane.example.com/example-ws/browse/LAB-41/',
		);
	});
	test('keeps the path of a self-hosted Plane under a prefix', () => {
		expect(workItemUrl('https://example.com/plane/', 'ws', 'K-1')).toBe(
			'https://example.com/plane/ws/browse/K-1/',
		);
	});
	test('encodes the workspace and the key', () => {
		expect(workItemUrl('https://plane.example.com', 'a/b', 'K 1')).toBe(
			'https://plane.example.com/a%2Fb/browse/K%201/',
		);
	});
});
