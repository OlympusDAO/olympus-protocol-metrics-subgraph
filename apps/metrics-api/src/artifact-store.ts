import { Readable } from "node:stream";
import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import type { ZodType } from "zod";

export class ArtifactReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactReadError";
  }
}

export class ArtifactNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Artifact not found: ${key}`);
    this.name = "ArtifactNotFoundError";
  }
}

export type ArtifactReader = {
  getJson<T>(key: string, schema: ZodType<T>): Promise<T>;
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
      requestTimeoutMs?: number;
      bodyTimeoutMs?: number;
      maxResponseBytes?: number;
    },
  ) {
    for (const value of [input.requestTimeoutMs, input.bodyTimeoutMs, input.maxResponseBytes]) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
        throw new Error("Artifact read limits must be positive safe integers.");
      }
    }
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

  async getJson<T>(key: string, schema: ZodType<T>): Promise<T> {
    const controller = new AbortController();
    let body: Readable | undefined;
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    const maxBytes = this.input.maxResponseBytes ?? 64 * 1024 * 1024;
    const stop = (error: ArtifactReadError) => {
      controller.abort(error);
      body?.destroy(error);
      return error;
    };
    try {
      return await Promise.race([
        new Promise<never>((_resolve, reject) => {
          requestTimer = setTimeout(() => {
            reject(stop(new ArtifactReadError("Artifact request timed out.")));
          }, this.input.requestTimeoutMs ?? 30_000);
        }),
        (async () => {
          const response = await this.client.send(
            new GetObjectCommand({ Bucket: this.input.bucket, Key: key }),
            { abortSignal: controller.signal },
          );
          if (!(response.Body instanceof Readable)) {
            throw new ArtifactReadError("Artifact had no readable response body.");
          }
          body = response.Body;
          // Always observe stream errors, including a response that arrives after abort.
          body.on("error", () => {});
          if (controller.signal.aborted) {
            body.destroy();
            throw controller.signal.reason;
          }
          if ((response.ContentLength ?? 0) > maxBytes) {
            throw stop(new ArtifactReadError("Artifact exceeds the response size limit."));
          }
          const text = await Promise.race([
            new Promise<never>((_resolve, reject) => {
              bodyTimer = setTimeout(() => {
                reject(stop(new ArtifactReadError("Artifact body timed out.")));
              }, this.input.bodyTimeoutMs ?? 10_000);
            }),
            (async () => {
              const chunks: Buffer[] = [];
              let bytes = 0;
              for await (const chunk of body) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                bytes += buffer.length;
                if (bytes > maxBytes) {
                  throw stop(new ArtifactReadError("Artifact exceeds the response size limit."));
                }
                chunks.push(buffer);
              }
              return Buffer.concat(chunks, bytes).toString("utf8");
            })(),
          ]);
          try {
            return schema.parse(JSON.parse(text));
          } catch {
            throw new ArtifactReadError("Invalid artifact JSON or runtime shape.");
          }
        })(),
      ]);
    } catch (error) {
      body?.destroy();
      if (isNotFoundError(error)) {
        throw new ArtifactNotFoundError(key);
      }
      if (controller.signal.aborted) throw controller.signal.reason;
      if (error instanceof ArtifactReadError) throw error;
      throw new ArtifactReadError("Artifact storage request failed.");
    } finally {
      clearTimeout(requestTimer);
      clearTimeout(bodyTimer);
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
    requestTimeoutMs: positiveEnv(env, "METRICS_API_ARTIFACT_REQUEST_TIMEOUT_MS", 30_000),
    bodyTimeoutMs: positiveEnv(env, "METRICS_API_ARTIFACT_BODY_TIMEOUT_MS", 10_000),
    maxResponseBytes: positiveEnv(env, "METRICS_API_ARTIFACT_MAX_BYTES", 64 * 1024 * 1024),
  });
}

function positiveEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = env[name] === undefined ? fallback : Number(env[name]);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive safe integer.`);
  return value;
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
