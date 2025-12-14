import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Signer } from "ethers";
import { RoyaleProtocol } from "@royale-protocol/sdk";

export interface UseRoyaleProtocolOptions {
  contractAddress: string;
  rpcUrl: string;
  ipfsGatewayUrl?: string;
}

export interface UseRoyaleProtocolReturn {
  protocol: RoyaleProtocol | null;
  signer: Signer | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: Error | null;
}

/**
 * Hook to initialize and manage Royale Protocol SDK
 */
export function useRoyaleProtocol(
  options: UseRoyaleProtocolOptions
): UseRoyaleProtocolReturn {
  const [protocol, setProtocol] = useState<RoyaleProtocol | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const rp = new RoyaleProtocol(
          options.contractAddress,
          options.rpcUrl,
          options.ipfsGatewayUrl
        );
        await rp.initializeIPFS();
        setProtocol(rp);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to initialize protocol"));
      }
    };

    init();
  }, [options.contractAddress, options.rpcUrl, options.ipfsGatewayUrl]);

  const connect = useCallback(async () => {
    if (!protocol) {
      setError(new Error("Protocol not initialized"));
      return;
    }

    try {
      if (typeof window !== "undefined" && window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        await protocol.connectSigner(signer);
        setSigner(signer);
        setIsConnected(true);
        setError(null);
      } else {
        throw new Error("Ethereum provider not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to connect wallet"));
      setIsConnected(false);
    }
  }, [protocol]);

  const disconnect = useCallback(() => {
    setSigner(null);
    setIsConnected(false);
  }, []);

  return {
    protocol,
    signer,
    isConnected,
    connect,
    disconnect,
    error,
  };
}

