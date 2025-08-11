const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Rebuilding Electron App for Windows...\n');

try {
    // Clean previous builds (Windows compatible)
    console.log('1. Cleaning previous builds...');
    if (fs.existsSync('dist-electron')) {
        if (process.platform === 'win32') {
            execSync('rmdir /s /q dist-electron', { stdio: 'inherit' });
        } else {
            execSync('rm -rf dist-electron', { stdio: 'inherit' });
        }
    }
    if (fs.existsSync('dist')) {
        if (process.platform === 'win32') {
            execSync('rmdir /s /q dist', { stdio: 'inherit' });
        } else {
            execSync('rm -rf dist', { stdio: 'inherit' });
        }
    }
    console.log('✅ Cleaned previous builds\n');

    // Install dependencies if needed
    console.log('2. Checking dependencies...');
    if (!fs.existsSync('node_modules')) {
        console.log('Installing dependencies...');
        execSync('npm install', { stdio: 'inherit' });
    }
    console.log('✅ Dependencies ready\n');

    // Build the application
    console.log('3. Building Electron app...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed\n');

    // Check if preload script was built
    console.log('4. Checking preload script...');
    const preloadPath = path.join('dist-electron', 'preload.js');
    if (fs.existsSync(preloadPath)) {
        console.log('✅ Preload script found at:', preloadPath);
        const stats = fs.statSync(preloadPath);
        console.log('   Size:', stats.size, 'bytes');
    } else {
        console.log('❌ Preload script not found!');
    }

    // Check main process
    const mainPath = path.join('dist-electron', 'main.js');
    if (fs.existsSync(mainPath)) {
        console.log('✅ Main process found at:', mainPath);
    } else {
        console.log('❌ Main process not found!');
    }

    console.log('\n🎉 Rebuild completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the backend: cd backend && npm run dev');
    console.log('2. Start the frontend: npm run dev');
    console.log('3. Start Electron: npm run electron-dev');
    console.log('\n🔍 Check the browser console for Electron API status');

} catch (error) {
    console.error('❌ Rebuild failed:', error.message);
    process.exit(1);
} 