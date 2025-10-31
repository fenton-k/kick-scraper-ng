import { graphqlRequest } from "./graphql.js";
import { saveOrUpdateProjects } from "./files.js";
import { sleep } from "./utils.js";
import fs from "fs/promises";
import path from "path";

const queryPath = path.resolve("./queries/query5.gql");
const query = await fs.readFile(queryPath, "utf8");

export async function fetchProjects({
  startCursor = null,
  maxPages = 100,
  batchSize = 50,
  delayMs = [1000, 3000],
  stopCondition = null, // optional: a function(project) => boolean
}) {
  console.log("🚀 Starting project fetch...");

  let nextCursor = startCursor;
  let batch = [];
  let total = 0;
  let pageCount = 0;

  do {
    const data = await graphqlRequest(query, { nextCursor });
    const edges = data?.data?.projects?.edges ?? [];
    const pageInfo = data?.data?.projects?.pageInfo ?? {};

    if (!edges.length) break;

    for (const edge of edges) {
      const project = edge.node;
      if (stopCondition && stopCondition(project)) {
        console.log(`🛑 Stop condition met (project ID: ${project.id})`);
        return total;
      }
      batch.push(edge);
    }

    total += edges.length;
    console.log(`📦 Got ${edges.length} (total: ${total})`);

    if (batch.length >= batchSize) {
      await saveOrUpdateProjects(batch);
      batch = [];
      console.log(`💾 Saved batch of ${batchSize}`);
    }

    pageCount++;
    nextCursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;

    if (pageCount >= maxPages) {
      console.log(`🛑 Max pages reached (${maxPages})`);
      break;
    }

    const delay = delayMs[0] + Math.random() * (delayMs[1] - delayMs[0]);
    await sleep(delay);
  } while (nextCursor);

  if (batch.length > 0) {
    await saveOrUpdateProjects(batch);
    console.log(`💾 Saved final ${batch.length}`);
  }

  console.log(`✅ Finished fetching ${total} projects.`);
  return total;
}

// Default: run full rebuild if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchProjects({ maxPages: 100 });
}
