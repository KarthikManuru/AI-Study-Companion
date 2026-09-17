const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const pdfDir = path.join(docsDir, 'pdf');

if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

const docFiles = [
  'ARCHITECTURE.md',
  'AI_USAGE.md',
  'DEVELOPMENT_PROMPTS.md',
  'EVALUATION.md',
  'KNOWN_LIMITATIONS.md',
  'FUTURE_IMPROVEMENTS.md',
];

async function generatePDFs() {
  console.log('🚀 Starting PDF generation for documentation files...');
  const browser = await chromium.launch();
  const context = await browser.newContext();

  for (const filename of docFiles) {
    const mdPath = path.join(docsDir, filename);
    if (!fs.existsSync(mdPath)) {
      console.warn(`⚠️ Skipping missing file: ${filename}`);
      continue;
    }

    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const pdfFilename = filename.replace(/\.md$/, '.pdf');
    const pdfPath = path.join(pdfDir, pdfFilename);

    console.log(`📄 Converting ${filename} -> docs/pdf/${pdfFilename}...`);

    const page = await context.newPage();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${filename.replace(/\.md$/, '')}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    @page {
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.65;
      color: #1a202c;
      background: #ffffff;
      padding: 10px 25px;
      font-size: 13px;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    h1 {
      font-size: 26px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 0;
      color: #4338ca;
    }

    h2 {
      font-size: 19px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 6px;
      margin-top: 1.8em;
      color: #1e293b;
    }

    h3 {
      font-size: 15px;
      color: #334155;
    }

    p {
      margin-top: 0;
      margin-bottom: 1em;
    }

    code {
      font-family: 'JetBrains Mono', monospace;
      background-color: #f1f5f9;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 11.5px;
      color: #0f172a;
    }

    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 14px 18px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.2em 0;
    }

    pre code {
      background-color: transparent;
      padding: 0;
      color: #e2e8f0;
      font-size: 11px;
      line-height: 1.5;
    }

    blockquote {
      border-left: 4px solid #6366f1;
      margin: 1.2em 0;
      padding: 8px 16px;
      background-color: #f8fafc;
      color: #475569;
      border-radius: 0 6px 6px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 12px;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #0f172a;
    }

    tr:nth-child(even) {
      background-color: #fdfdfd;
    }

    ul, ol {
      padding-left: 24px;
      margin-bottom: 1em;
    }

    li {
      margin-bottom: 0.35em;
    }

    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 2em 0;
    }

    .doc-header {
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
    }

    .doc-badge {
      background: #eef2ff;
      color: #4338ca;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <span>AI Study Companion — Engineering Submission</span>
    <span class="doc-badge">Production Architecture</span>
  </div>
  <div id="content"></div>
  <script>
    const rawMarkdown = ${JSON.stringify(mdContent)};
    document.getElementById('content').innerHTML = marked.parse(rawMarkdown);
  </script>
</body>
</html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // Allow markdown and fonts to render
    await page.waitForTimeout(1000);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm',
      },
      printBackground: true,
    });

    await page.close();
    console.log(`✅ Saved: ${pdfPath} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('🎉 All documentation PDFs generated successfully in docs/pdf/!');
}

generatePDFs().catch((err) => {
  console.error('❌ PDF generation failed:', err);
  process.exit(1);
});
