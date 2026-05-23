const fs = require('fs');
const html = fs.readFileSync('bing_debug.html', 'utf8');

const results = [];

const olMatch = html.match(/<ol[^>]*id="b_results"[^>]*>([\s\S]*?)<\/ol>/i);
const searchArea = olMatch ? olMatch[1] : html;

const blockRe = /<li class="b_algo"[\s\S]*?<\/li>/gi;
let m;

while ((m = blockRe.exec(searchArea)) !== null) {
  const block = m[0];

  const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);

  if (titleMatch) {
    const url = titleMatch[1].replace(/&amp;/g, '&');
    const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();

    let snippet = '';
    const snippetM = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
                  || block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
                  || block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (snippetM) {
      snippet = snippetM[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    results.push({ url, title, snippet: snippet.slice(0, 100) });
  }

  if (results.length >= 8) break;
}

console.log('Results:', results.length);
results.forEach((r, i) => {
  console.log(`\n[${i+1}] ${r.title}`);
  console.log(`    URL: ${r.url}`);
  console.log(`    Snippet: ${r.snippet}`);
});
