const fs = require('fs');
const lines = fs.readFileSync('src/shared/i18n.ts', 'utf8').split('\n');

let key = '';
let lineNum = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("': {")) {
    key = lines[i].trim();
    lineNum = i + 1;

    let hasRu = false;
    for (let j = i + 1; j < i + 7 && j < lines.length; j++) {
      if (lines[j].includes('ru:')) hasRu = true;
      if (lines[j].includes('},')) break;
    }

    if (!hasRu) {
      console.log(`Line ${lineNum}: ${key} - Missing RU`);
    }
  }
}
