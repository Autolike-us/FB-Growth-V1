# Aurora • Facebook Studio 2.0.6

The Facebook preview UI now runs a task engine adapted from the current Instagram and TikTok studios, with a Facebook-specific URL planner, DOM discovery and confirmed actions. Existing popup, floating panel, dark/light theme, saved setups, history, debug reports and notifications are retained. No subscription or backend required.

## Install or update

1. Download/extract the package into its own Facebook extension folder.
2. For an existing installation, stop the old task, replace **all** files in the original unpacked folder, then click **Reload** in `chrome://extensions`. This preserves stored setups/history. Otherwise choose **Load unpacked** and select the folder containing `manifest.json`.
3. Refresh Facebook tabs and use Facebook in English, signed in normally. Stop any old preview-version task and create a new task.
4. Open the toolbar popup or floating **Aurora → Open full studio**. Begin with Preview and a limit of **1**.
5. Preview discovers rendered posts and checks action controls without submitting reactions, comments, follows, friend requests, membership requests or shares. Discovery may scroll and read page elements.
6. To act, uncheck **Preview only**, click **Start task**, then review and click **Confirm live…** within 15 seconds. The task reuses your open Facebook tab; keep it open.

## Actions and inputs

| Action | Sources | Confirmation |
| --- | --- | --- |
| Like / Love / Care / Haha / Wow / Sad / Angry | Page/profile feed, group feed, hashtag, direct post/reel/video links | Changed reaction state on the target post |
| Follow | Explicit page/profile URLs or usernames | Following/requested state |
| Unfollow | Explicit page/profile URLs or usernames | Follow state after the native menu |
| Comment | Discovered or direct posts | A newly visible matching comment and a cleared editor |
| Friend request | Explicit profiles | Pending request or Friends state |
| Join group | Explicit group IDs, slugs or `/groups/…` links | Membership or pending-request state |
| Share | Discovered or direct posts | Facebook's share success alert |

Separate explicit targets with commas/new lines. Use exact usernames/URLs, not ambiguous search names. Facebook shortlinks and named searches are not resolved automatically. Marketplace is disabled: listing pages do not expose these engagement actions. No message sending or listing contact flow is implemented.

Shares use Facebook's existing feed audience; Aurora does not change privacy settings. Membership questions, group rules and approval requirements remain for you to handle manually. If Follow/Following is hidden in a profile menu, you may need to expose the control manually. Unavailable or ambiguous controls pause/skip without guessing. Already reacted posts are skipped rather than toggled off or switched to a different reaction.

## Task behavior

- Real discovery replaces the preview build's repeated visits to the same page. Scans stop at the posts-per-target setting, 20 scrolls, or three scans with no new results. Discovered post IDs are deduplicated across the task. Hidden/private content is not accessible.
- Action limits count confirmed live actions or eligible previews. Skips/discovery do not consume that limit. The optional daily cap counts confirmed live actions across tasks in the browser's local day; previews do not consume it.
- After counted actions, waits are at least your setting (plus up to 40%). Discovery/navigation/skips use shorter waits. Chrome may deliver timers late; an alarm backs up each step.
- Pause/Stop prevents subsequent actions. A click already sent can finish; its outcome is still recorded. Resume is blocked while a step is finishing or a restart left an action's outcome unknown.
- A receipt is saved **before** sending an action. Uncertain submissions are not automatically repeated. Comment/friend/join/share receipts are retained; reversible action receipts expire after 90 days. Receipts use an identifiable profile from visible navigation when available and otherwise a conservative browser-wide identity, so another signed-in account can also be blocked from repeating a prior submission.
- Sign-in, verification, restrictions and unexpected redirects pause the task with notifications, a toolbar badge and a banner. Complete checks manually before resuming. No restriction/captcha bypass or automatic verification solving is implemented.
- Debug reports include task targets and comment text, not passwords, cookies or tokens. History retains 5,000 entries; debug logs retain 1,500.

## Verification and practical limits

30 planning/worker tests and 60 offline Chromium DOM/UI checks passed during development. Fixtures cover every action, no-action preview, nested comment controls, duplicate/uncertain sends, warning detection, input validation, caps, pause/resume/restart and live confirmation. Chrome APIs and Facebook page URLs/layouts are simulated in these tests. They do **not** establish live Facebook compatibility or installed-extension verification. Facebook's changing React controls, dialogs and layouts may require selector updates; actions pause when confirmation cannot be established. Start with one intended target in Preview, then one intended live action.

Facebook is the only host permission. `scripting` is added to reattach missing content scripts after extension reload; other existing permissions remain. No cookies/password extraction, remote analytics or license checks are used.

## Development

No build is needed to load the extension. `npm install` installs Playwright for browser tests; point `CHROMIUM_PATH` at your Chromium binary if needed.

- `npm test`: planner and worker checks.
- `npm run test:browser`: offline browser fixtures; no account requests.
- `npm run package`: dependency-free install ZIP in `dist/`.

See `WORKFLOW_REVIEW.md` for the reference comparison and implementation map.

## Version 2.0.6
Aurora’s floating button and paused toolbar badge stay blue. Preview is enabled as a normal checkbox in both popup and studio: checked previews; unchecked enables live tasks. The header shows v2.0.6. The repository main branch may still be the old locked-preview 1.0.0 build until the draft PR is merged; install this release package to test automation.

## Permalink compatibility in 2.0.6
Preserves photo/photo.php destinations instead of converting fbid links into text-post permalinks. Post detection supports unlabelled permalink containers using a unique post reaction/Comment/Share action row, and excludes comment-only containers even when they contain a post permalink. Diagnostic logs retain allowlisted post identity query parameters and include article/link counts. Regression fixtures passed; the exact live layout reported by the user has not been inspected.

## Photo theater in 2.0.6
Supports the photo viewer rendered beside an empty role=main element, using one uniquely identifiable Like / Leave a comment / Share action row outside main. Nested comment Likes stay excluded. Offline selector verification against the user-provided HTML (scripts removed, network blocked, hidden server-rendered staging wrapper revealed to simulate hydration) found the photo Like control, not a comment control. No live action or real Facebook confirmation was tested. The uploaded HTML is private scratch input and is not included in source, tests or release files.

## Reaction chooser in 2.0.6
Opens the native reaction palette with pointer and mouse events at the post button coordinates, then selects the requested accessible label (including labelled canvas/role-button layouts). The selector no longer depends on re-identifying the post container while the palette is open. It supports title, image and radio labels too; it never guesses an unlabeled icon by ordinal position. A chooser failure before the reaction click creates no action receipt. Legacy chooser-only receipts are cleared only when the same target and reaction have a matching logged no-click failure within the attempt window; uncertain sends remain blocked. Browser fixtures match the palette structure pasted by the user. Live Love confirmation still needs a one-target check.

## Native reaction input in 2.0.6
Facebook left the user's Love selection unreacted after a synthetic DOM click. Non-Like reactions now use Chrome debugger native mouse input: the active task tab, target post, configured reaction and labelled control at the pointer are validated, then one mouse press/release pair is sent and the debugger detaches. Existing plain Like tasks keep their established click path. Confirmation also recognizes a labelled selected-reaction icon when the outer button label stays Like; closing the palette alone is never considered success.

This release adds the required `debugger` permission. Chrome does not allow it as an optional permission ([official permissions rules](https://developer.chrome.com/docs/extensions/reference/api/permissions)). Review the new access when loading/updating the extension. The API is used only for the active Facebook reaction task; no cookies, network bodies, console evaluations or account secrets are read by the debugger helper. Close DevTools on the task tab while the task runs; Chrome can show its debugging notification briefly.

For a paused uncertain reaction, check the post manually. If no reaction was applied, click **I checked: no reaction applied — allow retry**, then **Resume**. That clears only the current account/post/reaction's attempted receipt, keeps confirmed receipts and other targets, and leaves the task paused until Resume. It is your explicit manual review, not automatic retry of an unknown outcome.

The debugger transport is tested with mocks and offline browser fixtures; it has not been verified as an installed extension against live Facebook. Test one intended Love reaction first.

## Feed targets and confirmation in 2.0.6
Profile discovery reads feed article/FeedUnit containers only, excluding profile headers, cover areas and comment rows. It does not scan every photo link in main. Create a new task after updating so previously collected header/cover links do not remain in the queue.

Reaction summary counters (for example Care: 1 person) are not action controls. Confirmation checks the selected reaction on the retained target/scope when Facebook rerenders, and uses the same selected-control predicate when rebuilding the action row. Regression fixtures cover new counters and a replaced button/wrapper.

If you visibly confirm that a paused reaction succeeded, click **I checked: reaction succeeded — count and advance**. This records that one attempted receipt as manually confirmed, increments the action/daily counters once and removes the current queue item without clicking again. Press Resume for the next item. A duplicate manual confirmation is rejected. For an old task containing unwanted cover/header targets, stop it and create a fresh feed task instead.

User reports confirm native Care input succeeded; the new automatic confirmation and feed-only discovery still need live-layout validation.

## Version 2.0.7: foreground post dialogs and feed containers

Post targeting now checks action rows inside nested dialog/article wrappers before looking at the background feed. It retains the foreground post article so nested comments do not hide its reaction control. Live reaction preparation waits for the control to become reachable after scrolling and reacquires it if Facebook replaces it. Feed discovery scans rendered article/FeedUnit containers across the page and explicit reel links in feeds, including feeds rendered beside or in a second main container; profile covers, headers, comments and dialogs remain excluded.

Debug page checks include discoverable-feed counts and structural control geometry/overlay information without copying page text or account names. This release has offline regression coverage for nested post dialogs, duplicated background posts, multiple main containers and feed articles outside main. These checks do not verify the user's live Facebook DOM. Stop the old task, reload the extension, refresh Facebook and verify the displayed version is 2.0.7 before creating a fresh task.

## Version 2.0.8: in-feed liking and commenting
For page, group and hashtag targets, Like and Comment now work down the feed in place instead of collecting post links and opening each one. Aurora takes the first post not handled yet, reacts (or comments) if you have not already, waits your configured delay, then moves to the next and scrolls for more. Posts without a reaction bar (suggestions, reel rails) are ignored. Share, follow, friend and join keep their previous flow. Direct post/reel links still open the post.

## Version 2.0.13: comment and share in the feed
Comment and Share now use the same in-feed walk as reactions. For each post Aurora opens the Comment control (Facebook labels it "Leave a comment"), types your text one character at a time with natural pauses, sends it, closes any pop-up Facebook opened, and moves to the next post. Share opens the post's Share menu and chooses Share now. Reactions: the palette is waited out and a stubborn post is skipped rather than pausing the task. Follow, unfollow, friend and join still visit each listed page/group; their header button now uses the first match when Facebook shows it twice.

## Version 2.0.16: unfollow via Follow settings, page IDs
Unfollow now handles Facebook's "Follow settings" dialog: it picks the Unfollow radio and presses Update (the older menu is still supported). Pages can be targeted by a bare numeric ID or a `profile.php?id=…` link; if Facebook redirects the ID to the page's username, Aurora continues on the redirected page instead of stopping.

## Version 2.0.17: join dialogs, share menu, cleaner studio
- **Join:** if Facebook shows a membership-questions or rules dialog, Aurora closes it without answering and moves to the next group (it is logged as skipped, and a later run can still try that group).
- **Share:** the Share menu is read as a menu (not only buttons). Aurora picks "Share now", or "Share to Feed" followed by the composer's Share now/Post button; if neither exists it reports the options it saw. A post that cannot be handled is skipped; three in a row pause the task with the reason.
- **Studio:** fields that do not apply to the chosen action are hidden (follow/unfollow/friend/join hide "posts per target" and the source picker; only React shows the reaction list; only Comment shows the comment box). A banner always says PREVIEW MODE (nothing is sent) or LIVE MODE, the start button reads "Start preview" or "Start live task", and finished preview runs say that nothing was sent.

## Version 2.0.24: studio navigation
- **Start summary + target check:** a line above Start restates the task (mode, action, target count, posts each, pace, time estimate), and the target box shows how many targets are recognised and which are not valid. Start is blocked with a clear message while one is invalid.
- **Collapsible sections:** "Pace & limits" and "Advanced" fold away (their current values show in the caption) and remember whether you opened them.
- **Live session card:** shows "Target 2 of 5 · name · post 1/3 · next in 24s", a per-target list (✓ done, ↷ skipped, ▶ current, ○ upcoming) and, when paused, **Skip this target & continue**.
- **Sidebar badges:** a dot on Studio while running (red when paused), a count on Activity history, and a dot on Debug log for new errors.
- **Activity history:** filter chips (All, Done, Skipped, Problems), search, and status icons.
- **Saved setups:** a one-line summary of the selected setup and an "Update this setup with the current form" button.
- **First-run checklist** (dismissible), **Ctrl+Enter** to start, a sticky Start bar in the full studio, and on Facebook the bubble shows progress with a one-click Pause/Resume.

## Version 2.0.25: single scrollbar, redesigned on-page panel
- **Popup:** only the page scrolls (no inner scrollbars, no sideways scrollbar); the Start bar no longer sits 21px off the edge.
- **Aurora panel on Facebook:** matches the studio (follows light/dark), shows a PREVIEW or LIVE badge, and shows only the controls that apply — the preview form when idle; Pause and Stop while running; Resume, **Skip this target**, Stop and Copy error report when paused — with "Target 2 of 5 · name · next in 24s" and a progress bar.

## Version 2.0.26: no sticky Start bar
Nothing is pinned to the window any more: in both the full studio and the popup, Start/Save are ordinary form content, with the one-line summary just above them.
