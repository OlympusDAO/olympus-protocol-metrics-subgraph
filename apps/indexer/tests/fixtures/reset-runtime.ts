import { runWithReset } from "../../src/reset-envio";
import { superviseEnvio } from "../../src/start-envio";

await runWithReset(
  ["start", "--config", "fixture.yaml"],
  process.env,
  async () => Number(process.argv[2]),
  superviseEnvio,
);
