// @ts-ignore - secrets.js-grempe types may not be available
import * as secrets from "secrets.js-grempe";
import { SecretShares } from "./types";

// Buffer handling for browser and Node.js
const getBuffer = () => {
  if (typeof window !== "undefined") {
    // Browser environment - use polyfill
    try {
      return require("buffer").Buffer;
    } catch {
      // Fallback if buffer package not available
      return globalThis.Buffer || (global as any).Buffer;
    }
  } else {
    // Node.js environment - use native Buffer
    return global.Buffer;
  }
};

const Buffer = getBuffer();

/**
 * Encryption utilities using AES-256-GCM and Shamir Secret Sharing
 */

/**
 * Generate a random encryption key
 */
export function generateEncryptionKey(): string {
  const array = new Uint8Array(32);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else if (typeof global !== "undefined" && global.crypto) {
    global.crypto.getRandomValues(array);
  } else {
    // Fallback for Node.js
    const crypto = require("crypto");
    crypto.randomFillSync(array);
  }
  return Buffer.from(array).toString("hex");
}

/**
 * Encrypt data using AES-256-GCM
 * @param data Plaintext data to encrypt
 * @param key Encryption key (hex string)
 * @returns Encrypted data as hex string
 */
export async function encryptAES(data: string, key: string): Promise<string> {
  const keyBuffer = Buffer.from(key, "hex");
  const dataBuffer = Buffer.from(data, "utf8");

  // Generate random IV
  const iv = new Uint8Array(12);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(iv);
  } else if (typeof global !== "undefined" && global.crypto) {
    global.crypto.getRandomValues(iv);
  } else {
    const crypto = require("crypto");
    crypto.randomFillSync(iv);
  }

  // Use Web Crypto API if available (browser), otherwise use Node.js crypto
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    // Browser environment
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128,
      },
      cryptoKey,
      dataBuffer
    );

    const ivBuffer = Buffer.from(iv);
    const encryptedBuffer = Buffer.from(encrypted);
    const combined = Buffer.concat([ivBuffer, encryptedBuffer]);

    return combined.toString("hex");
  } else {
    // Node.js environment
    const crypto = require("crypto");
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
    let encrypted = cipher.update(dataBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    const ivBuffer = Buffer.from(iv);
    const combined = Buffer.concat([ivBuffer, encrypted, authTag]);

    return combined.toString("hex");
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData Encrypted data as hex string
 * @param key Decryption key (hex string)
 * @returns Decrypted plaintext
 */
export async function decryptAES(encryptedData: string, key: string): Promise<string> {
  const keyBuffer = Buffer.from(key, "hex");
  const combinedBuffer = Buffer.from(encryptedData, "hex");

  // Extract IV (first 12 bytes), encrypted data, and auth tag
  const iv = combinedBuffer.slice(0, 12);

  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    // Browser environment - extract encrypted data (rest after IV)
    const encrypted = combinedBuffer.slice(12);

    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128,
      },
      cryptoKey,
      encrypted
    );

    return Buffer.from(decrypted).toString("utf8");
  } else {
    // Node.js environment - last 16 bytes are auth tag
    const encrypted = combinedBuffer.slice(12, -16);
    const authTag = combinedBuffer.slice(-16);

    const crypto = require("crypto");
    const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  }
}

/**
 * Split a secret key into shares using Shamir Secret Sharing
 * @param secret Secret to split (hex string)
 * @param threshold Number of shares needed to reconstruct (default: 2)
 * @param totalShares Total number of shares to create (default: 3)
 * @returns Object containing the shares
 */
export function splitSecret(
  secret: string,
  threshold: number = 2,
  totalShares: number = 3
): SecretShares {
  // secrets.js expects hex string directly
  // Split the secret
  const shares = secrets.share(secret, totalShares, threshold);

  // Return shares
  return {
    beneficiaryShare: shares[0],
    timelockShare: shares[1],
    backupShare: shares[2],
  };
}

/**
 * Combine shares to reconstruct the secret
 * @param shares Array of share strings
 * @returns Reconstructed secret (hex string)
 */
export function combineShares(shares: string[]): string {
  if (shares.length < 2) {
    throw new Error("At least 2 shares are required");
  }

  // Combine shares - returns hex string
  const secretHex = secrets.combine(shares);

  return secretHex;
}

/**
 * Encrypt a share for a specific recipient using their public key
 * Note: This is a placeholder - in production, use proper ECIES encryption
 * @param share Share to encrypt
 * @param publicKey Recipient's public key (hex string)
 * @returns Encrypted share (hex string)
 */
export async function encryptShareForRecipient(
  share: string,
  publicKey: string
): Promise<string> {
  // TODO: Implement proper ECIES encryption with recipient's public key
  // For now, return the share as-is (in production, this must be encrypted)
  // This should use elliptic curve encryption (ECIES) with the beneficiary's public key
  return share;
}

/**
 * Decrypt a share encrypted for the recipient
 * @param encryptedShare Encrypted share
 * @param privateKey Recipient's private key (hex string)
 * @returns Decrypted share
 */
export async function decryptShareFromRecipient(
  encryptedShare: string,
  privateKey: string
): Promise<string> {
  // TODO: Implement proper ECIES decryption
  // For now, return as-is (in production, this must decrypt)
  return encryptedShare;
}
