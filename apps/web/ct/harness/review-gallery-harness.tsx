import { Button } from "@decocms/ui/components/button.tsx";
import { Globe01 } from "@untitledui/icons";
import { ReviewView } from "@/layouts/task-board/review-view";
import {
  parseReviewSections,
  type ReviewAudience,
} from "@/layouts/task-board/review-view-model";

const swatch = (label: string, color: string) =>
  `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="${color}"/><text x="320" y="210" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#0a0a09">${label}</text></svg>`,
  )}`;

type Scenario = {
  comment: string;
  audience: ReviewAudience;
  stage: string;
  stageHint?: string;
  verifiedByDeco?: boolean;
  round?: number;
  agentChecks?: number;
  preview?: boolean;
  decide?: boolean;
};

const SCENARIOS: Record<string, Scenario> = {
  "visual-before-after": {
    audience: "deco",
    stage: "Stage: QA",
    stageHint:
      "The deco team checks the work. Approving sends it to the client.",
    agentChecks: 6,
    decide: true,
    comment: `## Pedido
Mostrar a seta de rolagem no carrossel da home.

## O que mudou
O carrossel da home agora tem uma seta para a direita, no mesmo estilo das outras setas do site.

## Impacto
Só o carrossel da home. Outras páginas não mudam.

## Como conferir
- Abrir a home e ver a seta no carrossel
- Clicar na seta e ver o carrossel andar
- Ver no celular

## Evidências
Antes e depois do carrossel.

![Antes](${swatch("Antes", "#f5f4f2")})
![Depois](${swatch("Depois", "#e4e3e1")})

## Limitações
Não testado no Safari.`,
  },
  "visual-preview": {
    audience: "deco",
    stage: "Stage: QA",
    stageHint:
      "The deco team checks the work. Approving sends it to the client.",
    agentChecks: 4,
    preview: true,
    decide: true,
    comment: `## Pedido
Trocar a ordem das seções da página de coleção.

## O que mudou
Na página de coleção, a faixa de filtros agora vem antes da lista de produtos.

## Como conferir
- Abrir a página de coleção pelo preview
- Ver que os filtros aparecem acima dos produtos
- Aplicar um filtro e ver a lista mudar

## Evidências
Abra o preview na página afetada para conferir ao vivo.`,
  },
  technical: {
    audience: "deco",
    stage: "Stage: QA",
    stageHint:
      "The deco team checks the work. Approving sends it to the client.",
    agentChecks: 9,
    decide: true,
    comment: `## Pedido
Corrigir o envio duplicado do evento de rastreamento de compra.

## O que mudou
O evento de compra agora é enviado uma única vez por pedido. Antes, um segundo envio acontecia ao recarregar a página de confirmação.

## Impacto
Os relatórios de compra deixam de contar pedidos em dobro. Nada muda para quem compra.

## Como conferir
- Fazer uma compra de teste e confirmar um único evento
- Recarregar a página de confirmação e confirmar que não há novo evento
- Conferir o total de pedidos no relatório

## Evidências
| Verificação | Antes | Depois |
| --- | --- | --- |
| Eventos por pedido | 2 | 1 |
| Recarregar confirmação | novo evento | sem evento |
| Pedidos no relatório | 118 | 59 |

## Limitações
Pedidos antigos continuam contados em dobro no histórico.`,
  },
  "customer-round-2": {
    audience: "customer",
    stage: "Stage: Customer Approval",
    stageHint: "The client decides. Approving releases it for deployment.",
    verifiedByDeco: true,
    round: 2,
    agentChecks: 7,
    preview: true,
    decide: true,
    comment: `## Pedido
Ajustar o texto do botão de compra.

## O que mudou
O botão de compra agora diz "Comprar agora", como combinado na rodada anterior.

## Como conferir
- Abrir a página de um produto
- Ver o texto do botão

## Evidências
![Antes](${swatch("Antes", "#f5f4f2")})
![Depois](${swatch("Depois", "#e4e3e1")})`,
  },
  "in-review-read-only": {
    audience: "deco",
    stage: "Stage: In Review",
    stageHint: "Agents are still reviewing. Nothing to decide yet.",
    agentChecks: 3,
    comment: `## O que mudou
Troca do ícone do carrinho pelo ícone novo.

## Como conferir
- Abrir qualquer página e ver o ícone do carrinho`,
  },
  fallback: {
    audience: "deco",
    stage: "Stage: QA",
    stageHint:
      "The deco team checks the work. Approving sends it to the client.",
    decide: true,
    comment: "Pronto, abri o PR com a mudança. Os testes passaram.",
  },
};

/**
 * CT surface that renders one Review view scenario with synthetic data, so a
 * reviewer can see each kind of card without a running Studio.
 */
export function ReviewGalleryHarness({ scenario }: { scenario: string }) {
  const config = SCENARIOS[scenario]!;
  return (
    <div className="w-[720px] bg-background p-6">
      <ReviewView
        id={scenario}
        sections={parseReviewSections(config.comment)}
        fallback={<p>{config.comment}</p>}
        audience={config.audience}
        stage={config.stage}
        stageHint={config.stageHint}
        verifiedByDeco={config.verifiedByDeco}
        round={config.round}
        agentChecks={config.agentChecks}
        approveLabel={
          config.audience === "customer"
            ? "Approve and release for deployment"
            : "Approve QA and send to client"
        }
        preview={
          config.preview ? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Globe01 size={14} />
              Open preview
            </Button>
          ) : undefined
        }
        onApprove={config.decide ? () => {} : undefined}
        onRequestAdjustment={config.decide ? () => {} : undefined}
      />
    </div>
  );
}
