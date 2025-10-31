import fs from "fs/promises";

const FILE_PATH = "./projects.json";

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
    // Return empty object if file doesn't exist or is empty
    return {};
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
  const now = new Date().toISOString();
  let newProjects = 0;
  let updatedProjects = 0;

  for (const item of apiData) {
    const node = item?.node;
    if (!node?.id) continue;

    const id = node.id;
    const slug = extractSlug(node.url);

    // This is the latest funding data
    const fundingSnapshot = {
      timestamp: now,
      backersCount: node.backersCount || 0,
      pledged: node.pledged.amount || 0,
      currency: node.pledged.currency || null,
      percentFunded: node.percentFunded || 0,
      deadlineAt: node.deadlineAt || null,
    };

    if (!existing[id]) {
      // New project
      newProjects++;
      existing[id] = {
        id,
        slug,
        url: node.url,
        name: node.name || "",
        description: node.description || "",
        creator: {
          name: node.creator?.name || "",
          url: node.creator?.url || "",
        },
        fundingHistory: [fundingSnapshot], // Start history with current snapshot
        tags: {
          isLaunched: node.isLaunched || false,
          isProjectWeLove: node.isProjectWeLove || false,
          isProjectOfTheDay: node.isProjectOfTheDay || false,
        },
        lastUpdated: now,
      };
    } else {
      // Update existing project
      updatedProjects++;
      const p = existing[id]; //Shorter reference

      // Only fill in missing info; don't overwrite good data
      p.name = p.name || node.name || "";
      p.description = p.description || node.description || "";
      p.creator = p.creator || {
        name: node.creator?.name || "",
        url: node.creator?.url || "",
      };
      p.tags = p.tags || {
        isLaunched: node.isLaunched || false,
        isProjectWeLove: node.isProjectWeLove || false,
        isProjectOfTheDay: node.isProjectOfTheDay || false,
      };

      // Initialize fundingHistory if it's missing (for older data structures)
      p.fundingHistory = p.fundingHistory || [];

      // Append new funding snapshot *only if data has changed*
      const lastSnapshot = p.fundingHistory.slice(-1)[0] || {};
      if (
        lastSnapshot.backersCount !== fundingSnapshot.backersCount ||
        lastSnapshot.pledged !== fundingSnapshot.pledged ||
        lastSnapshot.percentFunded !== fundingSnapshot.percentFunded
      ) {
        p.fundingHistory.push(fundingSnapshot);
      }

      p.lastUpdated = now;
    }
  }

  console.log(
    `Saved/Updated projects: ${newProjects} new, ${updatedProjects} updated.`
  );
  await saveProjects(existing);
  return existing;
}
