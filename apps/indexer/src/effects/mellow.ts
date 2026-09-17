import { createEffect, S } from "envio";
import { getAddress } from "viem";
import { MELLOW_ABI } from "../snapshot/abis/mellow";
import { CHAIN_CONFIGS } from "../snapshot/chains";
import { getClient, retryRpc } from "../snapshot/rpc-client";

export const readMellowPosition = createEffect(
  {
    name: "readMellowPosition",
    input: { chainId: S.number, wallet: S.string, atBlock: S.number },
    output: S.schema({
      shares: S.string,
      priceD18: S.string,
      reportTimestamp: S.number,
      suspicious: S.boolean,
      maxAge: S.number,
      requests: S.array(
        S.schema({
          timestamp: S.number,
          shares: S.string,
          assets: S.string,
          isClaimable: S.boolean,
        }),
      ),
    }),
    cache: true,
    rateLimit: { calls: 1_000_000, per: "second" },
  },
  async ({ input }) => {
    const config = CHAIN_CONFIGS[input.chainId];
    const vault = config?.mellowVault;
    if (!vault || input.atBlock < vault.startBlock)
      throw new Error("Inactive Mellow configuration");
    const client = getClient(config);
    const blockNumber = BigInt(input.atBlock);
    const account = getAddress(input.wallet);
    const shares = await retryRpc(() =>
      client.readContract({
        address: getAddress(vault.shares),
        abi: MELLOW_ABI,
        functionName: "sharesOf",
        args: [account],
        blockNumber,
      }),
    );
    const requests: { timestamp: number; shares: string; assets: string; isClaimable: boolean }[] =
      [];
    // Enumerate every page; fail rather than silently truncate a pathological account.
    for (let offset = 0; ; offset += 100) {
      if (offset >= 100_000) throw new Error("Mellow request pagination limit exceeded");
      const page = await retryRpc(() =>
        client.readContract({
          address: getAddress(vault.redeemQueue),
          abi: MELLOW_ABI,
          functionName: "requestsOf",
          args: [account, BigInt(offset), 100n],
          blockNumber,
        }),
      );
      requests.push(
        ...page.map((r) => ({
          timestamp: Number(r.timestamp),
          shares: r.shares.toString(),
          assets: r.assets.toString(),
          isClaimable: r.isClaimable,
        })),
      );
      if (page.length < 100) break;
    }
    // An empty position needs no usable oracle report and cannot generate value.
    if (shares === 0n && requests.length === 0)
      return {
        shares: "0",
        priceD18: "0",
        reportTimestamp: 0,
        suspicious: false,
        maxAge: 0,
        requests,
      };
    const report = await retryRpc(() =>
      client.readContract({
        address: getAddress(vault.oracle),
        abi: MELLOW_ABI,
        functionName: "getReport",
        args: [getAddress(vault.asset)],
        blockNumber,
      }),
    );
    const params = await retryRpc(() =>
      client.readContract({
        address: getAddress(vault.depositQueue),
        abi: MELLOW_ABI,
        functionName: "syncDepositParams",
        blockNumber,
      }),
    );
    return {
      shares: shares.toString(),
      priceD18: report[0].toString(),
      reportTimestamp: report[1],
      suspicious: report[2],
      maxAge: params[1],
      requests,
    };
  },
);
