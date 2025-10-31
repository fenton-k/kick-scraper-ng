import puppeteer from "puppeteer";
import { loadAuthData, refreshAuth } from "./auth.js";

export async function graphqlRequest(query, variables = {}, retryCount = 0) {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000;

  let { _ksr_session, csrf } = await loadAuthData();
  if (!_ksr_session || !csrf) ({ _ksr_session, csrf } = await refreshAuth());

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/122.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9",
  });

  try {
    // Set cookie first
    await page.setCookie({
      name: "_ksr_session",
      value: _ksr_session,
      domain: ".kickstarter.com",
      path: "/",
      httpOnly: true,
      secure: true,
    });

    // 🔹 Load a real page on the same origin before sending GraphQL
    await page.goto("https://www.kickstarter.com", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

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

    if (result.status === 0) throw new Error(result.error || "Fetch failed");
    if (result.status === 401 || result.status === 403) {
      console.warn(`⚠️ Got ${result.status}, refreshing auth...`);
      await browser.close();
      ({ _ksr_session, csrf } = await refreshAuth());
      return graphqlRequest(query, variables, retryCount + 1);
    }

    if (result.status === 429 && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY + Math.random() * 2000;
      console.warn(
        `⚠️ 429 Too Many Requests, retrying in ${Math.round(delay)}ms`
      );
      await browser.close();
      await new Promise((r) => setTimeout(r, delay));
      return graphqlRequest(query, variables, retryCount + 1);
    }

    if (result.json?.errors) {
      console.warn("⚠️ GraphQL returned errors:", result.json.errors);
    }

    return result.json ?? { status: result.status, raw: result.raw };
  } catch (err) {
    console.error("❌ GraphQL request failed:", err.message);
    throw err;
  } finally {
    await browser.close();
  }
}

// ✅ Test directly with: node graphql.js
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
  })();
}
