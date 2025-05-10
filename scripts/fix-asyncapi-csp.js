const fs = require("fs");
const path = require("path");

// Define the path to the websocket documentation index.html
const indexPath = path.join(__dirname, "..", "docs", "websocket", "index.html");

// Check if the file exists
if (!fs.existsSync(indexPath)) {
  console.error(`File not found: ${indexPath}`);
  console.error(
    'Run "pnpm generate-websocket-docs" first to generate the documentation',
  );
  process.exit(1);
}

// Read the HTML file
let html = fs.readFileSync(indexPath, "utf8");

// Add a Content-Security-Policy meta tag to the head section
// This will override any dynamically set CSP and allow 'unsafe-eval' and 'unsafe-inline'
const metaTag =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'self' 'unsafe-eval' 'unsafe-inline'\">";

// Check if the CSP meta tag already exists
if (html.includes("Content-Security-Policy")) {
  // Replace existing CSP meta tag
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/,
    metaTag,
  );
} else {
  // Add CSP meta tag after the charset meta tag
  html = html.replace(
    '<meta charset="UTF-8">',
    '<meta charset="UTF-8">\n      ' + metaTag,
  );
}

// Write the modified HTML back to the file
fs.writeFileSync(indexPath, html);

console.log(
  "✅ Content-Security-Policy successfully updated in the AsyncAPI documentation",
);
console.log(
  "The documentation should now work correctly with the relaxed CSP settings",
);
