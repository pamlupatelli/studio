import { expect, test } from "@playwright/experimental-ct-react";
import { ReviewViewHarness } from "../harness/review-view-harness";

// A free-form comment: the agent skipped the contract.
const FREE_COMMENT = "Pronto, abri o PR com o banner novo.";

test("QA: shows the sections and an itemized checklist", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);

  await expect(component.getByText("What changed")).toBeVisible();
  await expect(
    component.getByText("Abrir a home e ver o novo banner"),
  ).toBeVisible();
  await expect(component.getByText("0 of 3 checked")).toBeVisible();

  await component.getByRole("checkbox").first().click();
  await expect(component.getByText("1 of 3 checked")).toBeVisible();
});

test("QA: approve reports the decision", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component.getByRole("button", { name: "Approve" }).click();
  await expect(component.getByTestId("approved")).toHaveText("1");
});

test("request adjustment needs a note and reports it", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component.getByRole("button", { name: "Request adjustment" }).click();

  const send = component.getByRole("button", { name: "Send back to To Do" });
  await expect(send).toBeDisabled();

  await component
    .getByRole("textbox", { name: "What needs to change?" })
    .fill("O botão está fora do lugar");
  await send.click();
  await expect(component.getByTestId("adjustments")).toHaveText(
    JSON.stringify(["O botão está fora do lugar"]),
  );
});

test("customer: one question, checklist collapsed, deco mark visible", async ({
  mount,
}) => {
  const component = await mount(
    <ReviewViewHarness audience="customer" verifiedByDeco round={2} />,
  );

  await expect(component.getByText("Is it what you expected?")).toBeVisible();
  await expect(component.getByTestId("review-verified")).toBeVisible();
  await expect(component.getByText("Round 2")).toBeVisible();
  await expect(component.getByText("Ver a home no celular")).toHaveCount(0);

  await component.getByRole("button", { name: "See what was checked" }).click();
  await expect(component.getByText("Ver a home no celular")).toBeVisible();
});

test("falls back to the raw comment when the contract is missing", async ({
  mount,
}) => {
  const component = await mount(
    <ReviewViewHarness audience="deco" comment={FREE_COMMENT} />,
  );
  await expect(component.getByTestId("review-fallback")).toBeVisible();
  await expect(component.getByText(FREE_COMMENT)).toBeVisible();
  await expect(
    component.getByRole("button", { name: "Approve" }),
  ).toBeVisible();
});
