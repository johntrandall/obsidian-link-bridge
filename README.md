# obsidian-link-bridge

A **self-hosted** https-to-Obsidian link bridge. Apps such as Google Calendar only make https links
clickable, so an `obsidian://` link in an event description is dead text. Point those apps at a bridge link on
your own domain instead; the page opens the note in Obsidian. It is a few static files, runs no server code
and keeps no record of what you open.

```
https://links.example.com/obsidian#vault=Notes&filepath=projects%2FPlan.md&openmode=tab
        → obsidian://advanced-uri?vault=Notes&filepath=projects%2FPlan.md&openmode=tab
```

## In plain terms

Google Calendar, email and most chat apps only make ordinary web links clickable, so a link to a note in Obsidian
shows up as dead text. This gives each note a normal web address on your own domain: click it, and the note opens in
Obsidian. It saves the small daily hunt for the right note before a meeting.

- Privacy-preserving: the website in the middle never sees which note you're opening.
- Nothing to maintain: a single web page on your own domain, free to host, with no server of your own to run.
- Safe by design: it can only open notes, so a link someone else sends can't make Obsidian do anything else.

## Prior art, and why yet another one

Yes, this is yet another Obsidian link bridge; sorry about that. Others got there first, and they are worth a look:

- [obsid.net](https://obsid.net) ([source](https://github.com/jdevalk/obsid.net)): a redirect service, also
  self-hostable as a Cloudflare Worker, that turns `vault` and `file` query parameters into `obsidian://open` links.
- [Ibraheem-Khalil/obsidian-link-bridge](https://github.com/Ibraheem-Khalil/obsidian-link-bridge) (2025): a
  one-page redirect that reads `vault` and `file` from the query string and opens `obsidian://open`.
- [SvenAkk/obsidian-link-bridge](https://github.com/SvenAkk/obsidian-link-bridge): a static page on GitHub Pages
  that carries a note path and line in the URL fragment and opens it with Advanced URI.

Why another one: the two GitHub bridges carry no license, and without one nobody may legally copy, modify or
redistribute their code. obsid.net is MIT-licensed (stated on its site) and self-hostable, but it reads the note
from the query string in server code and only produces `obsidian://open` links. This project keeps the note out of
every request, runs no server code, supports Advanced URI, and is **MIT-licensed** (see [LICENSE](LICENSE)): fork
it, change it, ship it.

As far as we can tell (checked 2026-10-15), it is also the most complete of the four:

| | obsid.net | Ibraheem-Khalil | SvenAkk | this project |
|---|---|---|---|---|
| Runs on your own domain | Yes (self-host the Worker), or use obsid.net | Yes | Yes (GitHub Pages) | Yes |
| Note name never sent to the server | No (query string) | No (query string) | Yes (fragment) | Yes (fragment) |
| Any vault | Yes | Yes | No (vault fixed in the code) | Yes |
| Built-in `obsidian://open` | Yes | Yes | No | Yes |
| [Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri) (new tab, heading, block, line) | No | No | Line only | Yes |
| Only ever opens notes | Yes (fixed parameters) | Yes (fixed parameters) | Yes (fixed parameters) | Yes (explicit allowlist) |
| Runs no server code | No (Worker reads the query) | Yes | Yes | Yes |
| Deploy kit | Cloudflare Worker (`wrangler`) | No | GitHub Pages | Cloudflare Workers script; any static host |
| License | MIT (stated on obsid.net; no LICENSE file in the repo) | None | None | MIT |

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
| `filepath=` | `obsidian://advanced-uri?…` (Advanced URI plugin; `openmode=tab` opens a new tab) | `vault` `filepath` `openmode` `viewmode` `heading` `block` `line` |
| `file=` or `path=` | `obsidian://open?…` (built into Obsidian) | `vault` `file` `path` `paneType` |

Encode values with `encodeURIComponent` (Python: `urllib.parse.quote(value, safe='')`). A literal `+` stays a `+`.

## Self-hosting

The site is deployed as a Cloudflare [Workers static-assets](https://developers.cloudflare.com/workers/static-assets/)
project with no Worker script, which fits the free plan. For other hosts, see [Other static hosts](#other-static-hosts).

### What you need

- A Cloudflare account, and a domain whose DNS is on Cloudflare. The bridge gets its own hostname in that
  domain, for example `links.example.com`; Cloudflare creates the DNS record and certificate.
- Node.js 18 or later (for the tests) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/):
  `npm install -g wrangler` or `brew install cloudflare-wrangler`.
- Obsidian on the computer where you click the links. For `filepath=` links, the Advanced URI plugin.

### 1. Get the code

```bash
git clone https://github.com/johntrandall/obsidian-link-bridge
cd obsidian-link-bridge
node --test test/
```

### 2. Create a Cloudflare API token

In the Cloudflare dashboard: **My Profile → API Tokens → Create Token**, use the **Edit Cloudflare Workers**
template, set **Account Resources** to your account and **Zone Resources** to the zone your hostname is in,
then create it and copy the token. Your account ID is in the dashboard URL
(`dash.cloudflare.com/<account id>/…`) and on the account's overview page.

### 3. Configure

```bash
cp deploy.env.example deploy.env
```

Fill in `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` and `BRIDGE_DOMAIN` (the hostname, without `https://`).
`deploy.env` is git-ignored; keep it that way. If you use 1Password, the values can be secret references
(`op://vault/item/field`); `deploy.sh` then runs Wrangler under `op run`, so the token is never written to disk.

### 4. Deploy

```bash
./deploy.sh
```

It runs the tests, then `wrangler deploy --domain "$BRIDGE_DOMAIN"`. Run it again after any change.

### 5. Check it

```bash
curl -sI https://links.example.com/obsidian        # HTTP 200, x-robots-tag: noindex
curl -s -H 'Accept: text/html' https://links.example.com/obsidian | grep -c cloudflareinsights   # 0
```

Then open a bridge link to a real note in your browser, tick **Always allow** when it asks to open Obsidian,
and confirm the note opens. Put bridge links wherever you need clickable note links.

### Cloudflare Web Analytics

If Web Analytics is on for your zone (Analytics & Logs → Web Analytics; it may already be on), Cloudflare adds
its beacon `<script>` to HTML responses at the edge. In our testing it did so for requests that send
`Accept: text/html`, which browsers do and a plain `curl` does not, so it is easy to miss. The page blocks the
script with its Content Security Policy, and `public/_headers` sends `Cache-Control: no-transform`, which stops
the injection. The second `curl` above checks it.

### Removing it

`wrangler delete` removes the Worker. Then delete the hostname's DNS record in the Cloudflare dashboard if it
remains.

### Other static hosts

Any static host works: serve `public/` and make `/obsidian` return `obsidian.html`. `public/_headers` uses the
Cloudflare/Netlify format; on other hosts, set the same response headers in their own configuration.

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

## Files

| Path | What |
|---|---|
| `public/obsidian.html` | The page, served at `/obsidian` |
| `public/obsidian.js` | Fragment → `obsidian://` URI, with the allowlist; also loads in Node for the tests |
| `public/_headers` | Response headers (security, `noindex`, `no-transform`); not served as a file |
| `public/index.html`, `public/bridge.css`, `public/robots.txt` | Root page, styles (light and dark), crawl block |
| `test/obsidian.test.js` | `node --test test/` |
| `wrangler.jsonc` | Worker config: static assets only, `workers.dev` and observability off, no hostname |
| `deploy.sh`, `deploy.env.example` | Test-and-deploy script and its settings template |

## License

MIT. See [LICENSE](LICENSE).

Not affiliated with or endorsed by Obsidian. "Obsidian" is a trademark of its owner; the name is used here only
to say what the bridge opens.
