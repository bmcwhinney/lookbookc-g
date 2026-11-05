// Print with fixed (non-variable) cuts of Newsreader and Geist.
// Chrome embeds variable fonts in PDFs as Type 3 fonts, which some viewers
// (Apple Preview) and printers render badly. Static cuts embed as TrueType.
// Newsreader text sizes use the opsz 12 cut; 18px and above use the opsz 48 cut.
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts-print');
const url = (f) => `file://${path.join(dir, f)}`;

const faces = [];
for (const tier of ['Text', 'Display']) {
  for (const [w, name] of [[300, 'Light'], [400, 'Regular']]) {
    faces.push(`@font-face{font-family:'CG Newsreader ${tier}';font-weight:${w};font-style:normal;src:url('${url(`Newsreader${tier}-${name}.ttf`)}') format('truetype')}`);
    faces.push(`@font-face{font-family:'CG Newsreader ${tier}';font-weight:${w};font-style:italic;src:url('${url(`Newsreader${tier}-${name}Italic.ttf`)}') format('truetype')}`);
  }
}
for (const [w, name] of [[300, 'Light'], [400, 'Regular']]) {
  faces.push(`@font-face{font-family:'CG Geist';font-weight:${w};font-style:normal;src:url('${url(`Geist-${name}.ttf`)}') format('truetype')}`);
}

export async function useStaticFonts(page) {
  await page.addStyleTag({ content: faces.join('\n') + '\n*{font-synthesis:none !important}' });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body, body *')) {
      const cs = getComputedStyle(el);
      const fam = cs.fontFamily;
      if (/Newsreader/i.test(fam)) {
        const tier = parseFloat(cs.fontSize) >= 18 ? 'Display' : 'Text';
        el.style.setProperty('font-family', `'CG Newsreader ${tier}', Georgia, serif`, 'important');
      } else if (/Geist/i.test(fam)) {
        el.style.setProperty('font-family', `'CG Geist', Helvetica, Arial, sans-serif`, 'important');
      }
      const w = parseInt(cs.fontWeight, 10);
      if (w > 400) el.style.setProperty('font-weight', '400', 'important');
    }
  });
  await page.evaluate(async () => { await document.fonts.ready; });
}
