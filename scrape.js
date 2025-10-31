import { graphqlRequest } from "./graphql.js";
import { saveOrUpdateProjects } from "./files.js";
import { enrichNewProjects } from "./enrich.js";
import { sleep } from "./utils.js";
import fs from "fs/promises";
import path from "path";

const query2Path = path.resolve("./queries/query2.gql");
const query2 = await fs.readFile(query2Path, "utf8");

async function runScraper(maxPages = 100) {
  console.log("Fetching recommended projects...");
  let nextCursor = null;
  let batchOfEdges = [];
  let pageCount = 0;
  let totalEdges = 0;
  const BATCH_SIZE = 50;

  do {
    const data = await graphqlRequest(query2, { nextCursor });
    const edges = data?.data?.projects?.edges || [];
    batchOfEdges = batchOfEdges.concat(edges);
    totalEdges += edges.length;

    console.log(`Just grabbed ${edges.length} projects.`);

    const pageInfo = data?.data?.projects?.pageInfo;
    nextCursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;

    await sleep(1000 + Math.random() * 2000);

    if (batchOfEdges.length >= BATCH_SIZE) {
      await saveOrUpdateProjects(batchOfEdges);
      batchOfEdges = [];
    }

    pageCount++;
    if (pageCount >= maxPages) {
      console.log(`Reached max page limit: ${maxPages}`);
      break;
    }
  } while (nextCursor);

  console.log(`Found ${totalEdges} projects.`);
  await saveOrUpdateProjects(batchOfEdges);
  //   await enrichNewProjects();
}

runScraper(1000);
