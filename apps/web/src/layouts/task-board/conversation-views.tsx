/**
 * Chooses between the Review view and the full conversation of a task card.
 *
 * Review is the default in the review lanes (In Review, QA, Customer Approval)
 * when the agent has left a comment for people; the full conversation is the
 * default everywhere else. A choice the person makes is remembered for every
 * card. The full conversation is passed in as `children`, untouched.
 */

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@decocms/ui/components/button.tsx";
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
import { pickReviewComment } from "./review-view-model";

type ViewChoice = "auto" | "review" | "full";

const REVIEW_LANES: string[] = [LANES.review, LANES.qa, LANES.customer];

/** Where an approval sends the card. Only the two people's lanes decide. */
const NEXT_LANE: Partial<Record<string, CanonicalColumnKey>> = {
  [LANES.qa]: LANES.customer,
  [LANES.customer]: LANES.release,
};

/** A request for adjustment sends the card back to To Do. The agent is not
 *  dispatched by a lane move, so someone re-runs it by hand. */
const ADJUSTMENT_LANE: CanonicalColumnKey = "todo";

export function ConversationViews({
  item,
  status,
  onMove,
  children,
}: {
  item: TaskBoardItem;
  /** The lane the card is in as the dialog shows it, so what this view says
   *  and what the header says never disagree. */
  status: TaskBoardItem["status"];
  /** Moves the card through the dialog, which keeps its own copy of the lane
   *  and saves it. */
  onMove: (lane: CanonicalColumnKey) => void;
  children: ReactNode;
}) {
  const t = useT();
  const [choice, setChoice] = useLocalStorage<ViewChoice>(
    LOCALSTORAGE_KEYS.taskConversationView(),
    "auto",
  );
  const comments = useTaskBoardComments(item.id);
  const { data: prs } = useTaskBoardItemPrs(item.id);

  const picked = pickReviewComment(
    comments.threads.flatMap((thread) => [thread, ...thread.replies]),
    SUPER_AGENT_ASSIGNEE_ID,
  );
  // Without an agent comment there is nothing to review: the full
  // conversation is the only view, so no switch is offered.
  if (!picked) return <>{children}</>;

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

  const approve = () => {
    if (!nextLane) return;
    onMove(nextLane);
    toast.success(t("taskBoard.review.movedTo", { lane: lane(nextLane) }));
  };
  const requestAdjustment = async (note: string) => {
    try {
      await comments.post.mutateAsync({ body: note });
    } catch {
      failed();
      return;
    }
    onMove(ADJUSTMENT_LANE);
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
    <div className="flex flex-col gap-5">
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

      {view === "review" ? (
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
      ) : (
        children
      )}
    </div>
  );
}
