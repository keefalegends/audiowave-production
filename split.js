const fs = require('fs');
const path = require('path');

const srcPath = '/home/keefalegends/Downloads/webticket/concert-ticket-app.html';
const content = fs.readFileSync(srcPath, 'utf8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
const scriptRegex = /<script>([\s\S]*?)<\/script>/;

const styleMatch = content.match(styleRegex);
const scriptMatch = content.match(scriptRegex);

const outDir = '/home/keefalegends/Downloads/webticket/frontend';
fs.mkdirSync(outDir, { recursive: true });

if (styleMatch) {
    fs.writeFileSync(path.join(outDir, 'style.css'), styleMatch[1].trim());
}

if (scriptMatch) {
    const jsHeader = `// ===== KONFIGURASI =====
// Ganti API_BASE_URL dengan Invoke URL dari API Gateway AWS yang nanti Anda deploy
const API_BASE_URL = '';

`;
    fs.writeFileSync(path.join(outDir, 'app.js'), jsHeader + scriptMatch[1].trim());
}

let htmlContent = content;
if (styleMatch) {
    htmlContent = htmlContent.replace(styleRegex, '<link rel="stylesheet" href="style.css" />');
}
if (scriptMatch) {
    htmlContent = htmlContent.replace(scriptRegex, '<script src="app.js"></script>');
}

fs.writeFileSync(path.join(outDir, 'index.html'), htmlContent);
console.log("Extraction to frontend/ successful.");
