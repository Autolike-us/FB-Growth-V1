# Workflow comparison

Reviewed the current `main` sources of [IG-Growth-V1](https://github.com/Autolike-us/IG-Growth-V1), [TK-Growth-V1](https://github.com/Autolike-us/TK-Growth-V1) and [FB-Growth-V1](https://github.com/Autolike-us/FB-Growth-V1).

| Layer | Instagram / TikTok pattern | Facebook implementation |
| --- | --- | --- |
| Setup UI | Action + source + targets; default preview; two-click live confirmation | Preserve existing Facebook fields/presets and enable the same confirmation workflow |
| Planner | Normalize URLs; discover posts/accounts; expand queues | Facebook profile/group/hashtag/post identity; feed discovery; explicit account actions |
| Worker | Persist queue and timing; navigate target tab; ask content script for a step | Adapt the TikTok worker, including reinjection, caps, receipts, alerts and restart handling |
| Page execution | Scope controls to target; confirm changed state | New Facebook-specific accessible-label and post/header selectors |
| Duplicate protection | Receipt before irreversible submission; uncertainty pauses | Conservative receipts for comments, friend requests, membership requests and shares |
| Observability | Logs, page-check report, notifications, task banners | Existing UI retained with real DOM diagnostics |

The original Facebook `engine.config()` forced `dry:true`, `dashboard.settings()` also forced `dry:true`, and `background.tick()` merely incremented preview counters after visiting a URL. Its content script had no step listener. Removing a checkbox lock alone could not add automation; all three execution layers needed to be connected.

Facebook differs from the references: seven reactions, friendship requests, membership rules and share destinations require Facebook-specific controls. Account actions use explicit lists rather than transplanting TikTok/Instagram follower discovery. Marketplace remains visibly unavailable because these actions have no matching controls on a listing.

The implementation reads normal rendered Facebook content and native accessible controls. It does not reuse proprietary API endpoints or implement a license bypass.
