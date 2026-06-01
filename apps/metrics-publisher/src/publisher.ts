export type PublishMode = "full" | "incremental";

export type PublishResult = {
  manifestPublishedLast: boolean;
  writtenKeys: string[];
};

export async function publishMetricsArtifacts(_input: {
  mode: PublishMode;
  lookbackDays?: number;
  startDate?: string;
}): Promise<PublishResult> {
  throw new Error("Not implemented");
}
