import { useState } from "react";
import { ReviewView } from "@/layouts/task-board/review-view";
import {
  parseReviewSections,
  type ReviewAudience,
} from "@/layouts/task-board/review-view-model";

/** Synthetic agent comment that follows the review contract. */
const CONTRACT_COMMENT = `## Pedido
Trocar o banner da home pela campanha de outubro.

## O que mudou
O banner da home agora mostra a campanha de outubro, com o novo botão.

## Impacto
Só a home. Nenhuma outra página muda.

## Como conferir
- Abrir a home e ver o novo banner
- Clicar no botão e chegar na coleção
- Ver a home no celular

## Evidências
Antes e depois da home anexados.

## Limitações
Não testado no Safari.
`;

/** A free-form comment: the agent skipped the contract. */
export const FREE_COMMENT = "Pronto, abri o PR com o banner novo.";

/**
 * CT surface for the Review view. Decisions are dumped into testid'd <pre>s so
 * specs can assert what the view reported.
 */
export function ReviewViewHarness({
  audience = "deco",
  comment = CONTRACT_COMMENT,
  verifiedByDeco = false,
  round = 1,
}: {
  audience?: ReviewAudience;
  comment?: string;
  verifiedByDeco?: boolean;
  round?: number;
}) {
  const [approved, setApproved] = useState(0);
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
        onApprove={() => setApproved((n) => n + 1)}
        onRequestAdjustment={(note) => setAdjustments((prev) => [...prev, note])}
      />
      <pre data-testid="approved">{approved}</pre>
      <pre data-testid="adjustments">{JSON.stringify(adjustments)}</pre>
    </div>
  );
}
