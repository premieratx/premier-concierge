/**
 * Fold the production build into one self-contained HTML file.
 *
 * The published page runs under a strict content security policy with no
 * outbound requests allowed, so the JavaScript and the stylesheet have to be
 * inlined rather than linked. The output is page *content* — no doctype, no
 * html, head or body element — because the host wraps it in its own skeleton.
 *
 * Run with: npm run build:artifact
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-artifact');
const assets = join(dist, 'assets');

const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));
if (!jsFile) throw new Error('no bundled script found in dist-artifact/assets');

/**
 * A literal `</script` inside the bundle would close the inline element early.
 * The backslash form parses identically inside JavaScript strings and regular
 * expressions, which are the only places it can legally appear.
 */
const escapeForInline = (source, tag) =>
  source.replaceAll(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

const js = escapeForInline(readFileSync(join(assets, jsFile), 'utf8'), 'script');
const css = cssFile ? escapeForInline(readFileSync(join(assets, cssFile), 'utf8'), 'style') : '';

const html = `<title>Container Castle Designer</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

const out = join(root, 'artifact', 'castle-designer.html');
writeFileSync(out, html);

const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`wrote ${out} — ${mb} MB (js ${(js.length / 1024).toFixed(0)} kB, css ${(css.length / 1024).toFixed(0)} kB)`);
