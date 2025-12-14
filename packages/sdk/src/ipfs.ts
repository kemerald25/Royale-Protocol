import { create, IPFSHTTPClient } from "ipfs-http-client";

/**
 * IPFS client wrapper
 */
export class IPFSClient {
  private client: IPFSHTTPClient | null = null;
  private gatewayUrl: string;

  constructor(gatewayUrl: string = "https://ipfs.io/ipfs/") {
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Initialize IPFS client
   * @param ipfsUrl IPFS node URL (default: public IPFS gateway)
   */
  async initialize(ipfsUrl?: string): Promise<void> {
    try {
      this.client = create({
        url: ipfsUrl || "https://ipfs.infura.io:5001/api/v0",
      });
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
    if (!this.client) {
      throw new Error("IPFS client not initialized. Call initialize() first.");
    }

    const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const result = await this.client.add(dataBuffer);
    return result.cid.toString();
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
    const url = `${this.gatewayUrl}${cid}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to retrieve from IPFS: ${response.statusText}`);
    }

    return await response.text();
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

