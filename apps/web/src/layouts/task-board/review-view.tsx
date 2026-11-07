/**
 * The structured "Review" view of a task card.
 *
 * Presentation only: the dialog maps the agent's comment, the card's review
 * state and its actions into these props. When the comment does not follow the
 * review format the caller passes `sections={null}` and the raw comment as
 * `fallback`, so the view never hides what the agent actually wrote.
 *
 * One screen serves both people's lanes. The agent reports what it checked;
 * in QA the deco team confirms it, disagreeing only with what is wrong. In
 * Customer Approval the client sees the result, a "checked by deco" mark and
 * one question. Either person can pin a spot on an evidence image, and the
 * pins travel with the adjustment request.
 */

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@decocms/ui/components/button.tsx";
import { Textarea } from "@decocms/ui/components/textarea.tsx";
import { cn } from "@decocms/ui/lib/utils.ts";
import { useCopy } from "@decocms/ui/hooks/use-copy.ts";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy01,
  Eye,
  EyeOff,
  Flag01,
  LinkExternal01,
  XClose,
} from "@untitledui/icons";
import {
  MemoizedMarkdown,
  TableCopyContext,
  tableToCsv,
} from "@/components/chat/markdown";
import { useT } from "@/i18n/use-t.ts";
import {
  buildAdjustmentNote,
  EMPTY_DRAFT,
  MAX_FEEDBACK_LENGTH,
  MAX_PINS,
  pinPosition,
  splitEvidence,
  type CheckedItem,
  type ChecklistItem,
  type Disagreement,
  type EvidenceImage,
  type ReviewAudience,
  type ReviewDraft,
  type ReviewPin,
  type ReviewSections,
} from "./review-view-model";

export type ReviewViewProps = {
  /** Stable per card, used to key the rendered markdown. */
  id: string;
  sections: ReviewSections | null;
  /** The agent's comment as written; shown when `sections` is null. */
  fallback?: ReactNode;
  audience: ReviewAudience;
  /** The deco team already approved this round. */
  verifiedByDeco?: boolean;
  /** 1 for the first pass; shown as a chip from round 2. */
  round?: number;
  /** Checks the agents already ran, collapsed into a single line. */
  agentChecks?: number;
  /** The preview button, placed beside the evidence it belongs to. */
  preview?: ReactNode;
  /** What the deco team checked for this delivery, shown to the client in
   *  place of the plain checklist. */
  verification?: CheckedItem[];
  /** Spells out what Approve does in this stage. */
  approveLabel?: string;
  /** What the person had marked before, restored when the card reopens. */
  initialDraft?: ReviewDraft;
  /** Called with every change of the marks, and with an empty draft once the
   *  decision is sent, so the caller can keep and clear it. */
  onDraftChange?: (draft: ReviewDraft) => void;
  /** Both omitted: the view is read-only and shows no decision bar. Reports
   *  the checklist as the person left it. */
  onApprove?: (checks: CheckedItem[]) => void;
  onRequestAdjustment?: (note: string) => void;
};

export function ReviewView({
  id,
  sections,
  fallback,
  audience,
  verifiedByDeco,
  round = 1,
  agentChecks,
  preview,
  verification,
  approveLabel,
  initialDraft = EMPTY_DRAFT,
  onDraftChange,
  onApprove,
  onRequestAdjustment,
}: ReviewViewProps) {
  const t = useT();
  // What the person disagrees with, by index of the agent's check.
  const [disagreed, setDisagreedState] = useState(initialDraft.disagreed);
  const [pins, setPinsState] = useState(initialDraft.pins);
  const [showChecklist, setShowChecklist] = useState(true);
  const [note, setNoteState] = useState(initialDraft.note);
  const [adjusting, setAdjusting] = useState(initialDraft.note.trim() !== "");

  // Each change is also reported, so the caller can keep it.
  const changeDraft = (next: Partial<ReviewDraft>) => {
    const draft = { pins, disagreed, note, ...next };
    setPinsState(draft.pins);
    setDisagreedState(draft.disagreed);
    setNoteState(draft.note);
    onDraftChange?.(draft);
  };

  const checks = sections?.howToCheck ?? [];
  const total = checks.length;
  const verifiedCount = checks.filter((c) => c.status === "passed").length;
  const disagreements: Disagreement[] = checks.flatMap((check, index) =>
    disagreed[index] === undefined
      ? []
      : [{ text: check.text, note: disagreed[index] }],
  );
  const feedbackCount = pins.length + disagreements.length;
  const decisive = onApprove !== undefined && onRequestAdjustment !== undefined;
  const pinning: PinControls | undefined = decisive
    ? {
        pins,
        add: (image, position) => {
          if (pins.length >= MAX_PINS) return;
          const pin: ReviewPin = {
            id: Math.max(0, ...pins.map((p) => p.id)) + 1,
            imageUrl: image.url,
            imageLabel: image.label,
            ...position,
            text: "",
          };
          changeDraft({ pins: [...pins, pin] });
        },
        edit: (id, text) =>
          changeDraft({
            pins: pins.map((pin) => (pin.id === id ? { ...pin, text } : pin)),
          }),
        remove: (id) =>
          changeDraft({ pins: pins.filter((pin) => pin.id !== id) }),
      }
    : undefined;
  const decoDone = verification?.filter((item) => item.done).length ?? 0;
  const showVerification = audience === "customer" && verification;

  return (
    <section
      data-testid="review-view"
      aria-label={t("taskBoard.review.viewReview")}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {verifiedByDeco && (
          <span
            data-testid="review-verified"
            title={t("taskBoard.review.verifiedByDecoHint")}
            className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
          >
            <CheckCircle className="size-3.5" />
            {t("taskBoard.review.verifiedByDeco")}
          </span>
        )}
        {round > 1 && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {t("taskBoard.review.round", { n: String(round) })}
          </span>
        )}
        {agentChecks ? (
          <span className="text-xs text-muted-foreground">
            {t("taskBoard.review.agentChecks", {
              count: String(agentChecks),
            })}
          </span>
        ) : null}
      </div>

      {sections ? (
        <>
          {sections.request && (
            <Block title={t("taskBoard.review.request")}>
              <MemoizedMarkdown
                id={`review-${id}-request`}
                text={sections.request}
              />
            </Block>
          )}

          <Block title={t("taskBoard.review.changed")}>
            <MemoizedMarkdown
              id={`review-${id}-changed`}
              text={sections.changed}
            />
            {sections.impact && (
              <div className="mt-3 text-muted-foreground">
                <MemoizedMarkdown
                  id={`review-${id}-impact`}
                  text={sections.impact}
                />
              </div>
            )}
          </Block>

          {(sections.evidence || preview) && (
            <EvidenceBlock
              id={id}
              evidence={sections.evidence}
              preview={preview}
              pinning={pinning}
            />
          )}

          <Block
            title={
              showVerification
                ? t("taskBoard.review.decoChecklist")
                : t("taskBoard.review.agentChecked")
            }
            aside={
              showVerification
                ? t("taskBoard.review.checked", {
                    done: String(decoDone),
                    total: String(verification.length),
                  })
                : t("taskBoard.review.verifiedCount", {
                    done: String(verifiedCount),
                    total: String(total),
                  })
            }
            action={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-expanded={showChecklist}
                aria-label={
                  showChecklist
                    ? t("taskBoard.review.hideChecklist")
                    : t("taskBoard.review.showChecklist")
                }
                title={
                  showChecklist
                    ? t("taskBoard.review.hideChecklist")
                    : t("taskBoard.review.showChecklist")
                }
                onClick={() => setShowChecklist((open) => !open)}
              >
                {showChecklist ? <Eye size={14} /> : <EyeOff size={14} />}
              </Button>
            }
          >
            {showChecklist && showVerification && (
              <p className="mb-2 text-xs text-muted-foreground">
                {t("taskBoard.review.checkedByBoth")}
              </p>
            )}
            {showChecklist && showVerification && (
              <ul
                data-testid="review-deco-checklist"
                className="flex flex-col gap-2"
              >
                {verification.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-start gap-2 text-sm"
                  >
                    {item.done ? (
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <span className="mt-0.5 size-4 shrink-0 text-center text-muted-foreground">
                        •
                      </span>
                    )}
                    <span className={cn(!item.done && "text-muted-foreground")}>
                      {item.text}
                      {!item.done && ` (${t("taskBoard.review.notChecked")})`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {showChecklist &&
              !showVerification &&
              checks.every((check) => check.status === "unverified") && (
                <p
                  data-testid="review-none-reported"
                  className="mb-1 text-xs text-muted-foreground"
                >
                  {t("taskBoard.review.allUnverified")}
                </p>
              )}
            {showChecklist && !showVerification && (
              <ul data-testid="review-agent-checks" className="flex flex-col">
                {attentionFirst(checks).map(({ item, index }) => (
                  <AgentCheck
                    key={`${index}-${item.text}`}
                    item={item}
                    note={disagreed[index]}
                    onDisagree={
                      audience === "deco" && decisive
                        ? (value) => {
                            const next = { ...disagreed };
                            if (value === undefined) delete next[index];
                            else next[index] = value;
                            changeDraft({ disagreed: next });
                          }
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </Block>

          {sections.limitations && (
            <Block title={t("taskBoard.review.limitations")}>
              <div className="text-muted-foreground">
                <MemoizedMarkdown
                  id={`review-${id}-limitations`}
                  text={sections.limitations}
                />
              </div>
            </Block>
          )}
        </>
      ) : (
        <div data-testid="review-fallback" className="flex flex-col gap-3">
          {onApprove && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 shrink-0" />
              {t("taskBoard.review.fallbackNotice")}
            </p>
          )}
          {fallback}
          {preview}
        </div>
      )}

      {onApprove && onRequestAdjustment && (
        <div
          className={cn(
            "flex flex-col gap-3 border-t border-border pt-4",
            adjusting && "gap-2",
          )}
        >
          {audience === "customer" && (
            <p className="text-sm font-medium">
              {t("taskBoard.review.customerQuestion")}
            </p>
          )}

          {adjusting ? (
            <>
              <Textarea
                autoFocus
                aria-label={t("taskBoard.review.adjustmentPlaceholder")}
                placeholder={t("taskBoard.review.adjustmentPlaceholder")}
                maxLength={MAX_FEEDBACK_LENGTH * 4}
                value={note}
                onChange={(event) => changeDraft({ note: event.target.value })}
              />
              {feedbackCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("taskBoard.review.adjustmentAttached", {
                    n: String(feedbackCount),
                  })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("taskBoard.review.adjustmentHint")}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={note.trim().length === 0 && feedbackCount === 0}
                  onClick={() => {
                    onRequestAdjustment(
                      buildAdjustmentNote(
                        { note, pins, disagreements },
                        {
                          pins: t("taskBoard.review.notePins"),
                          disagreements: t(
                            "taskBoard.review.noteDisagreements",
                          ),
                        },
                      ),
                    );
                    changeDraft(EMPTY_DRAFT);
                    setAdjusting(false);
                  }}
                >
                  {t("taskBoard.review.adjustmentSend")}
                </Button>
                <Button variant="ghost" onClick={() => setAdjusting(false)}>
                  {t("taskBoard.review.adjustmentCancel")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                variant={feedbackCount > 0 ? "outline" : "default"}
                onClick={() => {
                  onApprove(
                    checks.map((check, index) => ({
                      text: check.text,
                      done:
                        check.status === "passed" &&
                        disagreed[index] === undefined,
                    })),
                  );
                  changeDraft(EMPTY_DRAFT);
                }}
              >
                {approveLabel ?? t("taskBoard.review.approve")}
              </Button>
              <Button
                variant={feedbackCount > 0 ? "default" : "outline"}
                onClick={() => setAdjusting(true)}
              >
                {feedbackCount > 0
                  ? t("taskBoard.review.requestAdjustmentWith", {
                      n: String(feedbackCount),
                    })
                  : t("taskBoard.review.requestAdjustment")}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Block({
  title,
  aside,
  action,
  children,
}: {
  title: string;
  aside?: string;
  /** A control that belongs to the block, shown at the end of its header. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        <div className="flex items-center gap-1">
          {aside && (
            <span className="text-xs text-muted-foreground">{aside}</span>
          )}
          {action}
        </div>
      </div>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

/** What the evidence images need to take pins: the pins so far and how to
 *  change them. Absent when the view is read-only. */
type PinControls = {
  pins: ReviewPin[];
  add: (
    image: { url: string; label: string },
    position: { x: number; y: number },
  ) => void;
  edit: (id: number, text: string) => void;
  remove: (id: number) => void;
};

/** The checks to look at first: failed, then not verified, then passed. The
 *  index is the check's place in the agent's list. */
function attentionFirst(
  checks: ChecklistItem[],
): { item: ChecklistItem; index: number }[] {
  const rank = { failed: 0, unverified: 1, passed: 2 } as const;
  return checks
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank[a.item.status] - rank[b.item.status]);
}

/** One check the agent reported. Only a failure is loud: a pass is a quiet
 *  tick and an unreported check a neutral dot. The deco team can disagree with
 *  one, which opens a note; that is the exception, not a step. */
function AgentCheck({
  item,
  note,
  onDisagree,
}: {
  item: ChecklistItem;
  /** Undefined while the person agrees. */
  note?: string;
  onDisagree?: (note: string | undefined) => void;
}) {
  const t = useT();
  const statusLabel = {
    passed: t("taskBoard.review.checkPassed"),
    failed: t("taskBoard.review.checkFailed"),
    unverified: t("taskBoard.review.checkUnverified"),
  }[item.status];
  const disagreeLabel =
    note === undefined
      ? t("taskBoard.review.disagree")
      : t("taskBoard.review.disagreeUndo");
  return (
    <li
      data-status={item.status}
      className="flex flex-col gap-2 border-b border-border py-3 text-sm first:pt-1 last:border-b-0 last:pb-1"
    >
      <div className="flex items-start gap-2.5">
        <span title={statusLabel} className="mt-0.5 shrink-0">
          {item.status === "passed" && (
            <CheckCircle className="size-4 text-success" />
          )}
          {item.status === "failed" && (
            <AlertTriangle className="size-4 text-destructive" />
          )}
          {item.status === "unverified" && (
            <span className="block size-4 rounded-full border border-dashed border-muted-foreground/60" />
          )}
          <span className="sr-only">{statusLabel}</span>
        </span>
        <span
          className={cn(
            "min-w-0 flex-1",
            item.status === "failed" && "text-destructive",
          )}
        >
          {item.text}
          {item.status === "failed" && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {statusLabel}
            </span>
          )}
        </span>
        {onDisagree && (
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              "shrink-0 text-muted-foreground",
              note !== undefined && "text-destructive",
            )}
            aria-pressed={note !== undefined}
            aria-label={disagreeLabel}
            title={disagreeLabel}
            onClick={() => onDisagree(note === undefined ? "" : undefined)}
          >
            <Flag01 size={14} />
          </Button>
        )}
      </div>
      {note !== undefined && (
        <Textarea
          autoFocus
          rows={1}
          className="ml-[1.625rem] max-h-40 min-h-0 w-auto resize-none py-1.5"
          aria-label={t("taskBoard.review.disagreePlaceholder")}
          placeholder={t("taskBoard.review.disagreePlaceholder")}
          maxLength={MAX_FEEDBACK_LENGTH}
          value={note}
          onChange={(event) => onDisagree?.(event.target.value)}
        />
      )}
    </li>
  );
}

/** The evidence block. Its tables get one "copy as CSV" in the block's header,
 *  in place of the one the markdown shows above each table. */
function EvidenceBlock({
  id,
  evidence,
  preview,
  pinning,
}: {
  id: string;
  evidence?: string;
  preview?: ReactNode;
  pinning?: PinControls;
}) {
  const t = useT();
  const body = useRef<HTMLDivElement>(null);
  const { handleCopy, copied } = useCopy();
  const hasTable = /\|\s*:?-{3,}/.test(evidence ?? "");

  const copy = () => {
    const tables = Array.from(body.current?.querySelectorAll("table") ?? []);
    void handleCopy(tables.map((table) => tableToCsv(table)).join("\n\n"));
  };

  return (
    <Block
      title={t("taskBoard.review.evidence")}
      action={
        hasTable ? (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={copy}
          >
            {t("chat.markdown.copyAsCSV")}
            {copied ? <Check size={12} /> : <Copy01 size={12} />}
          </Button>
        ) : undefined
      }
    >
      <div ref={body}>
        <TableCopyContext.Provider value={false}>
          <Evidence id={id} evidence={evidence} pinning={pinning} />
        </TableCopyContext.Provider>
      </div>
      {preview && <div className="mt-3">{preview}</div>}
    </Block>
  );
}

/** The evidence prose, with its images laid out: a before/after pair side by
 *  side when the agent labelled them, any other image in a grid. */
function Evidence({
  id,
  evidence,
  pinning,
}: {
  id: string;
  evidence?: string;
  pinning?: PinControls;
}) {
  const t = useT();
  if (!evidence) return null;
  const { images, text } = splitEvidence(evidence);
  const before = images.find((image) => image.kind === "before");
  const after = images.find((image) => image.kind === "after");
  const pair = before && after ? [before, after] : [];
  const rest = images.filter((image) => !pair.includes(image));

  return (
    <div className="flex flex-col gap-3">
      {text && <MemoizedMarkdown id={`review-${id}-evidence`} text={text} />}
      {pinning && images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("taskBoard.review.pinHint")}
        </p>
      )}
      {pair.length > 0 && (
        <div
          data-testid="review-before-after"
          className="grid grid-cols-2 gap-3"
        >
          <EvidenceFigure
            image={pair[0]!}
            caption={t("taskBoard.review.evidenceBefore")}
            pinning={pinning}
          />
          <EvidenceFigure
            image={pair[1]!}
            caption={t("taskBoard.review.evidenceAfter")}
            pinning={pinning}
          />
        </div>
      )}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {rest.map((image) => (
            <EvidenceFigure
              key={image.url}
              image={image}
              caption={image.alt}
              pinning={pinning}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceFigure({
  image,
  caption,
  pinning,
}: {
  image: EvidenceImage;
  caption: string;
  pinning?: PinControls;
}) {
  const t = useT();
  const label = image.alt || caption;
  // Pins are numbered across the whole view, so the agent reads "pin 2" the
  // same way the person saw it.
  const own = (pinning?.pins ?? []).flatMap((pin, index) =>
    pin.imageUrl === image.url ? [{ pin, number: index + 1 }] : [],
  );

  const place = (box: DOMRect, click: { x: number; y: number }) =>
    pinning?.add({ url: image.url, label }, pinPosition(click, box));

  const img = (
    <img
      src={image.url}
      alt={image.alt || caption}
      loading="lazy"
      className="w-full rounded-lg border border-border bg-muted object-cover"
    />
  );

  return (
    <figure className="flex flex-col gap-1.5">
      {pinning ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={t("taskBoard.review.pinImage", { name: label })}
          className="relative cursor-crosshair rounded-lg focus-ring"
          onClick={(event) =>
            place(event.currentTarget.getBoundingClientRect(), {
              x: event.clientX,
              y: event.clientY,
            })
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            place(box, {
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
            });
          }}
        >
          {img}
          {own.map(({ pin, number }) => (
            <span
              key={pin.id}
              data-testid="review-pin"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground shadow-edge"
            >
              {number}
            </span>
          ))}
        </div>
      ) : (
        <a href={image.url} target="_blank" rel="noreferrer">
          {img}
        </a>
      )}
      <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{caption}</span>
        {pinning && (
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {t("taskBoard.review.openImage")}
            <LinkExternal01 aria-hidden="true" className="size-3" />
          </a>
        )}
      </figcaption>
      {pinning &&
        own.map(({ pin, number }) => (
          <div key={pin.id} className="flex items-start gap-2">
            <span className="mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {number}
            </span>
            <Textarea
              rows={1}
              className="max-h-40 min-h-0 resize-none py-1.5"
              aria-label={t("taskBoard.review.pinLabel", {
                n: String(number),
              })}
              placeholder={t("taskBoard.review.pinPlaceholder")}
              maxLength={MAX_FEEDBACK_LENGTH}
              value={pin.text}
              onChange={(event) => pinning.edit(pin.id, event.target.value)}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("taskBoard.review.pinRemove", {
                n: String(number),
              })}
              onClick={() => pinning.remove(pin.id)}
            >
              <XClose size={14} />
            </Button>
          </div>
        ))}
    </figure>
  );
}
