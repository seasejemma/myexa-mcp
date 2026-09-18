## Change

<!-- State the behavior changed and why. -->

## Verification

- [ ] `deno task ci`
- [ ] `deno task check-env`
- [ ] The tested tree is committed; no uncommitted implementation changes were
      deployed
- [ ] That exact commit was deployed to Deno Development
- [ ] `deno task smoke` passed against that revision
- [ ] `deno task eval:agent` passed against that revision
- [ ] No endpoint, credential, run identifier, or Agent content was added to
      this PR

Commit evaluated: `<!-- commit -->`

Deno Development revision: `<!-- revision -->`

Live-gate evidence or reason not applicable:

<!-- Include sanitized results only. Docs-only changes may mark live gates N/A with a reason. -->

## Promotion

- [ ] This PR contains the exact evaluated commit
- [ ] Production verification and rollback revision are identified for the
      operator
