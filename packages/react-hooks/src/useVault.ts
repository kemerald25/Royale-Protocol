import { useState, useEffect, useCallback } from "react";
import { RoyaleProtocol } from "@royale-protocol/sdk";
import { Vault, VaultStatusInfo } from "@royale-protocol/sdk";

export interface UseVaultOptions {
  protocol: RoyaleProtocol | null;
  vaultId: bigint | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseVaultReturn {
  vault: Vault | null;
  status: VaultStatusInfo | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  checkIn: () => Promise<void>;
  triggerRecovery: () => Promise<void>;
  claimInheritance: (beneficiaryShare: string) => Promise<string>;
  cancelVault: () => Promise<void>;
}

/**
 * Hook to manage a single vault
 */
export function useVault(options: UseVaultOptions): UseVaultReturn {
  const { protocol, vaultId, autoRefresh = false, refreshInterval = 30000 } = options;

  const [vault, setVault] = useState<Vault | null>(null);
  const [status, setStatus] = useState<VaultStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVault = useCallback(async () => {
    if (!protocol || vaultId === null) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [vaultData, statusData] = await Promise.all([
        protocol.getVault(vaultId),
        protocol.getVaultStatus(vaultId),
      ]);

      setVault(vaultData);
      setStatus(statusData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch vault"));
    } finally {
      setLoading(false);
    }
  }, [protocol, vaultId]);

  useEffect(() => {
    fetchVault();

    if (autoRefresh) {
      const interval = setInterval(fetchVault, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchVault, autoRefresh, refreshInterval]);

  const checkIn = useCallback(async () => {
    if (!protocol || vaultId === null) {
      throw new Error("Protocol or vault ID not available");
    }

    try {
      await protocol.checkIn(vaultId);
      await fetchVault();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to check in");
    }
  }, [protocol, vaultId, fetchVault]);

  const triggerRecovery = useCallback(async () => {
    if (!protocol || vaultId === null) {
      throw new Error("Protocol or vault ID not available");
    }

    try {
      await protocol.triggerRecovery(vaultId);
      await fetchVault();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to trigger recovery");
    }
  }, [protocol, vaultId, fetchVault]);

  const claimInheritance = useCallback(
    async (beneficiaryShare: string) => {
      if (!protocol || vaultId === null) {
        throw new Error("Protocol or vault ID not available");
      }

      try {
        const secret = await protocol.claimInheritance(vaultId, beneficiaryShare);
        await fetchVault();
        return secret;
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to claim inheritance");
      }
    },
    [protocol, vaultId, fetchVault]
  );

  const cancelVault = useCallback(async () => {
    if (!protocol || vaultId === null) {
      throw new Error("Protocol or vault ID not available");
    }

    try {
      await protocol.cancelVault(vaultId);
      await fetchVault();
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to cancel vault");
    }
  }, [protocol, vaultId, fetchVault]);

  return {
    vault,
    status,
    loading,
    error,
    refresh: fetchVault,
    checkIn,
    triggerRecovery,
    claimInheritance,
    cancelVault,
  };
}

