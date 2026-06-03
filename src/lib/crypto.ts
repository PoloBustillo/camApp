import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.ENCRYPTION_KEY ?? "";

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  return Buffer.from(KEY_HEX, "hex");
}

/**
 * Cifra un string con AES-256-GCM.
 * Formato de salida: base64(iv):base64(ciphertext):base64(authTag)
 * Usado para almacenar rutas/URLs que pueden contener credenciales.
 */
export function encryptPath(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV para GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

/**
 * Descifra un string almacenado con AES-256-GCM.
 */
export function decryptPath(encrypted: string): string {
  const key = getKey();
  const [ivB64, ciphertextB64, authTagB64] = encrypted.split(":");

  if (!ivB64 || !ciphertextB64 || !authTagB64) {
    throw new Error("Invalid encrypted path format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}

// Aliases para compatibilidad con código existente
export const encryptRtspUrl = encryptPath;
export const decryptRtspUrl = decryptPath;
