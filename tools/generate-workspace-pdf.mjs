import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'workspace-enquiry.html');
const outputPath = path.join(ROOT, 'pdf', 'Copa-Glas-Studio-Workspace-Enquiry.pdf');

const WIDTH_MM = 210;
const HEIGHT_MM = 297;

async function generatePdf() {
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1800 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });

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
        el.style.display = j === index ? '' : 'none';
        el.style.margin = '0';
        el.style.boxShadow = 'none';
        el.style.pageBreakAfter = 'auto';
      });
    }, i);

    const buffer = await page.pdf({
      width: `${WIDTH_MM}mm`,
      height: `${HEIGHT_MM}mm`,
      printBackground: true,
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
  console.log(`Pages: ${merged.getPageCount()} · A4 portrait (${WIDTH_MM} × ${HEIGHT_MM} mm)`);
}

await generatePdf();
