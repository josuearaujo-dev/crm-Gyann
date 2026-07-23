import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY

  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "META_TOKEN_ENCRYPTION_KEY não configurada. Defina uma chave com pelo menos 16 caracteres nas variáveis de ambiente.",
    )
  }

  return scryptSync(secret, "whatsapp-token-salt", 32)
}

export function isTokenEncryptionConfigured(): boolean {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY
  return !!secret && secret.trim().length >= 16
}

/**
 * Encrypts a token for storage. Format: iv:authTag:ciphertext (hex).
 */
export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptSecret(encryptedPayload: string): string {
  const key = getEncryptionKey()
  const parts = encryptedPayload.split(":")

  if (parts.length !== 3) {
    throw new Error("Formato de token criptografado inválido")
  }

  const [ivHex, authTagHex, cipherHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const ciphertext = Buffer.from(cipherHex, "hex")

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Token criptografado corrompido")
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

/**
 * Resolves a usable access token from either encrypted or legacy plaintext storage.
 */
export function resolveAccessToken(row: {
  access_token?: string | null
  access_token_encrypted?: string | null
}): string {
  if (row.access_token_encrypted) {
    try {
      return decryptSecret(row.access_token_encrypted)
    } catch (error) {
      console.error("[crypto] Failed to decrypt WhatsApp token:", error)
      throw new Error("Não foi possível descriptografar o token do WhatsApp")
    }
  }

  const plain = String(row.access_token || "").trim()
  if (!plain) {
    throw new Error("Token do WhatsApp não configurado")
  }

  return plain
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) return "••••"
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}
