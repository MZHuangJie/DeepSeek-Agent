const fs = require('fs');
const html = fs.readFileSync('bing_debug.html', 'utf8');

// 用 ol#b_results 来定位
const olMatch = html.match(/<ol[^>]*id="b_results"[^>]*>([\s\S]*?)<\/ol>/i);
if (olMatch) {
  console.log('Found b_results, length:', olMatch[1].length);
  // 在里面找 b_algo
  const algoRe = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  const algoMatches = olMatch[1].match(algoRe);
  console.log('b_algo matches:', algoMatches ? algoMatches.length : 0);
  if (algoMatches && algoMatches.length > 0) {
    console.log('First match length:', algoMatches[0].length);
    console.log('First 500:', algoMatches[0].substring(0, 500));
    // 提取标题
    const titleMatch = algoMatches[0].match(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]+)<\/a>/i);
    console.log('Title match:', titleMatch ? titleMatch[2] : 'NOT FOUND');
  }
} else {
  console.log('b_results not found');
}
