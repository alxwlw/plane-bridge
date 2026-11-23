// Local look at the graph: `bun scripts/demo.ts [--locale ru]`, then open http://localhost:8099/t/demo/graph?k=demo
// The data is invented (test/fixtures/demo-copy.en.json, or demo-copy.json for `ru`); nothing talks to a real Plane.
import { join } from 'node:path';

import { isLocale, type Locale } from '@alxwlw/plane-kit/locale';

import type { Config } from '../src/config.ts';
import type { CopyData } from '../src/contract.ts';
import { createHandler } from '../src/server.ts';
import { Store } from '../src/store.ts';
import { buildWeb } from '../src/web.ts';

const PORT = 8099;
const ROOT = join(import.meta.dir, '..');
const USAGE = 'usage: bun scripts/demo.ts [--locale en|ru]';
const FIXTURES: Record<Locale, string> = {
	en: 'test/fixtures/demo-copy.en.json',
	ru: 'test/fixtures/demo-copy.json',
};

export function demoOptions(argv: string[]): { locale: Locale; fixture: string } {
	let locale: Locale = 'en';
	for (let i = 0; i < argv.length; i += 2) {
		const value = argv[i + 1];
		if (argv[i] !== '--locale' || !isLocale(value)) throw new Error(USAGE);
		locale = value;
	}
	return { locale, fixture: FIXTURES[locale] };
}

/** The area label prefix of the demo tenant: the first label's name up to and including its first `:`. */
export function areaPrefixOf(copy: CopyData): string {
	const name = copy.labels[0]?.name;
	const colon = name?.indexOf(':') ?? -1;
	if (name === undefined || colon < 0)
		throw new Error('the demo copy has no area label with a ":" prefix');
	return name.slice(0, colon + 1);
}

if (import.meta.main) {
	let options: ReturnType<typeof demoOptions>;
	try {
		options = demoOptions(Bun.argv.slice(2));
	} catch (e) {
		console.error((e as Error).message);
		process.exit(2);
	}
	await serve(options);
}

async function serve({ locale, fixture }: ReturnType<typeof demoOptions>): Promise<void> {
	const copy = (await Bun.file(join(ROOT, fixture)).json()) as CopyData;
	const areaPrefix = areaPrefixOf(copy);
	const config: Config = {
		// Item links point back at this server, so a click opens a tab without leaving the machine.
		planeUrl: `http://localhost:${PORT}/plane-stub`,
		planeWebUrl: `http://localhost:${PORT}/plane-stub`,
		publicUrl: `http://localhost:${PORT}`,
		dbPath: ':memory:',
		port: PORT,
		tenants: new Map([
			[
				'demo',
				{
					id: 'demo',
					workspaceSlug: 'demo-ws',
					workspaceId: '00000000-0000-4000-8000-000000000001',
					clientId: 'demo-client',
					installationId: 'demo-installation',
					planeSecret: 'demo-plane-secret',
					webhookSecret: 'demo-webhook-secret',
					readKey: 'demo',
					agentKey: 'demo-agent-key',
					locale,
					areaPrefix,
				},
			],
		]),
	};

	const store = new Store(':memory:');
	const now = new Date();
	store.replaceCopy('demo', copy, now.toISOString());
	store.putRun(
		'demo',
		{
			runId: 'demo-run',
			kind: 'batch',
			startedAt: new Date(now.getTime() - 60_000).toISOString(),
			finishedAt: now.toISOString(),
			relationsAdded: [{ fromId: 'demo:INF-2', toId: 'demo:ABC-5' }],
			labelsAdded: [{ itemId: 'demo:ABC-5', label: `${areaPrefix}api` }],
			skipped: 0,
			costUsd: null,
		},
		now.toISOString(),
	);

	const handler = createHandler({
		config,
		store,
		log: () => {},
		now: () => Date.now(),
		enqueue: () => {},
		assets: await buildWeb(join(ROOT, 'web')),
		acceptRun: () => Promise.resolve(true),
	});

	Bun.serve({ port: PORT, fetch: handler });
	console.log(`demo: http://localhost:${PORT}/t/demo/graph?k=demo`);
}
