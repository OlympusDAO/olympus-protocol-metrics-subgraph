import { Address, BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeEach, clearStore, createMockedFunction, describe, log, test } from "matchstick-as";

import { TokenSupply } from "../../shared/generated/schema";
import { toBigInt } from "../../shared/src/utils/Decimals";
import { TYPE_BONDS_DEPOSITS, TYPE_BONDS_PREMINTED, TYPE_BONDS_VESTING_DEPOSITS, TYPE_BONDS_VESTING_TOKENS, TYPE_LENDING } from "../../shared/src/utils/TokenSupplyHelper";
import { OLYMPUS_ASSOCIATION_WALLET } from "../../shared/src/Wallets";
import { GnosisAuction, GnosisAuctionRoot } from "../generated/schema";
import { GNOSIS_RECORD_ID } from "../src/GnosisAuction";
import { BOND_MANAGER, CIRCULATING_SUPPLY_WALLETS, ERC20_GOHM, ERC20_OHM_V2, ERC20_SOHM_V3, EULER_ADDRESS, SILO_ADDRESS } from "../src/utils/Constants";
import { getMintedBorrowableOHMRecords, getTreasuryOHMRecords, getVestingBondSupplyRecords } from "../src/utils/OhmCalculations";
import { mockClearinghouseRegistryAddressNull, mockTreasuryAddressNull } from "./bophadesHelper";
import { mockERC20Balance, mockERC20TotalSupply } from "./erc20Helper";
import { OHM_V2_DECIMALS } from "./pairHelper";

const CONTRACT_GNOSIS = "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101".toLowerCase();
const CONTRACT_TELLER = "0x007FE70dc9797C4198528aE43d8195ffF82Bdc95".toLowerCase();

function tokenSupplyRecordsToMap(records: TokenSupply[]): Map<string, TokenSupply> {
    const map = new Map<string, TokenSupply>();

    for (let i = 0; i < records.length; i++) {
        const record = records[i];

        if (record.sourceAddress === null) {
            continue;
        }

        map.set(record.sourceAddress!.toLowerCase(), record);
    }

    return map;
}

function getNonNullableString(value: string | null): string {
    if (value === null) {
        return "";
    }

    return value;
}

function mockContractBalances(gnosisBalance: BigDecimal = BigDecimal.fromString("0"), bondManagerBalance: BigDecimal = BigDecimal.fromString("0"), payoutCapacity: BigDecimal = BigDecimal.fromString("0")): void {
    // Holds user deposits
    createMockedFunction(Address.fromString(ERC20_OHM_V2), "balanceOf", "balanceOf(address):(uint256)").
        withArgs([ethereum.Value.fromAddress(Address.fromString(CONTRACT_GNOSIS))]).
        returns([
            ethereum.Value.fromUnsignedBigInt(toBigInt(gnosisBalance, 9)),
        ]);

    // Holds user deposits after auction closure
    createMockedFunction(Address.fromString(ERC20_OHM_V2), "balanceOf", "balanceOf(address):(uint256)").
        withArgs([ethereum.Value.fromAddress(Address.fromString(BOND_MANAGER))]).
        returns([
            ethereum.Value.fromUnsignedBigInt(toBigInt(bondManagerBalance, 9)),
        ]);

    // Holds minted OHM
    createMockedFunction(Address.fromString(ERC20_OHM_V2), "balanceOf", "balanceOf(address):(uint256)").
        withArgs([ethereum.Value.fromAddress(Address.fromString(CONTRACT_TELLER))]).
        returns([
            ethereum.Value.fromUnsignedBigInt(toBigInt(payoutCapacity, 9)),
        ]);
}

function mockCirculatingSupplyWallets(balance: BigInt): void {
    for (let i = 0; i < CIRCULATING_SUPPLY_WALLETS.length; i++) {
        mockERC20Balance(ERC20_OHM_V2, CIRCULATING_SUPPLY_WALLETS[i], balance);
        mockERC20Balance(ERC20_SOHM_V3, CIRCULATING_SUPPLY_WALLETS[i], balance);
        mockERC20Balance(ERC20_GOHM, CIRCULATING_SUPPLY_WALLETS[i], balance);
    }
}

function mockCurrentIndex(index: BigInt): void {
    createMockedFunction(Address.fromString(ERC20_SOHM_V3), "index", "index():(uint256)").returns([
        ethereum.Value.fromUnsignedBigInt(index)
    ]);
}

const AUCTION_ID = "1";
const PAYOUT_CAPACITY = BigDecimal.fromString("100000");
const BID_QUANTITY = BigDecimal.fromString("90330");
const BOND_TERM = BigInt.fromString("10");
const AUCTION_OPEN_TIMESTAMP = BigInt.fromString("800");

const TIMESTAMP = BigInt.fromString("1000");
const AUCTION_CLOSE_TIMESTAMP_PRE_EXPIRY = BigInt.fromString("999");
const AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY = BigInt.fromString("980");

const BLOCK_NUMBER = BigInt.fromString("18000000");

function setUpGnosisAuction(auctionId: string = AUCTION_ID, payoutCapacity: BigDecimal = PAYOUT_CAPACITY, termSeconds: BigInt = BOND_TERM, bidQuantity: BigDecimal | null = null, auctionCloseTimestamp: BigInt | null = null, auctionOpenTimestamp: BigInt = AUCTION_OPEN_TIMESTAMP): void {
    const record = new GnosisAuction(auctionId);
    record.payoutCapacity = payoutCapacity;
    record.termSeconds = termSeconds;
    record.auctionOpenTimestamp = auctionOpenTimestamp;

    if (bidQuantity) {
        record.bidQuantity = bidQuantity;
    }

    if (auctionCloseTimestamp) {
        record.auctionCloseTimestamp = auctionCloseTimestamp;
    }

    record.save();
}

function setGnosisAuctionMarkets(markets: string[]): void {
    const marketIds: BigInt[] = [];
    for (let i = 0; i < markets.length; i++) {
        marketIds.push(BigInt.fromString(markets[i]));
    }

    const record = new GnosisAuctionRoot(GNOSIS_RECORD_ID);
    record.markets = marketIds;
    record.save();
}

function mockContracts(): void {
    createMockedFunction(Address.fromString(BOND_MANAGER), "isActive", "isActive():(bool)").returns([
        ethereum.Value.fromBoolean(true)
    ]);

    // Access methods on bond manager
    createMockedFunction(Address.fromString(BOND_MANAGER), "gnosisEasyAuction", "gnosisEasyAuction():(address)").returns([
        ethereum.Value.fromAddress(Address.fromString(CONTRACT_GNOSIS))
    ]);

    createMockedFunction(Address.fromString(BOND_MANAGER), "fixedExpiryTeller", "fixedExpiryTeller():(address)").returns([
        ethereum.Value.fromAddress(Address.fromString(CONTRACT_TELLER))
    ]);
}

beforeEach(() => {
    log.debug("beforeEach: Clearing store", []);
    clearStore();

    // Do at the start, as it can be used by mock functions
    mockTreasuryAddressNull();
    mockClearinghouseRegistryAddressNull();

    mockERC20TotalSupply(ERC20_OHM_V2, OHM_V2_DECIMALS, toBigInt(BigDecimal.fromString("1000")));
});

describe("Vesting Bonds", () => {
    test("no auctions", () => {
        mockContracts();
        mockContractBalances();

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // No supply impact
        assert.i32Equals(records.length, 0);
    });

    test("open auction", () => {
        // Mock auction payoutCapacity (GnosisAuction)
        setUpGnosisAuction();
        setGnosisAuctionMarkets([AUCTION_ID]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BigDecimal.zero(), PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // supply decreased by payoutCapacity in teller
        const tellerRecord: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(tellerRecord.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecord.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecord.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecord.type, TYPE_BONDS_PREMINTED);

        // No supply impact from Gnosis contract

        assert.i32Equals(records.length, 1);
    });

    test("open auction with deposits", () => {
        // Mock auction payoutCapacity (GnosisAuction)
        setUpGnosisAuction();
        setGnosisAuctionMarkets([AUCTION_ID]);

        // Mock contract values for the BondManager and Gnosis deposit
        mockContracts();
        const gnosisBalance = BigDecimal.fromString("1000");
        mockContractBalances(gnosisBalance, BigDecimal.zero(), PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // supply decreased by payoutCapacity in teller
        const tellerRecord: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(tellerRecord.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecord.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecord.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecord.type, TYPE_BONDS_PREMINTED);

        // No supply impact from Gnosis contract

        assert.i32Equals(records.length, 1);
    });

    test("closed auction/before bond expiry/with balance in GnosisEasyAuction", () => {
        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_PRE_EXPIRY);
        setGnosisAuctionMarkets([AUCTION_ID]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BID_QUANTITY, BigDecimal.zero(), PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // supply decreased by payout capacity in bond teller due to vesting tokens
        const tellerRecord: TokenSupply = records[1];
        assert.stringEquals(getNonNullableString(tellerRecord.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecord.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecord.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecord.type, TYPE_BONDS_VESTING_TOKENS);

        // supply decreased by bid quantity in bond manager due to vesting user deposits
        const bondManagerRecord: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecord.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecord.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecord.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecord.type, TYPE_BONDS_VESTING_DEPOSITS);

        assert.i32Equals(records.length, 2);
    });

    test("closed auction/before bond expiry/with balance in BondManager", () => {
        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_PRE_EXPIRY);
        setGnosisAuctionMarkets([AUCTION_ID]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BID_QUANTITY, PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // supply decreased by payout capacity in bond teller due to vesting tokens
        const tellerRecord: TokenSupply = records[1];
        assert.stringEquals(getNonNullableString(tellerRecord.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecord.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecord.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecord.type, TYPE_BONDS_VESTING_TOKENS);

        // supply decreased by bid quantity in bond manager due to vesting user deposits
        const bondManagerRecord: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecord.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecord.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecord.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecord.type, TYPE_BONDS_VESTING_DEPOSITS);

        assert.i32Equals(records.length, 2);
    });

    test("closed auction/after bond expiry", () => {
        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY);
        setGnosisAuctionMarkets([AUCTION_ID]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BID_QUANTITY, PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // No effect on supply from the teller, as bond tokens are no longer vesting

        // supply decreased by bid quantity in bond manager due to burnable deposits
        const bondManagerRecord = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecord.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecord.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecord.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecord.type, TYPE_BONDS_DEPOSITS);

        assert.i32Equals(records.length, 1);
    });

    test("closed auction/after bond expiry/all burned", () => {
        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY);
        setGnosisAuctionMarkets([AUCTION_ID]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BigDecimal.zero(), PAYOUT_CAPACITY); // Bid capacity is burned

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // No effect on supply from the teller, as bond tokens are no longer vesting

        // No entries for the Bond Manager

        // Burnable deposits are burned, which offsets the "burnable" entries
        assert.i32Equals(records.length, 0);
    });

    test("closed auction/after bond expiry/all burned/multiple auctions", () => {
        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY);
        setUpGnosisAuction("2", PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY);
        setGnosisAuctionMarkets([AUCTION_ID, "2"]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BigDecimal.zero(), PAYOUT_CAPACITY); // All of the bid capacity is burned

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // No effect on supply from the teller, as bond tokens are no longer vesting

        // No entries for the Bond Manager

        // Burnable deposits are burned, which offsets the "burnable" entries
        assert.i32Equals(records.length, 0);
    });

    test("closed auction/after bond expiry/partial burned", () => {
        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY); // Will be burnable
        setUpGnosisAuction("2", PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY); // Will be burnable
        setGnosisAuctionMarkets([AUCTION_ID, "2"]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BID_QUANTITY, PAYOUT_CAPACITY); // Half of the bid capacity is burned

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        // Remaining payout capacity is split between the two
        const bondManagerRecord = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecord.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecord.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecord.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).times(BigDecimal.fromString("0.5")).toString());
        assert.stringEquals(bondManagerRecord.type, TYPE_BONDS_DEPOSITS);

        const bondManagerRecordTwo = records[1];
        assert.stringEquals(getNonNullableString(bondManagerRecordTwo.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecordTwo.pool), "2");
        assert.stringEquals(bondManagerRecordTwo.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).times(BigDecimal.fromString("0.5")).toString());
        assert.stringEquals(bondManagerRecordTwo.type, TYPE_BONDS_DEPOSITS);

        assert.i32Equals(records.length, 2);
    });

    test("closed auction/multiple auctions/mixed bond expiry", () => {
        const auctionTwoBidQuantity = BigDecimal.fromString("500");

        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_PRE_EXPIRY); // Will be vesting
        setUpGnosisAuction("2", PAYOUT_CAPACITY, BOND_TERM, auctionTwoBidQuantity, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY); // Will be burnable
        setGnosisAuctionMarkets([AUCTION_ID, "2"]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BID_QUANTITY.plus(auctionTwoBidQuantity), PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        const tellerRecordOne: TokenSupply = records[1];
        assert.stringEquals(getNonNullableString(tellerRecordOne.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecordOne.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecordOne.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecordOne.type, TYPE_BONDS_VESTING_TOKENS);

        // supply decreased by bid quantity in bond manager due to vesting user deposits
        const bondManagerRecordOne: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecordOne.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecordOne.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecordOne.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecordOne.type, TYPE_BONDS_VESTING_DEPOSITS);

        // Remaining payout capacity is burnable
        const bondManagerRecordTwo = records[2];
        assert.stringEquals(getNonNullableString(bondManagerRecordTwo.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecordTwo.pool), "2");
        assert.stringEquals(bondManagerRecordTwo.supplyBalance.toString(), auctionTwoBidQuantity.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecordTwo.type, TYPE_BONDS_DEPOSITS);

        assert.i32Equals(records.length, 3);
    });

    test("closed auction/multiple auctions/mixed bond expiry/partial burned", () => {
        const auctionTwoBidQuantity = BigDecimal.fromString("500");
        const remainingBidCapacity = auctionTwoBidQuantity.div(BigDecimal.fromString("2"));

        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_PRE_EXPIRY); // Will be vesting
        setUpGnosisAuction("2", PAYOUT_CAPACITY, BOND_TERM, auctionTwoBidQuantity, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY); // Will be burnable
        setGnosisAuctionMarkets([AUCTION_ID, "2"]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BID_QUANTITY.plus(remainingBidCapacity), PAYOUT_CAPACITY);

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        const tellerRecordOne: TokenSupply = records[1];
        assert.stringEquals(getNonNullableString(tellerRecordOne.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecordOne.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecordOne.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecordOne.type, TYPE_BONDS_VESTING_TOKENS);

        // supply decreased by bid quantity in bond manager due to vesting user deposits
        const bondManagerRecordOne: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecordOne.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecordOne.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecordOne.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecordOne.type, TYPE_BONDS_VESTING_DEPOSITS);

        // Remaining payout capacity is partially burned
        const bondManagerRecordTwo = records[2];
        assert.stringEquals(getNonNullableString(bondManagerRecordTwo.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecordTwo.pool), "2");
        assert.stringEquals(bondManagerRecordTwo.supplyBalance.toString(), remainingBidCapacity.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecordTwo.type, TYPE_BONDS_DEPOSITS);

        assert.i32Equals(records.length, 3);
    });

    test("closed auction/multiple auctions/mixed bond expiry/all burned", () => {
        const auctionTwoBidQuantity = BigDecimal.fromString("500");

        // Mock auction payoutCapacity and bidQuantity (GnosisAuction)
        setUpGnosisAuction(AUCTION_ID, PAYOUT_CAPACITY, BOND_TERM, BID_QUANTITY, AUCTION_CLOSE_TIMESTAMP_PRE_EXPIRY); // Will be vesting
        setUpGnosisAuction("2", PAYOUT_CAPACITY, BOND_TERM, auctionTwoBidQuantity, AUCTION_CLOSE_TIMESTAMP_POST_EXPIRY); // Will be burnable
        setGnosisAuctionMarkets([AUCTION_ID, "2"]);

        // Mock contract values for the BondManager
        mockContracts();
        mockContractBalances(BigDecimal.zero(), BID_QUANTITY, PAYOUT_CAPACITY); // Burnable OHM is burned

        const records = getVestingBondSupplyRecords(TIMESTAMP, BLOCK_NUMBER);

        const tellerRecordOne: TokenSupply = records[1];
        assert.stringEquals(getNonNullableString(tellerRecordOne.sourceAddress), CONTRACT_TELLER.toLowerCase());
        assert.stringEquals(getNonNullableString(tellerRecordOne.pool) || "", AUCTION_ID);
        assert.stringEquals(tellerRecordOne.supplyBalance.toString(), PAYOUT_CAPACITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(tellerRecordOne.type, TYPE_BONDS_VESTING_TOKENS);

        // supply decreased by bid quantity in bond manager due to vesting user deposits
        const bondManagerRecordOne: TokenSupply = records[0];
        assert.stringEquals(getNonNullableString(bondManagerRecordOne.sourceAddress), BOND_MANAGER.toLowerCase());
        assert.stringEquals(getNonNullableString(bondManagerRecordOne.pool), AUCTION_ID);
        assert.stringEquals(bondManagerRecordOne.supplyBalance.toString(), BID_QUANTITY.times(BigDecimal.fromString("-1")).toString());
        assert.stringEquals(bondManagerRecordOne.type, TYPE_BONDS_VESTING_DEPOSITS);

        // Remaining payout capacity is burned, no entry

        assert.i32Equals(records.length, 2);
    });
});

describe("Treasury OHM", () => {
    beforeEach(() => {
        mockCurrentIndex(BigInt.fromString("100"));
        mockCirculatingSupplyWallets(BigInt.fromString("0"));
        mockERC20Balance(ERC20_OHM_V2, OLYMPUS_ASSOCIATION_WALLET, BigInt.fromString("1000000000000000000"));
        mockERC20Balance(ERC20_SOHM_V3, OLYMPUS_ASSOCIATION_WALLET, BigInt.fromString("1000000000000000000"));
        mockERC20Balance(ERC20_GOHM, OLYMPUS_ASSOCIATION_WALLET, BigInt.fromString("1000000000000000000"));
        mockERC20TotalSupply(ERC20_SOHM_V3, 9, BigInt.fromString("1000000000000000000"));
        mockERC20TotalSupply(ERC20_GOHM, 18, BigInt.fromString("1000000000000000000"));
    });

    test("excludes bond teller", () => {
        mockContractBalances(BigDecimal.zero(), BigDecimal.zero(), BigDecimal.fromString("1"));

        const records = getTreasuryOHMRecords(TIMESTAMP, BigInt.fromString("13782590"));
        const recordsMap = tokenSupplyRecordsToMap(records);

        // No supply impact from teller
        assert.assertTrue(recordsMap.has(CONTRACT_TELLER) == false);
    });

    test("excludes bond manager", () => {
        mockContractBalances(BigDecimal.zero(), BigDecimal.fromString("1"), BigDecimal.zero());

        const records = getTreasuryOHMRecords(TIMESTAMP, BigInt.fromString("13782590"));
        const recordsMap = tokenSupplyRecordsToMap(records);

        // No supply impact from bond manager
        assert.assertTrue(recordsMap.has(BOND_MANAGER.toLowerCase()) == false);
    });

    test("excludes Olympus Association after milestone block", () => {
        mockContractBalances(BigDecimal.zero(), BigDecimal.fromString("1"), BigDecimal.zero());

        const records = getTreasuryOHMRecords(TIMESTAMP, BigInt.fromString("17115001"));
        const recordsMap = tokenSupplyRecordsToMap(records);

        assert.assertTrue(recordsMap.has(OLYMPUS_ASSOCIATION_WALLET.toLowerCase()) == false);
    });

    test("includes Olympus Association before milestone block", () => {
        mockContractBalances(BigDecimal.zero(), BigDecimal.fromString("1"), BigDecimal.zero());

        const records = getTreasuryOHMRecords(TIMESTAMP, BigInt.fromString("17114999"));
        const recordsMap = tokenSupplyRecordsToMap(records);

        assert.assertTrue(recordsMap.has(OLYMPUS_ASSOCIATION_WALLET.toLowerCase()) == true);
    });
});

const SILO_MINT_BLOCK = BigInt.fromString("16627144");
const SILO_MINT_QUANTITY = BigDecimal.fromString("20000");
const EULER_MINT_BLOCK = BigInt.fromString("16627152");
const EULER_MINT_QUANTITY = BigDecimal.fromString("30000");
const EULER_WITHDRAW_BLOCK = BigInt.fromString("16818299");
const EULER_WITHDRAW_QUANTITY = BigDecimal.fromString("-27239.193995359");

describe("Borrowable OHM", () => {
    test("returns no records before minting", () => {
        const records = getMintedBorrowableOHMRecords(TIMESTAMP, SILO_MINT_BLOCK.minus(BigInt.fromI32(1)));

        assert.i32Equals(records.length, 0);
    });

    test("returns minted OHM after minting", () => {
        const records = getMintedBorrowableOHMRecords(TIMESTAMP, EULER_MINT_BLOCK.plus(BigInt.fromI32(1)));

        const recordSilo = records[0];
        assert.stringEquals(recordSilo.supplyBalance.toString(), (BigDecimal.fromString("-1").times(SILO_MINT_QUANTITY)).toString());
        assert.assertTrue(recordSilo.sourceAddress == SILO_ADDRESS);
        assert.stringEquals(recordSilo.type, TYPE_LENDING);

        const recordEuler = records[1];
        assert.stringEquals(recordEuler.supplyBalance.toString(), (BigDecimal.fromString("-1").times(EULER_MINT_QUANTITY)).toString());
        assert.assertTrue(recordEuler.sourceAddress == EULER_ADDRESS);
        assert.stringEquals(recordEuler.type, TYPE_LENDING);

        assert.i32Equals(records.length, 2);
    });

    test("considers withdraws", () => {
        const records = getMintedBorrowableOHMRecords(TIMESTAMP, EULER_WITHDRAW_BLOCK.plus(BigInt.fromI32(1)));

        const recordSilo = records[0];
        assert.stringEquals(recordSilo.supplyBalance.toString(), (BigDecimal.fromString("-1").times(SILO_MINT_QUANTITY)).toString());
        assert.assertTrue(recordSilo.sourceAddress == SILO_ADDRESS);
        assert.stringEquals(recordSilo.type, TYPE_LENDING);

        const recordEuler = records[1];
        assert.stringEquals(recordEuler.supplyBalance.toString(), (BigDecimal.fromString("-1").times(EULER_MINT_QUANTITY.plus(EULER_WITHDRAW_QUANTITY))).toString());
        assert.assertTrue(recordEuler.sourceAddress == EULER_ADDRESS);
        assert.stringEquals(recordEuler.type, TYPE_LENDING);

        assert.i32Equals(records.length, 2);
    });
});
