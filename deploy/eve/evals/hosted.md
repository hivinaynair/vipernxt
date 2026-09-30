# Hosted factory readiness — 1 October 2026 (IST)

Status: in progress. No completed hosted delivery or new readiness score is claimed yet.

The user authorized implementation, real paid-provider testing and disposable staging. This technical benchmark uses synthetic Return Desk data and covers J1.S1 (order-by-due, clear-filters, due-today). J1.S2/J1.S3, customer discovery, authentication/tenancy and production release are excluded. Ordinary customer intake still requires an observed walkthrough; the exact repository-bound simulation mode cannot certify an MVP.

## Changes and validation

[Implementation PR #33](https://github.com/hivinaynair/vipernxt/pull/33) targets staging. Requirements bind source hashes, criterion/case traces, material-policy holds and explicit build/staging authorization. The workflow now proceeds through serial slices, separate independent reviewers, combined review, exact-SHA CI repair, automatic staging dispatch/reconciliation and actual-site verification. Failed final checks, scope changes and exhausted budgets hold.

Live testing exposed and corrected six problems:

| Observed failure | Correction | Evidence |
|---|---|---|
| Adopted workflows collided on a predecessor-owned Cursor hook | Owner-scoped Cursor/CI/deployment/retry wake tokens; callbacks resolve the stored owner; conflict rejection reconciles durably; obsolete coordinators exit normally | Real coordinator handoff preserved worker/run IDs, both clocks, candidate and attempts. The predecessor completed with `superseded`; the replacement collected the original builder and launched independent review. |
| Required root checks initially failed because the worker lacked ZIP/Pandoc and inherited commit signing; approval mixed failed historical and successful final runs | Pin worker prerequisites and signing override; record one final result per command and preserve earlier failures/excluded outcomes in notes | Original contradictory approval correctly held; no false acceptance or evaluator modification. |
| Bun treated the bare nonstandard evaluator filename as a filter, skipping it in a mixed command and finding zero tests when run alone | Explicit `./` paths; intake rejects ambiguous pinned evaluator filters in jobs, integrated and deployed contracts | Subprocess regression reproduces a false green with a deliberately failing evaluator, then proves the explicit target executes and fails. Third SELECT independently passed the corrected command. |
| Integrated approval again included a failed supplementary excluded-journey check | Clarify included scope and phase; reject that report, then reserve at most two fresh independent reviews of the exact candidate within the original station clock. A failed required check still holds immediately. Explicit worker deadlines prioritize required checks and completion over unrequested media. | Six integration regressions cover integrated/deployed retry, exhaustion and required-check failure. The third trial stays blocked; fourth trial uses the identical packet with a disclosed new batch budget. |
| Slice reviewers repeatedly substituted a journey trace ID for the required criterion ID, exhausting format retries | Explicit criterion-vs-journey instruction, notes array example and feedback containing observed/expected IDs | Fourth trial correctly held at the two-retry cap, with candidate, clock and builder attempts preserved. No report was normalized into acceptance. |
| Combined reviewer treated the future staging origin as its pre-deployment browser target and rejected the expected 404 | Explicit machine phase/verification target; pre-deployment instructions require the worker app with staging URL variables unset; deployed-review still requires the real site | Fifth trial accepted both slices on their first attempts. Integrated local browser checks passed, but the reviewer manually changed the target and rejected. The rejection remains held; no failed required result was accepted or retried as formatting. |

Required root checks pass: 400 tests, zero failures, 45 files; 217 Eve tests are included, not added again. Strict Eve type checking and Vercel-target build pass; exactly two generated function configurations use 60-second invocation limits. Empty bare-kit product checks do not supply product evidence; separate real product/browser runs do.

## Hosted iterations

| Iteration | Outcome |
|---|---|
| [Issue #19](https://github.com/hivinaynair/return-desk-cloud-test/issues/19) | Both slices independently accepted; integrated approval with failed checks correctly blocked. Preserved hook-collision and worker-preflight failure evidence. |
| [Issue #21](https://github.com/hivinaynair/return-desk-cloud-test/issues/21) | Real builder handoff and normal predecessor exit; SELECT independently accepted. Paused when the broken deployed evaluator argv was reproduced. Existing VIEW builder finished; no subsequent reviewer/deployment was dispatched. |
| [Issue #23](https://github.com/hivinaynair/return-desk-cloud-test/issues/23) | Corrected packet at 8cee41c6ce6cedd0fcb38f2fae00f9adf5ea43d2. SELECT independently accepted at 448f405ba69ffbab037c0e9aa3aa9555a3ad209a; VIEW independently accepted at fd21bedeae9d6640addd74afaadd8ce845ed8a7d. Combined review ran all required checks successfully (173 unit tests, build and three browser cases), but approval included a failed supplementary excluded-journey test. It correctly held; no PR or deployment was produced. The original review clock was not reset. |

| [Issue #24](https://github.com/hivinaynair/return-desk-cloud-test/issues/24) | SELECT accepted at 3e3863c33a3bca8b1b6bbd8b7e16c9d8b8a86836; VIEW built at 0eeaa91cc2f7cf9a470c73668bf3cbb4bbd812b4. Three separate reviewer reports used incorrect IDs (one also had malformed notes). Correct hold at retry exhaustion; no PR or staging delivery. |

| [Issue #25](https://github.com/hivinaynair/return-desk-cloud-test/issues/25) | SELECT and VIEW independently accepted on first attempts, no format retries, candidate d41a9f2b441fa54d94e67a9ec2f0c586264ccc38. Integrated code checks and local browser passed; reviewer incorrectly required a not-yet-deployed origin and rejected. No PR or staging delivery. |

Fourth [issue #24](https://github.com/hivinaynair/return-desk-cloud-test/issues/24) uses the exact third intake and unchanged evaluators, requirements and limits. Runtime 39b9c98 is deployed as vipernxt-factory-5cn8xwzb5-vinaynair-projects.vercel.app. Prior reviewer FINISHED status was confirmed before dispatch.

Setup [PR #18](https://github.com/hivinaynair/return-desk-cloud-test/pull/18), [PR #20](https://github.com/hivinaynair/return-desk-cloud-test/pull/20) and [PR #22](https://github.com/hivinaynair/return-desk-cloud-test/pull/22) passed CI and merged only disposable staging. No production-main merge occurred. The original ViperNxt main remains 4a10ccb1c8717e0c8c75c747fe364120a75079c4.

## Operational evidence and limits

A real GitHub owner mention was delivered by vipernxt-factory[bot] at [the hold receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/19#issuecomment-5917529235). This proves comment/mention delivery, not human reading or email delivery. Unsigned callback requests are rejected with HTTP 401. A real signed Cursor callback returned 202; callback receipt never approves code.

The workspace Docker build hit upstream Docker Hub HTTP 429 and is not counted as passed. Worker execution and reported checks must supply the functional evidence. CLI streaming upload returned HTTP 502; buffered TLS upload of identical artifacts succeeded. An attempted Cursor stop endpoint returned 404; finished-run status, rather than a claimed cancellation, was confirmed before replacing the second trial.

Costs are authorized. One Gateway inference reported $0.00016; Cursor/hosting totals are unknown. There is no zero-spend claim or dollar-cap guarantee.

Fifth [issue #25](https://github.com/hivinaynair/return-desk-cloud-test/issues/25) uses the identical intake and limits. Reviewer-contract clarification 7d8e3d2 is live as vipernxt-factory-cxovp7h4n-vinaynair-projects.vercel.app; 400 root tests and 217 included Eve tests, strict types and Vercel build pass.

Remaining: fresh phase-explicit trial through both slices, combined review, exact-candidate GitHub CI, automatic staging receipt and deployed browser acceptance. Cold failover during provider creation and ambiguous remote staging dispatch have only fixture coverage; these limits prevent a 10/10 reliability claim.
