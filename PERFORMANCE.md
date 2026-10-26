# Performance checks — 2026.10.26.1

The release avoids cloning the full shared-review document for each displayed entry, caches computed review values between changes, and reads payment markers once per monthly render. Removed localStorage review mirrors eliminate repeated serialization on realtime updates. Ordinary financial saves avoid restore-journal reads unless a restore is involved.

Compared with commit 0e25514490e49f0bd7de8558bed985364870c75b. Two run orders provide 18 samples per version. The fixture adds 100 investment accounts with one automatic entry each and 100 valuation marks to synthetic financial records. The browser uses a 390×844 viewport, real service worker and offline cached reloads. Firebase network operations use the local adapter; these are not physical phone or production network measurements.

| Metric | Before median (ms) | After median (ms) | Change |
|---|---:|---:|---:|
| offlineOpen | 114.0 | 117.55 | 3.1% |
| pageSwitch | 99.55 | 104.65 | 5.1% |
| scheduledRefresh | 6.9 | 6.9 | 0.0% |
| offlineSaveAndRefresh | 145.35 | 135.9 | -6.5% |
| monthlyReview100Entries | 34.95 | 27.4 | -21.6% |

Monthly review is faster in both orders. Other timings are mixed, so no general startup/navigation/save speed improvement is claimed. The additional backup coordination is primarily a correctness change. Raw samples, separate run orders and environmental limitations are recorded in PERFORMANCE_RESULTS.json.

To reproduce, check out the baseline separately and set PFT_PERF_BASELINE_DIR to its dist directory, then run npm run test:performance. Repeat with PFT_PERF_ORDER=after-first. Use the same browser/device and avoid concurrent heavy work. Actual Android/iPhone timing, keyboard and assistive-technology checks remain manual-device work.


## Pending Lighthouse startup improvements

See LIGHTHOUSE_IMPROVEMENTS.md and STARTUP_PERFORMANCE_RESULTS.json for the controlled cold/return-navigation comparison against Cash Flow commit 6bc2453. These measurements use an isolated local fixture and do not replace a post-deployment Lighthouse run.
