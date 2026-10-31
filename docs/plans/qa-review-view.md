# QA review view inside the task card

A non-technical person (the client's PO, or someone on the deco team in QA)
opens a card and needs to know whose turn it is, what changed, what to check,
and how to approve or send it back. The card has a **Review** view for this,
beside the existing full conversation. It reads the agent's own comment, so it
adds no new storage.

## What it does

- **Whose turn.** A banner names the lane and what a decision does. In QA the
  deco team ticks a checklist; in Customer Approval the client sees the result,
  a "Checked by deco" mark and what the deco team checked, and one question.
- **What changed.** The latest comment the agent left for people, split into
  sections. Before/after images sit side by side. When the comment does not
  follow the format, the view shows it as written and says so.
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
| **Como conferir / How to check** | yes | A bullet list of things a person can check |
| Evidências / Evidence | no | Prose and images; before/after images are labelled by their alt text |
| Limitações / Limitations | no | What was not tested |

## Comments written by people

Two fixed first lines are read back by the view (either language):

- `**Ajuste pedido** · QA|Cliente · rodada N` followed by the note.
- `**Conferido pela deco**` followed by `- [x]` / `- [ ]` items, written when the
  deco team approves in QA, so the client can see what was checked.

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
5. **Business rules.** "How to check" is whatever the agent lists. A project-level
   source of agreed rules would let the view check against them.
6. **Telling people it is their turn.** There is no notification when a card
   enters QA or Customer Approval, and the board marks only unowned In Review
   cards.
7. **Persisted checks.** What the deco team ticks is kept only when they approve.
   Progress before that is local to the open card.
8. **Refuse versus adjust.** Both send the card back with a note. A separate
   "refuse" would only be worth it if it meant something different downstream.
