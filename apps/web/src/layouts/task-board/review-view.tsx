/**
 * The structured "Review" view of a task card.
 *
 * Presentation only: the dialog maps the agent's comment, the card's review
 * state and its actions into these props. When the comment does not follow the
 * review format the caller passes `sections={null}` and the raw comment as
 * `fallback`, so the view never hides what the agent actually wrote.
 *
 * One screen serves both people's lanes. In QA the deco team ticks an itemized
 * checklist; in Customer Approval the client sees the result, a "checked by
 * deco" mark and one question, with the checklist tucked away.
 */

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@decocms/ui/components/button.tsx";
import { Checkbox } from "@decocms/ui/components/checkbox.tsx";
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
} from "@untitledui/icons";
import {
  MemoizedMarkdown,
  TableCopyContext,
  tableToCsv,
} from "@/components/chat/markdown";
import { useT } from "@/i18n/use-t.ts";
import {
  splitEvidence,
  type CheckedItem,
  type EvidenceImage,
  type ReviewAudience,
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
  /** Where the card is and what a decision here does, in the person's words. */
  stage?: string;
  stageHint?: string;
  /** What the deco team checked for this delivery, shown to the client in
   *  place of the plain checklist. */
  verification?: CheckedItem[];
  /** Spells out what Approve does in this stage. */
  approveLabel?: string;
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
  stage,
  stageHint,
  verification,
  approveLabel,
  onApprove,
  onRequestAdjustment,
}: ReviewViewProps) {
  const t = useT();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [showChecklist, setShowChecklist] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState("");

  const total = sections?.howToCheck.length ?? 0;
  const done = Object.values(checked).filter(Boolean).length;
  const decoDone = verification?.filter((item) => item.done).length ?? 0;
  const showVerification = audience === "customer" && verification;

  return (
    <section
      data-testid="review-view"
      aria-label={t("taskBoard.review.viewReview")}
      className="flex flex-col gap-5"
    >
      {stage && (
        <div data-testid="review-stage" className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{stage}</p>
          {stageHint && (
            <p className="text-xs text-muted-foreground">{stageHint}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {verifiedByDeco && (
          <span
            data-testid="review-verified"
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
            />
          )}

          <Block
            title={
              showVerification
                ? t("taskBoard.review.decoChecklist")
                : t("taskBoard.review.howToCheck")
            }
            aside={
              showVerification
                ? t("taskBoard.review.checked", {
                    done: String(decoDone),
                    total: String(verification.length),
                  })
                : audience === "deco"
                  ? t("taskBoard.review.checked", {
                      done: String(done),
                      total: String(total),
                    })
                  : t("taskBoard.review.checklistCount", {
                      count: String(total),
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
            {showChecklist && !showVerification && (
              <ul className="flex flex-col gap-2">
                {sections.howToCheck.map((item, index) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    {audience === "deco" ? (
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <Checkbox
                          className="mt-0.5"
                          checked={checked[index] === true}
                          onCheckedChange={(value) =>
                            setChecked((prev) => ({
                              ...prev,
                              [index]: value === true,
                            }))
                          }
                        />
                        <span>{item}</span>
                      </label>
                    ) : (
                      <span className="text-muted-foreground">• {item}</span>
                    )}
                  </li>
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
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("taskBoard.review.adjustmentHint")}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={note.trim().length === 0}
                  onClick={() => {
                    onRequestAdjustment(note.trim());
                    setNote("");
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
                onClick={() =>
                  onApprove(
                    (sections?.howToCheck ?? []).map((text, index) => ({
                      text,
                      done: checked[index] === true,
                    })),
                  )
                }
              >
                {approveLabel ?? t("taskBoard.review.approve")}
              </Button>
              <Button variant="outline" onClick={() => setAdjusting(true)}>
                {t("taskBoard.review.requestAdjustment")}
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

/** The evidence block. Its tables get one "copy as CSV" in the block's header,
 *  in place of the one the markdown shows above each table. */
function EvidenceBlock({
  id,
  evidence,
  preview,
}: {
  id: string;
  evidence?: string;
  preview?: ReactNode;
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
          <Evidence id={id} evidence={evidence} />
        </TableCopyContext.Provider>
      </div>
      {preview && <div className="mt-3">{preview}</div>}
    </Block>
  );
}

/** The evidence prose, with its images laid out: a before/after pair side by
 *  side when the agent labelled them, any other image in a grid. */
function Evidence({ id, evidence }: { id: string; evidence?: string }) {
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
      {pair.length > 0 && (
        <div
          data-testid="review-before-after"
          className="grid grid-cols-2 gap-3"
        >
          <EvidenceFigure
            image={pair[0]!}
            caption={t("taskBoard.review.evidenceBefore")}
          />
          <EvidenceFigure
            image={pair[1]!}
            caption={t("taskBoard.review.evidenceAfter")}
          />
        </div>
      )}
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {rest.map((image) => (
            <EvidenceFigure key={image.url} image={image} caption={image.alt} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceFigure({
  image,
  caption,
}: {
  image: EvidenceImage;
  caption: string;
}) {
  return (
    <figure className="flex flex-col gap-1.5">
      <a href={image.url} target="_blank" rel="noreferrer">
        <img
          src={image.url}
          alt={image.alt || caption}
          loading="lazy"
          className="w-full rounded-lg border border-border bg-muted object-cover"
        />
      </a>
      {caption && (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
