# cctp-demo project notes

## Work split: Soroban contracts vs frontend/EVM

For this project specifically, user is writing the Soroban (Rust) contracts
themselves and wants me to handle the frontend and EVM integration. When the
user mentions a new wrapper or helper contract for this repo, propose the
design and offer to wire it into the frontend, but don't scaffold the Rust /
`stellar contract` workflow unless they ask.

This split is project-scoped, not a universal preference — on other projects
they may want help authoring Soroban contracts.

## Direction vocabulary (use this consistently)

Two orthogonal axes. Mixing them is what made this repo's prose drift, so keep
them apart in code, comments, UI copy, docs, and talk material alike:

1. **Route, relative to Stellar: `outbound` / `inbound`.** Outbound leaves
   Stellar (Stellar burns); inbound arrives on Stellar (Stellar mints). These
   only work because Stellar is this repo's fixed vantage point, so never use
   them in a sentence that isn't about Stellar. Gloss once on first use in a
   given document, then use them bare.
2. **Role within one transfer: `source` / `destination`.** Chain-neutral,
   matching CCTP's own field names (`sourceDomain`, `destinationDomain`). Use
   these for protocol slots and for any chain-neutral statement.

Rules that follow from those:

- Never write a chain-plus-role compound (`Stellar-source`, `Stellar-destination`,
  `Stellar-origin`, `Stellar-inbound`). Use `outbound` / `inbound` for the route,
  or a clause for the role ("when Stellar is the destination", "the EVM
  destination", "a Stellar source"). This mirrors how Circle's own
  [Stellar reference](https://developers.circle.com/cctp/references/stellar)
  reads.
- Don't say `origin`. It's a third word for `source`.
- `Direction` in `src/lib/config.ts` (`'stellar-to-evm'`, `'evm-to-stellar'`, …)
  is the explicit machine-identifier level. Leave those string values alone.
- `OutboundFlow` / `InboundFlow` / `stellarIsSource` are all already correct
  under this scheme. No renames needed.
- In speech, "the burn side" and "the mint side" work with no vantage point at
  all, which is handy for live talks.

The canonical version of this lives as a comment above `Direction` in
`src/lib/config.ts`, and a reader-facing version is in the README.

## Available Svelte MCP Tools:

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
