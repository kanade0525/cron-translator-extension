// Node.js script to generate icons
// Run with: node generate_icons.js

const fs = require('fs');

// Simple SVG icon
const svgIcon = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#4A90E2"/>
  <text x="64" y="50" font-family="Arial" font-size="40" font-weight="bold" text-anchor="middle" fill="white">Cron</text>
  <text x="64" y="90" font-family="Arial" font-size="36" font-weight="bold" text-anchor="middle" fill="white">翻訳</text>
</svg>`;

// Create icons directory if it doesn't exist
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

// Save SVG for manual conversion
fs.writeFileSync('icons/icon.svg', svgIcon);

console.log('SVG icon created at icons/icon.svg');
console.log('');
console.log('Next steps:');
console.log('1. Open https://cloudconvert.com/svg-to-png');
console.log('2. Upload icons/icon.svg');
console.log('3. Set sizes to: 16x16, 48x48, 128x128');
console.log('4. Download and save as icon-16.png, icon-48.png, icon-128.png in the icons folder');
console.log('');
console.log('OR use an image editor to create simple 128x128, 48x48, and 16x16 PNG files with:');
console.log('- Blue background (#4A90E2)');
console.log('- White text "Cron" or "C"');