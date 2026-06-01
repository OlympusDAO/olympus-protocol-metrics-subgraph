import { createHash, createHmac } from "node:crypto";

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
  constructor(
    private readonly input: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      fetchFn?: typeof fetch;
      now?: () => Date;
    },
  ) {}

  async putJson(key: string, value: unknown): Promise<void> {
    const body = serializeJson(value);
    const url = buildS3Url(this.input.endpoint, this.input.bucket, key);
    const headers = this.sign("PUT", url, body);
    const fetchFn = this.input.fetchFn ?? fetch;
    const response = await fetchFn(url, {
      method: "PUT",
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(`Artifact upload failed for ${key}: ${response.status} ${await response.text()}`);
    }
  }

  private sign(method: string, url: string, body: string): Record<string, string> {
    const parsed = new URL(url);
    const now = this.input.now?.() ?? new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(body);
    const credentialScope = `${dateStamp}/${this.input.region}/s3/aws4_request`;
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      host: parsed.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((header) => `${header}:${headers[header]}\n`)
      .join("");
    const canonicalRequest = [
      method,
      encodeCanonicalPath(parsed.pathname),
      parsed.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");
    const signature = hmacHex(signingKey(this.input.secretAccessKey, dateStamp, this.input.region), stringToSign);

    return {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${this.input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
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

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function buildS3Url(endpoint: string, bucket: string, key: string): string {
  const base = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return `${base}/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function encodeCanonicalPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) =>
      encodeURIComponent(decodeURIComponent(segment)).replace(/[!'()*]/g, (c) =>
        `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}
