import { readFile, writeFile } from 'node:fs/promises';

const COMMENT_MARKER = '<!-- promptfoo-security-findings -->';

const remediationByCategory = {
  'Data Leakage':
    'Keep customer context behind verified authorization, minimize hidden context, and retain this exact attack as a regression test.',
  'Prompt Extraction':
    'Reject requests to reveal or transform hidden instructions, and keep secrets and customer data out of the system prompt.',
  'Prompt Injection':
    'Enforce instruction hierarchy and authorization outside the model, validate untrusted context, and keep privileged actions behind approved tools.',
  'Financial Crime':
    'Strengthen refusal examples for evasion and fraud, and redirect users to lawful compliance or reporting guidance.',
  'Harmful Content':
    'Strengthen the relevant refusal policy and add this attack to the curated regression suite.',
  'Multi-turn Attack':
    'Apply the same authorization and disclosure policy on every turn, and add the full conversation to the curated regression suite.',
  'Promptfoo Runtime':
    'Inspect the workflow logs and provider configuration; this is an evaluation infrastructure failure, not a passing security result.',
  'Other Security Finding':
    'Review the failed assertion, tighten the chatbot policy or application control, and preserve the case as a regression test.',
};

function stringify(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(value, limit) {
  const text = stringify(value).trim();
  return text.length > limit ? `${text.slice(0, limit)}\n... [truncated]` : text;
}

function escapeHtml(value) {
  return stringify(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function rowsFromDocument(document) {
  const summary = document?.results?.version ? document.results : document;
  if (Array.isArray(summary?.results)) return summary.results;
  if (Array.isArray(document?.results)) return document.results;

  const table = summary?.table ?? document?.table;
  if (!Array.isArray(table?.body)) return [];

  return table.body.flatMap((row) =>
    (row.outputs ?? []).filter(Boolean).map((output) => ({
      ...output,
      vars: output.vars ?? row.vars,
      description: output.description ?? row.description,
    })),
  );
}

function failed(row) {
  return row?.success === false || row?.pass === false || row?.gradingResult?.pass === false || Boolean(row?.error);
}

function categoryFor(row) {
  const metadata = row?.metadata ?? row?.testCase?.metadata ?? {};
  const assertions = row?.gradingResult?.componentResults ?? [];
  const identifiers = [
    metadata.risk,
    metadata.pluginId,
    metadata.strategyId,
    row?.description,
    row?.testCase?.description,
    ...assertions.flatMap((result) => [result?.assertion?.metric, result?.assertion?.type]),
  ]
    .map(stringify)
    .join(' ')
    .toLowerCase();

  if (/multi[- ]?turn|crescendo/.test(identifiers)) return 'Multi-turn Attack';
  if (/pii|data[- ]?leak|syntheticdataleakage|privacy/.test(identifiers)) return 'Data Leakage';
  if (/prompt[- ]?extraction|promptconfidentiality/.test(identifiers)) return 'Prompt Extraction';
  if (/hijack|prompt[- ]?injection|injectionresistance/.test(identifiers)) return 'Prompt Injection';
  if (/financial|money[- ]?launder|compliance/.test(identifiers)) return 'Financial Crime';
  if (/harmful|crime|fraud|account[- ]?takeover/.test(identifiers)) return 'Harmful Content';
  return row?.error ? 'Promptfoo Runtime' : 'Other Security Finding';
}

function attackFor(row) {
  const vars = row?.vars ?? row?.testCase?.vars ?? {};
  return vars.prompt ?? vars.__prompt ?? row?.prompt?.display ?? row?.prompt?.raw ?? row?.prompt ?? 'Attack prompt was not present in the JSON report.';
}

function responseFor(row) {
  return row?.response?.output ?? row?.output ?? row?.text ?? row?.error ?? 'Gemma produced no response.';
}

function explanationFor(row) {
  const componentReasons = (row?.gradingResult?.componentResults ?? [])
    .filter((result) => result?.pass === false)
    .map((result) => result?.reason);
  return unique([
    ...componentReasons,
    row?.gradingResult?.reason,
    row?.failureReason,
    row?.error,
    row?.response?.error,
  ]).join('\n') || 'Promptfoo marked the assertion as failed without returning a grader explanation.';
}

function identifiersFor(row) {
  const metadata = row?.metadata ?? row?.testCase?.metadata ?? {};
  return unique([metadata.pluginId, metadata.strategyId, metadata.risk]).join(' / ');
}

export function extractReport(document, suite) {
  const rows = rowsFromDocument(document);
  return {
    suite,
    total: rows.length,
    failures: rows.filter(failed).map((row) => {
      const category = categoryFor(row);
      return {
        suite,
        category,
        title: row?.description ?? row?.testCase?.description ?? `${category} finding`,
        identifiers: identifiersFor(row),
        attack: attackFor(row),
        response: responseFor(row),
        explanation: explanationFor(row),
        remediation: remediationByCategory[category],
      };
    }),
  };
}

function renderFinding(finding, index, detailBudget) {
  const label = escapeHtml(truncate(finding.title, 180));
  const identifiers = finding.identifiers
    ? `\n- **Plugin / strategy:** ${escapeHtml(truncate(finding.identifiers, 250))}`
    : '';
  return [
    `#### ${index + 1}. ${label}`,
    `- **Suite:** ${finding.suite}${identifiers}`,
    '- **Attack:**',
    `<pre>${escapeHtml(truncate(finding.attack, Math.max(180, Math.floor(detailBudget * 0.25))))}</pre>`,
    '- **Gemma response:**',
    `<pre>${escapeHtml(truncate(finding.response, Math.max(240, Math.floor(detailBudget * 0.4))))}</pre>`,
    '- **Promptfoo verdict:** Failed',
    `- **Grader explanation:** ${escapeHtml(truncate(finding.explanation, Math.max(180, Math.floor(detailBudget * 0.25))))}`,
    `- **Suggested remediation:** ${finding.remediation}`,
  ].join('\n');
}

export function renderComment(reports, reportErrors = []) {
  const total = reports.reduce((sum, report) => sum + report.total, 0);
  const failures = reports.flatMap((report) => report.failures);
  const runUrl = process.env.PROMPTFOO_RUN_URL;
  const runLine = runUrl ? `\n[Open the GitHub Actions run](${runUrl})` : '';
  const lines = [COMMENT_MARKER, '## Promptfoo Security Findings', runLine];

  if (reportErrors.length) {
    lines.push(
      '',
      '> **Report warning:** One or more Promptfoo reports could not be read. The security gate remains authoritative.',
      ...reportErrors.map((error) => `> - ${escapeHtml(error)}`),
    );
  }

  if (!failures.length && !reportErrors.length) {
    lines.push('', `**0 failed of ${total} evaluated.**`, '', 'No Promptfoo security findings were detected.');
    return lines.join('\n');
  }

  lines.push('', `**${failures.length} failed of ${total} evaluated.**`);
  // Include every finding while keeping the single comment below GitHub's body limit.
  const detailBudget = Math.max(800, Math.floor(38_000 / Math.max(failures.length, 1)));
  const categories = unique(failures.map((finding) => finding.category));
  for (const category of categories) {
    lines.push('', `### ${category}`);
    failures
      .filter((finding) => finding.category === category)
      .forEach((finding, index) => lines.push('', renderFinding(finding, index, detailBudget)));
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : 'promptfoo-pr-comment.md';
  const reportPaths = args.filter((arg, index) => arg !== '--output' && index !== outputIndex + 1);
  const reports = [];
  const reportErrors = [];

  for (const reportPath of reportPaths) {
    const suite = reportPath.toLowerCase().includes('redteam') ? 'Generated red-team suite' : 'Curated regression suite';
    try {
      const document = JSON.parse(await readFile(reportPath, 'utf8'));
      reports.push(extractReport(document, suite));
    } catch (error) {
      reportErrors.push(`${suite}: ${error.message}`);
    }
  }

  await writeFile(outputPath, `${renderComment(reports, reportErrors)}\n`, 'utf8');
}

if (process.argv[1]?.endsWith('promptfoo-pr-comment.mjs')) {
  await main();
}
