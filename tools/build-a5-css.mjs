import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const outPath = path.join(ROOT, 'a5.css');

const SCALE = 148 / 210;

const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<style>([\s\S]*?)<\/style>/);
if (!match) throw new Error('Could not find <style> block in index.html');

function scaleMm(value) {
  const scaled = parseFloat(value) * SCALE;
  return `${Number(scaled.toFixed(2))}mm`;
}

function scalePt(value) {
  const scaled = parseFloat(value) * SCALE;
  return `${Number(scaled.toFixed(2))}pt`;
}

function scalePx(value) {
  return `${Math.round(parseFloat(value) * SCALE)}px`;
}

function scaleDimensions(css) {
  let out = css.replace(/calc\(\s*297mm\s*-\s*44mm\s*\)/g, scaleMm(297 - 44));
  out = out.replace(/(\d+(?:\.\d+)?)mm/g, (_, n) => scaleMm(n));
  out = out.replace(/(\d+(?:\.\d+)?)pt/g, (_, n) => scalePt(n));
  out = out.replace(/\b(width|height|margin-bottom|margin-top|top|bottom|left|right|gap):\s*(\d+)px\b/g, (full, prop, n) => {
    const num = parseInt(n, 10);
    if (num <= 4) return full;
    return `${prop}: ${scalePx(num)}`;
  });
  out = out.replace(/\.page\s*\{([^}]*)\}/, (_, body) => {
    const updated = body
      .replace(/width:\s*[\d.]+mm/, 'width: 148mm')
      .replace(/height:\s*[\d.]+mm/, 'height: 210mm');
    return `.page {${updated}}`;
  });
  return out;
}

function parseRules(css) {
  const rules = [];
  let i = 0;
  const len = css.length;

  while (i < len) {
    while (i < len && /\s/.test(css[i])) i++;
    if (i >= len) break;

    if (css[i] === '/' && css[i + 1] === '*') {
      i = css.indexOf('*/', i) + 2;
      continue;
    }

    const start = i;
    let depth = 0;
    let selectorEnd = -1;

    while (i < len) {
      const ch = css[i];
      if (ch === '/' && css[i + 1] === '*') {
        i = css.indexOf('*/', i) + 2;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) selectorEnd = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const selector = css.slice(start, selectorEnd).trim();
          const body = css.slice(selectorEnd + 1, i).trim();
          rules.push({ selector, body });
          i++;
          break;
        }
      }
      i++;
    }
  }

  return rules;
}

function prefixRule(selector, body) {
  const trimmed = selector.trim();

  if (trimmed.startsWith('@page')) {
    return '@page { size: 148mm 210mm; margin: 0; }';
  }

  if (trimmed.startsWith('@media')) {
    const innerRules = parseRules(body);
    const inner = innerRules
      .map(({ selector: s, body: b }) => prefixRule(s, b))
      .join('\n');
    return `${trimmed} {\n${inner}\n}`;
  }

  const prefixed = trimmed
    .split(',')
    .map((s) => `body.format-a5 ${s.trim()}`)
    .join(',\n');

  return `${prefixed} {\n${body}\n}`;
}

const scaledCss = scaleDimensions(match[1]);
const rules = parseRules(scaledCss);
const output = `/* Auto-generated native A5 layout — do not edit by hand. Run: npm run build:a5-css */
${rules.map(({ selector, body }) => prefixRule(selector, body)).join('\n\n')}
`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${outPath} (${output.length} bytes, ${rules.length} rules)`);
