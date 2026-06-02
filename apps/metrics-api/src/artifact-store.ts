import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";

export class ArtifactNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Artifact not found: ${key}`);
    this.name = "ArtifactNotFoundError";
  }
}

export type ArtifactReader = {
  getJson<T>(key: string): Promise<T>;
};

export class S3ArtifactReader implements ArtifactReader {
  private readonly client: Pick<S3Client, "send">;

  constructor(
    private readonly input: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      client?: Pick<S3Client, "send">;
    },
  ) {
    this.client =
      input.client ??
      new S3Client({
        endpoint: input.endpoint,
        region: input.region,
        forcePathStyle: true,
        credentials: {
          accessKeyId: input.accessKeyId,
          secretAccessKey: input.secretAccessKey,
        },
      });
  }

  async getJson<T>(key: string): Promise<T> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.input.bucket,
          Key: key,
        }),
      );
      const body = await response.Body?.transformToString();
      if (body === undefined) {
        throw new Error(`Artifact ${key} had no response body.`);
      }
      return JSON.parse(body) as T;
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new ArtifactNotFoundError(key);
      }
      throw error;
    }
  }
}

export function createArtifactReaderFromEnv(env: NodeJS.ProcessEnv): S3ArtifactReader {
  return new S3ArtifactReader({
    bucket: requiredEnv(env, "ARTIFACT_BUCKET"),
    endpoint: requiredEnv(env, "ARTIFACT_ENDPOINT"),
    region: requiredEnv(env, "ARTIFACT_REGION"),
    accessKeyId: requiredEnv(env, "ARTIFACT_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv(env, "ARTIFACT_SECRET_ACCESS_KEY"),
  });
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound"))
  );
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}
