import { graphqlRequest } from "./graphql.js";
import fs from "fs/promises";
import path from "path";

const query4Path = path.resolve("./queries/query4.gql");
const query4 = await fs.readFile(query4Path, "utf8");

const data = await graphqlRequest(query4, { nextCursor: null });
console.log(JSON.stringify(data));
