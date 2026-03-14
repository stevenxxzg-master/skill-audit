#!/usr/bin/env node

/**
 * GitHub Action entrypoint for skill-audit.
 * Reads inputs from env, runs audit, sets outputs, and optionally posts PR comments.
 */

import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { audit } from '../src/index.js';
import { calculateScore } from '../src/scorer.js';
import { generateMarkdown } from '../src/markdown-reporter.js';

// Read GitHub Action inputs from env
const scanPath = resolve(process.env.INPUT_PATH || '.');
const threshold = parseInt(process.env.INPUT_THRESHOLD || '0', 10);
const failOnDanger = (process.env.INPUT_FAIL_ON_DANGER || 'true').toLowerCase() === 'true';
const format = process.env.INPUT_FORMAT || 'text';
const githubToken = process.env.GITHUB_TOKEN || '';

// GitHub context from env
const githubEventPath = process.env.GITHUB_EVENT_PATH || '';
const githubRepository = process.env.GITHUB_REPOSITORY || '';
const githubApiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
const githubStepSummary = process.env.GITHUB_STEP_SUMMARY || '';
const githubOutput = process.env.GITHUB_OUTPUT || '';

import { appendFileSync, readFileSync } from 'fs';

function setOutput(name, value) {
  if (githubOutput) {
    appendFileSync(githubOutput, `${name}=${value}\n`);
  }
  // Also log for visibility
  console.log(`::set-output name=${name}::${value}`);
}

function appendSummary(markdown) {
  if (githubStepSummary) {
    appendFileSync(githubStepSummary, markdown + '\n');
  }
}

async function getPullRequestNumber() {
  if (!githubEventPath) return null;
  try {
    const event = JSON.parse(readFileSync(githubEventPath, 'utf-8'));
    // pull_request event
    if (event.pull_request && event.pull_request.number) {
      return event.pull_request.number;
    }
    // issue_comment or other events with issue number
    if (event.issue && event.issue.number) {
      return event.issue.number;
    }
    return null;
  } catch {
    return null;
  }
}

async function postPRComment(markdown, prNumber) {
  if (!githubToken || !githubRepository || !prNumber) return;

  const url = `${githubApiUrl}/repos/${githubRepository}/issues/${prNumber}/comments`;
  const marker = '<!-- skill-audit-report -->';
  const body = `${marker}\n${markdown}`;

  // Check for existing comment to update
  try {
    const listRes = await fetch(`${url}?per_page=100`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (listRes.ok) {
      const comments = await listRes.json();
      const existing = comments.find(c => c.body && c.body.startsWith(marker));
      if (existing) {
        // Update existing comment
        const updateRes = await fetch(`${githubApiUrl}/repos/${githubRepository}/issues/comments/${existing.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        });
        if (updateRes.ok) {
          console.log('✓ Updated existing PR comment');
          return;
        }
      }
    }
  } catch {
    // Fall through to create new comment
  }

  // Create new comment
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      console.log('✓ Posted PR comment');
    } else {
      console.log(`⚠ Failed to post PR comment: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.log(`⚠ Failed to post PR comment: ${err.message}`);
  }
}

// Main
async function main() {
  console.log(`skill-audit: scanning ${scanPath}`);

  let report;
  try {
    report = await audit(scanPath);
  } catch (err) {
    console.error(`✗ Audit failed: ${err.message}`);
    process.exit(2);
  }

  const { score, grade } = calculateScore(report.findings);
  const findingsCount = report.findings.length;

  // Generate markdown report
  const markdown = generateMarkdown(report);

  // Write report file
  const reportPath = resolve('skill-audit-report.md');
  await writeFile(reportPath, markdown, 'utf-8');

  // Set outputs
  setOutput('score', score);
  setOutput('grade', grade);
  setOutput('findings-count', findingsCount);
  setOutput('report-path', reportPath);

  // Write step summary
  appendSummary(markdown);

  // Console output based on format
  if (format === 'json') {
    console.log(JSON.stringify({ ...report, score: { score, grade } }, null, 2));
  } else if (format === 'markdown') {
    console.log(markdown);
  } else {
    // text format — print summary
    console.log(`\nScore: ${score}/100 (${grade})`);
    console.log(`Findings: ${findingsCount} (${report.summary.danger} danger, ${report.summary.warn} warning)`);
    if (report.findings.length > 0) {
      console.log('\nTop findings:');
      for (const f of report.findings.slice(0, 10)) {
        const icon = f.severity === 'danger' ? '✗' : '⚠';
        console.log(`  ${icon} ${f.file}:${f.line} — ${f.msg}`);
      }
    }
  }

  // Post PR comment if GITHUB_TOKEN is set
  const prNumber = await getPullRequestNumber();
  if (githubToken && prNumber) {
    await postPRComment(markdown, prNumber);
  }

  // Determine exit code
  const hasDanger = report.summary.danger > 0;
  if (score < threshold) {
    console.error(`\n✗ Score ${score} is below threshold ${threshold}`);
    process.exit(1);
  }
  if (failOnDanger && hasDanger) {
    console.error(`\n✗ ${report.summary.danger} danger finding(s) detected`);
    process.exit(1);
  }

  console.log('\n✓ skill-audit passed');
  process.exit(0);
}

main();
