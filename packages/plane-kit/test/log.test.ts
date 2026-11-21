import { describeError, jsonLog } from '@alxwlw/plane-kit/log';
import { describe, expect, test } from 'bun:test';

describe('jsonLog', () => {
	test('одна JSON-строка на запись: ts первым, поля записи следом, level сохраняется', () => {
		const lines: string[] = [];
		const log = jsonLog(
			(line) => lines.push(line),
			() => new Date('2026-10-22T12:00:00.000Z'),
		);
		log({ event: 'plane.rejected', level: 'error', reason: 'bad_signature', tenant: 'initech' });
		log({ event: 'plane.accepted', ms: 3, note: undefined });
		expect(lines).toEqual([
			'{"ts":"2026-10-22T12:00:00.000Z","event":"plane.rejected","level":"error","reason":"bad_signature","tenant":"initech"}',
			'{"ts":"2026-10-22T12:00:00.000Z","event":"plane.accepted","ms":3}',
		]);
	});

	test('по умолчанию пишет строку в stdout', () => {
		const written: string[] = [];
		const original = process.stdout.write;
		process.stdout.write = ((chunk: string) => {
			written.push(chunk);
			return true;
		}) as typeof process.stdout.write;
		try {
			jsonLog()({ event: 'x' });
		} finally {
			process.stdout.write = original;
		}
		expect(written).toHaveLength(1);
		expect(written[0]!.endsWith('\n')).toBe(true);
		expect(JSON.parse(written[0]!)).toMatchObject({ event: 'x' });
		expect(Date.now() - Date.parse(JSON.parse(written[0]!).ts)).toBeLessThan(60_000);
	});
});

describe('describeError', () => {
	test('names the error class and message', () => {
		expect(describeError(new TypeError('x'))).toBe('TypeError: x');
	});

	test('anything that is not an Error is unknown error', () => {
		expect(describeError(42)).toBe('unknown error');
		expect(describeError({ name: 'E', message: 'm' })).toBe('unknown error');
	});

	test('a throwing getter is unknown error', () => {
		const err = new Error('x');
		Object.defineProperty(err, 'message', {
			get() {
				throw new Error('boom');
			},
		});
		expect(describeError(err)).toBe('unknown error');
	});
});
