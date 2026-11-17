// Daily refresh of open roles and company news into data/feed.json.
// Runs in GitHub Actions (.github/workflows/refresh.yml) or locally: `node scripts/refresh.mjs`.
// No dependencies, no API keys: public Ashby posting API, Personio XML, Google News RSS.
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { familyOf } from "../lib/role-family.mjs"

const ROOT = new URL("../", import.meta.url)
const read = (p) => JSON.parse(readFileSync(new URL(p, ROOT), "utf8"))
const companies = read("data/companies.json")
const sources = read("data/sources.json").companies
const feedPath = new URL("data/feed.json", ROOT)
const prev = existsSync(feedPath) ? JSON.parse(readFileSync(feedPath, "utf8")) : { companies: {} }

const today = new Date().toISOString().slice(0, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const UA = { "user-agent": "funding-radar-refresh/1.0 (funding radar)" }

/* ---------------------------------- roles --------------------------------- */

// Role families (design, engineering, product, data, other) come from one rules file shared with the app.

async function ashby(slug) {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=false`, {
    headers: UA,
  })
  if (!res.ok) throw new Error(`Ashby ${slug}: HTTP ${res.status}`)
  const jobs = (await res.json()).jobs.filter((j) => j.isListed !== false)
  return jobs.map((j) => ({
    title: j.title.trim(),
    url: j.jobUrl,
    loc: j.location ?? "",
    published: j.publishedAt?.slice(0, 10) ?? null,
  }))
}

const xmlText = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""
}
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")

async function personio(sub) {
  const res = await fetch(`https://${sub}.jobs.personio.de/xml`, { headers: UA })
  if (!res.ok) throw new Error(`Personio ${sub}: HTTP ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<position>([\s\S]*?)<\/position>/g)].map(([, p]) => ({
    title: decode(xmlText(p, "name")),
    url: `https://${sub}.jobs.personio.de/job/${xmlText(p, "id")}`,
    loc: decode(xmlText(p, "office")),
    published: xmlText(p, "createdAt").slice(0, 10) || null,
  }))
}

async function roles(name, src, before) {
  const careers = src?.careers
  if (!careers) return null
  try {
    const all = careers.type === "ashby" ? await ashby(careers.slug) : await personio(careers.slug)
    const of = (fam) => all.filter((j) => familyOf(j.title) === fam)
    const design = of("design")
    const families = { engineering: of("engineering"), product: of("product"), data: of("data") }
    const counts = {
      design: design.length,
      engineering: families.engineering.length,
      product: families.product.length,
      data: families.data.length,
      other: all.length - design.length - families.engineering.length - families.product.length - families.data.length,
    }
    const history = [
      ...(before?.history ?? []).filter((h) => h.date !== today),
      { date: today, total: all.length, design: design.length, counts },
    ].slice(-60)
    return { total: all.length, design, families, counts, source: careers.type, checked: today, history }
  } catch (e) {
    console.warn(`roles ${name}: ${e.message}`)
    // Keep the last good snapshot; the panel shows its date, and the error.
    return before
      ? { ...before, error: e.message }
      : { error: e.message, checked: null, design: [], total: null, history: [] }
  }
}

/* ---------------------------------- news ---------------------------------- */

// TODO(claude-api): tags are keyword rules. With an API key (Denys's decision) Claude could tag and summarise instead.
const TAGS = [
  [
    "hire",
    /\b(appoints?|appointed|hires?|hired|joins? .{0,40}\bas (ceo|cto|cpo|coo|cfo|chief|head|vp)|names? .{0,40}(ceo|cto|cpo|coo|cfo)|new (ceo|cto|cpo|coo|cfo)|chief [a-z]+ officer|head of (design|product)|vp of (design|product))\b/i,
  ],
  [
    "funding",
    /\b(raises?|raised|funding|series [a-f]|seed|pre-seed|secures?|lands?|obtains?|snaps?|financ\w*|investment|invests?|stakes?|valuation|unicorn|millionen)\b/i,
  ],
  [
    "launch",
    /\b(launch(es|ed)?|unveils?|introduces?|rolls? out|releases?|debuts?|expands? to|opens? (an? )?office)\b/i,
  ],
]
// Data-broker and SEO pages, video and game sites: not news about the company.
const SKIP_SOURCES =
  /^(Revelio Labs|Clay|YouTube|OpenCritic|Crunchbase|PitchBook|Tracxn|CB Insights|LeadIQ|ZoomInfo|Craft\.co|Getlatka)$/i
const tagOf = (title) => TAGS.find(([, re]) => re.test(title))?.[0] ?? "other"
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

async function news(name, src) {
  const cfg = src?.news
  if (!cfg) return null
  const q = encodeURIComponent(`"${cfg.name}"`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=DE&ceid=DE:en`
  let res = await fetch(url, { headers: UA })
  for (let attempt = 1; res.status === 429 && attempt <= 3; attempt++) {
    await sleep(15000 * attempt) // rate limited: back off and try again
    res = await fetch(url, { headers: UA })
  }
  if (!res.ok) throw new Error(`Google News ${name}: HTTP ${res.status}`)
  const xml = await res.text()
  // The name as a whole word, case-sensitive, so "Moss" does not match "moss" or "Mossberg".
  const nameRe = new RegExp(`(^|[^\\p{L}\\p{N}])${esc(cfg.name)}(?=$|[^\\p{L}\\p{N}])`, "u")
  // Context words as whole words ("AI" must not match inside "entertainment").
  const requireRe = cfg.require.length
    ? new RegExp(`(^|[^\\p{L}\\p{N}])(${cfg.require.map(esc).join("|")})(?=$|[^\\p{L}\\p{N}])`, "iu")
    : null
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const source = it.match(/<source url="([^"]*)">([\s\S]*?)<\/source>/)
    const rawTitle = decode(xmlText(it, "title"))
    const sourceName = source ? decode(source[2]) : ""
    const title =
      sourceName && rawTitle.endsWith(` - ${sourceName}`) ? rawTitle.slice(0, -(sourceName.length + 3)) : rawTitle
    const description = decode(xmlText(it, "description")).replace(/<[^>]+>/g, " ")
    return {
      title,
      url: decode(xmlText(it, "link")),
      source: sourceName,
      sourceUrl: source ? source[1] : "",
      date: new Date(xmlText(it, "pubDate")).toISOString().slice(0, 10),
      text: `${title} ${description}`,
    }
  })
  const seen = new Set()
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
  return items
    .filter((i) => i.url && i.date >= yearAgo && !SKIP_SOURCES.test(i.source))
    .filter((i) => nameRe.test(i.title) && (!requireRe || requireRe.test(i.text)))
    .filter((i) => !seen.has(i.title.toLowerCase()) && seen.add(i.title.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((i) => ({
      title: i.title,
      url: i.url,
      source: i.source,
      sourceUrl: i.sourceUrl,
      date: i.date,
      tag: tagOf(i.title),
    }))
}

/* ---------------------------------- run ----------------------------------- */

const out = { generated: today, companies: {} }
for (const c of companies) {
  const src = sources[c.name]
  const before = prev.companies?.[c.name] ?? {}
  const entry = {}
  const r = await roles(c.name, src, before.roles)
  if (r) entry.roles = r
  if (src?.news) {
    try {
      entry.news = await news(c.name, src)
      entry.newsChecked = today
    } catch (e) {
      console.warn(`news ${c.name}: ${e.message}`)
      entry.news = before.news ?? []
      entry.newsChecked = before.newsChecked ?? null
      entry.newsError = e.message
    }
    await sleep(2500)
  }
  out.companies[c.name] = entry
  await sleep(300)
}
writeFileSync(feedPath, JSON.stringify(out, null, 1) + "\n")
const n = Object.values(out.companies)
console.log(
  `roles: ${n.filter((e) => e.roles && !e.roles.error).length} ok, ${n.filter((e) => e.roles?.error).length} failed · ` +
    `news: ${n.filter((e) => e.news?.length).length} companies with items`,
)
