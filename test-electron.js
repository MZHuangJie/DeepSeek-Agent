console.log('TYPE:', typeof require('electron'));
console.log('KEYS:', Object.keys(require('electron') || {}));
console.log('APP:', require('electron').app);
