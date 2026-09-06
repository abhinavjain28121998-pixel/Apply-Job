const fs = require('fs');
const content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');
let openBrackets = 0;
let openParens = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') openBrackets++;
  if (content[i] === '}') openBrackets--;
  if (content[i] === '(') openParens++;
  if (content[i] === ')') openParens--;
}
console.log('Brackets:', openBrackets, 'Parens:', openParens);
