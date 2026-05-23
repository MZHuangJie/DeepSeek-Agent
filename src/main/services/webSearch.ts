import https from 'https';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function httpGet(hostname: string, path: string, timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { hostname, path, headers: { 'User-Agent': 'DeepSeek-Agent/1.0' }, servername: hostname, timeout },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (loc) {
            try {
              const u = new URL(loc);
              httpGet(u.hostname, u.pathname + u.search, timeout).then(resolve).catch(reject);
            } catch { reject(new Error('重定向失败')); }
          }
          return;
        }
        let data = '';
        res.on('data', (c: string) => { data += c; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('搜索超时')); });
    req.on('error', reject);
  });
}

export async function webSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  // 尝试 DuckDuckGo Lite，失败后用 Bing 备选
  try {
    return await searchDDG(query, maxResults);
  } catch {
    try {
      return await searchBing(query, maxResults);
    } catch (e: any) {
      throw new Error(`搜索失败: ${e.message}`);
    }
  }
}

async function searchDDG(query: string, maxResults: number): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  const html = await httpGet('lite.duckduckgo.com', `/lite?q=${encoded}`);
  const results: SearchResult[] = [];
  const linkRe = /<a[^>]*href="([^"]*)"[^>]*class="result-link"[^>]*>([^<]*)<\/a>/gi;
  const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  if (html.includes('class="result-link"')) {
    const links: Array<{ title: string; url: string }> = [];
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      links.push({ url: m[1], title: m[2].replace(/<[^>]*>/g, '').trim() });
    }
    const snippets: string[] = [];
    while ((m = snippetRe.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
    }
    for (let i = 0; i < Math.min(links.length, snippets.length, maxResults); i++) {
      results.push({ ...links[i], snippet: snippets[i] });
    }
  }
  if (results.length === 0) throw new Error('未找到结果');
  return results;
}

async function searchBing(query: string, maxResults: number): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  const html = await httpGet('www.bing.com', `/search?q=${encoded}&count=${maxResults}`);
  const results: SearchResult[] = [];
  // Bing 结果格式: <li class="b_algo"><h2><a href="url">title</a></h2><p>snippet</p>
  const blockRe = /<li class="b_algo">([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const block = m[1];
    const urlM = block.match(/<a[^>]*href="(https?:\/\/[^"]*)"/i);
    const titleM = block.match(/<a[^>]*>([^<]+)<\/a>/i);
    const snippetM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (urlM && titleM) {
      results.push({
        url: urlM[1].replace(/&amp;/g, '&'),
        title: titleM[1].replace(/<[^>]*>/g, '').trim(),
        snippet: snippetM ? snippetM[1].replace(/<[^>]*>/g, '').trim() : '',
      });
    }
    if (results.length >= maxResults) break;
  }
  if (results.length === 0) throw new Error('未找到结果');
  return results;
}
