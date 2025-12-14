// Dynamic import for ipfs-http-client to handle ESM/CJS compatibility
type IPFSClientInstance = {
  add: (data: Buffer) => Promise<{ cid: { toString: () => string } }>;
};

type IPFSClientModule = {
  create: (options: { url: string }) => IPFSClientInstance;
} | null;

let ipfsClientModule: IPFSClientModule = null;
try {
  // Dynamic require for optional dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  ipfsClientModule = require("ipfs-http-client") as IPFSClientModule;
} catch (e) {
  // Fallback if module not available
  ipfsClientModule = null;
}

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
   * @param ipfsUrl IPFS node URL (default: public IPFS gateway)
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

    if (!ipfsClientModule) {
      if (pinataApiKey && pinataSecretKey) {
        console.log("Using Pinata API for IPFS uploads");
      } else {
        console.warn("ipfs-http-client not available, using gateway only");
      }
      this.client = null;
      return;
    }
    
    try {
      if (ipfsClientModule) {
        const { create } = ipfsClientModule;
        this.client = create({
          url: ipfsUrl || "https://ipfs.infura.io:5001/api/v0",
        });
      }
    } catch (error) {
      console.warn("Failed to initialize IPFS client, using gateway only:", error);
      this.client = null;
    }
  }

  /**
   * Upload data to IPFS
   * @param data Data to upload (string or Buffer)
   * @returns IPFS CID
   */
  async upload(data: string | Buffer): Promise<string> {
    const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const dataString = dataBuffer.toString("hex");

    // If Pinata credentials are set, use Pinata API directly
    if (this.pinataApiKey && this.pinataSecretKey) {
      const cid = await this.uploadToPinata(dataBuffer, this.pinataApiKey, this.pinataSecretKey);
      // Also store locally for retrieval during testing
      this.localStorage.set(cid, dataString);
      return cid;
    }

    // Try to use IPFS client if available
    if (this.client && typeof this.client.add === "function") {
      try {
        const result = await this.client.add(dataBuffer);
        return result.cid.toString();
      } catch (error) {
        console.warn("IPFS client upload failed, falling back to local storage:", error);
      }
    }

    // Fallback: generate a mock CID for testing and store locally
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const crypto = require("crypto") as typeof import("crypto");
    const hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
    // Return a mock CID (Qm prefix + hash)
    const cid = `Qm${hash.substring(0, 44)}`;
    // Store data locally for retrieval during testing
    this.localStorage.set(cid, dataString);
    console.warn(
      "Using local storage for IPFS. For production, provide Pinata credentials or configure IPFS client."
    );
    return cid;
  }

  /**
   * Upload data using Pinata (if configured)
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

    const formData = new FormData();
    // Convert Buffer to Uint8Array for Blob compatibility
    const uint8Array = new Uint8Array(dataBuffer);
    const blob = new Blob([uint8Array]);
    formData.append("file", blob);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.statusText}`);
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

