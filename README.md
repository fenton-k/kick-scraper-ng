## State

LIVE - projects that are live.
SUBMTITED - "coming soon" in kickstarter UI.
SUCCESSFUL - projects that are past their deadline and met their funding goal.
FAILED - projects that are past their deadline and did not meet their funding goal.

### totalCount

- **Type:** Int
- **Parent:** ProjectConnection
- **Description:** Total number of projects matching current filters (state, category, term, etc.)
- **Example:**
  ```graphql
  projects(state: LIVE) {
    totalCount
  }
  ```
