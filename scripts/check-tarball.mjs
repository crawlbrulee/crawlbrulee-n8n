// Refuses a bad npm tarball.
//
//   node scripts/check-tarball.mjs
//
// Both ci.yml and publish.yml call it, so the two gates cannot drift apart.
// It packs the real tarball and reads its contents, rather than parsing
// `npm pack --json`: that output has changed shape three times across npm
// releases (array, bare object, object keyed by package name), and the
// workflows do not all run the same npm.
// Not shipped: `files` in package.json is ["dist"].
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const out = execFileSync(npm, ['pack', '--silent'], { encoding: 'utf8' }).trim();
const tarball = out.split('\n').filter(Boolean).pop();
if (!tarball || !tarball.endsWith('.tgz')) {
	console.error('npm pack did not name a tarball; got:', JSON.stringify(out));
	process.exit(1);
}

let paths;
try {
	paths = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
		.split('\n')
		.filter((line) => line && !line.endsWith('/'))
		.map((line) => line.replace(/^package\//, ''));
} finally {
	rmSync(tarball, { force: true });
}

const allowed = /^(dist\/|README\.md$|LICENSE$|package\.json$)/;
// build leftovers that would otherwise slip through the dist/ prefix
const banned = /(\.tsbuildinfo$|\.d\.ts$|\.js\.map$|^dist\/package\.json$)/;
const bad = paths.filter((p) => !allowed.test(p) || banned.test(p));
if (bad.length) {
	console.error('unexpected files in tarball:', bad);
	process.exit(1);
}

// a build that emitted nothing would still pass the checks above
const js = paths.filter((p) => p.endsWith('.js'));
if (js.length < 10) {
	console.error('tarball is missing built code, only:', js);
	process.exit(1);
}

console.log(`tarball ok: ${paths.length} files, ${js.length} js`);
