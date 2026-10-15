# obsidian-link-bridge

A one-page static site that turns an https link into an `obsidian://` link, so links to Obsidian notes
are clickable in apps that only make https links clickable: Google Calendar event descriptions, many chat,
email and ticket tools. You host it yourself; it runs no server code and keeps no logs of what you open.

```
https://links.example.com/obsidian#vault=Notes&filepath=projects%2FPlan.md&openmode=tab
        → obsidian://advanced-uri?vault=Notes&filepath=projects%2FPlan.md&openmode=tab
```

## How it works

The Obsidian parameters travel in the URL **fragment**, the part after `#`. Browsers never send the fragment
to the server, so the host only ever receives `GET /obsidian`; no vault or note name reaches it or its logs.
A few lines of JavaScript in the page read the fragment, check it against an allowlist, build the
`obsidian://` URI and navigate to it. The page also shows the note's name and an "Open in Obsidian" button,
in case the browser blocks the automatic hand-off.

The first time a browser opens a bridge link it asks whether the site may open Obsidian. Tick
**Always allow** and later clicks open Obsidian directly.

## Link format

Take an Obsidian link's query string and put it after `https://<your host>/obsidian#`:

| Obsidian link | Bridge link |
|---|---|
| `obsidian://advanced-uri?vault=Notes&filepath=projects%2FPlan.md&openmode=tab` | `https://links.example.com/obsidian#vault=Notes&filepath=projects%2FPlan.md&openmode=tab` |
| `obsidian://open?vault=Notes&file=inbox%2FIdeas` | `https://links.example.com/obsidian#vault=Notes&file=inbox%2FIdeas` |

The page picks the action from the parameters:

| Fragment has | Opens | Allowed parameters |
|---|---|---|
| `filepath=` | `obsidian://advanced-uri?…` ([Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri) plugin; `openmode=tab` opens a new tab) | `vault` `filepath` `openmode` `viewmode` `heading` `block` `line` |
| `file=` or `path=` | `obsidian://open?…` (built into Obsidian) | `vault` `file` `path` `paneType` |

Encode values with `encodeURIComponent` (Python: `urllib.parse.quote(value, safe='')`). A literal `+` stays a `+`.

## Security model

Advanced URI can also run commands and write files (`commandid`, `data`, `mode`, …). After you tick
"Always allow", any link to your bridge opens Obsidian without asking, so a link someone else crafts would
run without a prompt. The page therefore forwards **only the "open a note" parameters** above. Any other
parameter, a repeated parameter, an empty target or broken encoding is refused, and nothing opens.

The page loads nothing from other sites and is served with a strict Content Security Policy
(`default-src 'none'; script-src 'self'; style-src 'self'`), `Referrer-Policy: no-referrer`,
`X-Frame-Options: DENY` and `X-Robots-Tag: noindex`. `robots.txt` disallows everything.

What the bridge cannot hide: the app that shows the link sees the whole link. For example, Google Calendar
stores it in the event, and its click-through redirect (`google.com/url?q=…`) passes the full URL, fragment
included, through Google.

## Deploy your own (Cloudflare Workers)

The site is plain static files, deployed as a [Workers static-assets](https://developers.cloudflare.com/workers/static-assets/)
project with no Worker script. It fits the free plan. You need a domain whose DNS is on Cloudflare.

```bash
git clone https://github.com/johntrandall/obsidian-link-bridge && cd obsidian-link-bridge
npm install -g wrangler            # or: brew install cloudflare-wrangler
cp deploy.env.example deploy.env   # fill in account id, API token, hostname
./deploy.sh                        # runs the tests, then: wrangler deploy --domain "$BRIDGE_DOMAIN"
curl -sI https://links.example.com/obsidian
```

- **API token:** create one from the "Edit Cloudflare Workers" template, with zone access to the zone your
  hostname is in. `wrangler deploy --domain` creates the DNS record and certificate for the hostname.
- **1Password:** `deploy.env` values may be secret references (`op://vault/item/field`). `deploy.sh` then
  runs `wrangler` under `op run`, so the token never touches disk.
- `deploy.env` is git-ignored. Keep it that way.

### Cloudflare Web Analytics will inject a script unless you stop it

If Web Analytics is on for your zone (check Analytics & Logs → Web Analytics; it may already be on), Cloudflare
adds its beacon `<script>` to HTML responses at the edge. In our testing it did so for requests that send
`Accept: text/html`, which browsers do and a plain `curl` does not, so it is easy to miss. The CSP above blocks
the script, and `public/_headers` sends `Cache-Control: no-transform`, which stops the injection. Check your
deployment with:

```bash
curl -s -H 'Accept: text/html' https://links.example.com/obsidian | grep -c cloudflareinsights   # expect 0
```

### Other static hosts

Any static host works: serve `public/` and make `/obsidian` return `obsidian.html`. `public/_headers` uses the
Cloudflare/Netlify format; on other hosts, set the same response headers in their own configuration.

## Files

| Path | What |
|---|---|
| `public/obsidian.html` | The page, served at `/obsidian` |
| `public/obsidian.js` | Fragment → `obsidian://` URI, with the allowlist; also loads in Node for the tests |
| `public/_headers` | Response headers (security, `noindex`, `no-transform`); not served as a file |
| `public/index.html`, `public/bridge.css`, `public/robots.txt` | Root page, styles (light and dark), crawl block |
| `test/obsidian.test.js` | `node --test test/` (Node 18+) |
| `wrangler.jsonc` | Worker config: static assets only, `workers.dev` and observability off, no hostname |
| `deploy.sh`, `deploy.env.example` | Test-and-deploy script and its settings template |

## License

MIT. See [LICENSE](LICENSE).
