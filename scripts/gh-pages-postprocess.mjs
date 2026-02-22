import { promises as fs } from 'node:fs';
import path from 'node:path';

const distDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('dist');
const basePathRaw =
  process.env.GH_PAGES_BASE_PATH ??
  process.env.EXPO_BASE_URL ??
  process.env.BASE_PATH ??
  '';

const basePath = String(basePathRaw).replace(/^\/+/, '').replace(/\/+$/, '');
const prefix = basePath ? `/${basePath}` : '';

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(full)));
    } else {
      results.push(full);
    }
  }

  return results;
}

function injectBaseEnv(html) {
  // The base URL is now baked into the bundle via experiments.baseUrl in
  // app.config.js, so we no longer need to inject runtime globals for
  // expo-router's path handling.  We keep only the NODE_ENV polyfill
  // (some older RN web polyfills reference window.process).
  const injection =
    `<script>\n` +
    `window.process = window.process || {};\n` +
    `window.process.env = window.process.env || {};\n` +
    `window.process.env.NODE_ENV = window.process.env.NODE_ENV || 'production';\n` +
    `</script>`;

  if (html.includes("window.process.env.NODE_ENV = window.process.env.NODE_ENV || 'production'")) {
    return html;
  }

  const marker = 'globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>';
  const markerIndex = html.indexOf(marker);
  if (markerIndex !== -1) {
    const insertAt = markerIndex + marker.length;
    return html.slice(0, insertAt) + injection + html.slice(insertAt);
  }

  // Fallback: insert before closing head.
  const headCloseIndex = html.indexOf('</head>');
  if (headCloseIndex !== -1) {
    return html.slice(0, headCloseIndex) + injection + html.slice(headCloseIndex);
  }

  return injection + html;
}

function rewriteAbsolutePaths(html) {
  if (!prefix) return html;

  // Prefix root-absolute URL attributes that don't already start with the base
  // path (Expo's export with experiments.baseUrl already prefixes some URLs).
  // Avoid protocol-relative URLs ("//example.com") and already-prefixed URLs.
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withPrefixedAttrs = html
    .replace(new RegExp(`\\bhref="\\/(?!\\/)(?!${escaped.slice(1)}\\/)`, 'g'), `href="${prefix}/`)
    .replace(new RegExp(`\\bsrc="\\/(?!\\/)(?!${escaped.slice(1)}\\/)`, 'g'), `src="${prefix}/`)
    .replace(new RegExp(`\\bcontent="\\/(?!\\/)(?!${escaped.slice(1)}\\/)`, 'g'), `content="${prefix}/`);

  return withPrefixedAttrs;
}

async function main() {
  if (!(await exists(distDir))) {
    console.error(`dist directory not found: ${distDir}`);
    process.exit(1);
  }

  // GitHub Pages + Jekyll will ignore directories starting with "_" unless this exists.
  await fs.writeFile(path.join(distDir, '.nojekyll'), '');

  const files = await listFilesRecursive(distDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));

  for (const htmlPath of htmlFiles) {
    const original = await fs.readFile(htmlPath, 'utf8');

    let next = original;
    next = injectBaseEnv(next);
    next = rewriteAbsolutePaths(next);

    if (next !== original) {
      await fs.writeFile(htmlPath, next);
    }
  }

  // SPA fallback for GitHub Pages: always overwrite 404.html with index.html
  // so unknown paths (e.g. /pdf?query=...) load the full SPA instead of the
  // expo-router +not-found pre-render.
  const indexHtmlPath = path.join(distDir, 'index.html');
  const notFoundPath = path.join(distDir, '404.html');
  if (await exists(indexHtmlPath)) {
    await fs.copyFile(indexHtmlPath, notFoundPath);
  }

  console.log(
    prefix
      ? `Post-processed HTML for GitHub Pages base path: ${prefix}/`
      : 'Post-processed HTML for GitHub Pages (no base path)'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
