import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createConnection } from 'node:net';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { sql, transaction } from './db';
import { requireAccess } from './access';
import { DomainError } from './domain';
import { enqueueJob } from './jobs';

export type PrivateFile = {
  id: string;
  organisation_id: string;
  engagement_id: string | null;
  object_key: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  status: string;
  provider: string;
  uploaded_by: string;
  scan_error?: string | null;
};
const maxSize = 25 * 1024 * 1024;
const provider = () => process.env.FILE_STORAGE_PROVIDER ?? 'local';
const root = () => {
  const path = resolve(
    /* turbopackIgnore: true */ process.env.FILE_STORAGE_PATH ?? '.data/private-files',
  );
  const publicDirectory = resolve(process.cwd(), 'public');
  const rel = relative(publicDirectory, path);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel)))
    throw new Error('Private storage must be outside the public directory.');
  return path;
};
function localPath(key: string) {
  const base = root(),
    target = resolve(/* turbopackIgnore: true */ base, key),
    rel = relative(base, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid private object path.');
  return target;
}
const s3 = () =>
  new S3Client({
    region: process.env.S3_REGION ?? process.env.AWS_REGION ?? 'eu-west-2',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
export function inspectUpload(name: string, mime: string, buffer: Buffer) {
  if (!buffer.length || buffer.length > maxSize)
    throw new DomainError('Files must be between 1 byte and 25 MB.');
  const ext = name.toLowerCase().split('.').pop() ?? '';
  let type = '';
  if (ext === 'pdf' && buffer.subarray(0, 5).toString() === '%PDF-') type = 'application/pdf';
  else if (
    ext === 'png' &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    type = 'image/png';
  else if (
    ['jpg', 'jpeg'].includes(ext) &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  )
    type = 'image/jpeg';
  else if (
    ['txt', 'csv', 'json', 'md', 'log', 'yaml', 'yml', 'tf', 'diff', 'patch'].includes(ext) &&
    !buffer.includes(0)
  ) {
    type = ext === 'csv' ? 'text/csv' : ext === 'json' ? 'application/json' : 'text/plain';
    if (ext === 'json') {
      try {
        JSON.parse(buffer.toString('utf8'));
      } catch {
        throw new DomainError('The JSON document is invalid.');
      }
    }
  }
  if (!type)
    throw new DomainError(
      'Allowed files: PDF, PNG, JPEG, CSV, JSON, and plain-text engineering evidence. The extension must match the content.',
    );
  if (
    mime &&
    mime !== 'application/octet-stream' &&
    ![
      'text/plain',
      'application/json',
      'text/csv',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/x-yaml',
      'text/yaml',
    ].includes(mime)
  )
    throw new DomainError('This content type is not accepted.');
  if (
    /(?:AKIA|ASIA)[A-Z0-9]{16}|aws_secret_access_key\s*[=:]\s*[A-Za-z0-9/+]{20,}/.test(
      buffer.toString('utf8'),
    )
  )
    throw new DomainError(
      'The document appears to contain AWS credentials. Remove secrets before uploading.',
    );
  return type;
}
async function putObject(key: string, buffer: Buffer, mime: string, storageProvider: string) {
  if (storageProvider === 's3') {
    if (!process.env.S3_BUCKET)
      throw new DomainError('Private storage has not been configured.', 503);
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mime,
        ServerSideEncryption: process.env.S3_KMS_KEY_ID ? 'aws:kms' : 'AES256',
        SSEKMSKeyId: process.env.S3_KMS_KEY_ID || undefined,
      }),
    );
  } else if (storageProvider === 'local') {
    const path = localPath(key),
      directory = resolve(/* turbopackIgnore: true */ path, '..');
    await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
    await writeFile(/* turbopackIgnore: true */ path, buffer, { flag: 'wx', mode: 0o600 });
  } else throw new Error('Unsupported private storage provider.');
}
export async function readObject(file: PrivateFile) {
  if (file.provider === 's3') {
    const response = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: file.object_key }),
    );
    return Buffer.from(await response.Body!.transformToByteArray());
  }
  const path = localPath(file.object_key);
  return readFile(/* turbopackIgnore: true */ path);
}
export async function removeObject(file: PrivateFile) {
  if (file.provider === 's3')
    await s3().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: file.object_key }),
    );
  else {
    const path = localPath(file.object_key);
    await unlink(/* turbopackIgnore: true */ path).catch(() => {});
  }
}
export async function scanBuffer(buffer: Buffer): Promise<{ clean: boolean; detail: string }> {
  const host = process.env.CLAMAV_HOST;
  if (!host)
    throw new DomainError('Malware scanning is not configured. The file remains quarantined.', 503);
  return new Promise((resolveResult, reject) => {
    const socket = createConnection({ host, port: Number(process.env.CLAMAV_PORT ?? 3310) });
    let result = '';
    socket.setTimeout(60000);
    socket.on('connect', () => {
      socket.write(Buffer.from('zINSTREAM\0'));
      for (let offset = 0; offset < buffer.length; offset += 65536) {
        const chunk = buffer.subarray(offset, offset + 65536),
          length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => {
      result += chunk.toString();
      if (result.includes('\0')) socket.end();
    });
    socket.on('timeout', () => socket.destroy(new Error('Malware scanner timed out.')));
    socket.on('error', reject);
    socket.on('end', () => {
      if (result.includes('FOUND'))
        resolveResult({ clean: false, detail: result.replace(/\0/g, '').slice(0, 500) });
      else if (/: OK\0/.test(result))
        resolveResult({ clean: true, detail: 'ClamAV INSTREAM scan passed.' });
      else reject(new Error('Malware scanner did not return a conclusive result.'));
    });
  });
}
export async function scanFile(fileId: string) {
  const file = (await sql<PrivateFile>('SELECT * FROM files WHERE id=$1', [fileId]))[0];
  if (!file || file.status === 'rejected') return;
  if (file.status === 'clean') return;
  try {
    const buffer = await readObject(file);
    if (createHash('sha256').update(buffer).digest('hex') !== file.sha256)
      throw new Error('Stored file checksum mismatch.');
    const result = await scanBuffer(buffer);
    await sql('UPDATE files SET status=$1,scan_error=$2 WHERE id=$3', [
      result.clean ? 'clean' : 'rejected',
      result.detail,
      file.id,
    ]);
    if (!result.clean) await removeObject(file);
  } catch (e) {
    await sql("UPDATE files SET status='quarantined',scan_error=$1 WHERE id=$2", [
      e instanceof Error ? e.message : 'Scan failed.',
      file.id,
    ]);
    throw e;
  }
}
export async function uploadFile(request: Request) {
  const form = await request.formData(),
    org = String(form.get('organisationId') ?? ''),
    engagementId = String(form.get('engagementId') ?? '') || null;
  const access = await requireAccess(request, { organisationId: org });
  if (!access.isStaff && !['owner', 'approver', 'member'].includes(access.organisationRole ?? ''))
    throw new DomainError('Only company owners or approvers can upload engagement files.', 403);
  const file = form.get('file');
  if (!(file instanceof File)) throw new DomainError('Choose a file to upload.');
  if (file.size > maxSize) throw new DomainError('The maximum file size is 25 MB.', 413);
  const buffer = Buffer.from(await file.arrayBuffer()),
    filename = file.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200),
    mime = inspectUpload(filename, file.type, buffer);
  if (
    engagementId &&
    !(
      await sql('SELECT id FROM engagements WHERE id=$1 AND organisation_id=$2', [
        engagementId,
        org,
      ])
    ).length
  )
    throw new DomainError('Engagement not found.', 404);
  const id = randomUUID(),
    key = `${org}/${id}`,
    storageProvider = provider();
  await putObject(key, buffer, mime, storageProvider);
  try {
    await transaction(async (c) => {
      await c.query(
        'INSERT INTO files(id,organisation_id,engagement_id,object_key,filename,mime,size,sha256,provider,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          id,
          org,
          engagementId,
          key,
          filename,
          mime,
          buffer.length,
          createHash('sha256').update(buffer).digest('hex'),
          storageProvider,
          access.user.id,
        ],
      );
      await c.query(
        "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,'file.uploaded',$4,$5)",
        [
          randomUUID(),
          org,
          access.user.id,
          id,
          JSON.stringify({ filename, size: buffer.length, status: 'quarantined' }),
        ],
      );
    });
  } catch (e) {
    await removeObject({ object_key: key, provider: storageProvider } as PrivateFile);
    throw e;
  }
  await enqueueJob('file-scan', { fileId: id });
  return {
    file: {
      id,
      filename,
      status: 'quarantined',
      note: 'The file is private and unavailable for download until malware scanning passes.',
    },
  };
}
export async function downloadFile(request: Request, id: string) {
  const file = (await sql<PrivateFile>('SELECT * FROM files WHERE id=$1', [id]))[0];
  if (!file) throw new DomainError('File not found.', 404);
  const access = await requireAccess(request, { organisationId: file.organisation_id });
  if (file.status !== 'clean')
    throw new DomainError('This file is quarantined or rejected and cannot be downloaded.', 409);
  if (!access.isStaff && file.uploaded_by !== access.user.id) {
    const published = (
      await sql(
        "SELECT id FROM records WHERE organisation_id=$1 AND kind='deliverable' AND status='published' AND data->>'fileId'=$2 AND COALESCE(data->>'visibility','customer')!='internal'",
        [file.organisation_id, file.id],
      )
    ).length;
    if (!published)
      throw new DomainError('This document has not been published to your company.', 403);
  }
  const buffer = await readObject(file);
  await sql(
    "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id) VALUES($1,$2,$3,'file.downloaded',$4)",
    [randomUUID(), file.organisation_id, access.user.id, file.id],
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `attachment; filename="${file.filename.replace(/["\r\n]/g, '_')}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  });
}
