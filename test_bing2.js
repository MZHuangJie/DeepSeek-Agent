const https = require('https');
const fs = require('fs');

function searchBing(query) {
  return new Promise((resolve, reject) => {
    const q = encodeURIComponent(query);
    const req = https.request({
      hostname: 'cn.bing.com',
      path: '/search?q=' + q + '&count=5',
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

(async () => {
  const html = await searchBing('bilibili');
  fs.writeFileSync('bing_debug.html', html);
  console.log('Saved', html.length, 'bytes to bing_debug.html');
  
  // 搜索几个关键 class
  const patterns = ['b_algo', 'b_ans', 'b_title', 'b_caption', 'b_attribution', 'search-results', 'result'];
  for (const p of patterns) {
    const idx = html.indexOf(p);
    console.log(p + ':', idx >= 0 ? 'found at ' + idx : 'NOT FOUND');
  }
  
  // 打印前 2000 字符
  console.log('\n--- First 2000 chars ---');
  console.log(html.substring(0, 2000));
})();
