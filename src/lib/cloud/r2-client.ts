// Lazy-load @aws-sdk/client-s3 — only imported when cloud is actually used
let _client: any = null;
let _sdk: any = null;

async function getSdk() {
  if (_sdk) return _sdk;
  _sdk = await import("@aws-sdk/client-s3");
  return _sdk;
}

async function getClient() {
  if (_client) return _client;

  const endpoint = process.env.CLOUD_ENDPOINT;
  const accessKeyId = process.env.CLOUD_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUD_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "CLOUD_ENDPOINT, CLOUD_ACCESS_KEY_ID y CLOUD_SECRET_ACCESS_KEY son requeridos",
    );
  }

  const { S3Client } = await getSdk();
  _client = new S3Client({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return _client;
}

function getBucket(): string {
  const bucket = process.env.CLOUD_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUD_BUCKET_NAME es requerido");
  return bucket;
}

export function isCloudConfigured(): boolean {
  return !!(
    process.env.CLOUD_ENDPOINT &&
    process.env.CLOUD_ACCESS_KEY_ID &&
    process.env.CLOUD_SECRET_ACCESS_KEY &&
    process.env.CLOUD_BUCKET_NAME
  );
}

export interface CloudMetadata {
  [key: string]: string;
}

export async function uploadToCloud(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "video/mp4",
  metadata?: CloudMetadata,
): Promise<{ key: string; bucket: string }> {
  const client = await getClient();
  const bucket = getBucket();
  const { PutObjectCommand } = await getSdk();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );

  return { key, bucket };
}

export async function getCloudObject(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const client = await getClient();
  const bucket = getBucket();
  const { GetObjectCommand } = await getSdk();

  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const stream = res.Body;
    if (!stream) return null;
    const chunks: Uint8Array[] = [];
    const reader = stream.transformToWebStream().getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    return {
      body: Buffer.concat(chunks),
      contentType: res.ContentType || "video/mp4",
    };
  } catch {
    return null;
  }
}

export async function deleteFromCloud(key: string): Promise<void> {
  const client = await getClient();
  const bucket = getBucket();
  const { DeleteObjectCommand } = await getSdk();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
}

export async function headCloudObject(
  key: string,
): Promise<{ exists: boolean; size?: number; metadata?: Record<string, string> }> {
  const client = await getClient();
  const bucket = getBucket();
  const { HeadObjectCommand } = await getSdk();

  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      exists: true,
      size: res.ContentLength ?? undefined,
      metadata: (res.Metadata as Record<string, string>) ?? undefined,
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "name" in err &&
      (err.name === "NotFound" || err.name === "NoSuchKey")
    ) {
      return { exists: false };
    }
    throw err;
  }
}
