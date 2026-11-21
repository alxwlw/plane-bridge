import { expect, test } from 'bun:test';
import { describeRequest } from '@alxwlw/plane-kit/capture';
import { KEEP_HEADER } from '../scripts/capture.ts';

test('POST: заголовки GitHub и Vercel (событие, подпись, target-id) сохранены', async () => {
	const line = await describeRequest(
		new Request('http://x/hooks/github', {
			method: 'POST',
			body: '{}',
			headers: {
				'x-github-event': 'installation',
				'x-hub-signature-256': 'sha256=ab',
				'x-github-hook-installation-target-id': '1',
				'x-vercel-signature': 'cd',
				Authorization: 'Bearer s',
			},
		}),
		new Date(),
		KEEP_HEADER,
	);
	expect(line.headers['x-github-event']).toBe('installation');
	expect(line.headers['x-hub-signature-256']).toBe('sha256=ab');
	expect(line.headers['x-github-hook-installation-target-id']).toBe('1');
	expect(line.headers['x-vercel-signature']).toBe('cd');
	expect(line.headers.authorization).toBeUndefined();
});
