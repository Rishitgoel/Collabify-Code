import fs from 'fs-extra';
import path from 'path';

const roomPath = 'd:/Collabify/Backend/workspace/4xvMulEjsq';
console.log('Checking path:', roomPath);
if (fs.existsSync(roomPath)) {
  console.log('Exists. Deleting...');
  try {
    fs.removeSync(roomPath);
    console.log('Deleted successfully.');
  } catch (err) {
    console.error('Failed to delete:', err);
  }
} else {
  console.log('Path does not exist.');
}
