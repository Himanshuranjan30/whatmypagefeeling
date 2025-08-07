const fs = require('fs');
const path = require('path');

console.log('🚀 Building What My Page Feeling Chrome Extension...\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
  console.log('✅ Created dist directory');
}

// Files and directories to copy
const filesToCopy = [
  'manifest.json',
  'src',
  'icons'
];

// Function to copy directory recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(childItem => {
      copyRecursiveSync(path.join(src, childItem), path.join(dest, childItem));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy files to dist
filesToCopy.forEach(item => {
  const srcPath = path.join(__dirname, item);
  const destPath = path.join(distDir, item);
  
  if (fs.existsSync(srcPath)) {
    copyRecursiveSync(srcPath, destPath);
    console.log(`✅ Copied ${item}`);
  } else {
    console.log(`⚠️  Warning: ${item} not found`);
  }
});

// Verify icons exist
const iconSizes = [16, 32, 48, 128];
const missingIcons = [];

iconSizes.forEach(size => {
  const iconPath = path.join(distDir, 'icons', `icon${size}.png`);
  if (!fs.existsSync(iconPath)) {
    missingIcons.push(`icon${size}.png`);
  }
});

if (missingIcons.length > 0) {
  console.log('\n⚠️  Warning: Missing icon files:', missingIcons.join(', '));
  console.log('   Run "open generate-icons.html" to create them\n');
}

// Create a package.json if it doesn't exist
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  const packageJson = {
    name: "what-my-page-feeling",
    version: "1.0.0",
    description: "Chrome extension that analyzes webpage emotions using Gemini AI",
    scripts: {
      "build": "node build.js",
      "clean": "rm -rf dist"
    },
    author: "Himanshu Ranjan",
    license: "MIT"
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Created package.json');
}

console.log('\n✨ Build complete!');
console.log('\n📦 To install the extension:');
console.log('1. Open Chrome and go to chrome://extensions/');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked"');
console.log('4. Select the "dist" folder from:', path.join(__dirname, 'dist'));
console.log('\n🔑 Remember to add your Gemini API key when using the extension!');