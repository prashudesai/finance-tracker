# Installed-PWA-style performance measurements

Headless Chromium, 390x844 mobile viewport, real service worker, offline cached reloads; synthetic records. Not a physical iPhone.

Two runs in opposite orders; 18 offline cached samples per version. Each reload restores the same synthetic fixture plus matched incremental test saves.

| Operation | Before median | After median | Median change |
|---|---:|---:|---:|
| offlineOpen | 110.4 ms | 94.45 ms | 14.4% reduction |
| pageSwitch | 20.75 ms | 22.45 ms | -8.2% reduction |
| scheduledRefresh | 19.55 ms | 6.0 ms | 69.3% reduction |
| offlineSaveAndRefresh | 137.9 ms | 91.1 ms | 33.9% reduction |

Negative reduction means slower. First-time page switching moves work onto navigation; the pooled median cost increased 1.7 ms. Cached opening improved about 14%, scheduled refresh work about 69%, and offline save plus refresh about 34% in these local runs. Do not interpret these as physical-iPhone results, cold-network startup or guaranteed production gains. Authentication and cloud latency are mocked; the service worker, offline cache, IndexedDB and rendering are real. Memory and battery were not measured.

Reproduce with `npm run test:performance` and `PFT_PERF_ORDER=after-first npm run test:performance`. Preserve each JSON output from `test-results/performance/report.json` before the second run. Full measurements are in `PERFORMANCE_RESULTS.json`.
