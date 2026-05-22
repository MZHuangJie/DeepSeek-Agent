import https from 'https';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string, maxResults = 10): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  const path = `/lite?q=${encoded}`;

  const html = await new Promise<string>((resolve, reject) => {
    const opts = {
      hostname: 'lite.duckduckgo.com',
      path,
      headers: { 'User-Agent': 'DeepSeek-Agent/1.0' },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });

  return parseDuckDuckGoLite(html, maxResults);
}

function parseDuckDuckGoLite(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  // DuckDuckGo Lite format: table rows with links and snippets
  const rowRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>\s*<span[^>]*>([^<]*)<\/span>/gi;
  // Simpler approach: extract all <a> then match with snippets
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*class="result-link"[^>]*>([^<]*)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  if (html.includes('class="result-link"')) {
    // Modern Lite format
    const links: Array<{ title: string; url: string }> = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      links.push({ url: m[1], title: m[2].replace(/<[^>]*>/g, '').trim() });
    }
    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
    }
    for (let i = 0; i < Math.min(links.length, snippets.length, maxResults); i++) {
      results.push({ ...links[i], snippet: snippets[i] });
    }
  } else {
    // Fallback: generic link extraction
    const linkRegex2 = /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = linkRegex2.exec(html)) !== null && results.length < maxResults) {
      const url = m[1];
      const title = m[2].replace(/<[^>]*>/g, '').trim();
      if (!url.includes('duckduckgo.com') && title.length > 2 && !title.startsWith('<')) {
        results.push({ url, title, snippet: '' });
      }
    }
  }

  return results;
}
