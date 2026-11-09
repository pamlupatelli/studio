import { useState } from "react";
import { ReviewView } from "@/layouts/task-board/review-view";
import {
  parseReviewSections,
  type CheckedItem,
  type ReviewAudience,
} from "@/layouts/task-board/review-view-model";

/** Sized and distinct, so each image has a real box to click and its own pins. */
const swatch = (color: string) =>
  `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${color}"/></svg>`,
  )}`;
const BEFORE = swatch("#9ca3af");
const AFTER = swatch("#4ade80");

/** Synthetic agent comment that follows the review contract. */
const CONTRACT_COMMENT = `## Pedido
Trocar o banner da home pela campanha de outubro.

## O que mudou
O banner da home agora mostra a campanha de outubro, com o novo botão.

## Impacto
Só a home. Nenhuma outra página muda.

## Como conferir
- [x] Abrir a home e ver o novo banner
- [!] Clicar no botão e chegar na coleção
- Ver a home no celular

## Evidências
Antes e depois da home.

![Antes](${BEFORE})
![Depois](${AFTER})

## Limitações
Não testado no Safari.
`;

/**
 * CT surface for the Review view. Decisions are dumped into testid'd <pre>s so
 * specs can assert what the view reported.
 */
export function ReviewViewHarness({
  audience = "deco",
  comment = CONTRACT_COMMENT,
  verifiedByDeco = false,
  round = 1,
  verification,
}: {
  audience?: ReviewAudience;
  comment?: string;
  verifiedByDeco?: boolean;
  round?: number;
  verification?: CheckedItem[];
}) {
  const [approved, setApproved] = useState(0);
  const [checks, setChecks] = useState<CheckedItem[]>([]);
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const sections = parseReviewSections(comment);

  return (
    <div className="flex w-[640px] flex-col gap-5 bg-background p-6">
      <ReviewView
        id="harness"
        sections={sections}
        fallback={<p>{comment}</p>}
        audience={audience}
        verifiedByDeco={verifiedByDeco}
        round={round}
        agentChecks={5}
        verification={verification}
        onApprove={(reported) => {
          setApproved((n) => n + 1);
          setChecks(reported);
        }}
        onRequestAdjustment={(note) =>
          setAdjustments((prev) => [...prev, note])
        }
      />
      <pre data-testid="approved">{approved}</pre>
      <pre data-testid="checks">{JSON.stringify(checks)}</pre>
      <pre data-testid="adjustments">{JSON.stringify(adjustments)}</pre>
    </div>
  );
}
