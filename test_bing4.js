const fs = require('fs');
const html = fs.readFileSync('bing_debug.html', 'utf8');

const olMatch = html.match(/<ol[^>]*id="b_results"[^>]*>([\s\S]*?)<\/ol>/i);
const algoRe = /<li class="b_algo"[\s\S]*?<\/li>/gi;
const algoMatches = olMatch[1].match(algoRe);

// 打印第一个结果的更多内容，特别是标题链接附近
const first = algoMatches[0];
// 找所有 <a 标签
const aMatches = first.match(/<a[\s\S]*?<\/a>/gi);
console.log('Total <a> tags:', aMatches ? aMatches.length : 0);
if (aMatches) {
  for (let i = 0; i < Math.min(5, aMatches.length); i++) {
    console.log('\n--- a tag', i, '---');
    console.log(aMatches[i].substring(0, 300));
  }
}

// 也搜索 h2 标签
const h2Matches = first.match(/<h2[\s\S]*?<\/h2>/gi);
console.log('\nTotal <h2> tags:', h2Matches ? h2Matches.length : 0);
if (h2Matches) {
  h2Matches.forEach((h, i) => console.log('h2', i, ':', h.substring(0, 200)));
}
