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

import { useState, type ReactNode } from "react";
import { Button } from "@decocms/ui/components/button.tsx";
import { Checkbox } from "@decocms/ui/components/checkbox.tsx";
import { Textarea } from "@decocms/ui/components/textarea.tsx";
import { cn } from "@decocms/ui/lib/utils.ts";
import { CheckCircle } from "@untitledui/icons";
import { MemoizedMarkdown } from "@/components/chat/markdown";
import { useT } from "@/i18n/use-t.ts";
import type { ReviewAudience, ReviewSections } from "./review-view-model";

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
  onApprove: () => void;
  onRequestAdjustment: (note: string) => void;
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
  onApprove,
  onRequestAdjustment,
}: ReviewViewProps) {
  const t = useT();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [showChecklist, setShowChecklist] = useState(audience === "deco");
  const [adjusting, setAdjusting] = useState(false);
  const [note, setNote] = useState("");

  const total = sections?.howToCheck.length ?? 0;
  const done = Object.values(checked).filter(Boolean).length;

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
            <Block title={t("taskBoard.review.evidence")}>
              {sections.evidence && (
                <MemoizedMarkdown
                  id={`review-${id}-evidence`}
                  text={sections.evidence}
                />
              )}
              {preview && <div className="mt-3">{preview}</div>}
            </Block>
          )}

          {audience === "customer" && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              aria-expanded={showChecklist}
              onClick={() => setShowChecklist((open) => !open)}
            >
              {showChecklist
                ? t("taskBoard.review.hideChecklist")
                : t("taskBoard.review.showChecklist")}
            </Button>
          )}

          {showChecklist && (
            <Block
              title={t("taskBoard.review.howToCheck")}
              aside={
                audience === "deco"
                  ? t("taskBoard.review.checked", {
                      done: String(done),
                      total: String(total),
                    })
                  : undefined
              }
            >
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
            </Block>
          )}

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
          <p className="text-xs text-muted-foreground">
            {t("taskBoard.review.fallbackNotice")}
          </p>
          {fallback}
          {preview}
        </div>
      )}

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
            <Button onClick={onApprove}>{t("taskBoard.review.approve")}</Button>
            <Button variant="outline" onClick={() => setAdjusting(true)}>
              {t("taskBoard.review.requestAdjustment")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Block({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
