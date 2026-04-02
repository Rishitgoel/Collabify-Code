const path = require('path');

function validatePath(baseDir, relativePath) {
  const fullPath = path.resolve(baseDir, relativePath)
  console.log('Base:', path.resolve(baseDir));
  console.log('Full:', fullPath);
  if (!fullPath.startsWith(path.resolve(baseDir))) {
    console.log('DENIED');
    return false;
  }
  console.log('ALLOWED');
  return true;
}

validatePath('./workspace', '..');
validatePath('./workspace', 'foo.txt');
validatePath('./workspace', '../../etc/passwd');
