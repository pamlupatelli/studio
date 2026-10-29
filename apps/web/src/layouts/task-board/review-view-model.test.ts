import { describe, expect, it } from "bun:test";
import { parseReviewSections } from "./review-view-model";

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
    expect(parsed?.changed).toBe("O banner agora mostra a campanha de outubro.");
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
