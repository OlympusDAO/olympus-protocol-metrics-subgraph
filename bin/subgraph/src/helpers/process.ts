import { spawn } from "child_process";

export const spawnProcess = (
  command: string,
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void,
): void => {
  const process = spawn(command, { shell: true });

  process.stdout.on("data", (data: Buffer) => {
    console.info(data.toString());
  });

  process.stderr.on("data", (data: Buffer) => {
    console.error(data.toString());
  });

  process.on("exit", onExit);
};
