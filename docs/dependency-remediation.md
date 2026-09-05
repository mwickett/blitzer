# Dependency remediation — 2026-09-05

The refreshed lockfile reduces `npm audit` from **14 affected packages (12 high,
2 moderate) to 3 high entries**. The remaining entries describe one advisory
propagated through `prisma → @prisma/config → deepmerge-ts`. Audit counts are
package counts, not distinct vulnerabilities, and remain time-sensitive.

## Changes and exposure

| Dependency | Resolved change | Use in this application / evidence |
| --- | --- | --- |
| Next / sharp | Next and its ESLint config 16.2.11 → 16.3.4; sharp 0.34.5 → 0.35.4 | Runtime image optimization. Next's own optional dependency now selects patched sharp; no sharp override. [Next release](https://github.com/vercel/next.js/releases/tag/v16.3.4), [sharp advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj). |
| DOMPurify | 3.4.12 → 3.4.14 | Browser dependency of PostHog. The advisory requires in-place sanitization with an element-removal hook; this app does not configure DOMPurify directly. Patched without assuming the SDK's internal usage is unreachable. [Advisory](https://github.com/advisories/GHSA-55q2-fjhq-7xh7). |
| brace-expansion | 1.1.16 / 2.1.2 / 5.0.8 → 1.1.18 / 2.1.4 / 5.0.9 | ESLint, Jest, and React Email tooling. Each existing major receives its own patch, including the follow-up fix. [Advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895). |
| fast-uri | 3.1.4 → 3.1.7 | AJV configuration/schema processing in Sentry's webpack plugin, Prisma local tooling, and React Email. Retains major 3. [Advisories](https://github.com/fastify/fast-uri/security/advisories). |
| js-yaml / nanoid | js-yaml 3.15.0 / 4.3.0 → 3.15.2 / 4.3.2; nanoid 3.3.16 → 3.3.18 | ESLint/Jest configuration and PostCSS. All remain on their existing majors. [YAML advisory](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [nanoid advisory](https://github.com/advisories/GHSA-2v37-7h3g-55p8). |
| Prisma | CLI, client, and PostgreSQL adapter 7.9.0 → 7.10.0 | Keeps the runtime client/adapter aligned with generation and migration tooling. Upstream `@prisma/dev` 0.24.17 brings find-my-way 9.7.0 and Valibot 1.4.2. [Prisma release](https://github.com/prisma/orm/releases/tag/7.10.0), [router advisory](https://github.com/advisories/GHSA-c96f-x56v-gq3h), [Valibot advisory](https://github.com/advisories/GHSA-5qjj-4xww-7phc). |
| mysql2 | Prisma-only override 3.15.3 → 3.24.3 | Prisma still pins 3.15.3 for Studio's MySQL connector. The override retains major 3 and the `mysql2/promise` pool API used by Studio. This app's databases use `PrismaPg`, not MySQL. [Authentication advisory](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), [compression advisory](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), [release](https://github.com/sidorares/node-mysql2/releases/tag/v3.24.3). Remove the override once Prisma supplies a patched version. |

No force audit fix, major Prisma change, or application dependency removals were
performed. Registry versions and upstream release/advisory information were
checked on the date above. Next remains on major 16 and React is unchanged;
the [Next upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
requires no major-version migration for this update.

## Remaining advisory

`deepmerge-ts@7.1.5` is pinned by `@prisma/config@7.10.0`. Its
[recursive-object stack-exhaustion advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
is fixed only in major 8. There is no patched major 7 release. npm suggests a
Prisma 6.12 downgrade, which is inappropriate for this Prisma 7 application.

The package is loaded by Prisma's local configuration loader; the loader merges
the repository-owned `prisma.config.ts` and disables remote config extension.
The vulnerable condition requires recursive JavaScript objects, which ordinary
JSON input cannot produce. Application database clients import the generated
runtime and PostgreSQL adapter. None of the 30 production `.nft.json` file
traces include deepmerge, Prisma's configuration/CLI modules, or mysql2. This
supports a tooling-only classification for this checkout, not a universal claim
that the dependency is safe. Prisma is in `dependencies`, so `--omit=dev` alone
does not remove its audit findings.

Follow up when Prisma adopts patched deepmerge, or if the project begins merging
untrusted JavaScript configuration. Do not hide the finding or install major 8
under a version-7 contract just to make the audit green.

## Verification

Verified with Node 24.15.0 and npm 11.12.1:

- Fresh `npm ci`, including Prisma 7.10 client generation.
- Typecheck; lint exits successfully with three new warnings for existing
  `window.location.href` assignments in error pages.
- All 28 source test suites / 215 tests pass.
- Both PostgreSQL integration cases pass against a disposable PostgreSQL 17
  container after applying the real migration chain.
- Production `next build` passes with the synthetic service configuration from
  `.github/workflows/test.yml`; this invokes no shared-database migration.
- sharp encodes, resizes, and decodes a synthetic image in WebP and AVIF.
- mysql2's promise pool, execute, and close APIs load without a database
  connection. A live MySQL connection was not tested; the app uses PostgreSQL.
- `npm ls` validates the resolved tree; fresh audit confirms the three remaining
  entries above. Installation still emits Jest's existing glob deprecation notices.

Prisma 7.10 also changes PostgreSQL unique-constraint error metadata; combined
integration testing must include the audit's provisioning/concurrency changes.
These dependency checks do not replace the final browser and combined-branch
regression pass.
