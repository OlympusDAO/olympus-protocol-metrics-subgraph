import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";

test("Envio 3.14 uses its scoped stable API while the main compiler stays TypeScript 7", async () => {
  const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const indexerRequire = createRequire(join(cwd, "package.json"));
  const rootRequire = createRequire(join(cwd, "../../package.json"));
  expect(rootRequire("typescript/package.json").version).toBe("7.0.2");
  expect(indexerRequire("typescript/package.json")).toMatchObject({
    name: "@typescript/typescript6",
    version: "6.0.2",
  });
  for (const name of ["findConfigFile", "createProgram", "getParsedCommandLineOfConfigFile"])
    expect(typeof indexerRequire("typescript")[name]).toBe("function");
  const { check } = await import(
    pathToFileURL(
      join(dirname(indexerRequire.resolve("envio/package.json")), "src/HandlerTypeCheck.mjs"),
    ).href
  );
  const handlers = (await readdir(join(cwd, "src/handlers")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(cwd, "src/handlers", name));
  expect(handlers.length).toBeGreaterThan(0);
  expect(await check(cwd, handlers)).toEqual({});
  const fixture = await mkdtemp(join(tmpdir(), "metrics-envio-typecheck-"));
  try {
    const invalid = join(fixture, "invalid-handler.ts");
    await writeFile(invalid, 'const incompatible: number = "invalid";\n');
    const result = await check(cwd, [invalid]);
    expect(result.skipped).toBeUndefined();
    expect(result.errors).toContain("not assignable to type 'number'");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30000);
