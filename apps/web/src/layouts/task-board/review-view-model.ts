/**
 * View model for the structured "Review" view of a task card.
 *
 * The agent's human-facing comment is the single source. It follows a fixed
 * set of section headings (see `SECTION_ALIASES`); `parseReviewSections` turns
 * it into this shape and returns `null` when the comment does not follow the
 * contract, so the caller can fall back to the raw comment.
 */

export type ReviewSectionKey =
  | "request"
  | "changed"
  | "impact"
  | "howToCheck"
  | "evidence"
  | "limitations";

export type ReviewSections = {
  request?: string;
  changed: string;
  impact?: string;
  /** One item per bullet of the "how to check" section. */
  howToCheck: string[];
  evidence?: string;
  limitations?: string;
};

/** Accepted heading names per section, lowercased and without accents. */
const SECTION_ALIASES: Record<ReviewSectionKey, string[]> = {
  request: ["pedido", "request"],
  changed: ["o que mudou", "what changed"],
  impact: ["impacto", "impact"],
  howToCheck: ["como conferir", "how to check"],
  evidence: ["evidencias", "evidence"],
  limitations: ["limitacoes", "limitations"],
};

function normalizeHeading(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[:*_`]/g, "")
    .trim()
    .toLowerCase();
}

function sectionKeyFor(heading: string): ReviewSectionKey | null {
  const name = normalizeHeading(heading);
  for (const key of Object.keys(SECTION_ALIASES) as ReviewSectionKey[]) {
    if (SECTION_ALIASES[key].includes(name)) return key;
  }
  return null;
}

function bulletsOf(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const match = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line);
    if (match?.[1]) items.push(match[1].trim());
  }
  return items;
}

/**
 * Splits a comment into its contract sections. Returns `null` unless the two
 * sections a reviewer cannot do without are present: what changed, and how to
 * check it.
 */
export function parseReviewSections(markdown: string): ReviewSections | null {
  const buckets = new Map<ReviewSectionKey, string[]>();
  let current: ReviewSectionKey | null = null;

  for (const line of markdown.split("\n")) {
    const heading = /^#{1,4}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading?.[1] !== undefined) {
      current = sectionKeyFor(heading[1]);
      if (current && !buckets.has(current)) buckets.set(current, []);
      continue;
    }
    if (current) buckets.get(current)?.push(line);
  }

  const text = (key: ReviewSectionKey): string | undefined => {
    const value = buckets.get(key)?.join("\n").trim();
    return value ? value : undefined;
  };

  const changed = text("changed");
  const howToCheck = bulletsOf(text("howToCheck") ?? "");
  if (!changed || howToCheck.length === 0) return null;

  return {
    request: text("request"),
    changed,
    impact: text("impact"),
    howToCheck,
    evidence: text("evidence"),
    limitations: text("limitations"),
  };
}

export type ReviewAudience = "deco" | "customer";

/** The slice of a comment the picker reads. */
export type ReviewCommentSource = {
  authorId: string;
  audience: string;
  body: string;
  createdAt: string;
};

export type PickedReviewComment = {
  body: string;
  sections: ReviewSections | null;
  /** The agent commented after the picked delivery without following the
   *  format, so the full conversation holds something newer. */
  hasNewer: boolean;
};

/**
 * The agent comment the Review view is built from: the latest human-facing
 * comment by the agent that follows the contract. When none does, the latest
 * human-facing agent comment as written (so the view can show it raw), or
 * `null` when the agent has not commented for people at all.
 */
export function pickReviewComment(
  comments: ReviewCommentSource[],
  agentId: string,
): PickedReviewComment | null {
  const fromAgent = comments
    .filter((c) => c.authorId === agentId && c.audience === "human")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  for (const [index, comment] of fromAgent.entries()) {
    const sections = parseReviewSections(comment.body);
    if (sections) return { body: comment.body, sections, hasNewer: index > 0 };
  }
  const latest = fromAgent[0];
  return latest ? { body: latest.body, sections: null, hasNewer: false } : null;
}

export type EvidenceImage = {
  alt: string;
  url: string;
  kind: "before" | "after" | "other";
};

const IMAGE_MARKDOWN = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const SAFE_IMAGE_URL =
  /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);)/i;

function imageKind(alt: string): EvidenceImage["kind"] {
  const name = normalizeHeading(alt);
  if (/\b(antes|before)\b/.test(name)) return "before";
  if (/\b(depois|after)\b/.test(name)) return "after";
  return "other";
}

/**
 * Separates the images of an evidence section from its prose. Images whose
 * alt text says before/after (or antes/depois) are labelled so the view can
 * set them side by side. Only http(s) and inline image URLs are kept.
 */
export function splitEvidence(evidence: string): {
  images: EvidenceImage[];
  text: string;
} {
  const images: EvidenceImage[] = [];
  const text = dropEmptyTables(
    evidence.replace(IMAGE_MARKDOWN, (_match, alt: string, url: string) => {
      if (SAFE_IMAGE_URL.test(url)) {
        images.push({ alt, url, kind: imageKind(alt) });
      }
      return "";
    }),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { images, text };
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const EMPTY_CELLS = /^[\s|:-]*$/;

/** A table that only held images is left with a header over empty cells once
 *  the images are lifted out, so its block is dropped. */
function dropEmptyTables(markdown: string): string {
  const lines = markdown.split("\n");
  const kept: string[] = [];
  let block: string[] = [];
  const flush = () => {
    // Header and separator stay only if some body row still has content.
    const body = block.slice(2);
    const hollow = block.length > 0 && body.every((l) => EMPTY_CELLS.test(l));
    if (!hollow) kept.push(...block);
    block = [];
  };
  for (const line of lines) {
    if (TABLE_ROW.test(line)) {
      block.push(line);
    } else {
      flush();
      kept.push(line);
    }
  }
  flush();
  return kept.join("\n");
}

type AdjustmentOrigin = "qa" | "customer";

type AdjustmentRequest = {
  origin: AdjustmentOrigin;
  /** The round the requested work belongs to: 2 for the first adjustment. */
  round: number;
  note: string;
  createdAt: string;
};

type AdjustmentLabels = {
  title: string;
  qa: string;
  customer: string;
  round: string;
};

const MARKER =
  /^\*\*(?:Ajuste pedido|Adjustment requested)\*\*\s*·\s*(QA|Cliente|Customer)\s*·\s*(?:rodada|round)\s+(\d+)\s*\n+([\s\S]*)$/i;

/**
 * The comment a request for adjustment is stored as. A fixed first line says
 * who asked and for which round; the rest is the person's note. The line is
 * what `adjustmentState` reads back, in either language.
 */
export function formatAdjustment(
  request: Pick<AdjustmentRequest, "origin" | "round" | "note">,
  labels: AdjustmentLabels,
): string {
  const origin = request.origin === "qa" ? labels.qa : labels.customer;
  return `**${labels.title}** · ${origin} · ${labels.round} ${request.round}\n\n${request.note}`;
}

function parseAdjustment(
  comment: ReviewCommentSource,
): AdjustmentRequest | null {
  const match = MARKER.exec(comment.body.trim());
  if (!match) return null;
  return {
    origin: match[1]!.toLowerCase() === "qa" ? "qa" : "customer",
    round: Number(match[2]),
    note: match[3]!.trim(),
    createdAt: comment.createdAt,
  };
}

type AdjustmentState = {
  /** The round the card is in: 1 until someone asks for an adjustment. */
  round: number;
  /** The latest request while the agent has not delivered since; else null. */
  returned: AdjustmentRequest | null;
};

/**
 * Where a card stands in its back-and-forth, read from its comments. A request
 * is "returned" until the agent leaves a comment for people after it.
 */
export function adjustmentState(
  comments: ReviewCommentSource[],
  agentId: string,
): AdjustmentState {
  const requests = comments
    .filter((c) => c.audience === "human" && c.authorId !== agentId)
    .flatMap((c) => parseAdjustment(c) ?? [])
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const latest = requests.at(-1);
  if (!latest) return { round: 1, returned: null };

  const delivered = comments.some(
    (c) =>
      c.authorId === agentId &&
      c.audience === "human" &&
      Date.parse(c.createdAt) > Date.parse(latest.createdAt),
  );
  return {
    round: Math.max(...requests.map((r) => r.round)),
    returned: delivered ? null : latest,
  };
}

export type CheckedItem = { text: string; done: boolean };

const VERIFIED_MARKER =
  /^\*\*(?:Conferido pela deco|Checked by deco)\*\*\s*\n+([\s\S]*)$/i;

/**
 * The comment that records what the deco team checked when it approved in QA,
 * so the client can see it. One task-list line per item of the checklist.
 */
export function formatVerification(
  items: CheckedItem[],
  title: string,
): string {
  const lines = items.map((i) => `- [${i.done ? "x" : " "}] ${i.text}`);
  return `**${title}**\n\n${lines.join("\n")}`;
}

function parseVerification(body: string): CheckedItem[] | null {
  const match = VERIFIED_MARKER.exec(body.trim());
  if (!match) return null;
  const items: CheckedItem[] = [];
  for (const line of match[1]!.split("\n")) {
    const item = /^\s*-\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (item) items.push({ done: item[1] !== " ", text: item[2]!.trim() });
  }
  return items.length > 0 ? items : null;
}

/**
 * What the deco team checked for the current delivery: the latest record by a
 * person, and only if it is newer than the agent's latest comment for people.
 * A new delivery starts the check over.
 */
export function decoVerification(
  comments: ReviewCommentSource[],
  agentId: string,
): CheckedItem[] | null {
  const delivered = comments
    .filter((c) => c.authorId === agentId && c.audience === "human")
    .map((c) => Date.parse(c.createdAt));
  const since = delivered.length > 0 ? Math.max(...delivered) : 0;
  const records = comments
    .filter(
      (c) =>
        c.authorId !== agentId &&
        c.audience === "human" &&
        Date.parse(c.createdAt) > since,
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const record of records) {
    const items = parseVerification(record.body);
    if (items) return items;
  }
  return null;
}
