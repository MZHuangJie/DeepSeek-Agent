import https from 'https';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ============================================================
// HTTP 工具
// ============================================================

function httpRequest(
  hostname: string,
  path: string,
  options?: { method?: string; body?: string; timeout?: number }
): Promise<string> {
  const timeout = options?.timeout ?? 15000;
  const method = options?.method ?? 'GET';

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...(options?.body ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(options.body).toString(),
          } : {}),
        },
        timeout,
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const loc = res.headers.location;
          if (loc) {
            try {
              const u = new URL(loc);
              httpRequest(u.hostname, u.pathname + u.search, { method: 'GET', timeout })
                .then(resolve).catch(reject);
            } catch {
              reject(new Error('重定向失败'));
            }
          }
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      }
    );

    req.on('timeout', () => { req.destroy(); reject(new Error('搜索超时')); });
    req.on('error', reject);

    if (options?.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// 带重试的请求
async function httpRequestWithRetry(
  hostname: string,
  path: string,
  options?: { method?: string; body?: string; timeout?: number },
  retries = 1
): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await httpRequest(hostname, path, options);
    } catch (e) {
      if (i === retries) throw e;
      // 等 500ms 后重试
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('unreachable');
}


// ============================================================
// 搜索引擎
// ============================================================

export async function webSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  const engines: Array<{ name: string; fn: () => Promise<SearchResult[]> }> = [
    { name: 'Bing', fn: () => searchBing(query, maxResults) },
    { name: 'DuckDuckGo', fn: () => searchDDG(query, maxResults) },
    { name: 'Google', fn: () => searchGoogle(query, maxResults) },
  ];

  for (const engine of engines) {
    try {
      const results = await engine.fn();
      if (results.length > 0) return results;
    } catch (e: any) {
      // 当前引擎失败，尝试下一个
      continue;
    }
  }

  throw new Error('所有搜索引擎均失败');
}


// ============================================================
// DuckDuckGo HTML 搜索
// 接口: POST https://html.duckduckgo.com/html/
// 同时支持 GET 作为 fallback
// ============================================================

async function searchDDG(query: string, maxResults: number): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);

  // 先尝试 POST
  let html: string;
  try {
    html = await httpRequestWithRetry('html.duckduckgo.com', '/html/', {
      method: 'POST',
      body: `q=${encoded}`,
      timeout: 10000,
    });
  } catch {
    // POST 失败则尝试 GET
    html = await httpRequestWithRetry('html.duckduckgo.com', `/html/?q=${encoded}`, {
      method: 'GET',
      timeout: 10000,
    });
  }

  return parseDDGHTML(html, maxResults);
}

function parseDDGHTML(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML 版结构:
  // <div class="result results_links ...">
  //   <a class="result__a" href="...">标题</a>
  //   <a class="result__snippet">摘要</a>
  // </div>

  const blockRe = /<div class="result results_links[\s\S]*?<\/div>\s*<\/div>/gi;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(html)) !== null) {
    const block = m[0];

    const urlMatch = block.match(/class="result__a"[^>]*href="([^"]*)"/i);
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

    if (urlMatch && titleMatch) {
      let url = urlMatch[1]
        .replace(/&amp;/g, '&')
        .trim();

      // DDG 会把真实 URL 编码在 uddg 参数里，需要解码
      if (url.includes('uddg=')) {
        try {
          const decoded = decodeURIComponent(url);
          const uddgMatch = decoded.match(/uddg=([^&]+)/);
          if (uddgMatch) url = uddgMatch[1];
        } catch { /* keep original */ }
      }

      results.push({
        url,
        title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
        snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '',
      });
    }

    if (results.length >= maxResults) break;
  }

  if (results.length === 0) throw new Error('DDG 未找到结果');
  return results;
}


// ============================================================
// Bing 搜索
// ============================================================

async function searchBing(query: string, maxResults: number): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  // 优先用 cn.bing.com（国内可直连），失败再试 www.bing.com
  let html: string;
  try {
    html = await httpRequestWithRetry('cn.bing.com', `/search?q=${encoded}&count=${maxResults}`, { timeout: 10000 });
  } catch {
    html = await httpRequestWithRetry('www.bing.com', `/search?q=${encoded}&count=${maxResults}`, { timeout: 10000 });
  }

  const results: SearchResult[] = [];

  // cn.bing.com 结构:
  // <li class="b_algo" ...>
  //   <h2><a href="url">标题</a></h2>
  //   <p>摘要</p> 或 <div class="b_caption"><p>摘要</p></div>
  //   <a class="tilk" href="url">  (显示URL)
  // </li>

  // 先定位 ol#b_results
  const olMatch = html.match(/<ol[^>]*id="b_results"[^>]*>([\s\S]*?)<\/ol>/i);
  const searchArea = olMatch ? olMatch[1] : html;

  const blockRe = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(searchArea)) !== null) {
    const block = m[0];

    // 标题: <h2><a href="url">标题</a></h2>
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);

    if (titleMatch) {
      const url = titleMatch[1].replace(/&amp;/g, '&');
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();

      // 摘要: <p class="b_lineclamp..."> 或 <div class="b_caption"> 中的 <p>
      let snippet = '';
      const snippetM = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
                    || block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
                    || block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (snippetM) {
        snippet = snippetM[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }

      if (title && url) {
        results.push({ url, title, snippet });
      }
    }

    if (results.length >= maxResults) break;
  }

  if (results.length === 0) throw new Error('Bing 未找到结果');
  return results;
}


// ============================================================
// Google 搜索（HTML 爬取，无需 API Key）
// ============================================================

async function searchGoogle(query: string, maxResults: number): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  const html = await httpRequestWithRetry('www.google.com', `/search?q=${encoded}&num=${maxResults}&hl=zh-CN`, { timeout: 10000 });

  const results: SearchResult[] = [];

  // Google 搜索结果结构:
  // <div class="g"> ... <a href="url"><h3>标题</h3></a> ... <span class="st">摘要</span> ... </div>
  // 或用正则匹配: <a href="/url?q=REAL_URL&..."><h3>标题</h3></a>

  // 方式1: 匹配 /url?q= 格式的链接（Google 自己的跳转链接）
  const blockRe = /<a href="\/url\?q=(https?:\/\/[^"&]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = m[1].replace(/&amp;/g, '&');
    const titleBlock = m[2];

    // 提取标题（去掉 HTML 标签）
    const titleMatch = titleBlock.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
      : titleBlock.replace(/<[^>]*>/g, '').trim();

    // 尝试找摘要
    const snippetMatch = html.substring(m.index).match(/<span class="[^"]*st[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    if (title && rawUrl && !results.find(r => r.url === rawUrl)) {
      results.push({ url: decodeURIComponent(rawUrl), title, snippet });
    }
  }

  if (results.length === 0) throw new Error('Google 未找到结果');
  return results;
}
