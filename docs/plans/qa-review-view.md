# QA review view inside the task card

A non-technical person (the client's PO, or someone on the deco team in QA)
opens a card and needs to know whose turn it is, what changed, what to check,
and how to approve or send it back. The card has a **Review** view for this,
beside the existing full conversation. It reads the agent's own comment, so it
adds no new storage.

## What it does

- **Whose turn.** The lane is already on the card header, so the view adds no
  stage text. In QA the deco team reads what the agent checked; in Customer
  Approval the client sees the result, a "Checked by deco" mark and what was
  checked, and one question.
- **What the agent checked.** Each item shows passed, failed or not verified.
  Only a failure is loud; a pass is a quiet tick and an unreported check a
  neutral dot. When the agent reported none, one line says so. Failed and
  unverified come first. The approver does not tick anything: the
  common case is one click on Approve. A per-item "Disagree" with a short note is
  the exception, and turns the decision into a request for adjustment.
- **Pins on screenshots.** Both the deco team and the client can click an
  evidence image to mark a spot and write what must change. Pins are numbered,
  stored as percentages of the image, and travel in the adjustment note
  (`**Pins**` list) so the agent receives them. Live preview is not pinnable yet.
- **What changed.** The latest comment the agent left for people, split into
  sections. Before/after images sit side by side. When the comment does not
  follow the format, the view shows it as written and says so.
- **Preview.** When the card has a pull request with a deploy preview, the
  evidence block shows the preview button, so the person can open the change
  without leaving the card. Pull requests are read live from GitHub, so a card
  without one, such as a seeded demo card, shows no button.
- **Decisions.** Approve moves QA → Customer Approval → Ready for Deployment.
  Request adjustment sends the card to **In Review** with no owner, so the
  board's existing "Needs you" badge applies, and records the request.
- **Back and forth.** The card shows "Returned from QA/Customer · round N" until
  the agent delivers again, with the note of what must change.

All of it is stored as ordinary comments, so the full conversation stays the
source of truth.

## The agent comment format

Headings may be Portuguese or English. The two marked ones are required; without
them the view falls back to the raw comment.

| Heading | Required | Content |
| --- | --- | --- |
| Pedido / Request | no | What was asked, in plain words |
| **O que mudou / What changed** | yes | What is different now, no jargon |
| Impacto / Impact | no | Where it shows, what does not change |
| **Como conferir / How to check** (also "O que o agente verificou / What the agent checked") | yes | A task list of what the agent checked: `- [x]` passed, `- [!]` failed, `- [ ]` or plain bullet not verified |
| Evidências / Evidence | no | Prose and images; before/after images are labelled by their alt text |
| Limitações / Limitations | no | What was not tested |

## Comments written by people

Two fixed first lines are read back by the view (either language):

- `**Ajuste pedido** · QA|Cliente · rodada N` followed by the note.
- `**Conferido pela deco**` followed by `- [x]` / `- [ ]` items, written when the
  deco team approves in QA, so the client can see what was checked. An item is
  done only if the agent passed it and the approver did not disagree.

## Gaps and recommendations

Not built here because they belong to the platform:

1. **Agents do not yet write the format above.** The task-run prompt asks for one
   human-facing comment but not its shape. Adding it is a dispatch-path change
   and needs its own default-off flag.
2. **Re-run takes no feedback.** The note of a returned card is only read when
   someone re-runs the agent, which keeps the cost behind a human action. A
   feedback input on Re-run, or a way for a person to record a review verdict,
   would let the agent receive it directly.
3. **A status for returned cards.** Today they share In Review with first
   reviews and are told apart by the comment marker. A dedicated status, or
   `returnedFrom` and `round` fields on the item, would also put the signal on
   the board card.
4. **Required fields in the review decision schema**, so that "what changed" and
   "how to check" are guaranteed rather than parsed.
5. **Checking against what was agreed.** "How to check" is written by the agent from
   the card, so the approver checks against the agent's reading of the request. Showing
   the card's original request next to the checklist would let them compare. Rules that
   apply to a whole project would be a later step.
6. **Telling people it is their turn.** There is no notification when a card
   enters QA or Customer Approval, and the board marks only unowned In Review
   cards.
7. **Shared drafts.** Pins, disagreements and the note are kept as a draft in
   the person's browser, per card, delivery and round, and cleared when the
   decision is sent. They do not follow the person to another device, and the
   rest of the team cannot see them. Keeping them on the card would need new
   storage.
8. **Several authors in one round.** Pins are one person's marks, sent as one
   request with the author's name. If several people must annotate the same
   round, pins become comments (author, time, replies, resolved) stored on the
   card.
9. **Choosing the status on adjustment.** Not built: adjustments always return to
   In Review.
10. **Refuse versus adjust.** Both send the card back with a note. A separate
   "refuse" would only be worth it if it meant something different downstream.
