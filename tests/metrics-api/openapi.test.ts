import { describe, expect, test } from "vitest";

import { getOpenApiDocument } from "../../packages/metrics-artifacts/src";

describe("OpenAPI document", () => {
  test("documents v2, legacy operations, deprecated operations, and atBlock 501 responses", () => {
    const document = getOpenApiDocument() as {
      paths: Record<string, { get?: { deprecated?: boolean; responses?: Record<string, unknown> } }>;
    };

    expect(document.paths["/v2/bounds"]).toBeDefined();
    expect(document.paths["/v2/metrics/daily"]).toBeDefined();
    expect(document.paths["/v2/treasury-assets/daily"]).toBeDefined();
    expect(document.paths["/v2/ohm-supply/daily"]).toBeDefined();
    expect(document.paths["/operations/paginated/metrics"]?.get?.deprecated).toBe(true);
    expect(document.paths["/operations/atBlock/metrics"]?.get?.responses?.["501"]).toBeDefined();
  });
});
