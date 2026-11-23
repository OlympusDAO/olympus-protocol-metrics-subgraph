import { addAbortSignal, Readable } from "node:stream";
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
  private readonly client: S3Client;

  constructor(
    private readonly input: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
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
    for (const timeout of [input.requestTimeoutMs, input.bodyTimeoutMs]) {
      if (timeout !== undefined && timeout > 2_147_483_647) {
        throw new Error("Artifact timeouts must not exceed 2147483647 ms.");
      }
    }
    this.client = new S3Client({
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
    const requestSignal = AbortSignal.timeout(this.input.requestTimeoutMs ?? 30_000);
    let body: Readable | undefined;
    let bodySignal: AbortSignal | undefined;
    const maxBytes = this.input.maxResponseBytes ?? 64 * 1024 * 1024;
    try {
      let onAbort: (() => void) | undefined;
      const response = await Promise.race([
        this.client.send(new GetObjectCommand({ Bucket: this.input.bucket, Key: key }), {
          abortSignal: requestSignal,
        }),
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(requestSignal.reason);
          requestSignal.addEventListener("abort", onAbort, { once: true });
          if (requestSignal.aborted) onAbort();
        }),
      ]).finally(() => {
        if (onAbort) requestSignal.removeEventListener("abort", onAbort);
      });
      if (!(response.Body instanceof Readable))
        throw new ArtifactReadError("Artifact had no readable response body.");
      body = response.Body;
      bodySignal = AbortSignal.timeout(this.input.bodyTimeoutMs ?? 10_000);
      addAbortSignal(requestSignal, body);
      addAbortSignal(bodySignal, body);
      if ((response.ContentLength ?? 0) > maxBytes)
        throw new ArtifactReadError("Artifact exceeds the response size limit.");
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of body) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBytes)
          throw new ArtifactReadError("Artifact exceeds the response size limit.");
        chunks.push(buffer);
      }
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
        if (!schema.validate(parsed))
          throw new ArtifactReadError("Invalid artifact JSON or runtime shape.");
        return schema.parse(parsed);
      } catch {
        throw new ArtifactReadError("Invalid artifact JSON or runtime shape.");
      }
    } catch (error) {
      body?.destroy();
      if (isNotFoundError(error)) throw new ArtifactNotFoundError(key);
      if (requestSignal.aborted) throw new ArtifactReadError("Artifact request timed out.");
      if (bodySignal?.aborted) throw new ArtifactReadError("Artifact body timed out.");
      if (error instanceof ArtifactReadError) throw error;
      throw new ArtifactReadError("Artifact storage request failed.");
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
