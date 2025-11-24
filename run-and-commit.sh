#!/bin/bash

cd /opt/kick-scraper-ng || exit 1

# Run your scraper
/usr/bin/node scrape.js
/usr/bin/node filter-active.js

# Stage only projects.json
git add projects.json active_projects.json

# Commit with today's date (MM/DD format)
DATE=$(date +"%m/%d")
git commit -m "$DATE projects" || exit 0  # avoid errors if no changes

# Push to GitHub
git push origin main
