const fs = require('fs');
const https = require('https');
const path = require('path');

const files = [
  'pyodide.js',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'pyodide_py.tar',
  'python_stdlib.zip',
  'repodata.json'
];

const baseUrl = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';
const destDir = path.join(process.cwd(), 'public', 'pyodide');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

async function download(file) {
  return new Promise((resolve, reject) => {
    const dest = path.join(destDir, file);
    const fileStream = fs.createWriteStream(dest);
    https.get(baseUrl + file, (response) => {
       if (response.statusCode === 302 || response.statusCode === 301) {
           // Handle redirect
           https.get(response.headers.location, (res2) => {
               if (res2.statusCode !== 200) {
                   reject(new Error(`Failed to download ${file}: ${res2.statusCode}`));
                   return;
               }
               res2.pipe(fileStream);
               fileStream.on('finish', () => {
                 fileStream.close();
                 console.log(`Downloaded ${file}`);
                 resolve();
               });
           }).on('error', reject);
           return;
       }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${file}: ${response.statusCode}`));
        return;
      }
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded ${file}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

(async () => {
  console.log('Starting download to ' + destDir);
  for (const file of files) {
    try {
      await download(file);
    } catch (err) {
      console.error(err.message);
    }
  }
})();
