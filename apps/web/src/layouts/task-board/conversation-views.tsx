/**
 * Chooses between the Review view and the full conversation of a task card.
 *
 * Review is the default in the review lanes (In Review, QA, Customer Approval)
 * when the agent has left a comment for people; the full conversation is the
 * default everywhere else. A choice the person makes is remembered for every
 * card. The full conversation is passed in as `children`, untouched.
 */

import type { ReactNode } from "react";
import { Button } from "@decocms/ui/components/button.tsx";
import { SUPER_AGENT_ASSIGNEE_ID, LANES } from "@decocms/shared/task-board";
import { MemoizedMarkdown } from "@/components/chat/markdown";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useTaskBoardComments } from "@/hooks/use-task-board-comments";
import { useTaskBoardItemPrs } from "@/hooks/use-task-board-item-prs";
import { LOCALSTORAGE_KEYS } from "@/lib/localstorage-keys";
import { useT } from "@/i18n/use-t.ts";
import type { TaskBoardItem } from "./config";
import { PreviewButton } from "./preview-button";
import { ReviewView } from "./review-view";
import { pickReviewComment } from "./review-view-model";

type ViewChoice = "auto" | "review" | "full";

const REVIEW_LANES: string[] = [LANES.review, LANES.qa, LANES.customer];

export function ConversationViews({
  item,
  children,
}: {
  item: TaskBoardItem;
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
      ? REVIEW_LANES.includes(item.status)
        ? "review"
        : "full"
      : choice;

  const previewUrl = prs?.find((pr) => pr.previewUrl)?.previewUrl;

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
          audience={item.status === LANES.customer ? "customer" : "deco"}
          verifiedByDeco={item.status === LANES.customer}
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
