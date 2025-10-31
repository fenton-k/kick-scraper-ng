import { graphqlRequest } from "./graphql.js";
import { sleep } from "./utils.js";
import { loadProjects, saveProjects } from "./files.js";

const query = `
  query($slug: String!) {
    project(slug: $slug) {
      id
      creator {
        name
        launchedProjects { totalCount }
      }
      collaborators {
        edges { node { name } }
      }
    }
  }
`;

const BATCH_SIZE = 10;

/** Enrich projects with collaborators and previous projects */
export async function enrichNewProjects() {
  const projects = await loadProjects();
  let enrichedCount = 0;
  let changedSinceLastSave = false; // Track if we have unsaved work

  const projectsToEnrich = Object.values(projects).filter(
    (p) => p.slug && !p._enriched
  );

  if (projectsToEnrich.length === 0) {
    console.log("project has already been enriched");
    return;
  }

  console.log(`Found ${projectsToEnrich.length} new projects to enrich...`);

  // Use a traditional for...of loop to handle async saving
  for (const [index, p] of projectsToEnrich.entries()) {
    try {
      await sleep(1000 + Math.random() * 2000); // Polite delay

      const data = await graphqlRequest(query, { slug: p.slug });
      const project = data.data?.project;

      if (!project) {
        console.warn(`⚠️ No project data found for slug: ${p.slug}`);
        continue;
      }

      if (!p.creator) p.creator = {};

      // Update enrichment fields
      p.creator.previousProjects =
        project.creator?.launchedProjects?.totalCount ?? 0;
      p.collaborators =
        project.collaborators?.edges.map((e) => e.node.name) ?? [];
      p._enriched = true; // Mark as enriched
      p.lastUpdated = new Date().toISOString();

      enrichedCount++;
      changedSinceLastSave = true;

      console.log(
        `✅ Enriched ${p.slug} (${index + 1}/${projectsToEnrich.length})`
      );

      // --- BATCH SAVE LOGIC ---
      // Save if we hit the batch size AND we have changes
      if (enrichedCount % BATCH_SIZE === 0 && changedSinceLastSave) {
        await saveProjects(projects);
        changedSinceLastSave = false; // Reset flag
        console.log(`💾 Saved batch of ${BATCH_SIZE} projects to disk.`);
      }
      // ------------------------
    } catch (err) {
      console.warn(`⚠️ Failed to enrich ${p.slug}: ${err.message}`);
    }
  }

  // --- FINAL SAVE ---
  // After the loop, save any remaining projects that didn't fill a full batch
  if (changedSinceLastSave) {
    await saveProjects(projects);
    console.log(`💾 Saved final remaining projects to disk.`);
  }
  // ------------------

  if (enrichedCount > 0) {
    console.log(
      `✅ Enrichment complete. ${enrichedCount} total projects enriched.`
    );
  } else {
    console.log(
      "ℹ️ Attempted to enrich, but no projects were successfully updated."
    );
  }
}
