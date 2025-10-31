import { fetchProjects } from "./scrape.js";
import { loadProjects } from "./files.js";
import fs from "fs/promises";
import path from "path";

const newestQueryPath = path.resolve("./queries/query5.gql");
const newestQuery = await fs.readFile(newestQueryPath, "utf8");

// Override query in memory
import { graphqlRequest } from "./graphql.js";
graphqlRequest.defaultQuery = newestQuery; // optional safety override

async function updateProjects() {
  console.log("🕓 Checking for new projects...");

  const existingProjects = await loadProjects();
  const knownIds = new Set(Object.keys(existingProjects));

  const stopCondition = (project) => {
    if (knownIds.has(project.id)) {
      console.log(`⚡ Found existing project: ${project.name} (${project.id})`);
      return true;
    }
    return false;
  };

  await fetchProjects({
    startCursor: null,
    maxPages: 20, // fetch up to N pages if nothing new found
    batchSize: 20,
    delayMs: [1000, 2000],
    stopCondition,
  });

  console.log("✅ Incremental update complete.");
}

updateProjects();
