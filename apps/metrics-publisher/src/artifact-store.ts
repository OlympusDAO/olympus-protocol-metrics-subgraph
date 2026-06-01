import { createHash } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type ArtifactStore = {
  putJson(key: string, value: unknown): Promise<void>;
};

export type ArtifactEntry = {
  sha256: string;
  byteLength: number;
  rowCount: number;
};

export class MemoryArtifactStore implements ArtifactStore {
  readonly writtenKeys: string[] = [];
  readonly objects = new Map<string, string>();

  async putJson(key: string, value: unknown): Promise<void> {
    this.writtenKeys.push(key);
    this.objects.set(key, serializeJson(value));
  }

  json(key: string): any {
    const value = this.objects.get(key);
    if (value === undefined) {
      throw new Error(`No object written for ${key}`);
    }
    return JSON.parse(value);
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
