import { runWithReset } from "../../src/reset-envio";
import { superviseEnvio } from "../../src/start-envio";

let idle = process.argv[2] === "idle";
await runWithReset(
  ["start", "--config", "fixture.yaml"],
  process.env,
  async (args, env, options) => {
    if (!idle) return superviseEnvio(args, env, options);
    idle = false;
    console.error("Fixture control ready");
    await new Promise<void>((resolve) =>
      options?.signal?.addEventListener("abort", () => resolve(), { once: true }),
    );
  },
);
