// Refuses a bad npm tarball. Reads `npm pack --dry-run --json` on stdin:
//
//   npm pack --dry-run --json | node scripts/check-tarball.mjs
//
// Both ci.yml and publish.yml call it, so the two gates cannot drift apart.
// Not shipped: `files` in package.json is ["dist"].
import { readFileSync } from 'node:fs';

const [pkg] = JSON.parse(readFileSync(0, 'utf8'));
const paths = pkg.files.map((f) => f.path);

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
