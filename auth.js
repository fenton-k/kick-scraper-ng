import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";

const cookiesPath = path.resolve("./cookies.json");
const headersPath = path.resolve("./headers.json");

/**
 * Save _ksr_session and CSRF token to disk
 */
async function saveAuthData(_ksr_session, csrf) {
  await fs.writeFile(cookiesPath, JSON.stringify({ _ksr_session }, null, 2));
  await fs.writeFile(
    headersPath,
    JSON.stringify({ "X-CSRF-Token": csrf }, null, 2)
  );
  console.log("✅ Saved _ksr_session and CSRF token to disk.");
}

/**
 * Load cookies and CSRF token from disk
 */
export async function loadAuthData() {
  try {
    const [cookieRaw, headerRaw] = await Promise.all([
      fs.readFile(cookiesPath, "utf8"),
      fs.readFile(headersPath, "utf8"),
    ]);
    const cookieObj = JSON.parse(cookieRaw);
    const headerObj = JSON.parse(headerRaw);
    return {
      _ksr_session: cookieObj._ksr_session,
      csrf: headerObj["X-CSRF-Token"],
    };
  } catch {
    return { _ksr_session: null, csrf: null };
  }
}

/**
 * Use Puppeteer to visit Kickstarter and extract session + CSRF token
 */
export async function refreshAuth() {
  console.log("🔄 Launching Puppeteer to refresh session...");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();

  // Pretend to be a real browser
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/122.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "accept-language": "en-US,en;q=0.9",
  });

  try {
    // Navigate to Kickstarter homepage and wait until fully loaded
    await page.goto("https://www.kickstarter.com", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Try to extract CSRF token
    const csrf = await page.$eval(
      'meta[name="csrf-token"]',
      (el) => el.content
    );

    // Grab all cookies and find _ksr_session
    const cookies = await page.cookies();
    const sessionCookie = cookies.find((c) => c.name === "_ksr_session")?.value;

    if (!sessionCookie) {
      throw new Error("❌ Could not find _ksr_session cookie");
    }
    if (!csrf) {
      throw new Error("❌ Could not extract CSRF token");
    }

    await saveAuthData(sessionCookie, csrf);
    console.log("✅ Session refresh successful.");
    return { _ksr_session: sessionCookie, csrf };
  } catch (err) {
    console.error("❌ Failed to refresh auth:", err.message);
    throw err;
  } finally {
    await browser.close();
  }
}

// Optional: quick standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await refreshAuth();
  })();
}
