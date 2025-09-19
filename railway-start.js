// Railway startup file
console.log('🚂 Starting Railway deployment...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

// Remove public folder from Railway deployment
const fs = require('fs');
const path = require('path');

const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  console.log('⚠️  Removing public folder to prevent static serving conflicts...');
  fs.rmSync(publicPath, { recursive: true, force: true });
}

// Start the actual server
require('./server.js');