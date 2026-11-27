import { mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";

test("Envio 3.19.0 checks actual handlers with the root TypeScript 7 CLI", async () => {
  const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const indexerRequire = createRequire(join(cwd, "package.json"));
  const rootRequire = createRequire(join(cwd, "../../package.json"));
  expect(indexerRequire("envio/package.json").version).toBe("3.19.0");
  expect(rootRequire("typescript/package.json").version).toBe("7.0.2");
  expect(indexerRequire.resolve("typescript/package.json")).toBe(
    rootRequire.resolve("typescript/package.json"),
  );
  const { check } = await import(
    pathToFileURL(
      join(dirname(indexerRequire.resolve("envio/package.json")), "src/HandlerTypeCheck.res.mjs"),
    ).href
  );
  const handlers = (await readdir(join(cwd, "src/handlers")))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(cwd, "src/handlers", name));
  expect(handlers.length).toBeGreaterThan(0);
  expect(await check(cwd, handlers)).toBe("Passed");
  const fixture = await mkdtemp(join(tmpdir(), "metrics-envio-typecheck-"));
  try {
    const invalid = join(fixture, "invalid-handler.ts");
    await symlink(join(cwd, "../../node_modules"), join(fixture, "node_modules"));
    await writeFile(
      join(fixture, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, skipLibCheck: true },
        include: ["*.ts"],
      }),
    );
    await writeFile(invalid, 'const incompatible: number = "invalid";\n');
    const result = await check(fixture, [invalid]);
    expect(result.TAG).toBe("TypeErrors");
    expect(result._0).toContain("not assignable to type 'number'");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30000);
