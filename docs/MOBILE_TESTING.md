# Play the review build on a phone

Use the repository's GitHub Pages site for the mobile preview. Playing it requires no developer tools or additional account.

The link becomes usable after the **Mobile preview** workflow's **deploy** job succeeds. Open the deployment link shown on that run. Without a custom domain, the expected address is [philipreese.github.io/WorldWeaver/](https://philipreese.github.io/WorldWeaver/). An enabled Pages setting alone does not establish that the game is live.

The workflow publishes the built contents of `main` after its checks pass. It updates the repository's single Pages site on each push to `main`; it does not create a separate site for every pull request. PR #4 integrates the prototype baseline, with subsequent features developed in focused PRs. Publishing or merging a prototype is not a declaration that the release acceptance gates are complete.

For a feature preview before merge, manually run **Mobile preview** on that branch only if the `github-pages` environment explicitly permits it. This temporarily replaces the same site's contents. Run the workflow on `main` again to restore the integrated prototype. Automatic feature-branch pushes do not replace the site.

## One-time setup

The owner has enabled Pages and confirmed **GitHub Actions** as its source. The repository is public. The available repository connection does not expose environment settings, so branch eligibility still needs confirmation from the deployment result.

1. In [Settings → Pages](https://github.com/philipreese/WorldWeaver/settings/pages), use **Build and deployment → Source → GitHub Actions**. Skip this if it is already selected. A branch-based source does not run the production build in this workflow.
2. If the `github-pages` environment restricts deployment branches, allow **`main`** in [Settings → Environments](https://github.com/philipreese/WorldWeaver/settings/environments). A manual feature preview needs its actual branch explicitly permitted too. Keep existing protection rules. If the job requests an environment review, approve that deployment through GitHub.
3. Merge checked changes into `main`, or manually run **Mobile preview** on an explicitly permitted branch. In [Actions](https://github.com/philipreese/WorldWeaver/actions), open **Mobile preview**. Both **build** and **deploy** must succeed before treating that commit as live. A rejected new deployment leaves the last successful site available.

No personal access token or hosting secret is required: the workflow uses GitHub's supplied token and the Pages deployment environment. GitHub offers Pages for public repositories on its free plan.

The initial trigger is a branch push. GitHub's **Run workflow** button for `workflow_dispatch` requires the workflow to exist on the default branch, so that button is not a prerequisite here. If a settings correction fixes a failed run, open that run and use **Re-run failed jobs**; a new push also retries the complete workflow.

## First phone visit

1. Open the successful deployment's URL in Chrome or Safari. The world should start **paused on day 2**. Installation is optional; start in the browser.
2. Tap **Meet Nera**, then **Walk with them**. Drag around the neighborhood, try pinch and the **+ / −** controls, and return to overview. Open the journal if you lose track of the person or place.
3. Inspect Hearth or Nera and expose the **Silt Saddle**. Advance with **+1 day** to day 4. Nera's decision should be the repair exchange. Read its observed effects, recorded alternatives, and separately labeled interpretations.
4. Visit **day 1** on the timeline and branch. Leave the passage closed and advance to day 4: Nera should build the Dry Loft. The original repair future remains available through **Branches**. Use day 1 because your route intervention is already part of day 2's recorded history. The [player guide](PLAYER_GUIDE.md) gives another walkthrough, and `two-tellings.json` in the [example histories](../public/worlds) contains both outcomes.
5. Switch away from the browser and return. Time should be paused. Rotate the phone and check that controls, scene text, and the journal remain usable. Export from Settings before changing browser contexts; then try importing that file in another browser.

For a browser offline check, first load the game online and let its asset cache finish, then close and reopen it with networking disabled. A first uncached visit needs a connection. Record what actually works on the device; the existing Node worker checks do not establish phone offline behavior.

## Updates and problems

- A new commit is only live after its deployment succeeds. Record the successful run's commit, including whether it was `main` or a manual feature preview, before reporting a problem against that build.
- An already-open tab can retain the previous cached version while an update waits. Close all tabs for the game and reopen the deployment URL online. Export your history before clearing site data; clearing it also removes that browser's saved world.
- A source/configuration failure is visible in the workflow log. A branch-protection rejection requires the explicit branch allowance above; using another environment to evade the rule is not part of this setup.
- Saves stay in that browser until exported. Serving the game over HTTPS does not add cloud sync.

Report the phone/browser, orientation, build commit, and shortest reproduction on [issue #3](https://github.com/philipreese/WorldWeaver/issues/3). If a save is relevant, attach its exported JSON. The remaining acceptance checks are listed in [VERIFICATION.md](VERIFICATION.md).

## GitHub references

- [Publishing source and Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Custom Pages workflows and required permissions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Manual workflow trigger requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [Deployment branch and environment protections](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
