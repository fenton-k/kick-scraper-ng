import { graphql } from "graphql";
import { graphqlRequest } from "./graphql.js";
import { closeBrowser } from "./graphql.js";
import fs from "fs/promises";
import path from "path";

const queryPath = path.resolve("./queries/query.gql");
const query = await fs.readFile(queryPath, "utf8");

let query5 = `query ($nextCursor: String) {
  projects(first: 5, after: $nextCursor, state: SUSPENDED, sort: NEWEST) {
    totalCount
    edges {
      node {
        id
        slug
        goal {
          amount
        }
        category {
          name
        }
      }
    }

    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

let query2 = `query ($slug: String!) {
  project(slug: $slug) {
    id
    creator {
      name
      launchedProjects {
        totalCount
      }
    }
    state
    category {
      name
    }
  }
}
`;

let data;

try {
  data = await graphqlRequest(query5, { nextCursor: null });
  console.log(JSON.stringify(data));
} catch (err) {
  console.error("Scraper error: ", err);
} finally {
  await closeBrowser();
}

let data2;

try {
  data2 = await graphqlRequest(query2, {
    slug: "luxmea/nuo-3d-mask",
  });
  console.log(JSON.stringify(data2));
} catch (err) {
  console.error("Scraper error:", err);
} finally {
  await closeBrowser();
}
