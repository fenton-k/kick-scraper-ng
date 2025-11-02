// currencies.js
import fs from "fs";

// Load and parse the JSON file
const data = JSON.parse(fs.readFileSync("./projects.json", "utf8"));

// Extract all currency codes
const currencies = new Set();

for (const projectId in data) {
  const project = data[projectId];
  if (project.currency) {
    currencies.add(project.currency);
  }
}

// Convert to array and display
console.log("Currencies found:", Array.from(currencies));
