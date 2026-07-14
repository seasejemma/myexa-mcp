# Search recipes

Use these recipes to choose a search shape. Confirm exact SDK spelling and
currently accepted fields before implementation; these are workflows, not a
vendored API specification.

## General web discovery

- Start with `type: "auto"` and 5-10 results.
- Request highlights for scanning or bounded text for downstream extraction.
- Add domain or publication-date filters only when the task supplies a real
  constraint.
- Fetch full contents only for the small set of URLs that survive triage.

## Coverage and deduplication

- Generate two or three materially different queries when recall matters.
- Vary the angle, entity name, or terminology rather than adding synonyms
  mechanically.
- Run independent searches concurrently when the caller can tolerate the cost.
- Deduplicate by canonical URL and underlying entity before synthesis.
- Preserve citations from the retained representative result.

## Companies and people

- Use `category: "company"` for company discovery and `category: "people"` for
  public professional profiles.
- Do not send publication/crawl date filters or `excludeDomains` with these two
  categories.
- For `people`, use `includeDomains` only with profile domains currently
  accepted by Exa.
- Discover broadly first, then run unfiltered follow-up searches for news,
  interviews, filings, or other evidence about selected entities.

## News and time-bounded research

- Use `category: "news"` with explicit publication dates for recent events.
- Include the entity and event type in the query; do not rely on date filters to
  supply intent.
- Sort and reconcile evidence by event date, not crawl date.
- Use fresh content retrieval only when the task needs the current page body.

## Research papers and reports

- Use `category: "research paper"` for scholarly discovery.
- Use `category: "financial report"` for filings, earnings material, and annual
  reports.
- Add venue or issuer domains when precision matters.
- Retrieve full text only after title, abstract, date, and source triage.

## Personal sites

- Use `category: "personal site"` for practitioner writing, portfolios, and
  first-person technical accounts.
- Exclude large publishing platforms only when the user specifically wants
  independent sites.
- Use subpage discovery for a selected site rather than across a broad result
  set.

## Deep and structured search

- Use `deep-lite` for bounded synthesis with lower latency.
- Use `deep` for multi-step research and `deep-reasoning` only when stronger
  analysis justifies its latency and cost.
- Supply a narrow system prompt and output schema when the result feeds a
  deterministic workflow.
- Keep structured schemas shallow and request only fields the caller will use.

## Cost and failure boundaries

- Start small, inspect result quality, then expand `numResults` or query count.
- Keep entitlement, rate-limit, and validation failures distinct.
- Do not silently retry an unsupported category/filter combination without
  explaining the changed query semantics.
- Treat Search results as evidence candidates, not verified facts; corroborate
  important claims from primary sources.
