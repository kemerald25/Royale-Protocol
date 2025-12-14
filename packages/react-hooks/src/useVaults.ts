import { useState, useEffect, useCallback } from "react";
import { RoyaleProtocol } from "@royale-protocol/sdk";
import { Vault } from "@royale-protocol/sdk";

export interface UseVaultsOptions {
  protocol: RoyaleProtocol | null;
  address: string | null;
  type: "owner" | "beneficiary";
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseVaultsReturn {
  vaults: Vault[];
  vaultIds: bigint[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage multiple vaults for an address
 */
export function useVaults(options: UseVaultsOptions): UseVaultsReturn {
  const {
    protocol,
    address,
    type,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [vaultIds, setVaultIds] = useState<bigint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVaults = useCallback(async () => {
    if (!protocol || !address) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ids =
        type === "owner"
          ? await protocol.getOwnerVaults(address)
          : await protocol.getBeneficiaryVaults(address);

      setVaultIds(ids);

      // Fetch full vault data for each ID
      const vaultPromises = ids.map((id: bigint) => protocol.getVault(id));
      const vaultData = await Promise.all(vaultPromises);

      setVaults(vaultData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch vaults"));
    } finally {
      setLoading(false);
    }
  }, [protocol, address, type]);

  useEffect(() => {
    fetchVaults();

    if (autoRefresh) {
      const interval = setInterval(fetchVaults, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchVaults, autoRefresh, refreshInterval]);

  return {
    vaults,
    vaultIds,
    loading,
    error,
    refresh: fetchVaults,
  };
}

