# Banking Chatbot Promptfoo POC

A deliberately small TypeScript banking-support chatbot used to demonstrate LLM safety evaluation in CI. The web and CLI clients share the same policy and OpenRouter integration, and Promptfoo calls that same code path.

## What this demonstrates

- Web and CLI multi-turn chat using a free Gemma model through OpenRouter
- Curated CI regression tests for harmful content, prompt injection, data leakage, and multi-turn behavior
- A bounded generated red-team scan for deeper scheduled testing
- Pull-request pass/fail gating plus JSON and HTML evaluation artifacts
- A reusable structure that can be extracted into an organization-wide evaluation package

This is not a real banking service. It has no authentication, persistent storage, tools, RAG, customer data, or transaction capability.

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

The fast suite uses authored attacks and deterministic assertions:

```bash
npm run eval
npm run eval:view
```

The generated suite is slower and uses the model for attack generation and grading:

```bash
npm run redteam
```

Evaluation files can contain prompts and model responses. Treat them as sensitive artifacts and do not use real customer data in tests.

## GitHub Actions setup

Create a repository Actions secret named `OPENROUTER_API_KEY`. Pull requests and `main` pushes run type checks, unit tests, and the curated Promptfoo gate. A separate workflow runs the generated red team every Monday and on demand.

The CI workflow intentionally fails when the secret is missing. For public repositories or fork-based contributions, move model evaluation to a protected `workflow_dispatch`/merge-queue workflow so secrets are never exposed to untrusted code.

## Scaling to 10 repositories

1. Move the provider wrapper, shared policies, assertion scripts, and workflow into a versioned internal npm package and reusable GitHub workflow.
2. Keep product-specific prompts and test datasets in each owning repository; require owners for policy and golden-test changes.
3. Run deterministic regression tests on pull requests, broader model-graded tests nightly, and full multi-turn red teams weekly or before release.
4. Pin Promptfoo, model IDs, and judge models centrally. Upgrade through a controlled compatibility repository before rolling changes to all consumers.
5. Store only synthetic test data. Apply artifact retention, access control, secret scanning, and an explicit process for promoting discovered failures into regression cases.
6. Track pass rate by risk category, new failures, false-positive rate, latency, token use, and flaky-test rate. Do not reduce safety to one aggregate score.
7. Use a stronger, independently governed judge model for production gates. The free Gemma target is suitable for this POC, but free-tier availability and self-grading are not robust organizational controls.

## Repository map

- `src/policy.ts`: chatbot policy, types, and message validation
- `src/openrouter.ts`: OpenRouter client and selected Gemma model
- `src/server.ts` / `src/cli.ts`: web API and terminal client
- `eval/provider.ts`: Promptfoo adapter using the production chat path
- `promptfooconfig.yaml`: deterministic pull-request gate
- `promptfooconfig.redteam.yaml`: generated multi-turn adversarial scan
- `.github/workflows`: CI and scheduled red-team workflows

