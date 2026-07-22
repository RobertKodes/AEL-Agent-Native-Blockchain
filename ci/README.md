# Activating GitHub Actions

`ael-protocol-ci.yml` is the repository-reviewed workflow template. The GitHub OAuth token used for the initial backup did not have the separate `workflow` scope, so the source backup keeps the template here instead of pretending CI is active.

An administrator can activate it without changing its contents:

```sh
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows
cp ci/ael-protocol-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "Activate reproducible protocol CI"
git push origin main
```

The workflow runs the 99-test conformance suite on Node 20, 22, and 24, scans the tracked source for secrets, rebuilds the release twice, compares its SHA-256 digest, and retains the release, SBOM, audit manifest, phase gates, and wallet packages as CI artifacts.
