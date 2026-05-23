const https = require('https');

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
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
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
  try {
    const html = await searchBing('bilibili');
    console.log('OK, length:', html.length);
    const re = /<li class="b_algo">([\s\S]*?)<\/li>/gi;
    let count = 0;
    let m;
    while ((m = re.exec(html)) !== null && count < 3) {
      const block = m[1];
      const urlM = block.match(/<a[^>]*href="(https?:\/\/[^"]*)"/i);
      const titleM = block.match(/<a[^>]*>([^<]+)<\/a>/i);
      if (urlM && titleM) {
        console.log('Result:', titleM[1].slice(0, 60));
        count++;
      }
    }
    console.log('Total results found:', count);
  } catch(e) {
    console.log('FAIL:', e.message);
  }
})();
