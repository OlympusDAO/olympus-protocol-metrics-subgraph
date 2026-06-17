import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export class ArtifactNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Artifact not found: ${key}`);
    this.name = "ArtifactNotFoundError";
  }
}

export type ArtifactStore = {
  getJson<T>(key: string): Promise<T>;
  getJsonWithMetadata<T>(key: string): Promise<{ value: T; etag?: string }>;
  putJson(key: string, value: unknown): Promise<void>;
  putJsonIfAbsent(key: string, value: unknown): Promise<boolean>;
  putJsonIfMatch(key: string, value: unknown, etag: string): Promise<boolean>;
  listKeys(prefix: string): Promise<string[]>;
  deleteJson(key: string): Promise<void>;
  deleteJsonIfMatch(key: string, etag: string): Promise<boolean>;
};

export type ArtifactEntry = {
  sha256: string;
  byteLength: number;
  rowCount: number;
};

export class MemoryArtifactStore implements ArtifactStore {
  readonly writtenKeys: string[] = [];
  readonly deletedKeys: string[] = [];
  readonly objects = new Map<string, string>();

  async getJson<T>(key: string): Promise<T> {
    return this.getJsonWithMetadata<T>(key).then((result) => result.value);
  }

  async getJsonWithMetadata<T>(key: string): Promise<{ value: T; etag?: string }> {
    const value = this.objects.get(key);
    if (value === undefined) {
      throw new ArtifactNotFoundError(key);
    }
    return { value: JSON.parse(value) as T, etag: etag(value) };
  }

  async putJson(key: string, value: unknown): Promise<void> {
    this.writtenKeys.push(key);
    this.objects.set(key, serializeJson(value));
  }

  async putJsonIfAbsent(key: string, value: unknown): Promise<boolean> {
    if (this.objects.has(key)) {
      return false;
    }
    await this.putJson(key, value);
    return true;
  }

  async putJsonIfMatch(key: string, value: unknown, etagValue: string): Promise<boolean> {
    const existing = this.objects.get(key);
    if (existing === undefined || etag(existing) !== etagValue) {
      return false;
    }
    await this.putJson(key, value);
    return true;
  }

  async listKeys(prefix: string): Promise<string[]> {
    return Array.from(this.objects.keys())
      .filter((key) => key.startsWith(prefix))
      .sort();
  }

  async deleteJson(key: string): Promise<void> {
    this.deletedKeys.push(key);
    this.objects.delete(key);
  }

  async deleteJsonIfMatch(key: string, etagValue: string): Promise<boolean> {
    const existing = this.objects.get(key);
    if (existing === undefined || etag(existing) !== etagValue) {
      return false;
    }
    this.deletedKeys.push(key);
    this.objects.delete(key);
    return true;
  }

  json<T = unknown>(key: string): T {
    const value = this.objects.get(key);
    if (value === undefined) {
      throw new Error(`No object written for ${key}`);
    }
    return JSON.parse(value) as T;
  }
}

export class S3ArtifactStore implements ArtifactStore {
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

  async putJson(key: string, value: unknown): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.input.bucket,
        Key: key,
        Body: serializeJson(value),
        ContentType: "application/json; charset=utf-8",
      }),
    );
  }

  async getJson<T>(key: string): Promise<T> {
    return this.getJsonWithMetadata<T>(key).then((result) => result.value);
  }

  async getJsonWithMetadata<T>(key: string): Promise<{ value: T; etag?: string }> {
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
      return { value: JSON.parse(body) as T, etag: response.ETag };
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new ArtifactNotFoundError(key);
      }
      throw error;
    }
  }

  async putJsonIfAbsent(key: string, value: unknown): Promise<boolean> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.input.bucket,
          Key: key,
          Body: serializeJson(value),
          ContentType: "application/json; charset=utf-8",
          IfNoneMatch: "*",
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        return false;
      }
      throw error;
    }
  }

  async putJsonIfMatch(key: string, value: unknown, etagValue: string): Promise<boolean> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.input.bucket,
          Key: key,
          Body: serializeJson(value),
          ContentType: "application/json; charset=utf-8",
          IfMatch: etagValue,
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        return false;
      }
      throw error;
    }
  }

  async deleteJson(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.input.bucket,
        Key: key,
      }),
    );
  }

  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.input.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of response.Contents ?? []) {
        if (object.Key !== undefined) {
          keys.push(object.Key);
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken !== undefined);
    return keys;
  }

  async deleteJsonIfMatch(key: string, etagValue: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.input.bucket,
          Key: key,
          IfMatch: etagValue,
        }),
      );
      return true;
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        return false;
      }
      throw error;
    }
  }
}

export function artifactEntry(value: unknown, rowCount: number): ArtifactEntry {
  const content = serializeJson(value);
  return {
    sha256: sha256(content),
    byteLength: Buffer.byteLength(content),
    rowCount,
  };
}

export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function etag(value: string): string {
  return `"${sha256(value)}"`;
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound"))
  );
}

function isConditionalWriteFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "PreconditionFailed" ||
      error.name === "ConditionalRequestConflict" ||
      error.name === "NotModified")
  );
}
