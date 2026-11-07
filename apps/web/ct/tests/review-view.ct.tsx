import { expect, test } from "@playwright/experimental-ct-react";
import { ReviewViewHarness } from "../harness/review-view-harness";

// A free-form comment: the agent skipped the contract.
const FREE_COMMENT = "Pronto, abri o PR com o banner novo.";

test("QA: shows the sections and what the agent checked", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);

  await expect(component.getByText("What changed")).toBeVisible();
  await expect(component.getByText("What the agent checked")).toBeVisible();
  await expect(component.getByText("1 of 3 verified")).toBeVisible();
  // Nothing to tick: the person only confirms.
  await expect(component.getByRole("checkbox")).toHaveCount(0);
});

test("QA: failed and unverified checks come first", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  const statuses = await component
    .getByTestId("review-agent-checks")
    .locator("li")
    .evaluateAll((items) => items.map((li) => li.getAttribute("data-status")));
  expect(statuses).toEqual(["failed", "unverified", "passed"]);
});

test("QA: approve reports the decision", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component.getByRole("button", { name: "Approve" }).click();
  await expect(component.getByTestId("approved")).toHaveText("1");
});

test("request adjustment needs a note and reports it", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component.getByRole("button", { name: "Request adjustment" }).click();

  const send = component.getByRole("button", {
    name: "Send back to In Review",
  });
  await expect(send).toBeDisabled();

  await component
    .getByRole("textbox", { name: "What needs to change?" })
    .fill("O botão está fora do lugar");
  await send.click();
  await expect(component.getByTestId("adjustments")).toHaveText(
    JSON.stringify(["O botão está fora do lugar"]),
  );
});

test("customer: one question, checklist visible, deco mark visible", async ({
  mount,
}) => {
  const component = await mount(
    <ReviewViewHarness audience="customer" verifiedByDeco round={2} />,
  );

  await expect(component.getByText("Is it what you expected?")).toBeVisible();
  await expect(component.getByTestId("review-verified")).toBeVisible();
  await expect(component.getByText("Round 2")).toBeVisible();
  await expect(component.getByText("Ver a home no celular")).toBeVisible();
});

test("the eye inside the checklist block hides and shows the items", async ({
  mount,
}) => {
  const component = await mount(<ReviewViewHarness audience="customer" />);

  await component.getByRole("button", { name: "Hide checklist" }).click();
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

test("lays out labelled before and after images side by side", async ({
  mount,
}) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  const pair = component.getByTestId("review-before-after");
  await expect(pair).toBeVisible();
  await expect(pair.getByRole("img")).toHaveCount(2);
  await expect(pair.getByText("Before")).toBeVisible();
  await expect(pair.getByText("After")).toBeVisible();
});

test("QA: approving records only what the agent passed", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component.getByRole("button", { name: "Approve" }).click();

  const reported = JSON.parse(
    (await component.getByTestId("checks").textContent()) ?? "[]",
  ) as { text: string; done: boolean }[];
  expect(reported.map((item) => item.done)).toEqual([true, false, false]);
});

test("QA: disagreeing with a check becomes an adjustment", async ({
  mount,
}) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component.getByRole("button", { name: "Disagree" }).first().click();
  await component
    .getByRole("textbox", { name: "What is wrong?" })
    .fill("O botão leva para a home");

  await component
    .getByRole("button", { name: "Request adjustment (1)" })
    .click();
  await component
    .getByRole("button", { name: "Send back to In Review" })
    .click();

  const sent = JSON.parse(
    (await component.getByTestId("adjustments").textContent()) ?? "[]",
  ) as string[];
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain("Checks I disagree with");
  expect(sent[0]).toContain("O botão leva para a home");
});

test("pins: a click marks the image and travels with the adjustment", async ({
  mount,
}) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  const after = component.getByRole("button", {
    name: "Mark a spot on Depois",
  });
  await after.click({ position: { x: 1, y: 1 } });

  await expect(component.getByTestId("review-pin")).toHaveCount(1);
  await component
    .getByRole("textbox", { name: "Pin 1" })
    .fill("Alinhar com o título");

  await component
    .getByRole("button", { name: "Request adjustment (1)" })
    .click();
  await component
    .getByRole("button", { name: "Send back to In Review" })
    .click();

  const sent = JSON.parse(
    (await component.getByTestId("adjustments").textContent()) ?? "[]",
  ) as string[];
  expect(sent[0]).toContain("**Pins**");
  expect(sent[0]).toMatch(
    /1\. Depois \(x [\d.]+%, y [\d.]+%\): Alinhar com o título/,
  );
});

test("pins: removing one clears its mark", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness audience="deco" />);
  await component
    .getByRole("button", { name: "Mark a spot on Antes" })
    .click({ position: { x: 1, y: 1 } });
  await expect(component.getByTestId("review-pin")).toHaveCount(1);
  await component.getByRole("button", { name: "Remove pin 1" }).click();
  await expect(component.getByTestId("review-pin")).toHaveCount(0);
});

test("customer: sees what the deco team checked", async ({ mount }) => {
  const component = await mount(
    <ReviewViewHarness
      audience="customer"
      verifiedByDeco
      verification={[
        { text: "Abrir a home e ver o novo banner", done: true },
        { text: "Ver a home no celular", done: false },
      ]}
    />,
  );

  await expect(component.getByText("What deco checked")).toBeVisible();
  await expect(component.getByText("1 of 2 checked")).toBeVisible();
  await expect(
    component.getByText("Ver a home no celular (not checked)"),
  ).toBeVisible();
  await expect(component.getByRole("checkbox")).toHaveCount(0);
});

const TABLE_COMMENT = `## O que mudou
X

## Como conferir
- Y

## Evidências
| A | B |
|---|---|
| 1 | 2 |`;

test("the CSV button sits in the evidence header", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness comment={TABLE_COMMENT} />);
  const copy = component.getByRole("button", { name: "Copy as CSV" });
  await expect(copy).toHaveCount(1);

  // Same row as the block title, above the table.
  const title = await component
    .getByText("Evidence", { exact: true })
    .boundingBox();
  const button = await copy.boundingBox();
  const table = await component.getByRole("table").boundingBox();
  expect(Math.abs(button!.y - title!.y)).toBeLessThan(24);
  expect(button!.y + button!.height).toBeLessThanOrEqual(table!.y);
});

test("a comment outside the format is flagged", async ({ mount }) => {
  const component = await mount(<ReviewViewHarness comment={FREE_COMMENT} />);
  await expect(component.getByTestId("review-fallback")).toContainText(
    "did not use the expected format",
  );
});
