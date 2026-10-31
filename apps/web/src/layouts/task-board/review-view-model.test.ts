import { describe, expect, it } from "bun:test";
import {
  adjustmentState,
  decoVerification,
  formatAdjustment,
  formatVerification,
  parseReviewSections,
  pickReviewComment,
  splitEvidence,
} from "./review-view-model";

const FULL = `## Pedido
Trocar o banner da home.

## O que mudou
O banner agora mostra a campanha de outubro.

## Impacto
Só a home. Nenhuma outra página muda.

## Como conferir
- Abrir a home e ver o novo banner
- [ ] Conferir que o botão leva para a coleção
1. Ver no celular

## Evidências
Antes e depois anexados.

## Limitações
Não testado no Safari.
`;

describe("parseReviewSections", () => {
  it("reads every contract section", () => {
    const parsed = parseReviewSections(FULL);
    expect(parsed?.request).toBe("Trocar o banner da home.");
    expect(parsed?.changed).toBe(
      "O banner agora mostra a campanha de outubro.",
    );
    expect(parsed?.impact).toContain("Só a home");
    expect(parsed?.howToCheck).toEqual([
      "Abrir a home e ver o novo banner",
      "Conferir que o botão leva para a coleção",
      "Ver no celular",
    ]);
    expect(parsed?.limitations).toBe("Não testado no Safari.");
  });

  it("accepts English headings and bold or colon decorations", () => {
    const parsed = parseReviewSections(
      "### **What changed:**\nNew banner.\n\n## How to check\n- Open home",
    );
    expect(parsed?.changed).toBe("New banner.");
    expect(parsed?.howToCheck).toEqual(["Open home"]);
  });

  it("accepts headings without accents", () => {
    const parsed = parseReviewSections(
      "## Evidencias\nprint\n## O que mudou\nX\n## Como conferir\n- Y",
    );
    expect(parsed?.evidence).toBe("print");
  });

  it("returns null when 'what changed' is missing", () => {
    expect(parseReviewSections("## Como conferir\n- Y")).toBeNull();
  });

  it("returns null when 'how to check' has no bullets", () => {
    expect(
      parseReviewSections("## O que mudou\nX\n## Como conferir\nsem lista"),
    ).toBeNull();
  });

  it("returns null for a free-form comment", () => {
    expect(parseReviewSections("Pronto, abri o PR.")).toBeNull();
    expect(parseReviewSections("")).toBeNull();
  });

  it("ignores unknown headings without leaking their text", () => {
    const parsed = parseReviewSections(
      "## O que mudou\nX\n## Notas\nsegredo\n## Como conferir\n- Y",
    );
    expect(parsed?.changed).toBe("X");
  });
});

describe("pickReviewComment", () => {
  const AGENT = "super-agent";
  const contract = "## O que mudou\nX\n## Como conferir\n- Y";
  const make = (
    body: string,
    createdAt: string,
    authorId = AGENT,
    audience = "human",
  ) => ({ authorId, audience, body, createdAt });

  it("prefers the latest comment that follows the contract", () => {
    const picked = pickReviewComment(
      [
        make(contract, "2026-10-01T10:00:00Z"),
        make("Pronto, abri o PR.", "2026-10-01T11:00:00Z"),
      ],
      AGENT,
    );
    expect(picked?.sections?.changed).toBe("X");
  });

  it("falls back to the latest agent comment as written", () => {
    const picked = pickReviewComment(
      [
        make("primeiro", "2026-10-01T10:00:00Z"),
        make("segundo", "2026-10-01T11:00:00Z"),
      ],
      AGENT,
    );
    expect(picked).toEqual({
      body: "segundo",
      sections: null,
      hasNewer: false,
    });
  });

  it("ignores people, internal comments and other authors", () => {
    expect(
      pickReviewComment(
        [
          make(contract, "2026-10-01T10:00:00Z", "someone"),
          make(contract, "2026-10-01T11:00:00Z", AGENT, "internal"),
        ],
        AGENT,
      ),
    ).toBeNull();
    expect(pickReviewComment([], AGENT)).toBeNull();
  });
});

describe("splitEvidence", () => {
  it("labels before and after images and keeps the prose", () => {
    const { images, text } = splitEvidence(
      "Veja a diferença.\n\n![Antes](https://x.test/a.png)\n![Depois](https://x.test/b.png)",
    );
    expect(images.map((i) => i.kind)).toEqual(["before", "after"]);
    expect(text).toBe("Veja a diferença.");
  });

  it("understands English labels and other images", () => {
    const { images } = splitEvidence(
      "![Before](https://x.test/a.png) ![mobile](https://x.test/m.png)",
    );
    expect(images.map((i) => i.kind)).toEqual(["before", "other"]);
  });

  it("drops images with unsafe URLs", () => {
    const { images, text } = splitEvidence(
      "![Antes](javascript:void) ![x](file:///etc/passwd)",
    );
    expect(images).toEqual([]);
    expect(text).toBe("");
  });

  it("drops a table that only held the images", () => {
    const { images, text } = splitEvidence(
      "Veja.\n\n| Antes | Depois |\n|---|---|\n| ![Antes](https://x.test/a.png) | ![Depois](https://x.test/b.png) |",
    );
    expect(images.map((i) => i.kind)).toEqual(["before", "after"]);
    expect(text).toBe("Veja.");
  });

  it("keeps a table that still has text", () => {
    const { text } = splitEvidence(
      "| Página | Estado |\n|---|---|\n| Home | ok |",
    );
    expect(text).toContain("| Home | ok |");
  });

  it("returns plain text untouched", () => {
    expect(splitEvidence("só texto")).toEqual({ images: [], text: "só texto" });
  });
});

describe("pickReviewComment newer comments", () => {
  const AGENT = "super-agent";
  const contract = "## O que mudou\nX\n## Como conferir\n- Y";
  const make = (body: string, createdAt: string) => ({
    authorId: AGENT,
    audience: "human",
    body,
    createdAt,
  });

  it("flags a newer agent comment that skipped the format", () => {
    const picked = pickReviewComment(
      [
        make(contract, "2026-10-01T10:00:00Z"),
        make("Corrigido.", "2026-10-02T10:00:00Z"),
      ],
      AGENT,
    );
    expect(picked?.sections?.changed).toBe("X");
    expect(picked?.hasNewer).toBe(true);
  });

  it("does not flag when the latest comment is the delivery", () => {
    const picked = pickReviewComment(
      [make(contract, "2026-10-01T10:00:00Z")],
      AGENT,
    );
    expect(picked?.hasNewer).toBe(false);
  });
});

describe("adjustments", () => {
  const AGENT = "super-agent";
  const labels = {
    title: "Ajuste pedido",
    qa: "QA",
    customer: "Cliente",
    round: "rodada",
  };
  const person = (body: string, createdAt: string) => ({
    authorId: "u1",
    audience: "human",
    body,
    createdAt,
  });
  const agent = (createdAt: string) => ({
    authorId: AGENT,
    audience: "human",
    body: "## O que mudou\nX\n## Como conferir\n- Y",
    createdAt,
  });

  it("round trips a request", () => {
    const body = formatAdjustment(
      { origin: "qa", round: 2, note: "O botão está torto" },
      labels,
    );
    expect(body).toBe(
      "**Ajuste pedido** · QA · rodada 2\n\nO botão está torto",
    );
    const state = adjustmentState(
      [person(body, "2026-10-01T10:00:00Z")],
      AGENT,
    );
    expect(state.round).toBe(2);
    expect(state.returned).toEqual({
      origin: "qa",
      round: 2,
      note: "O botão está torto",
      createdAt: "2026-10-01T10:00:00Z",
    });
  });

  it("reads the English marker and the customer origin", () => {
    const state = adjustmentState(
      [
        person(
          "**Adjustment requested** · Customer · round 3\n\nMake it bigger",
          "2026-10-01T10:00:00Z",
        ),
      ],
      AGENT,
    );
    expect(state.round).toBe(3);
    expect(state.returned?.origin).toBe("customer");
  });

  it("is no longer returned once the agent delivers again", () => {
    const body = formatAdjustment(
      { origin: "customer", round: 2, note: "Mais claro" },
      labels,
    );
    const state = adjustmentState(
      [
        agent("2026-10-01T09:00:00Z"),
        person(body, "2026-10-01T10:00:00Z"),
        agent("2026-10-01T11:00:00Z"),
      ],
      AGENT,
    );
    expect(state).toEqual({ round: 2, returned: null });
  });

  it("starts at round 1 with no requests and ignores the agent's text", () => {
    expect(adjustmentState([agent("2026-10-01T09:00:00Z")], AGENT)).toEqual({
      round: 1,
      returned: null,
    });
    const fake = {
      authorId: AGENT,
      audience: "human",
      body: "**Ajuste pedido** · QA · rodada 9\n\nx",
      createdAt: "2026-10-01T10:00:00Z",
    };
    expect(adjustmentState([fake], AGENT).round).toBe(1);
  });

  it("takes the highest round across several requests", () => {
    const one = formatAdjustment({ origin: "qa", round: 2, note: "a" }, labels);
    const two = formatAdjustment(
      { origin: "customer", round: 3, note: "b" },
      labels,
    );
    const state = adjustmentState(
      [
        person(one, "2026-10-01T10:00:00Z"),
        agent("2026-10-01T11:00:00Z"),
        person(two, "2026-10-01T12:00:00Z"),
      ],
      AGENT,
    );
    expect(state.round).toBe(3);
    expect(state.returned?.note).toBe("b");
  });
});

describe("deco verification", () => {
  const AGENT = "super-agent";
  const delivery = (createdAt: string) => ({
    authorId: AGENT,
    audience: "human",
    body: "## O que mudou\nX\n## Como conferir\n- Y",
    createdAt,
  });
  const person = (body: string, createdAt: string) => ({
    authorId: "u1",
    audience: "human",
    body,
    createdAt,
  });
  const items = [
    { text: "Ver o banner", done: true },
    { text: "Ver no celular", done: false },
  ];

  it("round trips the checked items", () => {
    const body = formatVerification(items, "Conferido pela deco");
    expect(body).toBe(
      "**Conferido pela deco**\n\n- [x] Ver o banner\n- [ ] Ver no celular",
    );
    expect(
      decoVerification(
        [
          delivery("2026-10-01T09:00:00Z"),
          person(body, "2026-10-01T10:00:00Z"),
        ],
        AGENT,
      ),
    ).toEqual(items);
  });

  it("starts over when the agent delivers again", () => {
    const body = formatVerification(items, "Checked by deco");
    expect(
      decoVerification(
        [
          person(body, "2026-10-01T10:00:00Z"),
          delivery("2026-10-01T11:00:00Z"),
        ],
        AGENT,
      ),
    ).toBeNull();
  });

  it("ignores the agent's text and comments without the marker", () => {
    const body = formatVerification(items, "Conferido pela deco");
    expect(
      decoVerification(
        [
          { ...delivery("2026-10-01T10:00:00Z"), body },
          person("Parece bom", "2026-10-01T11:00:00Z"),
        ],
        AGENT,
      ),
    ).toBeNull();
  });
});
