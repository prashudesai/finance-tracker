# Modular source and cached runtime assets

The deployed HTML shell is approximately 112 KB instead of 1.16 MB. Inline styles, the existing licensed Chart.js build and application JavaScript have moved to separately cached runtime files.

Editable source lives in `src/index.html`, `src/legacy-*.css` and `src/core/`. Core fragments follow `src/core-order.json` and build into one classic-script bundle. This deliberately preserves cross-feature function hoisting and existing global bindings; loading the fragments as separate scripts would change execution semantics.

Run `npm run build` after source edits. Generated Hosting files remain checked into `dist/`. CI rebuilds and rejects generated-file drift before unit/browser checks and production deployment. Relative stylesheet image paths are adjusted for the runtime directory. All runtime assets are precached together, so an incomplete download cannot activate a mixed app release.

Legacy function-level tests use a composed source reader. Browser tests load the real external scripts and styles. A separate native-filesystem build test checks deterministic output, script order, asset availability, print CSS and unchanged vendor bytes and a core bundle identical to its ordered source fragments.

There is no data migration, new backend, calculation change or visual redesign in this release. Scheduled save refreshes render the visible page and mark hidden pages dirty; navigation updates them on demand. Startup no longer eagerly warms every hidden page. Theme CSS remains in its original cascade order. Feature-level source maintenance is now possible without editing the giant HTML file. This is not an ES-module or framework rewrite; the classic global contract remains for compatibility.

Performance measurements and reproducible commands are in PERFORMANCE.md and PERFORMANCE_RESULTS.json. Save-triggered refreshes now update the visible page and mark other pages dirty. Hidden pages refresh when opened. Theme changes do not create hidden analytics charts. Imports and explicit full refresh still rebuild the whole view when required.
