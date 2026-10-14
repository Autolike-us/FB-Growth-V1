# Aurora • Facebook Studio 2.0.4

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

23 planning/worker tests and 53 offline Chromium DOM/UI checks passed during development. Fixtures cover every action, no-action preview, nested comment controls, duplicate/uncertain sends, warning detection, input validation, caps, pause/resume/restart and live confirmation. Chrome APIs and Facebook page URLs/layouts are simulated in these tests. They do **not** establish live Facebook compatibility or installed-extension verification. Facebook's changing React controls, dialogs and layouts may require selector updates; actions pause when confirmation cannot be established. Start with one intended target in Preview, then one intended live action.

Facebook is the only host permission. `scripting` is added to reattach missing content scripts after extension reload; other existing permissions remain. No cookies/password extraction, remote analytics or license checks are used.

## Development

No build is needed to load the extension. `npm install` installs Playwright for browser tests; point `CHROMIUM_PATH` at your Chromium binary if needed.

- `npm test`: planner and worker checks.
- `npm run test:browser`: offline browser fixtures; no account requests.
- `npm run package`: dependency-free install ZIP in `dist/`.

See `WORKFLOW_REVIEW.md` for the reference comparison and implementation map.

## Version 2.0.4
Aurora’s floating button and paused toolbar badge stay blue. Preview is enabled as a normal checkbox in both popup and studio: checked previews; unchecked enables live tasks. The header shows v2.0.4. The repository main branch may still be the old locked-preview 1.0.0 build until the draft PR is merged; install this release package to test automation.

## Permalink compatibility in 2.0.4
Preserves photo/photo.php destinations instead of converting fbid links into text-post permalinks. Post detection supports unlabelled permalink containers using a unique post reaction/Comment/Share action row, and excludes comment-only containers even when they contain a post permalink. Diagnostic logs retain allowlisted post identity query parameters and include article/link counts. Regression fixtures passed; the exact live layout reported by the user has not been inspected.

## Photo theater in 2.0.4
Supports the photo viewer rendered beside an empty role=main element, using one uniquely identifiable Like / Leave a comment / Share action row outside main. Nested comment Likes stay excluded. Offline selector verification against the user-provided HTML (scripts removed, network blocked, hidden server-rendered staging wrapper revealed to simulate hydration) found the photo Like control, not a comment control. No live action or real Facebook confirmation was tested. The uploaded HTML is private scratch input and is not included in source, tests or release files.

## Reaction chooser in 2.0.4
Opens the native reaction palette with pointer and mouse events at the post button coordinates, then selects the requested accessible label (including labelled canvas/role-button layouts). The selector no longer depends on re-identifying the post container while the palette is open. It supports title, image and radio labels too; it never guesses an unlabeled icon by ordinal position. A chooser failure before the reaction click creates no action receipt. Legacy chooser-only receipts are cleared only when the same target and reaction have a matching logged no-click failure within the attempt window; uncertain sends remain blocked. Browser fixtures match the palette structure pasted by the user. Live Love confirmation still needs a one-target check.
