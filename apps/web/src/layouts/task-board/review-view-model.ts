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

  for (const comment of fromAgent) {
    const sections = parseReviewSections(comment.body);
    if (sections) return { body: comment.body, sections };
  }
  const latest = fromAgent[0];
  return latest ? { body: latest.body, sections: null } : null;
}

export type EvidenceImage = {
  alt: string;
  url: string;
  kind: "before" | "after" | "other";
};

const IMAGE_MARKDOWN = /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const SAFE_IMAGE_URL = /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);)/i;

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
  const text = evidence
    .replace(IMAGE_MARKDOWN, (_match, alt: string, url: string) => {
      if (SAFE_IMAGE_URL.test(url)) {
        images.push({ alt, url, kind: imageKind(alt) });
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { images, text };
}
