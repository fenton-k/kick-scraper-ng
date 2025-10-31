import { graphqlRequest } from "./graphql.js";
import { saveOrUpdateProjects } from "./files.js";
import { sleep } from "./utils.js";
import fs from "fs/promises";
import path from "path";

const queryPath = path.resolve("./queries/combined.gql"); // your new single query file
const query = await fs.readFile(queryPath, "utf8");

const BATCH_SIZE = 50; // how many projects to save at once
const MIN_DELAY = 1000; // polite delay between pages
const MAX_DELAY = 3000;

async function runScraper(maxPages = 100) {
  console.log("🚀 Fetching recommended projects...");

  let nextCursor = null;
  let batch = [];
  let totalProjects = 0;
  let pageCount = 0;

  do {
    // --- Fetch a page of projects ---
    const data = await graphqlRequest(query, { nextCursor });
    const edges = data?.data?.projects?.edges ?? [];
    const pageInfo = data?.data?.projects?.pageInfo ?? {};

    if (!edges.length) {
      console.warn("⚠️ No projects found on this page.");
      break;
    }

    // --- Merge into our working batch ---
    batch.push(...edges);
    totalProjects += edges.length;

    console.log(
      `📦 Fetched ${edges.length} projects (total: ${totalProjects})`
    );

    // --- Save when we hit batch size ---
    if (batch.length >= BATCH_SIZE) {
      await saveOrUpdateProjects(batch);
      console.log(`💾 Saved ${batch.length} projects to disk.`);
      batch = [];
    }

    // --- Prepare next page ---
    nextCursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    pageCount++;

    if (pageCount >= maxPages) {
      console.log(`🛑 Reached max page limit (${maxPages}).`);
      break;
    }

    // --- Polite random delay ---
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    await sleep(delay);
  } while (nextCursor);

  // --- Save any leftovers ---
  if (batch.length > 0) {
    await saveOrUpdateProjects(batch);
    console.log(`💾 Saved final ${batch.length} remaining projects.`);
  }

  console.log(`✅ Done. Total projects fetched: ${totalProjects}`);
}

runScraper(1);
