const fs = require('fs');
const path = require('path');

// Set the workspace root directory (parent of web-tool directory)
const TOOL_DIR = __dirname;
const ROOT_DIR = path.join(__dirname, '..');
const COMBINED_HTML_PATH = path.join(TOOL_DIR, 'combined.html');

const collectedPages = [];

function injectAssetsAndCollect(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        
        if (fs.statSync(fullPath).isDirectory()) {
            const folderNameTrimmed = file.trim().toLowerCase();
            // Ignore node_modules, .git, web-tool, or any folder containing "#question" or "#table"
            if (file !== 'node_modules' && file !== '.git' && file !== 'web-tool' && !folderNameTrimmed.includes('#question') && !folderNameTrimmed.includes('#table')) {
                injectAssetsAndCollect(fullPath);
            }
        } else if (fullPath.endsWith('.html')) {
            // Skip combined.html if re-scanning
            if (path.basename(fullPath) === 'combined.html') return;

            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Calculate relative path from the current HTML file's folder to web-tool
            let relativePathToTool = path.relative(dir, TOOL_DIR);
            let prefix = relativePathToTool === '' ? '.' : relativePathToTool;
            prefix = prefix.replace(/\\/g, '/'); 
            
            const cssTag = `<link rel="stylesheet" href="${prefix}/beautify.css">`;
            const jsTag = `<script src="${prefix}/util.js"></script>`;

            // Clean up any existing beautify.css and util.js tags first
            const cleanedContent = content
                .replace(/\s*<link\s+rel="stylesheet"\s+href="[^"]*beautify\.css">/gi, '')
                .replace(/\s*<script\s+src="[^"]*util\.js"><\/script>/gi, '');

            let newContent = cleanedContent;

            // Inject CSS just before the closing </head> tag
            if (newContent.match(/<\/head>/i)) {
                newContent = newContent.replace(/<\/head>/i, `    ${cssTag}\n</head>`);
            }

            // Inject JS just before the closing </body> tag
            if (newContent.match(/<\/body>/i)) {
                newContent = newContent.replace(/<\/body>/i, `    ${jsTag}\n</body>`);
            }

            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent);
                console.log(`Injected assets into: ${fullPath}`);
            }

            // --- Collect page for combined.html ---
            let relLinkToPage = path.relative(TOOL_DIR, fullPath).replace(/\\/g, '/');

            // Extract Title
            let titleMatch = content.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                             content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            let pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : path.basename(fullPath, '.html');

            // Extract Body / Article Content
            let articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            let bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            let extractedHtml = articleMatch ? articleMatch[1] : (bodyMatch ? bodyMatch[1] : content);

            // Strip redundant script/link tags and top nav elements from body snippet
            extractedHtml = extractedHtml
                .replace(/\s*<link\s+rel="stylesheet"\s+href="[^"]*beautify\.css">/gi, '')
                .replace(/\s*<script\s+src="[^"]*util\.js"><\/script>/gi, '')
                .replace(/<nav[^>]*class="[^"]*util-nav-bar[^"]*"[\s\S]*?<\/nav>/gi, '')
                .replace(/<nav[^>]*class="[^"]*util-breadcrumb[^"]*"[\s\S]*?<\/nav>/gi, '');

            collectedPages.push({
                fullPath,
                relLinkToPage,
                title: pageTitle,
                htmlContent: extractedHtml
            });
        }
    });
}

function generateCombinedHtml() {
    console.log(`Generating combined.html with ${collectedPages.length} pages...`);

    let tocItemsHtml = '';
    let sectionsHtml = '';

    collectedPages.forEach((page, idx) => {
        const sectionId = `section-${idx + 1}`;

        tocItemsHtml += `
          <li class="combined-toc-item">
            <a href="#${sectionId}">${idx + 1}. ${escapeHtml(page.title)}</a>
          </li>`;

        sectionsHtml += `
        <section class="combined-section" id="${sectionId}">
          <div class="combined-section-header">
            <h2 class="combined-section-title">${idx + 1}. ${escapeHtml(page.title)}</h2>
            <a href="${page.relLinkToPage}" class="combined-file-link" target="_blank" rel="noopener">
              <span>Open Original Article</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          </div>
          <div class="combined-section-content">
            ${page.htmlContent}
          </div>
        </section>\n`;
    });

    const combinedHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Master Combined Knowledge Base</title>
  <link rel="stylesheet" href="./beautify.css">
  <style>
    .combined-toc {
      background: var(--bg-tertiary, #F6F8FA);
      border: 1px solid var(--border-light, #E5E7EB);
      border-radius: var(--radius-lg, 12px);
      padding: 1.5rem;
      margin-bottom: 2.5rem;
      box-shadow: var(--shadow-sm);
    }
    .combined-toc-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 1rem;
      color: var(--text-heading, #111827);
    }
    .combined-toc-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.5rem 1rem;
      padding-left: 1.25rem;
      margin: 0;
    }
    .combined-toc-item a {
      color: var(--text-link, #3B82F6);
      font-weight: 500;
      text-decoration: none;
    }
    .combined-toc-item a:hover {
      text-decoration: underline;
    }
    .combined-section {
      margin-bottom: 3.5rem;
      padding-bottom: 2rem;
      border-bottom: 2px dashed var(--border-light, #E5E7EB);
    }
    .combined-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      background: var(--bg-tertiary, #F6F8FA);
      border: 1px solid var(--border-light, #E5E7EB);
      border-radius: var(--radius-md, 8px);
      padding: 0.75rem 1.25rem;
      margin-bottom: 1.5rem;
      position: sticky;
      top: 10px;
      z-index: 10;
      backdrop-filter: blur(8px);
    }
    .combined-section-title {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-heading, #111827);
    }
    .combined-file-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff !important;
      background: var(--accent-primary, #3B82F6);
      border-radius: 6px;
      text-decoration: none !important;
      transition: all 150ms ease;
    }
    .combined-file-link:hover {
      background: var(--text-link-hover, #2563EB);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <article class="page sans">
    <header>
      <h1 class="page-title">Master Combined Knowledge Base</h1>
      <p class="page-description">Combined master view containing all exported workspace articles.</p>
    </header>
    <div class="page-body">
      <nav class="combined-toc" aria-label="Table of Contents">
        <h2 class="combined-toc-title">Table of Contents (${collectedPages.length} Articles)</h2>
        <ol class="combined-toc-list">
          ${tocItemsHtml}
        </ol>
      </nav>

      ${sectionsHtml}
    </div>
  </article>
  <script src="./util.js"></script>
</body>
</html>`;

    fs.writeFileSync(COMBINED_HTML_PATH, combinedHtmlContent, 'utf8');
    console.log(`Created combined master page at: ${COMBINED_HTML_PATH}`);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Execute the functions
injectAssetsAndCollect(ROOT_DIR);
generateCombinedHtml();
console.log('Done scanning, injecting, and generating combined.html.');