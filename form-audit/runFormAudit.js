const { execSync } = require('child_process');

console.log("Starting RFQ flow audit...");
execSync('node formCapture.js', { stdio: 'inherit' });
console.log("All steps captured successfully.");