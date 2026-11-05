import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'url';
import path from 'path';
import { useStaticFonts } from './static-fonts.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';

const FORMATS = {
  a4: {
    label: 'A4',
    widthMm: 210,
    heightMm: 297,
    filename: 'Copa-Glas-Studio-Lookbook-2026.pdf',
  },
  a5: {
    label: 'A5',
    widthMm: 148,
    heightMm: 210,
    filename: 'Copa-Glas-Studio-Lookbook-2026-A5.pdf',
  },
};

const arg = process.argv.find((a) => a.startsWith('--format='))?.split('=')[1]
  ?? (process.argv.includes('--a5') ? 'a5' : 'a4');
const format = FORMATS[arg] ?? FORMATS.a4;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const a5CssPath = path.join(ROOT, 'a5.css');
const printCssPath = path.join(ROOT, 'print.css');
const printA5CssPath = path.join(ROOT, 'print-a5.css');
const outputPath = path.join(ROOT, 'pdf', format.filename);
const isA5 = arg === 'a5';

if (isA5) {
  execFileSync(process.execPath, [path.join(__dirname, 'build-a5-css.mjs')], { stdio: 'inherit' });
}

async function generatePdf() {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1800 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.addStyleTag({ path: printCssPath });

  if (isA5) {
    await page.evaluate(() => document.body.classList.add('format-a5'));
    await page.addStyleTag({ path: a5CssPath });
    await page.addStyleTag({
      content: `
        body.format-a5 { background: #fff !important; margin: 0; padding: 0; }
        body.format-a5 .page { margin: 0 !important; box-shadow: none !important; }
        @page { size: 148mm 210mm; margin: 0; }
      `,
    });
    await page.addStyleTag({ path: printA5CssPath });
  }

  await useStaticFonts(page);

  // Disable viewport scaling script — it wraps pages and can break PDF layout.
  await page.evaluate(() => {
    window.removeEventListener('resize', window.__lookbookFit);
    window.removeEventListener('orientationchange', window.__lookbookFit);
    document.querySelectorAll('.page-fit').forEach((wrap) => {
      const page = wrap.querySelector('.page');
      if (page) wrap.parentNode.insertBefore(page, wrap);
      wrap.remove();
    });
    document.querySelectorAll('.page').forEach((p) => {
      p.style.transform = '';
      p.style.transformOrigin = '';
    });
  });

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      })
    );
  });

  const pageCount = await page.locator('.page').count();
  const merged = await PDFDocument.create();

  for (let i = 0; i < pageCount; i++) {
    await page.evaluate((index) => {
      document.body.style.background = '#ffffff';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.querySelectorAll('.page').forEach((el, j) => {
        if (j === index) {
          el.style.removeProperty('display');
        } else {
          el.style.display = 'none';
        }
        el.style.margin = '0';
        el.style.boxShadow = 'none';
        el.style.pageBreakAfter = 'auto';
        el.style.transform = '';
      });
      document.querySelectorAll('.page-fit').forEach((wrap) => {
        wrap.style.height = 'auto';
        wrap.style.overflow = 'visible';
      });
    }, i);

    const buffer = await page.pdf({
      width: `${format.widthMm}mm`,
      height: `${format.heightMm}mm`,
      printBackground: true,
      preferCSSPageSize: isA5,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1,
    });

    const single = await PDFDocument.load(buffer);
    const [copied] = await merged.copyPages(single, [0]);
    merged.addPage(copied);
    process.stdout.write(`Rendered page ${i + 1}/${pageCount}\r`);
  }

  const pdfBytes = await merged.save();
  fs.writeFileSync(outputPath, pdfBytes);
  await browser.close();

  console.log(`\nPDF saved: ${outputPath}`);
  console.log(
    `Pages: ${merged.getPageCount()} · ${format.label} portrait (${format.widthMm} × ${format.heightMm} mm) · print backgrounds enabled`
  );
}

await generatePdf();
