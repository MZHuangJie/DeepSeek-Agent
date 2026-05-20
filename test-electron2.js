console.log('TYPE:', typeof require('electron'));
console.log('IS STRING:', typeof require('electron') === 'string');
console.log('KEYS:', Object.keys(require('electron') || {}));
const e = require('electron');
console.log('APP:', e.app);
console.log('typeof e:', typeof e);
console.log('e itself:', e);
