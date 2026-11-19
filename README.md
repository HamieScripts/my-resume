# Jamie Clark - Resume

A flat, responsive resume built with native HTML and CSS and build-time
Tailwind v4. There is no navigation, application framework, runtime JavaScript,
backend, or external font request. Published content is explicitly approved;
interview evidence and working drafts remain outside this repository.

## Run Locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npx playwright install chromium
npm start
```

Open the URL printed by the server, normally http://127.0.0.1:5173. It selects
another port if that port is occupied. To rebuild after source changes, run
`npm run build`; an already running preview server will serve the new files.

## Build and Test

```sh
npm run build
npm test
```

The build copies the HTML and local fonts/icons, compiles and minifies Tailwind,
and uses Chromium to generate original bitmap illustrations and a tagged,
text-selectable PDF from the same page. Print CSS adapts layout and pagination;
the CV narrative is not maintained separately. The download serves the finished
static file at `dist/assets/cv.pdf`, with no runtime PDF generation.

Tests cover five viewport widths, image and font loading, artwork pixels,
keyboard access, downloads, two-page PDF content and links, and hosting beneath a
repository subpath. Desktop and mobile screenshots are generated in `.artifacts/`.

`dist/` is the complete GitHub Pages-compatible site; URLs are relative. Publish
that directory, not the source tree. The local build does not commit, push, or
publish anything.

## GitHub Pages

In the GitHub repository, open **Settings > Pages** and set **Source** to
**GitHub Actions**. The Pages workflow builds and tests the site and PDF before
deploying only `dist/`. It runs on pushes to `main` and can also be started
manually from **Actions > Deploy resume to GitHub Pages**.

Deployment uses GitHub's built-in token and OpenID Connect; no personal access
token or additional deployment secret is required. Interview notes and private
drafts are never part of the build or the deployment artifact.

## Authoring Skills

Invoke these explicitly from GitHub Copilot Chat in VS Code:

- `/career-history-interview`: gather career evidence privately.
- `/current-experience-interview`: review recent work and update private evidence.
- `/publication-update`: prepare exact changes for destination-specific approval.

Career evidence and drafts belong in a separately approved private folder outside
this repository, never in an ignored folder here. Only explicitly approved public
content belongs in this project. The skills guide agent behaviour; they are not a
technical sandbox. See [GLOSSARY.md](GLOSSARY.md) for the agreed terminology.

## Assets and Dependencies

The build creates the core geometric artwork locally; the additional documentation
and chart studies are approved local bitmap assets. Space Grotesk and DM Sans are
self-hosted from Fontsource; tool icons come from Lucide. Their license notices
are copied into the generated assets. Playwright and PDF.js are build/test tools,
not browser dependencies. Tailwind is compiled through its Node API without a
file watcher; Lightning CSS minifies the result.