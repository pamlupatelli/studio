import { expect, test } from "@playwright/experimental-ct-react";
import { ReviewGalleryHarness } from "../harness/review-gallery-harness";

const SCENARIOS = [
  "visual-before-after",
  "visual-preview",
  "technical",
  "customer-round-2",
  "in-review-read-only",
  "fallback",
];

// One screenshot per kind of card, attached to the test report so each can be
// looked at without running Studio.
for (const scenario of SCENARIOS) {
  test(`gallery: ${scenario}`, async ({ mount }, testInfo) => {
    const component = await mount(<ReviewGalleryHarness scenario={scenario} />);
    await expect(component.getByTestId("review-view")).toBeVisible();
    const path = testInfo.outputPath(`${scenario}.png`);
    await component.screenshot({ path });
    await testInfo.attach(scenario, { path, contentType: "image/png" });
  });
}
