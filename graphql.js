import puppeteer from "puppeteer";
import { loadAuthData, refreshAuth } from "./auth.js";
import { sleep } from "./utils.js";
import fs from "fs/promises";
import path from "path";

const cookiesPath = path.resolve("./cookies.json");
const headersPath = path.resolve("./headers.json");

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY = 3000;
const RATE_LIMIT_DELAY = 1500;

let browser = null;
let page = null;
let lastRequestTime = 0;

// ---------- Utility: refresh CSRF directly from live DOM ----------
async function getLiveCsrf(page) {
  try {
    return await page.$eval('meta[name="csrf-token"]', (el) => el.content);
  } catch {
    return null;
  }
}

// ---------- Launch shared browser ----------
async function getPage() {
  if (!browser) {
    console.log("🌐 Launching shared browser...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
    });
  }
  return page;
}

// ---------- Graceful cleanup ----------
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    console.log("👋 Closed shared browser instance.");
  }
}

// ---------- Main request ----------
export async function graphqlRequest(query, variables = {}, retryCount = 0) {
  const now = Date.now();
  const sinceLast = now - lastRequestTime;
  if (sinceLast < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - sinceLast);
  }
  lastRequestTime = Date.now();

  const page = await getPage();
  let { _ksr_session } = await loadAuthData();

  if (!_ksr_session) ({ _ksr_session } = await refreshAuth());

  // Ensure cookie set & visit home if needed
  const cookies = await page.cookies("https://www.kickstarter.com");
  const hasCookie = cookies.some((c) => c.name === "_ksr_session");
  if (!hasCookie) {
    await page.setCookie({
      name: "_ksr_session",
      value: _ksr_session,
      domain: ".kickstarter.com",
      path: "/",
      httpOnly: true,
      secure: true,
    });
    await page.goto("https://www.kickstarter.com", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
  }

  // Get live CSRF from DOM, not file
  const csrf = await getLiveCsrf(page);
  if (!csrf) {
    console.warn("⚠️ No CSRF found in DOM, refreshing auth...");
    await refreshAuth();
    return graphqlRequest(query, variables, retryCount + 1);
  }

  try {
    const result = await page.evaluate(
      async ({ query, variables, csrf }) => {
        try {
          const res = await fetch("https://www.kickstarter.com/graph", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
              Accept: "application/json, text/plain, */*",
              Referer: "https://www.kickstarter.com/",
              Origin: "https://www.kickstarter.com",
            },
            body: JSON.stringify({ query, variables }),
          });

          const text = await res.text();
          return {
            status: res.status,
            ok: res.ok,
            json: (() => {
              try {
                return JSON.parse(text);
              } catch {
                return null;
              }
            })(),
            raw: text,
          };
        } catch (err) {
          return { status: 0, error: err.message };
        }
      },
      { query, variables, csrf }
    );

    // --- Handle responses ---
    if (result.status === 0) throw new Error(result.error || "Fetch failed");

    if ([401, 403].includes(result.status)) {
      if (retryCount >= MAX_RETRIES) throw new Error("Auth failed repeatedly");
      console.warn(`⚠️ ${result.status} Forbidden — refreshing auth...`);
      await refreshAuth();
      await sleep(2000);
      return graphqlRequest(query, variables, retryCount + 1);
    }

    if (result.status === 429 && retryCount < MAX_RETRIES) {
      const delay =
        RETRY_BASE_DELAY * Math.pow(1.5, retryCount) + Math.random() * 1000;
      console.warn(
        `⏳ 429 Too Many Requests, retrying in ${Math.round(delay)}ms`
      );
      await sleep(delay);
      return graphqlRequest(query, variables, retryCount + 1);
    }

    if (result.json?.errors) {
      console.warn("⚠️ GraphQL returned errors:", result.json.errors);
    }

    return result.json ?? { status: result.status, raw: result.raw };
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY + Math.random() * 2000;
      console.warn(
        `⚠️ Network error, retrying in ${Math.round(delay)}ms (${err.message})`
      );
      await sleep(delay);
      return graphqlRequest(query, variables, retryCount + 1);
    }
    console.error("❌ GraphQL request failed:", err.message);
    throw err;
  }
}

// ---------- Optional test ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const query = `
      query FindProject($slug: String!) {
        project(slug: $slug) {
          id
          name
          creator { name }
        }
      }
    `;
    const variables = { slug: "coolest-cooler" };
    const data = await graphqlRequest(query, variables);
    console.log("✅ GraphQL result:", JSON.stringify(data, null, 2));
    await closeBrowser();
  })();
}
