import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const endpoint = process.env.CLOUD_ENDPOINT;
  const accessKeyId = process.env.CLOUD_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUD_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "CLOUD_ENDPOINT, CLOUD_ACCESS_KEY_ID y CLOUD_SECRET_ACCESS_KEY son requeridos",
    );
  }

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

export async function uploadToCloud(
  key: string,
  body: Buffer | Uint8Array,
  contentType = "video/mp4",
): Promise<{ key: string; bucket: string }> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, bucket };
}

export async function getCloudObject(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const client = getClient();
  const bucket = getBucket();

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
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
}

export async function headCloudObject(
  key: string,
): Promise<{ exists: boolean; size?: number }> {
  const client = getClient();
  const bucket = getBucket();

  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return { exists: true, size: res.ContentLength ?? undefined };
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
