import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("--- ORACLE PRO DIAGNOSTIC ---");
console.log(`Node Version: ${process.version}`);
console.log(`Current Directory: ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);

// Check for dist folder
const fs = await import('fs');
const distExists = fs.existsSync(path.join(__dirname, 'dist'));
console.log(`'dist' folder exists: ${distExists}`);

// Test Binance Connectivity
console.log("\nTesting Binance DNS Connectivity...");
try {
    const res = await fetch("https://api.binance.us/api/v3/ping");
    const data = await res.json();
    console.log("✅ Binance connectivity: OK");
} catch (e) {
    console.log("❌ Binance connectivity FAILED:", e.message);
}

console.log("\n--- DIAGNOSTIC COMPLETE ---");
