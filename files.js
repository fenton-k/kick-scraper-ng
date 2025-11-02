import fs from "fs/promises";

const FILE_PATH = "./projects.json";
const RATES_PATH = "./exchange-rates.json";

/** Load exchange rates once per run */
let cachedRates = null;
async function loadExchangeRates() {
  if (cachedRates) return cachedRates;
  try {
    const text = await fs.readFile(RATES_PATH, "utf8");
    const parsed = JSON.parse(text);
    const rates = parsed?.rates || parsed;
    if (!rates?.USD) throw new Error("Missing USD rate");
    cachedRates = rates;
    console.log(`💱 Rates loaded (base: ${parsed.base_code || "USD"})`);
    return rates;
  } catch (err) {
    console.warn("⚠️ Could not load exchange rates. Using fallback {USD:1}");
    cachedRates = { USD: 1 };
    return cachedRates;
  }
}

/** Convert amount to USD using provided rates */
function normalizeToUSD(amount, currency, rates) {
  const numeric = parseFloat(amount || 0);
  const rate = rates[currency];
  if (!rate) {
    console.warn(`⚠️ Unknown currency: ${currency}, leaving unchanged.`);
    return {
      usd: numeric,
      original: { amount: numeric, currency, rate: 1 },
    };
  }
  // Open ER API gives 1 USD = X currency
  // So to go from foreign → USD, divide
  const usd = numeric / rate;
  return {
    usd: parseFloat(usd.toFixed(2)),
    original: { amount: numeric, currency, rate },
  };
}

/** Extract slug from project URL */
export function extractSlug(url) {
  const match = url.match(/kickstarter\.com\/projects\/([^/]+\/[^/?#]+)/);
  return match ? match[1] : null;
}

/** Load projects.json or return empty object */
export async function loadProjects() {
  try {
    const text = await fs.readFile(FILE_PATH, "utf8");
    return JSON.parse(text);
  } catch {
    return {}; // Start fresh if file missing
  }
}

/** Save projects object to disk */
export async function saveProjects(data) {
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
}

/** Merge or append new projects from query results */
export async function saveOrUpdateProjects(apiData) {
  if (!Array.isArray(apiData)) throw new Error("Expected array input");

  const existing = await loadProjects();
  const rates = await loadExchangeRates();
  const now = new Date().toISOString();
  let newProjects = 0;
  let updatedProjects = 0;

  for (const item of apiData) {
    const node = item?.node;
    if (!node?.id) continue;

    const id = node.id;
    const slug = extractSlug(node.url);
    const currency = node.pledged?.currency ?? "USD";

    // Normalize pledged to USD
    const pledgedNorm = normalizeToUSD(
      node.pledged?.amount ?? 0,
      currency,
      rates
    );
    const goalNorm = normalizeToUSD(node.goal?.amount ?? 0, currency, rates);

    // Latest funding snapshot
    const fundingSnapshot = {
      timestamp: now,
      backersCount: node.backersCount ?? 0,
      pledged: pledgedNorm.usd,
      pledgedOriginal: pledgedNorm.original,
      percentFunded: node.percentFunded ?? 0,
    };

    if (!existing[id]) {
      // ✅ Create new project entry
      newProjects++;
      existing[id] = {
        id,
        slug,
        url: node.url,
        name: node.name ?? "",
        description: node.description ?? "",
        creator: {
          name: node.creator?.name ?? "",
          url: node.creator?.url ?? "",
          launchedProjects: node.creator?.launchedProjects.totalCount ?? "",
        },
        category: node.category?.name ?? "",
        currency,
        goal: goalNorm.usd,
        goalOriginal: goalNorm.original,
        deadlineAt: node.deadlineAt ?? null,
        launchedAt: node.launchedAt ?? null,
        isLaunched: node.isLaunched ?? false,
        isProjectWeLove: node.isProjectWeLove ?? false,
        isProjectOfTheDay: node.isProjectOfTheDay ?? false,
        fundingHistory: [fundingSnapshot],
        lastUpdated: now,
      };
    } else {
      // ✅ Update existing project
      updatedProjects++;
      const p = existing[id];

      // Only fill in missing info (don’t overwrite)
      p.name ||= node.name ?? "";
      p.description ||= node.description ?? "";
      p.category ||= node.category?.name ?? "";
      p.currency ||= currency;
      p.deadlineAt ||= node.deadlineAt ?? null;
      p.launchedAt ||= node.launchedAt ?? null;

      p.isLaunched = node.isLaunched ?? p.isLaunched ?? false;
      p.isProjectWeLove = node.isProjectWeLove ?? p.isProjectWeLove ?? false;
      p.isProjectOfTheDay =
        node.isProjectOfTheDay ?? p.isProjectOfTheDay ?? false;

      p.creator = p.creator || {
        name: node.creator?.name ?? "",
        url: node.creator?.url ?? "",
      };

      // Update goal if it's missing or zero
      if (!p.goalUSD && goalNorm.usd > 0) {
        p.goalUSD = goalNorm.usd;
        p.goalOriginal = goalNorm.original;
      }

      // Append funding snapshot only if it changed
      p.fundingHistory = p.fundingHistory || [];
      const last = p.fundingHistory.at(-1) || {};
      if (
        last.backersCount !== fundingSnapshot.backersCount ||
        last.pledged !== fundingSnapshot.pledged ||
        last.percentFunded !== fundingSnapshot.percentFunded
      ) {
        p.fundingHistory.push(fundingSnapshot);
      }

      p.lastUpdated = now;
    }
  }

  console.log(`💾 ${newProjects} new, ${updatedProjects} updated.`);
  await saveProjects(existing);
  return existing;
}
