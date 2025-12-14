// IPFS client types (ipfs-http-client is ESM-only and doesn't work with webpack/Next.js)
// We'll use Pinata API or gateway-only approach for browser environments
type IPFSClientInstance = {
  add: (data: Buffer) => Promise<{ cid: { toString: () => string } }>;
};

type IPFSClientModule = {
  create: (options: { url: string }) => IPFSClientInstance;
} | null;

/**
 * IPFS client wrapper
 */
export class IPFSClient {
  private client: IPFSClientInstance | null = null;
  private gatewayUrl: string;
  private localStorage: Map<string, string> = new Map(); // For testing - store data locally
  private pinataApiKey?: string;
  private pinataSecretKey?: string;

  constructor(gatewayUrl: string = "https://red-famous-peafowl-148.mypinata.cloud/ipfs/") {
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Initialize IPFS client
   * @param ipfsUrl IPFS node URL (default: public IPFS gateway) - Only used in Node.js
   * @param pinataApiKey Optional Pinata API key
   * @param pinataSecretKey Optional Pinata secret key
   */
  async initialize(
    ipfsUrl?: string,
    pinataApiKey?: string,
    pinataSecretKey?: string
  ): Promise<void> {
    this.pinataApiKey = pinataApiKey;
    this.pinataSecretKey = pinataSecretKey;

    // Skip ipfs-http-client entirely to avoid webpack bundling issues
    // Pinata API works in both browser and Node.js, so we use that instead
    // ipfs-http-client is ESM-only and breaks webpack/Next.js bundlers

    // Default: Use Pinata API if credentials provided, otherwise gateway-only mode
    // Gateway-only mode works for reads, uploads will use local fallback
    this.client = null;
  }

  /**
   * Upload data to IPFS
   * @param data Data to upload (string or Buffer)
   * @returns IPFS CID
   */
  async upload(data: string | Buffer): Promise<string> {
    const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const dataString = dataBuffer.toString("hex");

    // Priority 1: Use Pinata API if credentials are set (works in browser and Node.js)
    if (this.pinataApiKey && this.pinataSecretKey) {
      try {
        const cid = await this.uploadToPinata(dataBuffer, this.pinataApiKey, this.pinataSecretKey);
        // Store locally for immediate retrieval
        this.localStorage.set(cid, dataString);
        return cid;
      } catch (error) {
        console.warn("Pinata upload failed, falling back:", error);
      }
    }

    // Note: ipfs-http-client removed to avoid webpack bundling issues
    // Use Pinata API for production uploads

    // Priority 3: Fallback - generate a deterministic CID and store locally
    // This allows testing without IPFS infrastructure
    const isNode = typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node;
    let hash: string;
    
    if (isNode) {
      // Node.js: use crypto module
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const crypto = require("crypto") as typeof import("crypto");
      hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
    } else {
      // Browser: use Web Crypto API
      // Convert Buffer to Uint8Array for Web Crypto API
      const uint8Array = new Uint8Array(dataBuffer);
      const hashBuffer = await crypto.subtle.digest("SHA-256", uint8Array);
      hash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }
    
    // Generate a mock CID (Qm prefix + hash) for local testing
    const cid = `Qm${hash.substring(0, 44)}`;
    // Store data locally for retrieval
    this.localStorage.set(cid, dataString);
    
    // Only warn in development
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "IPFS upload: Using local storage fallback. For production, provide Pinata credentials."
      );
    }
    
    return cid;
  }

  /**
   * Upload data using Pinata API (works in browser and Node.js)
   * @param data Data to upload
   * @param pinataApiKey Pinata API key
   * @param pinataSecretKey Pinata secret key
   * @returns IPFS CID
   */
  async uploadToPinata(
    data: string | Buffer,
    pinataApiKey: string,
    pinataSecretKey: string
  ): Promise<string> {
    const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;

    // Handle FormData differently for Node.js vs Browser
    const isNode = typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node;
    
    let formData: any;
    if (isNode) {
      // Node.js: use form-data package
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const FormDataNode = require("form-data");
      formData = new FormDataNode();
      formData.append("file", dataBuffer, { filename: "data.json" });
    } else {
      // Browser: use native FormData
      formData = new FormData();
      const uint8Array = new Uint8Array(dataBuffer);
      const blob = new Blob([uint8Array]);
      formData.append("file", blob);
    }

    const headers: Record<string, string> = {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretKey,
    };

    // Add Content-Type for Node.js form-data
    if (isNode && (formData as any).getHeaders) {
      Object.assign(headers, (formData as any).getHeaders());
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers,
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as { IpfsHash: string };
    return result.IpfsHash;
  }

  /**
   * Retrieve data from IPFS
   * @param cid IPFS CID
   * @returns Data as string
   */
  async retrieve(cid: string): Promise<string> {
    // Check local storage first (for testing and Pinata uploads)
    if (this.localStorage.has(cid)) {
      const hexData = this.localStorage.get(cid)!;
      return Buffer.from(hexData, "hex").toString("utf8");
    }

    // Try to retrieve from IPFS gateway
    const url = `${this.gatewayUrl}${cid}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.text();
        // Cache it locally for future retrievals
        const dataBuffer = Buffer.from(data, "utf8");
        this.localStorage.set(cid, dataBuffer.toString("hex"));
        return data;
      } else {
        console.warn(`IPFS gateway returned status ${response.status} for CID ${cid}`);
      }
    } catch (error) {
      console.warn(`IPFS gateway failed for ${cid}:`, error);
    }

    // If we have Pinata credentials, try to retrieve via Pinata gateway with longer timeout
    if (this.pinataApiKey && this.pinataSecretKey) {
      // Pinata files might need a moment to propagate, try with a delay
      console.log(`Attempting to retrieve from Pinata gateway: ${cid}`);
      try {
        // Try the Pinata dedicated gateway
        const pinataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        const response = await fetch(pinataUrl, {
          method: "GET",
          headers: {
            Accept: "text/plain",
          },
        });
        if (response.ok) {
          const data = await response.text();
          // Cache it locally
          const dataBuffer = Buffer.from(data, "utf8");
          this.localStorage.set(cid, dataBuffer.toString("hex"));
          return data;
        }
      } catch (error) {
        console.warn(`Pinata gateway also failed for ${cid}:`, error);
      }
    }

    throw new Error(`Failed to retrieve from IPFS: CID ${cid} not found`);
  }

  /**
   * Get IPFS gateway URL for a CID
   * @param cid IPFS CID
   * @returns Full gateway URL
   */
  getGatewayUrl(cid: string): string {
    return `${this.gatewayUrl}${cid}`;
  }
}

