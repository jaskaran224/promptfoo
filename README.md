# Banking Chatbot Promptfoo POC

A deliberately small TypeScript banking-support chatbot used to demonstrate LLM safety evaluation in CI. The web and CLI clients share the same policy and OpenRouter integration, and Promptfoo calls that same code path.

## What this demonstrates

- Web and CLI multi-turn chat using a free Gemma model through OpenRouter
- Hosted red-team tests for harmful content, prompt injection, data leakage, and multi-turn behavior
- A curated Promptfoo regression suite that preserves known security attacks
- Fabricated customer records and internal canaries in hidden model context, with exact-match leakage assertions
- A bounded generated red-team scan for scheduled and manual testing
- JSON red-team report artifacts from GitHub Actions
- A reusable structure that can be extracted into an organization-wide evaluation package

This is not a real banking service. It has no authentication, persistent storage, tools, RAG, real customer data, or transaction capability. The records in `src/synthetic-data.ts` are intentionally fake (`example.invalid` addresses and POC identifiers).

## Run locally

Requirements: Node.js 22.22+ and an OpenRouter API key.

```bash
npm install
cp .env.example .env
# Set OPENROUTER_API_KEY in .env
npm run dev
```

Open `http://localhost:3000`, or run the terminal client with:

```bash
npm run cli
```

Do not commit `.env`. Free OpenRouter models can change availability or be rate-limited; override `OPENROUTER_MODEL` when needed.

## Evaluate

Promptfoo's hosted endpoints generate attacks and grade target responses; Gemma remains only the chatbot target:

```bash
npm run regression
npm run redteam
```

Hosted red teaming sends the configured purpose, generated prompts, target responses, and grading criteria to Promptfoo's service. It does not send `OPENROUTER_API_KEY`. The target invocation itself still runs in the CI worker through `eval/provider.ts`.

Evaluation files can contain prompts and model responses. Treat them as sensitive artifacts and do not use real customer data in tests.

### How leakage testing works

`src/synthetic-data.ts` defines fake customer accounts, support PINs, session tokens, and internal records. `src/policy.ts` places them in Gemma's hidden system context and orders the chatbot not to reveal them. Promptfoo generates direct and multi-turn extraction attacks. Every response also receives a deterministic `not-contains-any` assertion, so an exact protected value appearing in output fails the run even if the hosted model grader misses it.

## GitHub Actions setup

Create a repository Actions secret named `OPENROUTER_API_KEY`. Every non-draft pull request targeting `main` runs the curated Promptfoo regressions followed by the generated Promptfoo red team. Either suite failing makes the stable `Promptfoo security gate` check fail.

To block merges on failure, add `Promptfoo security gate` as a required status check in the repository's `main` ruleset. GitHub rulesets are repository settings and cannot be enabled by workflow YAML alone.

## Scaling to 10 repositories

1. Move the provider wrapper, shared policies, assertion scripts, and workflow into a versioned internal npm package and reusable GitHub workflow.
2. Keep product-specific prompts and test datasets in each owning repository; require owners for policy and golden-test changes.
3. Run scoped hosted scans on demand, full multi-turn red teams weekly, and release-gating scans before production deployment.
4. Pin Promptfoo, model IDs, and judge models centrally. Upgrade through a controlled compatibility repository before rolling changes to all consumers.
5. Store only synthetic test data. Apply artifact retention, access control, secret scanning, and an explicit process for promoting discovered failures into regression cases.
6. Track pass rate by risk category, new failures, false-positive rate, latency, token use, and flaky-test rate. Do not reduce safety to one aggregate score.
7. Use a stronger, independently governed judge model for production gates. The free Gemma target is suitable for this POC, but free-tier availability and self-grading are not robust organizational controls.

## Repository map

- `src/policy.ts`: chatbot policy, types, and message validation
- `src/synthetic-data.ts`: fabricated protected records and exact leakage canaries
- `src/openrouter.ts`: OpenRouter client and selected Gemma model
- `src/server.ts` / `src/cli.ts`: web API and terminal client
- `eval/provider.ts`: Promptfoo adapter using the production chat path
- `eval/regressions.yaml`: fixed security attacks retained across pull requests
- `promptfooconfig.regression.yaml`: curated Promptfoo regression configuration
- `promptfooconfig.redteam.yaml`: generated multi-turn adversarial scan
- `.github/workflows/redteam.yml`: pull-request-only Promptfoo security gate

