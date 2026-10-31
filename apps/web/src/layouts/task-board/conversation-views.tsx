/**
 * Chooses between the Review view and the full conversation of a task card.
 *
 * Review is the default in the review lanes (In Review, QA, Customer Approval)
 * when the agent has left a comment for people; the full conversation is the
 * default everywhere else. A choice the person makes is remembered for every
 * card.
 *
 * The switch sits at the top of the card body. Review takes the place of the
 * description and the activity feed, which stay one click away: `children` is
 * the card's own body (description, subtasks) and `activity` its record.
 */

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@decocms/ui/components/button.tsx";
import { cn } from "@decocms/ui/lib/utils.ts";
import { ChevronDown, ReverseLeft } from "@untitledui/icons";
import {
  LANES,
  SUPER_AGENT_ASSIGNEE_ID,
  type CanonicalColumnKey,
} from "@decocms/shared/task-board";
import { MemoizedMarkdown } from "@/components/chat/markdown";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTaskBoardComments } from "@/hooks/use-task-board-comments";
import { useTaskBoardItemPrs } from "@/hooks/use-task-board-item-prs";
import { LOCALSTORAGE_KEYS } from "@/lib/localstorage-keys";
import { useT } from "@/i18n/use-t.ts";
import { laneHeader, type TaskBoardItem } from "./config";
import { PreviewButton } from "./preview-button";
import { ReviewView } from "./review-view";
import {
  adjustmentState,
  decoVerification,
  formatAdjustment,
  formatVerification,
  pickReviewComment,
  type CheckedItem,
} from "./review-view-model";

type ViewChoice = "auto" | "review" | "full";

const REVIEW_LANES: string[] = [LANES.review, LANES.qa, LANES.customer];

/** Where an approval sends the card. Only the two people's lanes decide. */
const NEXT_LANE: Partial<Record<string, CanonicalColumnKey>> = {
  [LANES.qa]: LANES.customer,
  [LANES.customer]: LANES.release,
};

/** A request for adjustment sends the card back to In Review with no owner.
 *  The board already marks that as handed to a person, and a lane move does
 *  not dispatch the agent, so a person re-runs it. */
const ADJUSTMENT_LANE: CanonicalColumnKey = LANES.review;

type CardMove = {
  status: CanonicalColumnKey;
  /** Clears the owner when null. */
  assigneeId?: null;
};

export function ConversationViews({
  item,
  status,
  onMove,
  activity,
  children,
}: {
  /** Absent while a new card is being written. */
  item?: TaskBoardItem;
  /** The lane the card is in as the dialog shows it, so what this view says
   *  and what the header says never disagree. */
  status: TaskBoardItem["status"];
  /** Moves the card through the dialog, which keeps its own copy of the lane
   *  and saves it. */
  onMove: (next: CardMove) => void;
  /** The card's record (links, activity), shown in the full view. */
  activity: ReactNode;
  /** The card's own body: description and subtasks. */
  children: ReactNode;
}) {
  const t = useT();
  const [choice, setChoice] = useLocalStorage<ViewChoice>(
    LOCALSTORAGE_KEYS.taskConversationView(),
    "auto",
  );
  const [showBody, setShowBody] = useState(false);
  const comments = useTaskBoardComments(item?.id);
  const { data: prs } = useTaskBoardItemPrs(item?.id);

  const all = comments.threads.flatMap((thread) => [thread, ...thread.replies]);
  const picked = pickReviewComment(all, SUPER_AGENT_ASSIGNEE_ID);
  const { round, returned } = adjustmentState(all, SUPER_AGENT_ASSIGNEE_ID);
  const verification = decoVerification(all, SUPER_AGENT_ASSIGNEE_ID);
  // Without an agent comment there is nothing to review: the full
  // conversation is the only view, so no switch is offered.
  if (!item || !picked) {
    return (
      <div className="flex flex-col">
        {children}
        {activity}
      </div>
    );
  }

  const view =
    choice === "auto"
      ? REVIEW_LANES.includes(status)
        ? "review"
        : "full"
      : choice;

  const previewUrl = prs?.find((pr) => pr.previewUrl)?.previewUrl;
  const nextLane = NEXT_LANE[status];
  const lane = (key: string) => laneHeader(key, t).label;
  const failed = () => toast.error(t("taskBoard.review.actionFailed"));

  const approve = async (checks: CheckedItem[]) => {
    if (!nextLane) return;
    // The deco team's approval leaves a record the client can read.
    if (status === LANES.qa && checks.length > 0) {
      try {
        await comments.post.mutateAsync({
          body: formatVerification(
            checks,
            t("taskBoard.review.verificationTitle"),
          ),
        });
      } catch {
        failed();
        return;
      }
    }
    onMove({ status: nextLane });
    toast.success(t("taskBoard.review.movedTo", { lane: lane(nextLane) }));
  };
  const requestAdjustment = async (note: string) => {
    const body = formatAdjustment(
      {
        origin: status === LANES.qa ? "qa" : "customer",
        round: round + 1,
        note,
      },
      {
        title: t("taskBoard.review.adjustmentTitle"),
        qa: t("taskBoard.review.originQa"),
        customer: t("taskBoard.review.originCustomer"),
        round: t("taskBoard.review.adjustmentRound"),
      },
    );
    try {
      await comments.post.mutateAsync({ body });
    } catch {
      failed();
      return;
    }
    onMove({ status: ADJUSTMENT_LANE, assigneeId: null });
    toast.success(
      t("taskBoard.review.adjustmentSent", { lane: lane(ADJUSTMENT_LANE) }),
    );
  };

  const stageHint =
    status === LANES.qa
      ? t("taskBoard.review.stageHintQa")
      : status === LANES.customer
        ? t("taskBoard.review.stageHintCustomer")
        : status === LANES.review
          ? t("taskBoard.review.stageHintReview")
          : undefined;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
        <div
          role="group"
          aria-label={t("taskBoard.review.viewLabel")}
          className="flex w-fit gap-1"
        >
          <Button
            size="sm"
            variant="tab"
            aria-pressed={view === "review"}
            onClick={() => setChoice("review")}
          >
            {t("taskBoard.review.viewReview")}
          </Button>
          <Button
            size="sm"
            variant="tab"
            aria-pressed={view === "full"}
            onClick={() => setChoice("full")}
          >
            {t("taskBoard.review.viewFull")}
          </Button>
        </div>
        {returned && (
          <span
            data-testid="review-returned"
            className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
          >
            <ReverseLeft className="size-3.5" />
            {t("taskBoard.review.returnedFrom", {
              origin:
                returned.origin === "qa"
                  ? t("taskBoard.review.originQa")
                  : t("taskBoard.review.originCustomer"),
              n: String(returned.round),
            })}
          </span>
        )}
      </div>

      {view === "review" ? (
        <div className="flex flex-col gap-4 py-4">
          {returned && (
            <div
              data-testid="review-returned-note"
              className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4"
            >
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("taskBoard.review.returnedNote")}
              </h3>
              <p className="text-sm whitespace-pre-wrap">{returned.note}</p>
              <p className="text-xs text-muted-foreground">
                {t("taskBoard.review.returnedPrevious")}
              </p>
            </div>
          )}
          {picked.hasNewer && (
            <p
              data-testid="review-stale"
              className="text-xs text-muted-foreground"
            >
              {t("taskBoard.review.staleNotice")}
            </p>
          )}
          <ReviewView
            id={item.id}
            sections={picked.sections}
            fallback={
              <MemoizedMarkdown
                id={`review-${item.id}-fallback`}
                text={picked.body}
              />
            }
            audience={status === LANES.customer ? "customer" : "deco"}
            verifiedByDeco={status === LANES.customer}
            round={round}
            verification={verification ?? undefined}
            stage={t("taskBoard.review.stage", { lane: lane(status) })}
            stageHint={stageHint}
            approveLabel={
              status === LANES.qa
                ? t("taskBoard.review.approveQa")
                : t("taskBoard.review.approveCustomer")
            }
            onApprove={nextLane ? approve : undefined}
            onRequestAdjustment={nextLane ? requestAdjustment : undefined}
            preview={
              previewUrl ? (
                <PreviewButton
                  url={previewUrl}
                  routes={item.previewRoutes ?? []}
                />
              ) : undefined
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-fit text-muted-foreground"
            aria-expanded={showBody}
            onClick={() => setShowBody((open) => !open)}
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform", showBody && "rotate-180")}
            />
            {t("taskBoard.review.cardDetails")}
          </Button>
          {showBody && children}
        </div>
      ) : (
        <>
          {children}
          {activity}
        </>
      )}
    </div>
  );
}
