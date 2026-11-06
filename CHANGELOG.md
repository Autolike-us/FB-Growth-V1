# Changelog

## 1.4.0 — Share my reels and posts to groups
- **New: Share to groups** (own menu entry, same page as Post to groups). Choose reels and posts you already published and the groups to send them to. Aurora uses Facebook's own Share → “Share to a group” for each item and group.
- **Choose what to share**: “My reels” and “My posts” are read from your profile and shown as cards you tick, or use “Paste links” for any reel or post link.
- **Assisted (recommended) or Automatic**, an optional caption (or a different caption per group written by Aurora Reply), the order of the shares (spread out, or group by group), the same rules check, admin-approval filter, daily limit and pacing as Post to groups.
- Never shares the same item to the same group twice, remembers what was shared where, and stops on warnings. An uncertain share is never repeated.

## 1.3.1 — Groups: loading, filters, several-groups post, link previews
- **Load my groups** now runs in the background, shows how many it has found, and brings this window back to the front by itself when it is done. If nothing is found, it says what it saw so you can send a report.
- **Several groups in one post**: use Facebook's own “Add groups” (up to 9 groups at a time). Aurora opens the first group's post box, ticks the other groups by name, writes your text once and posts once. Choose how many groups per post.
- **Admin approval and promotion rules**: Aurora learns which groups hold posts for admins or ban promotion (while it reads rules, and when a post goes to the admins). The list shows it, and a filter can hide or show those groups. “Check rules of the chosen groups” reads them without posting.
- **Link previews**: when your post has a link (for example a YouTube video), Aurora waits for Facebook's picture card, nudges it once if it does not appear, and tells you if it still did not show.
- **Better defaults**: 2 minutes between groups in Assisted mode, 5 minutes in Automatic mode. The daily limit now counts groups.

## 1.3.0 — Post to groups
- **New tab "Post to groups"**: write one post, load the groups you belong to, tick all of them or only some (search, "Select all", saved lists), and post to them one at a time.
- **Assisted mode (recommended)**: Aurora opens each group and puts your text in the post box once; you read it and press Post yourself. Close the box to skip a group.
- **Automatic mode**: Aurora presses Post too. It needs you to accept an account-risk notice, waits at least 5 minutes between groups, and allows at most 15 posts a day.
- **Rules check**: Aurora reads each group's rules first and skips groups that ban promotion (you can turn this off).
- **Different wording per group** (optional): Aurora Reply writes a separate version for each group, 1 Reply credit each. You can read and edit every version.
- **Safety**: never posts the same text to the same group twice, stops on captchas, restrictions and warnings, and an uncertain post is never repeated. Preview mode checks the post box and posts nothing.
- Text only for now. Photos and videos are not attached yet.

## 1.2.2 — Move or hide the Aurora button
- **Move it**: drag the floating Aurora button to any corner of the page. Aurora remembers the spot, and the panel opens up or down so it never goes off screen. Double-click the button to put it back.
- **Hide it**: a small × next to the button hides it. Turn it back on with the checkbox "Show the Aurora button on pages" in the toolbar popup. If a task pauses and needs you, the button still appears so you do not miss it.

## 1.2.1 — Your home feed
- **Your home feed** is a new source for reacting, commenting and sharing: Aurora works down your own Facebook home feed. No target needed.

## 1.2.0 — A different comment on each post
- New option under "Comment on posts": **Use a different comment on each post**. Write one comment per line (at least two). Aurora picks one at random for each post and does not repeat a comment until all have been used; the same post always keeps its comment if a step is retried or resumed.
- Everything else about commenting is unchanged: one comment per post, preview first, nothing is sent until you confirm.

## 1.1.1 — Comment confirmation fix
- After posting a comment, Aurora now recognises it even when Facebook hides decoy characters inside the comment text, so it no longer reports "Comment sent but could not confirm it appeared" for a comment that did appear.
- Nothing about sending changed: Aurora still sends at most one comment per post, and it still says "could not confirm" when nothing was actually posted.

## 1.1.0 — New popup and a fresher dashboard
- The toolbar popup is now a small status card: what is running, Pause / Stop, today's count against your daily limit, your license, and **Open dashboard**. It cannot start or resume anything.
- Everything else (new tasks, saved setups, history, debug log) lives in the full dashboard tab, which opens from the popup. It re-uses the tab if it is already open.
- The dashboard has a calmer look in light and dark, a fourth **Today** card and a Help & support link.
- Nothing about how tasks run has changed: previews, confirmations, pacing, receipts and pause-on-problems are exactly as in 1.0.1.

