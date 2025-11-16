import fs from "fs/promises";

async function main() {
  const inputFile = "./projects.json";
  const outputFile = "./active_projects.json";

  // Load file
  const raw = await fs.readFile(inputFile, "utf8");
  const allProjects = JSON.parse(raw);

  const nowUnix = Math.floor(Date.now() / 1000);

  // Filter only active projects
  const activeProjects = {};

  for (const [id, project] of Object.entries(allProjects)) {
    const isActive =
      project.isLaunched === true &&
      typeof project.deadlineAt === "number" &&
      project.deadlineAt > nowUnix;

    if (isActive) {
      activeProjects[id] = project;
    }
  }

  // Save output
  await fs.writeFile(outputFile, JSON.stringify(activeProjects, null, 2));

  console.log(
    `Saved ${
      Object.keys(activeProjects).length
    } active projects to ${outputFile}`
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
