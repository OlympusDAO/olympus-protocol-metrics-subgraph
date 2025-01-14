import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { assert, describe, test } from "matchstick-as";

import { TokenRecord } from "../../shared/generated/schema";
import { createTokenRecord } from "../../shared/src/utils/TokenRecordHelper";
import { BUYBACK_MS } from "../../shared/src/Wallets";
import { getTreasuryLiquidBacking, getTreasuryMarketValue } from "../src/protocolMetrics/TreasuryMetrics";
import { BLOCKCHAIN, ERC20_GOHM, ERC20_OHM_V2, ERC20_TOKENS } from "../src/utils/Constants";
import { TREASURY_ADDRESS_V3 } from "../src/utils/ProtocolAddresses";

const TIMESTAMP = BigInt.fromString("1");
const INCLUSION_BLOCK = BigInt.fromI32(20514801);

describe("Treasury Market Value", () => {
    test("includes OHM in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "20");
    });

    test("includes gOHM in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "20");
    });

    test("excludes OHM not in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "0");
    });

    test("excludes gOHM not in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "0");
    });

    test("excludes OHM in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "0");
    });

    test("excludes gOHM in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "0");
    });

    test("excludes OHM not in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "0");
    });

    test("excludes gOHM not in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const marketValue = getTreasuryMarketValue(records);

        assert.stringEquals(marketValue.toString(), "0");
    });
});

describe("Treasury Liquid Backing", () => {
    test("excludes OHM in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes gOHM in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes OHM not in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes gOHM not in the buyback MS after the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK,
                true,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes OHM in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes gOHM in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Buyback MS",
                BUYBACK_MS,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes OHM not in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "OHM V2",
                ERC20_OHM_V2,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });

    test("excludes gOHM not in the buyback MS before the inclusion block", () => {
        const records: TokenRecord[] = [
            createTokenRecord(
                TIMESTAMP,
                "gOHM",
                ERC20_GOHM,
                "Treasury",
                TREASURY_ADDRESS_V3,
                BigDecimal.fromString("2"),
                BigDecimal.fromString("10"),
                INCLUSION_BLOCK.minus(BigInt.fromI32(1)),
                false,
                ERC20_TOKENS,
                BLOCKCHAIN,
            )
        ];

        const liquidBacking = getTreasuryLiquidBacking(records);

        assert.stringEquals(liquidBacking.toString(), "0");
    });
})
