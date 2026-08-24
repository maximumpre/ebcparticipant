/**
 * SSR HTML twin of components/ErrorScreen.tsx for denied bots (no JS required).
 * Keep visual parity: Chrome-style ERR_NAME_NOT_RESOLVED.
 */
export function buildErrorScreenHtml(hostname: string): string {
  const safeHost = hostname.replace(/[<>&"']/g, "")
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${safeHost}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;background:#202124;color:#9AA0A6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:6rem 1rem}
  .wrap{max-width:42rem;margin:0 auto}
  img{display:block;margin-bottom:2rem;width:72px;height:72px;image-rendering:pixelated}
  h1{font-size:1.5rem;font-weight:600;color:#9AA0A6}
  p{margin-top:1rem;font-size:15px}
  ul{margin-top:.5rem;padding-left:2rem;font-size:15px}
  li{margin:.5rem 0}
  .link{color:#8ABFF8}
  .err{font-size:12px;margin-top:1.25rem}
</style>
</head>
<body>
  <div class="wrap">
    <img src="/error-icon.png" alt="" width="72" height="72"/>
    <h1>This site can't be reached</h1>
    <p><b>${safeHost}</b> took too long to respond.</p>
    <p>Try:</p>
    <ul>
      <li>Checking the connection</li>
      <li class="link">Checking the proxy, firewall, and DNS configuration</li>
      <li class="link">Running Windows Network Diagnostics</li>
    </ul>
    <p class="err">ERR_NAME_NOT_RESOLVED</p>
  </div>
</body>
</html>`
}
