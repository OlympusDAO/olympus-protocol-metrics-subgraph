import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { TokenCategoryPOL, TokenCategoryStable, TokenCategoryVolatile, TokenDefinition } from "../../../shared/src/contracts/TokenDefinition";
import { LendingMarketDeployment } from "../../../shared/src/utils/LendingMarketDeployment";
import { AAVE_ALLOCATOR, AAVE_ALLOCATOR_V2, AURA_ALLOCATOR, AURA_ALLOCATOR_V2, BALANCER_ALLOCATOR, BONDS_DEPOSIT, BONDS_INVERSE_DEPOSIT, CONVEX_ALLOCATOR1, CONVEX_ALLOCATOR2, CONVEX_ALLOCATOR3, CONVEX_CVX_ALLOCATOR, CONVEX_CVX_VL_ALLOCATOR, CONVEX_STAKING_PROXY_FRAXBP, CONVEX_STAKING_PROXY_OHM_FRAXBP, CROSS_CHAIN_ARBITRUM, CROSS_CHAIN_FANTOM, CROSS_CHAIN_POLYGON, DAO_WALLET, DAO_WORKING_CAPITAL, LUSD_ALLOCATOR, MAKER_DSR_ALLOCATOR, MAKER_DSR_ALLOCATOR_PROXY, MYSO_LENDING, OLYMPUS_ASSOCIATION_WALLET, OTC_ESCROW, RARI_ALLOCATOR, TREASURY_ADDRESS_V1, TREASURY_ADDRESS_V2, TREASURY_ADDRESS_V3, TRSRY, VEFXS_ALLOCATOR, VENDOR_LENDING, WALLET_ADDRESSES } from "../../../shared/src/Wallets";
import { PairHandler, PairHandlerTypes } from "./PairHandler";

export const BLOCKCHAIN = "Ethereum";

// Tokens definition
export const DAIBOND_TOKEN = "DAI";
export const OHMDAILPBOND_TOKEN = "OHM-DAI";
export const OHMFRAXLPBOND_TOKEN = "OHM-FRAX";
export const FRAXBOND_TOKEN = "FRAX";
export const ETHBOND_TOKEN = "WETH";
export const LUSDBOND_TOKEN = "LUSD";
export const OHMLUSDLPBOND_TOKEN = "OHM-LUSD";
export const OHMETHLPBOND_TOKEN = "OHM-WETH";

/**
 * Holds OHM V1, wsOHM (V1) and gOHM
 * 
 * Any V1 assets in this contract were previously external to the protocol,
 * and should NOT be counted as protocol assets.
 * 
 * Any gOHM in this contract has been pre-minted
 * for migration from V1 assets, and should NOT be counted as protocol assets.
 */
export const MIGRATION_CONTRACT = "0x184f3fad8618a6f458c16bae63f70c426fe784b3".toLowerCase();

export const TREASURY_ADDRESS_V2_BLOCK = "12525281";
export const TREASURY_ADDRESS_V3_BLOCK = "13805100";

export const AAVE_ALLOCATOR_V2_BLOCK = "14375500";
export const CONVEX_ALLOCATOR1_BLOCK = "13027359";
export const CONVEX_ALLOCATOR2_BLOCK = "13308077";
export const CONVEX_ALLOCATOR3_BLOCK = "13920000";
export const OHMDAI_ONSEN_ID = 185;
export const OHMLUSD_ONSEN_ID = 323;
export const ONSEN_ALLOCATOR = "0x0316508a1b5abf1CAe42912Dc2C8B9774b682fFC".toLowerCase();
export const SUSHI_MASTERCHEF = "0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd".toLowerCase();
export const CONVEX_STAKING_CRV_REWARD_POOL = "0x3fe65692bfcd0e6cf84cb1e7d24108e434a7587e".toLowerCase();
export const CONVEX_STAKING_FRAX_3CRV_REWARD_POOL = "0xB900EF131301B307dB5eFcbed9DBb50A3e209B2e".toLowerCase();
export const CONVEX_STAKING_FRAX_USDC_REWARD_POOL = "0x7e880867363A7e321f5d260Cade2B0Bb2F717B02".toLowerCase();
export const CONVEX_STAKING_OHM_ETH_REWARD_POOL = "0xd683C7051a28fA150EB3F4BD92263865D4a67778".toLowerCase();
export const CONVEX_STAKING_OHM_FRAXBP_REWARD_POOL = "0x27A8c58e3DE84280826d615D80ddb33930383fE9".toLowerCase();
export const FRAX_LOCKING_FRAX_USDC = "0x963f487796d54d2f27bA6F3Fbe91154cA103b199".toLowerCase();
export const FRAX_LOCKING_OHM_FRAXBP = "0xc96e1a26264D965078bd01eaceB129A65C09FFE7".toLowerCase();

export const OHMDAISLPBOND_CONTRACT1 = "0xd27001d1aaed5f002c722ad729de88a91239ff29".toLowerCase();
export const OHMDAISLPBOND_CONTRACT1_BLOCK = "12154429";
export const OHMDAISLPBOND_CONTRACT2 = "0x13e8484a86327f5882d1340ed0d7643a29548536".toLowerCase();
export const OHMDAISLPBOND_CONTRACT2_BLOCK = "12368362";
export const OHMDAISLPBOND_CONTRACT3 = "0x996668c46fc0b764afda88d83eb58afc933a1626".toLowerCase();
export const OHMDAISLPBOND_CONTRACT3_BLOCK = "12525388";
export const OHMDAISLPBOND_CONTRACT4 = "0x956c43998316b6a2F21f89a1539f73fB5B78c151".toLowerCase();
export const OHMDAISLPBOND_CONTRACT4_BLOCK = "12659907";
export const DAIBOND_CONTRACTS1 = "0xa64ed1b66cb2838ef2a198d8345c0ce6967a2a3c".toLowerCase();
export const DAIBOND_CONTRACTS1_BLOCK = "12280908";
export const DAIBOND_CONTRACTS2 = "0xd03056323b7a63e2095ae97fa1ad92e4820ff045".toLowerCase();
export const DAIBOND_CONTRACTS2_BLOCK = "12525351";
export const DAIBOND_CONTRACTS3 = "0x575409F8d77c12B05feD8B455815f0e54797381c".toLowerCase();
export const DAIBOND_CONTRACTS3_BLOCK = "12659928";
export const OHMFRAXLPBOND_CONTRACT1 = "0x539b6c906244ac34e348bbe77885cdfa994a3776".toLowerCase();
export const OHMFRAXLPBOND_CONTRACT1_BLOCK = "12621882";
export const OHMFRAXLPBOND_CONTRACT2 = "0xc20cfff07076858a7e642e396180ec390e5a02f7".toLowerCase();
export const OHMFRAXLPBOND_CONTRACT2_BLOCK = "12659925";
export const FRAXBOND_CONTRACT1 = "0x8510c8c2B6891E04864fa196693D44E6B6ec2514".toLowerCase();
export const FRAXBOND_CONTRACT1_BLOCK = "12666825";
export const ETHBOND_CONTRACT1 = "0xe6295201cd1ff13ced5f063a5421c39a1d236f1c".toLowerCase();
export const ETHBOND_CONTRACT1_BLOCK = "12959821";
export const LUSDBOND_CONTRACT1 = "0x10c0f93f64e3c8d0a1b0f4b87d6155fd9e89d08d".toLowerCase();
export const LUSDBOND_CONTRACT1_BLOCK = "13264217";
export const OHMLUSDBOND_CONTRACT1 = "0xfb1776299e7804dd8016303df9c07a65c80f67b6".toLowerCase();
export const OHMLUSDBOND_CONTRACT1_BLOCK = "13348034";

export const CIRCULATING_SUPPLY_CONTRACT = "0x0EFFf9199Aa1Ac3C3E34E957567C1BE8bF295034".toLowerCase();
export const CIRCULATING_SUPPLY_CONTRACT_BLOCK = "12236262";

export const STAKING_CONTRACT_V1 = "0x0822f3c03dcc24d200aff33493dc08d0e1f274a2".toLowerCase();
export const STAKING_CONTRACT_V2 = "0xfd31c7d00ca47653c6ce64af53c1571f9c36566a".toLowerCase();
export const STAKING_CONTRACT_V2_BLOCK = "12622679";
export const STAKING_CONTRACT_V3 = "0xB63cac384247597756545b500253ff8E607a8020".toLowerCase();
export const STAKING_CONTRACT_V3_BLOCK = "13804019";

export const BONDING_CALCULATOR = "0xcaaa6a2d4b26067a391e7b7d65c16bb2d5fa571a".toLowerCase();
export const BONDING_CALCULATOR_BLOCK = "12525357";

export const BOND_FIXED_EXPIRY_TELLER = "0x007fe70dc9797c4198528ae43d8195fff82bdc95".toLowerCase();

export const LQTY_STAKING = "0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d".toLowerCase();
export const LUSD_ALLOCATOR_BLOCK = "14397867";
export const LIQUITY_STABILITY_POOL = "0x66017d22b0f8556afdd19fc67041899eb65a21bb".toLowerCase();

export const RARI_ALLOCATOR_BLOCK = "14550000";

export const TOKE_ALLOCATOR = "0x0483DE8C11eE2f0538a29F0C294246677cbC92F5".toLowerCase();
export const TOKE_STAKING = "0x96f98ed74639689c3a11daf38ef86e59f43417d3".toLowerCase();

export const BALANCER_VAULT = "0xba12222222228d8ba445958a75a0704d566bf2c8".toLowerCase();

export const OLYMPUS_BOOSTED_LIQUIDITY_REGISTRY = "0x375E06C694B5E50aF8be8FB03495A612eA3e2275".toLowerCase();

export const OLYMPUS_INCUR_DEBT = "0xd9d87586774fb9d036fa95a5991474513ff6c96e".toLowerCase();

export const BALANCER_LIQUIDITY_GAUGE_OHM_DAI = "0x107A2209883621aFe2968da31C03190e0B2782C2".toLowerCase();
export const BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH = "0x852CF729dEF9beB9De2f18c97a0ea6bf93a7dF8B".toLowerCase();
export const BALANCER_LIQUIDITY_GAUGE_OHM_WETH = "0x5f2c3422a675860f0e019Ddd78C6fA681bE84bd4".toLowerCase();
export const BALANCER_LIQUIDITY_GAUGE_OHM_WSTETH = "0xE879f17910E77c01952b97E4A098B0ED15B6295c".toLowerCase();
export const BALANCER_LIQUIDITY_GAUGE_WETH_FDT = "0xbd0dae90cb4a0e08f1101929c2a01eb165045660".toLowerCase();
export const BALANCER_LIQUIDITY_GAUGES = [BALANCER_LIQUIDITY_GAUGE_WETH_FDT, BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH, BALANCER_LIQUIDITY_GAUGE_OHM_WETH, BALANCER_LIQUIDITY_GAUGE_OHM_DAI, BALANCER_LIQUIDITY_GAUGE_OHM_WSTETH];

export const AURA_STABLE_REWARD_POOL = "0x62D7d772b2d909A0779d15299F4FC87e34513c6d".toLowerCase();
export const AURA_STAKING_AURA_BAL = "0x00A7BA8Ae7bca0B10A32Ea1f8e2a1Da980c6CAd2".toLowerCase();
export const AURA_STAKING_OHM_DAI_WETH = "0xF01e29461f1FCEdD82f5258Da006295E23b4Fab3".toLowerCase();
export const AURA_STAKING_OHM_WETH = "0x978653c02f2fbbdfd67cbc7f45c42262f213e0b5".toLowerCase();
export const AURA_STAKING_OHM_DAI = "0xB9D6ED734Ccbdd0b9CadFED712Cf8AC6D0917EcD".toLowerCase();
export const AURA_STAKING_OHM_WSTETH = "0x636024f9ddef77e625161b2ccf3a2adfbfad3615".toLowerCase();

export const BOND_MANAGER = "0xf577c77ee3578c7f216327f41b5d7221ead2b2a3";

export const MAKER_DSR = "0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7";

export const EULER_ADDRESS = "0x27182842E098f60e3D576794A5bFFb0777E025d3".toLowerCase();
export const SILO_ADDRESS = "0xb2374f84b3cEeFF6492943Df613C9BcF45322a0c".toLowerCase();

/**
 * Defines the contract addresses that belong to the protocol & DAO treasuries.
 * 
 * This is normally deducted from total supply to determine circulating supply.
 * 
 * The following are not included:
 * - Myso and Vendor Finance: the deployed amounts are hard-coded.
 * - Migration Contract: the migration offset is used to indicate the protocol-owned OHM. 
 * Additionally, the OHM and gOHM in the migration contract is pre-minted for v1 -> v2 migrations,
 * and is not owned by the protocol or DAO.
 * - Olympus Association: not considered part of the protocol or DAO treasuries.
 */
export const CIRCULATING_SUPPLY_WALLETS = [
  BONDS_DEPOSIT,
  BONDS_INVERSE_DEPOSIT,
  DAO_WALLET,
  DAO_WORKING_CAPITAL,
  OTC_ESCROW,
  TREASURY_ADDRESS_V1,
  TREASURY_ADDRESS_V2,
  TREASURY_ADDRESS_V3,
];

// Olympus tokens
export const ERC20_OHM_V1 = "0x383518188c0c6d7730d91b2c03a03c837814a899".toLowerCase();
export const ERC20_OHM_V2 = "0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5".toLowerCase();
export const ERC20_OHM_V2_BLOCK = "13782589";
export const ERC20_SOHM_V1 = "0x31932e6e45012476ba3a3a4953cba62aee77fbbe".toLowerCase();
export const ERC20_SOHM_V2 = "0x04f2694c8fcee23e8fd0dfea1d4f5bb8c352111f".toLowerCase();
export const ERC20_SOHM_V2_BLOCK = "12622596";
export const ERC20_SOHM_V3 = "0x04906695D6D12CF5459975d7C3C03356E4Ccd460".toLowerCase();
export const ERC20_SOHM_V3_BLOCK = "13806000";
export const ERC20_GOHM = "0x0ab87046fBb341D058F17CBC4c1133F25a20a52f".toLowerCase();

// Stablecoin tokens
export const ERC20_ADAI = "0x028171bca77440897b824ca71d1c56cac55b68a3".toLowerCase();
export const ERC20_CVX_FRAX_3CRV = "0xbe0f6478e0e4894cfb14f32855603a083a57c7da".toLowerCase(); // Staked version of ERC20_FRAX_3CRV
export const ERC20_DAI = "0x6b175474e89094c44da98b954eedeac495271d0f".toLowerCase();
export const ERC20_FEI = "0x956F47F50A910163D8BF957Cf5846D573E7f87CA".toLowerCase();
export const ERC20_FRAX = "0x853d955acef822db058eb8505911ed77f175b99e".toLowerCase();
export const ERC20_FRAX_3CRV = "0xd632f22692fac7611d2aa1c0d552930d43caed3b".toLowerCase();
export const ERC20_FRAX_BP = "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC".toLowerCase();
export const ERC20_LUSD = "0x5f98805a4e8be255a32880fdec7f6728c6568ba0".toLowerCase();
export const ERC20_LUSD_BLOCK = "12178594";
export const ERC20_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".toLowerCase();
export const ERC20_UST = "0xa693b19d2931d498c5b318df961919bb4aee87a5".toLowerCase();
export const ERC20_UST_BLOCK_DEATH = "14730000";
export const ERC20_UST_BLOCK = "13408366";
export const ERC20_BB_A_USD = "0xA13a9247ea42D743238089903570127DdA72fE44".toLowerCase();

// Volatile tokens
export const ERC20_AGEUR = "0x1a7e4e63778b4f12a199c062f3efdd288afcbce8".toLowerCase();
export const ERC20_ALCX = "0xdbdb4d16eda451d0503b854cf79d55697f90c8df".toLowerCase();
export const ERC20_AURA = "0xC0c293ce456fF0ED870ADd98a0828Dd4d2903DBF".toLowerCase();
export const ERC20_AURA_BAL = "0x616e8BfA43F920657B3497DBf40D6b1A02D4608d".toLowerCase();
export const ERC20_AURA_GRAVI = "0xBA485b556399123261a5F9c95d413B4f93107407".toLowerCase();
export const ERC20_AURA_VL = "0x3Fa73f1E5d8A792C80F426fc8F84FBF7Ce9bBCAC".toLowerCase();
export const ERC20_BAL = "0xba100000625a3754423978a60c9317c58a424e3d".toLowerCase();
export const ERC20_BALANCER_AURA_WETH = "0xc29562b045D80fD77c69Bec09541F5c16fe20d9d".toLowerCase();
export const ERC20_BALANCER_BAL_WETH = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56".toLowerCase();
export const ERC20_BALANCER_BB_A_WSTETH = "0x25accb7943fd73dda5e23ba6329085a3c24bfb6a".toLowerCase();
export const ERC20_BALANCER_GRAVIAURA_AURABAL_WETH = "0x0578292CB20a443bA1CdE459c985CE14Ca2bDEe5".toLowerCase();
export const ERC20_BALANCER_OHM_BTRFLY_V2 = "0x2de32a7c98c3ef6ec79e703500e8ca5b2ec819aa".toLowerCase();
export const ERC20_BALANCER_OHM_DAI = "0x76FCf0e8C7Ff37A47a799FA2cd4c13cDe0D981C9".toLowerCase();
export const ERC20_BALANCER_OHM_DAI_AURA = "0xB23Dfc0C4502a271976F1ee65321C51Be2529640".toLowerCase();
export const ERC20_BALANCER_OHM_DAI_WETH = "0xc45D42f801105e861e86658648e3678aD7aa70f9".toLowerCase(); // Balancer pool token
export const ERC20_BALANCER_OHM_DAI_WETH_AURA = "0x622A725a79C7fE37AD839C640cD62d546712B3A9".toLowerCase();
export const ERC20_BALANCER_OHM_WETH = "0xD1eC5e215E8148D76F4460e4097FD3d5ae0A3558".toLowerCase();
export const ERC20_BALANCER_OHM_WETH_AURA = "0xA02D8861FBFD0bA3D8EbaFA447Fe7680a3FA9a93".toLowerCase();
export const ERC20_BALANCER_OHM_WSTETH = "0xd4f79CA0Ac83192693bce4699d0c10C66Aa6Cf0F".toLowerCase();
export const ERC20_BALANCER_OHM_WSTETH_AURA = "0x0EF97ef0e20F84e82ec2D79CBD9Eda923C3DAF09".toLowerCase();
export const ERC20_BALANCER_WETH_FDT = "0x2D344A84BaC123660b021EEbE4eB6F12ba25fe86".toLowerCase();
export const ERC20_BALANCER_WSTETH_WETH = "0x32296969ef14eb0c6d29669c550d4a0449130230".toLowerCase();
export const ERC20_BARNBRIDGE = "0x0391D2021f89DC339F60Fff84546EA23E337750f".toLowerCase();
export const ERC20_BTRFLY_V1 = "0xc0d4ceb216b3ba9c3701b291766fdcba977cec3a".toLowerCase();
export const ERC20_BTRFLY_V1_STAKED = "0xCC94Faf235cC5D3Bf4bEd3a30db5984306c86aBC".toLowerCase();
export const ERC20_BTRFLY_V2 = "0xc55126051b22ebb829d00368f4b12bde432de5da".toLowerCase();
export const ERC20_BTRFLY_V2_RL = "0x742B70151cd3Bc7ab598aAFF1d54B90c3ebC6027".toLowerCase();
export const ERC20_CRV = "0xd533a949740bb3306d119cc777fa900ba034cd52".toLowerCase();
export const ERC20_CRV_3POOL = "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490".toLowerCase();
export const ERC20_CRV_FRAX_USDC = "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC".toLowerCase();
export const ERC20_CRV_OHMETH = "0x3660bd168494d61ffdac21e403d0f6356cf90fd7".toLowerCase();
export const ERC20_CRV_OHMFRAXBP = "0x5271045F7B73c17825A7A7aee6917eE46b0B7520".toLowerCase();
export const ERC20_CVX = "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b".toLowerCase();
export const ERC20_CVX_BLOCK = "12460000";
export const ERC20_CVX_CRV = "0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7".toLowerCase();
export const ERC20_CVX_FRAX_USDC = "0x117A0bab81F25e60900787d98061cCFae023560c".toLowerCase();
export const ERC20_CVX_FRAX_USDC_STAKED = "0x8a53ee42FB458D4897e15cc7dEa3F75D0F1c3475".toLowerCase();
export const ERC20_CVX_FXS = "0xfeef77d3f69374f66429c91d732a244f074bdf74".toLowerCase();
export const ERC20_CVX_OHM_FRAXBP = "0xd8F1B275c320819c7D752ef79988d0780bf00446".toLowerCase();
export const ERC20_CVX_OHM_FRAXBP_STAKED = "0x81b0dCDa53482A2EA9eb496342dC787643323e95".toLowerCase();
export const ERC20_CVX_OHMETH = "0x9bb0daf4361e1b84f5a44914595c46f07e9d12a4".toLowerCase(); // Staked ERC20_CRV_OHMETH
export const ERC20_CVX_VL_V1 = "0xd18140b4b819b895a3dba5442f959fa44994af50".toLowerCase();
export const ERC20_CVX_VL_V1_BLOCK = "13153663";
export const ERC20_CVX_VL_V2 = "0x72a19342e8F1838460eBFCCEf09F6585e32db86E".toLowerCase();
export const ERC20_FDT = "0xEd1480d12bE41d92F36f5f7bDd88212E381A3677".toLowerCase();
export const ERC20_FOX = "0xc770eefad204b5180df6a14ee197d99d808ee52d".toLowerCase();
export const ERC20_FPIS = "0xc2544a32872a91f4a553b404c6950e89de901fdb".toLowerCase();
export const ERC20_FPIS_BLOCK = "14482720";
export const ERC20_FXS = "0x3432b6a60d23ca0dfca7761b7ab56459d9c964d0".toLowerCase();
export const ERC20_FXS_BLOCK = "11465584";
export const ERC20_FXS_VE = "0xc8418af6358ffdda74e09ca9cc3fe03ca6adc5b0".toLowerCase();
export const ERC20_FXS_VE_BLOCK = "13833298";
export const ERC20_KP3R = "0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44".toLowerCase();
export const ERC20_LDO = "0x5a98fcbea516cf06857215779fd812ca3bef1b32".toLowerCase();
export const ERC20_LQTY = "0x6dea81c8171d0ba574754ef6f8b412f2ed88c54d".toLowerCase();
export const ERC20_PRIME = "0x43d4a3cd90ddd2f8f4f693170c9c8098163502ad".toLowerCase();
export const ERC20_SUSHI = "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2".toLowerCase();
export const ERC20_STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84".toLowerCase();
export const ERC20_SYN = "0x0f2d719407fdbeff09d87557abb7232601fd9f29".toLowerCase();
export const ERC20_THOR = "0xa5f2211b9b8170f694421f2046281775e8468044".toLowerCase();
export const ERC20_TOKE = "0x2e9d63788249371f1dfc918a52f8d799f4a38c94".toLowerCase();
export const ERC20_TRIBE = "0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B".toLowerCase();
export const ERC20_WBTC = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599".toLowerCase();
export const ERC20_WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase();
export const ERC20_WSTETH = "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0".toLowerCase();
export const ERC20_XSUSHI = "0x8798249c2e607446efb7ad49ec89dd1865ff4272".toLowerCase();
export const NATIVE_ETH = Address.zero().toHexString().toLowerCase();

export const ERC20_TOKENS = new Map<string, TokenDefinition>();
// ERC20_TOKENS.set(ERC20_STETH, new TokenDefinition(ERC20_STETH, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_ADAI, new TokenDefinition(ERC20_ADAI, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_AGEUR, new TokenDefinition(ERC20_AGEUR, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_ALCX, new TokenDefinition(ERC20_ALCX, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_AURA_BAL, new TokenDefinition(ERC20_AURA_BAL, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_AURA_VL, new TokenDefinition(ERC20_AURA_VL, TokenCategoryVolatile, true, false)); // Locked for 16 weeks only
ERC20_TOKENS.set(ERC20_AURA, new TokenDefinition(ERC20_AURA, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_BAL, new TokenDefinition(ERC20_BAL, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_DAI_AURA, new TokenDefinition(ERC20_BALANCER_OHM_DAI_AURA, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_DAI_WETH_AURA, new TokenDefinition(ERC20_BALANCER_OHM_DAI_WETH_AURA, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_DAI_WETH, new TokenDefinition(ERC20_BALANCER_OHM_DAI_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_DAI, new TokenDefinition(ERC20_BALANCER_OHM_DAI, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_WETH_AURA, new TokenDefinition(ERC20_BALANCER_OHM_WETH_AURA, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_WETH, new TokenDefinition(ERC20_BALANCER_OHM_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_WSTETH_AURA, new TokenDefinition(ERC20_BALANCER_OHM_WSTETH_AURA, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_OHM_WSTETH, new TokenDefinition(ERC20_BALANCER_OHM_WSTETH, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BALANCER_WSTETH_WETH, new TokenDefinition(ERC20_BALANCER_WSTETH_WETH, TokenCategoryPOL, true, false));
ERC20_TOKENS.set(ERC20_BARNBRIDGE, new TokenDefinition(ERC20_BARNBRIDGE, TokenCategoryVolatile, true, false, BigDecimal.fromString("0.77")));
ERC20_TOKENS.set(ERC20_BB_A_USD, new TokenDefinition(ERC20_BB_A_USD, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_BTRFLY_V1_STAKED, new TokenDefinition(ERC20_BTRFLY_V1_STAKED, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_BTRFLY_V1, new TokenDefinition(ERC20_BTRFLY_V1, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_BTRFLY_V2_RL, new TokenDefinition(ERC20_BTRFLY_V2_RL, TokenCategoryVolatile, false, false, BigDecimal.fromString("0.89")));
ERC20_TOKENS.set(ERC20_BTRFLY_V2, new TokenDefinition(ERC20_BTRFLY_V2, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_CRV_3POOL, new TokenDefinition(ERC20_CRV_3POOL, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_CRV, new TokenDefinition(ERC20_CRV, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_CVX_CRV, new TokenDefinition(ERC20_CVX_CRV, TokenCategoryVolatile, true, false)); // Ensures that it gets indexed, since it's not POL
ERC20_TOKENS.set(ERC20_CVX_FRAX_3CRV, new TokenDefinition(ERC20_CVX_FRAX_3CRV, TokenCategoryStable, true, false)); // Ensures that it gets indexed, since it's not POL
ERC20_TOKENS.set(ERC20_CVX_VL_V1, new TokenDefinition(ERC20_CVX_VL_V1, TokenCategoryVolatile, true, false)); // Locked for a few months only
ERC20_TOKENS.set(ERC20_CVX_VL_V2, new TokenDefinition(ERC20_CVX_VL_V2, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_CVX, new TokenDefinition(ERC20_CVX, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_DAI, new TokenDefinition(ERC20_DAI, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_FDT, new TokenDefinition(ERC20_FDT, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_FEI, new TokenDefinition(ERC20_FEI, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_FOX, new TokenDefinition(ERC20_FOX, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_FPIS, new TokenDefinition(ERC20_FPIS, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_FRAX_3CRV, new TokenDefinition(ERC20_FRAX_3CRV, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_FRAX_BP, new TokenDefinition(ERC20_FRAX_BP, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_FRAX, new TokenDefinition(ERC20_FRAX, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_FXS_VE, new TokenDefinition(ERC20_FXS_VE, TokenCategoryVolatile, false, false)); // Locked till 1787788800 (2026)
ERC20_TOKENS.set(ERC20_FXS, new TokenDefinition(ERC20_FXS, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_GOHM, new TokenDefinition(ERC20_GOHM, TokenCategoryVolatile, false, false)); // Illiquid so it's excluded from LB
ERC20_TOKENS.set(ERC20_KP3R, new TokenDefinition(ERC20_KP3R, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_LDO, new TokenDefinition(ERC20_LDO, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_LQTY, new TokenDefinition(ERC20_LQTY, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_LUSD, new TokenDefinition(ERC20_LUSD, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_OHM_V2, new TokenDefinition(ERC20_OHM_V2, TokenCategoryVolatile, false, false)); // Illiquid so it's excluded from LB
ERC20_TOKENS.set(ERC20_PRIME, new TokenDefinition(ERC20_PRIME, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_SUSHI, new TokenDefinition(ERC20_SUSHI, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_SYN, new TokenDefinition(ERC20_SYN, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_THOR, new TokenDefinition(ERC20_THOR, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_TOKE, new TokenDefinition(ERC20_TOKE, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_TRIBE, new TokenDefinition(ERC20_TRIBE, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(ERC20_USDC, new TokenDefinition(ERC20_USDC, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_UST, new TokenDefinition(ERC20_UST, TokenCategoryStable, true, false));
ERC20_TOKENS.set(ERC20_WBTC, new TokenDefinition(ERC20_WBTC, TokenCategoryVolatile, true, true));
ERC20_TOKENS.set(ERC20_WETH, new TokenDefinition(ERC20_WETH, TokenCategoryVolatile, true, true));
ERC20_TOKENS.set(ERC20_WSTETH, new TokenDefinition(ERC20_WSTETH, TokenCategoryVolatile, true, true));
ERC20_TOKENS.set(ERC20_XSUSHI, new TokenDefinition(ERC20_XSUSHI, TokenCategoryVolatile, true, false));
ERC20_TOKENS.set(NATIVE_ETH, new TokenDefinition(NATIVE_ETH, TokenCategoryVolatile, true, true));

/**
 * Mapping between the non-staked token and the token staked in Convex.
 * 
 * The staked token should NOT be listed in {ERC20_TOKENS}.
 */
const CONVEX_STAKED_TOKENS = new Map<string, TokenDefinition>();
CONVEX_STAKED_TOKENS.set(ERC20_CRV_FRAX_USDC, new TokenDefinition(ERC20_CVX_FRAX_USDC, TokenCategoryStable, true, false));
CONVEX_STAKED_TOKENS.set(ERC20_CRV_OHMETH, new TokenDefinition(ERC20_CVX_OHMETH, TokenCategoryPOL, true, false));
CONVEX_STAKED_TOKENS.set(ERC20_CRV_OHMFRAXBP, new TokenDefinition(ERC20_CVX_OHM_FRAXBP, TokenCategoryPOL, true, false));
CONVEX_STAKED_TOKENS.set(ERC20_CRV, new TokenDefinition(ERC20_CVX_CRV, TokenCategoryVolatile, true, false));
CONVEX_STAKED_TOKENS.set(ERC20_FRAX_3CRV, new TokenDefinition(ERC20_CVX_FRAX_3CRV, TokenCategoryStable, true, false));
CONVEX_STAKED_TOKENS.set(ERC20_FXS, new TokenDefinition(ERC20_CVX_FXS, TokenCategoryVolatile, true, false));

/**
 * Gets the staked Convex version of the given token.
 *
 * @param contractAddress
 * @returns contract address for the staked token, or null
 */
export const getConvexStakedToken = (contractAddress: string): TokenDefinition | null => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!CONVEX_STAKED_TOKENS.has(contractAddressLower)) return null;

  return CONVEX_STAKED_TOKENS.get(contractAddressLower);
};

/**
 * Convex staking contracts (reward pools).
 */
export const CONVEX_STAKING_CONTRACTS = [
  CONVEX_STAKING_CRV_REWARD_POOL,
  CONVEX_STAKING_FRAX_3CRV_REWARD_POOL,
  CONVEX_STAKING_FRAX_USDC_REWARD_POOL,
  CONVEX_STAKING_OHM_ETH_REWARD_POOL,
  CONVEX_STAKING_OHM_FRAXBP_REWARD_POOL,
];

/**
 * Frax locking contracts
 */
export const FRAX_LOCKING_CONTRACTS = [
  FRAX_LOCKING_FRAX_USDC,
  FRAX_LOCKING_OHM_FRAXBP,
];

/**
 * Mapping between the non-staked token and the token staked in Frax.
 * 
 * The staked token should NOT be listed in {ERC20_TOKENS}.
 */
const FRAX_STAKED_TOKENS = new Map<string, TokenDefinition>();
FRAX_STAKED_TOKENS.set(ERC20_CRV_FRAX_USDC, new TokenDefinition(ERC20_CVX_FRAX_USDC_STAKED, TokenCategoryStable, true, false));
FRAX_STAKED_TOKENS.set(ERC20_CRV_OHMFRAXBP, new TokenDefinition(ERC20_CVX_OHM_FRAXBP_STAKED, TokenCategoryPOL, true, false));

/**
 * Gets the staked Frax version of the given token.
 *
 * @param contractAddress
 * @returns contract address for the staked token, or null
 */
export const getFraxStakedToken = (contractAddress: string): TokenDefinition | null => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!FRAX_STAKED_TOKENS.has(contractAddressLower)) return null;

  return FRAX_STAKED_TOKENS.get(contractAddressLower);
};

/**
 * AURA staking contracts
 */
export const AURA_STAKING_CONTRACTS = [
  AURA_STAKING_AURA_BAL,
  AURA_STAKING_OHM_DAI_WETH,
  AURA_STAKING_OHM_DAI,
  AURA_STAKING_OHM_WETH,
  AURA_STAKING_OHM_WSTETH,
];

/**
 * AURA rewards contracts
 */
export const AURA_REWARDS_CONTRACTS = [
  AURA_STABLE_REWARD_POOL,
  AURA_STAKING_AURA_BAL,
  AURA_STAKING_OHM_DAI_WETH,
  AURA_STAKING_OHM_DAI,
  AURA_STAKING_OHM_WETH,
  AURA_STAKING_OHM_WSTETH,
];

const AURA_STAKED_TOKENS = new Map<string, string>();
AURA_STAKED_TOKENS.set(ERC20_AURA_BAL, ERC20_AURA_BAL);
AURA_STAKED_TOKENS.set(ERC20_BALANCER_OHM_DAI_WETH, ERC20_BALANCER_OHM_DAI_WETH_AURA);
AURA_STAKED_TOKENS.set(ERC20_BALANCER_OHM_DAI, ERC20_BALANCER_OHM_DAI_AURA);
AURA_STAKED_TOKENS.set(ERC20_BALANCER_OHM_WETH, ERC20_BALANCER_OHM_WETH_AURA);
AURA_STAKED_TOKENS.set(ERC20_BALANCER_OHM_WSTETH, ERC20_BALANCER_OHM_WSTETH_AURA);

/**
 * Gets the staked Aura version of the given token.
 *
 * @param contractAddress
 * @returns contract address for the staked token, or null
 */
export const getAuraStakedToken = (contractAddress: string): string | null => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!AURA_STAKED_TOKENS.has(contractAddressLower)) return null;

  return AURA_STAKED_TOKENS.get(contractAddressLower);
};

const UNSTAKED_TOKEN_MAPPING = new Map<string, string>();
UNSTAKED_TOKEN_MAPPING.set(ERC20_AURA_VL, ERC20_AURA);
UNSTAKED_TOKEN_MAPPING.set(ERC20_CVX_VL_V1, ERC20_CVX);
UNSTAKED_TOKEN_MAPPING.set(ERC20_CVX_VL_V2, ERC20_CVX);
UNSTAKED_TOKEN_MAPPING.set(ERC20_FXS_VE, ERC20_FXS);

/**
 * Often, staked/locked tokens have the same price as the original token. This
 * provides the address of the unstaked token.
 * 
 * @param contractAddress 
 * @returns address of the unstaked token, or the original token address if not found
 */
export const getUnstakedToken = (contractAddress: string): string => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!UNSTAKED_TOKEN_MAPPING.has(contractAddressLower)) {
    return contractAddress;
  }

  return UNSTAKED_TOKEN_MAPPING.get(contractAddressLower);
}

// Liquidity Pools
export const PAIR_CURVE_ETH_STETH = "0xdc24316b9ae028f1497c275eb9192a3ea0f67022".toLowerCase();
export const PAIR_CURVE_FRAX_USDC = "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2".toLowerCase(); // FraxBP
export const PAIR_CURVE_FXS_CVX_FXS = "0xd658a338613198204dca1143ac3f01a722b5d94a".toLowerCase();
export const PAIR_CURVE_OHM_ETH = "0x6ec38b3228251a0C5D491Faf66858e2E23d7728B".toLowerCase();
export const PAIR_CURVE_OHM_FRAXBP = "0xFc1e8bf3E81383Ef07Be24c3FD146745719DE48D".toLowerCase();
export const PAIR_FRAXSWAP_V1_OHM_FRAX = "0x38633ed142bcc8128b45ab04a2e4a6e53774699f".toLowerCase();
export const PAIR_FRAXSWAP_V2_OHM_FRAX = "0x5769071665eb8Db80e7e9226F92336Bb2897DCFA".toLowerCase();
export const PAIR_UNISWAP_V2_ALCX_ETH = "0xc3f279090a47e80990fe3a9c30d24cb117ef91a8".toLowerCase();
export const PAIR_UNISWAP_V2_BOND_USDC = "0x6591c4bcd6d7a1eb4e537da8b78676c1576ba244".toLowerCase();
export const PAIR_UNISWAP_V2_CRV_ETH = "0x58dc5a51fe44589beb22e8ce67720b5bc5378009".toLowerCase();
export const PAIR_UNISWAP_V2_CVX_CRV_ETH = "0x4b893b0e9c2fe8bf5d531d0c9c603b1483b4ce30".toLowerCase();
export const PAIR_UNISWAP_V2_CVX_ETH = "0x05767d9ef41dc40689678ffca0608878fb3de906".toLowerCase();
export const PAIR_UNISWAP_V2_ETH_WBTC = "0xceff51756c56ceffca006cd410b03ffc46dd3a58".toLowerCase();
export const PAIR_UNISWAP_V2_FOX_ETH = "0x470e8de2ebaef52014a47cb5e6af86884947f08c".toLowerCase();
export const PAIR_UNISWAP_V2_KP3R_ETH = "0xaf988aff99d3d0cb870812c325c588d8d8cb7de8".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_BTRFLY_V1 = "0xe9ab8038ee6dd4fcc7612997fe28d4e22019c4b4".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_DAI = "0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_DAI_V2 = "0x055475920a8c93cffb64d039a8205f7acc7722d3".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK = "13827000";
export const PAIR_UNISWAP_V2_OHM_ETH = "0xfffae4a0f4ac251f4705717cd24cadccc9f33e06".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_ETH_BLOCK = "12310798";
export const PAIR_UNISWAP_V2_OHM_ETH_V2 = "0x69b81152c5a8d35a67b32a4d3772795d96cae4da".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_ETH_V2_BLOCK = "13805112";
export const PAIR_UNISWAP_V2_OHM_FRAX = "0x2dce0dda1c2f98e0f171de8333c3c6fe1bbf4877".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_FRAX_BLOCK = "12563434";
export const PAIR_UNISWAP_V2_OHM_FRAX_V2 = "0xb612c37688861f1f90761dc7f382c2af3a50cc39".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_FRAX_V2_BLOCK = "13824000";
export const PAIR_UNISWAP_V2_OHM_LUSD = "0xfdf12d1f85b5082877a6e070524f50f6c84faa6b".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_LUSD_BLOCK = "13327921";
export const PAIR_UNISWAP_V2_OHM_LUSD_V2 = "0x46E4D8A1322B9448905225E52F914094dBd6dDdF".toLowerCase();
export const PAIR_UNISWAP_V2_OHM_LUSD_V2_BLOCK = "14381693";
export const PAIR_UNISWAP_V2_SUSHI_ETH = "0x795065dcc9f64b5614c407a6efdc400da6221fb0".toLowerCase();
export const PAIR_UNISWAP_V2_SYN_FRAX = "0x9fae36a18ef8ac2b43186ade5e2b07403dc742b1".toLowerCase();
export const PAIR_UNISWAP_V2_THOR_ETH = "0x3d3f13f2529ec3c84b2940155effbf9b39a8f3ec".toLowerCase();
export const PAIR_UNISWAP_V2_TOKE_ETH = "0xd4e7a6e2d03e4e48dfc27dd3f46df1c176647e38".toLowerCase();
export const PAIR_UNISWAP_V2_TRIBE_ETH = "0x7ce01885a13c652241ae02ea7369ee8d466802eb".toLowerCase();
export const PAIR_UNISWAP_V2_USDC_ETH = "0x397ff1542f962076d0bfe58ea045ffa2d347aca0".toLowerCase();
export const PAIR_UNISWAP_V2_UST_ETH = "0x8B00eE8606CC70c2dce68dea0CEfe632CCA0fB7b".toLowerCase();
export const PAIR_UNISWAP_V2_XSUSHI_ETH = "0x36e2fcccc59e5747ff63a03ea2e5c0c2c14911e7".toLowerCase();
export const PAIR_UNISWAP_V3_3CRV_USD = "0x5f7f44c304d016fe8cad589aaadba366528f0ad0".toLowerCase();
export const PAIR_UNISWAP_V3_AGEUR_USDC = "0x735a26a57a0a0069dfabd41595a970faf5e1ee8b".toLowerCase();
export const PAIR_UNISWAP_V3_FEI_USDC = "0xdf50fbde8180c8785842c8e316ebe06f542d3443".toLowerCase();
export const PAIR_UNISWAP_V3_FPIS_FRAX = "0x8fe536c7dc019455cce34746755c64bbe2aa163b".toLowerCase();
export const PAIR_UNISWAP_V3_FXS_ETH = "0xcd8286b48936cdac20518247dbd310ab681a9fbf".toLowerCase();
export const PAIR_UNISWAP_V3_FXS_ETH_BLOCK = "13509100";
export const PAIR_UNISWAP_V3_LDO_WETH = "0xa3f558aebaecaf0e11ca4b2199cc5ed341edfd74".toLowerCase();
export const PAIR_UNISWAP_V3_LQTY_LUSD = "0xd251dff33e31bb98d5587e5b1004ff01a5a41289".toLowerCase();
export const PAIR_UNISWAP_V3_LQTY_WETH = "0xd1d5a4c0ea98971894772dcd6d2f1dc71083c44e".toLowerCase();
export const PAIR_UNISWAP_V3_LUSD_USDC = "0x9902affdd3b8ef60304958c60377110c6d6ab1df".toLowerCase();
export const PAIR_UNISWAP_V3_WETH_BTRFLY_V1 = "0xdf9ab3c649005ebfdf682d2302ca1f673e0d37a2".toLowerCase();
export const PAIR_UNISWAP_V3_WETH_BTRFLY_V2 = "0x3e6e23198679419cd73bb6376518dcc5168c8260".toLowerCase();
// export const POOL_BALANCER_BB_A_WSTETH_ID = "0x25accb7943fd73dda5e23ba6329085a3c24bfb6a000200000000000000000387";
export const POOL_BALANCER_AURA_WETH_ID = "0xc29562b045d80fd77c69bec09541f5c16fe20d9d000200000000000000000251";
export const POOL_BALANCER_BAL_WETH_ID = "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014";
export const POOL_BALANCER_D2D_USDC_ID = "0x27c9f71cc31464b906e0006d4fcbc8900f48f15f00020000000000000000010f";
export const POOL_BALANCER_GRAVIAURA_AURABAL_WETH_ID = "0x0578292cb20a443ba1cde459c985ce14ca2bdee5000100000000000000000269";
export const POOL_BALANCER_OHM_DAI = "0x76fcf0e8c7ff37a47a799fa2cd4c13cde0d981c90002000000000000000003d2";
export const POOL_BALANCER_OHM_DAI_WETH_ID = "0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e"; // Pool ID, not a contract address
export const POOL_BALANCER_OHM_V2_BTRFLY_V2_ID = "0x2de32a7c98c3ef6ec79e703500e8ca5b2ec819aa00020000000000000000031c".toLowerCase();
export const POOL_BALANCER_OHM_WETH = "0xd1ec5e215e8148d76f4460e4097fd3d5ae0a35580002000000000000000003d3";
export const POOL_BALANCER_OHM_WSTETH_ID = "0xd4f79ca0ac83192693bce4699d0c10c66aa6cf0f00020000000000000000047e";
export const POOL_BALANCER_WETH_FDT_ID = "0x2d344a84bac123660b021eebe4eb6f12ba25fe8600020000000000000000018a"; // Pool ID
export const POOL_BALANCER_WSTETH_WETH_ID = "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080";

const pairHandlerAuraWEth = new PairHandler(
  PairHandlerTypes.Balancer,
  BALANCER_VAULT,
  POOL_BALANCER_AURA_WETH_ID,
);

/**
 * Maps an ERC20 token with an array of liquidity pairs that can be used for price lookup.
 */
const LIQUIDITY_POOL_TOKEN_LOOKUP = new Map<string, PairHandler[]>();
// LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BB_A_USD, [new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_BB_A_WSTETH_ID)]); // TODO not ideal, find a better pool
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_AGEUR, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_AGEUR_USDC)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_ALCX, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_ALCX_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_AURA_BAL, [new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_GRAVIAURA_AURABAL_WETH_ID)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_AURA_VL, [pairHandlerAuraWEth]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_AURA, [pairHandlerAuraWEth]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BAL, [new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_BAL_WETH_ID)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BARNBRIDGE, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_BOND_USDC)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BTRFLY_V1_STAKED, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_WETH_BTRFLY_V1)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BTRFLY_V1, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_WETH_BTRFLY_V1)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BTRFLY_V2_RL, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_WETH_BTRFLY_V2)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_BTRFLY_V2, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_WETH_BTRFLY_V2)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CRV_3POOL, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_3CRV_USD)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CRV_OHMFRAXBP, [new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_OHM_FRAXBP)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CRV, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_CRV_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CVX_CRV, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_CVX_CRV_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CVX_FXS, [new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_FXS_CVX_FXS)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CVX_VL_V1, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_CVX_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CVX_VL_V2, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_CVX_ETH)]); // TODO is this correct?
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_CVX, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_CVX_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_DAI, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI), new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI_V2)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FDT, [new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_WETH_FDT_ID)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FEI, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_FEI_USDC)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FOX, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_FOX_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FPIS, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_FPIS_FRAX)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FRAX_BP, [new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_FRAX_USDC)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FXS_VE, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_FXS_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_FXS, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_FXS_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_KP3R, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_KP3R_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_LDO, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_LDO_WETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_LQTY, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_LQTY_WETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_LUSD, [new PairHandler(PairHandlerTypes.UniswapV3, PAIR_UNISWAP_V3_LUSD_USDC)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_PRIME, [new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_D2D_USDC_ID)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_SUSHI, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_SUSHI_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_STETH, [new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_ETH_STETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_SYN, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_SYN_FRAX)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_THOR, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_THOR_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_TOKE, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_TOKE_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_TRIBE, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_TRIBE_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_UST, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_UST_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_WBTC, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_ETH_WBTC)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_WETH, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_USDC_ETH)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_WSTETH, [new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_WSTETH_WETH_ID)]);
LIQUIDITY_POOL_TOKEN_LOOKUP.set(ERC20_XSUSHI, [new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_XSUSHI_ETH)]);

/**
 * OHM price lookup
 */
const pairHandlerBalancerOhmDaiEth = new PairHandler(
  PairHandlerTypes.Balancer,
  BALANCER_VAULT,
  POOL_BALANCER_OHM_DAI_WETH_ID,
);

const pairHandlerUniswapV2OhmDaiV2 = new PairHandler(
  PairHandlerTypes.UniswapV2,
  PAIR_UNISWAP_V2_OHM_DAI_V2,
);

const pairHandlerBalanceOhmDai = new PairHandler(
  PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_OHM_DAI,
);

const pairHandlerBalanceOhmWEth = new PairHandler(
  PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_OHM_WETH,
);

export const OHM_PRICE_PAIRS = [pairHandlerUniswapV2OhmDaiV2, pairHandlerBalancerOhmDaiEth, pairHandlerBalanceOhmDai];

/**
 * Returns the first handler for a liquidity pair. These pairs
 * are commonly used for price lookup.
 *
 * @param contractAddress the contract address to look up
 * @returns a {PairHandler} or null
 */
export const getPairHandler = (contractAddress: string): PairHandler | null => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!LIQUIDITY_POOL_TOKEN_LOOKUP.has(contractAddressLower)) {
    log.debug("No pair handler for contract {}", [contractAddressLower]);
    return null;
  }

  const handlers = LIQUIDITY_POOL_TOKEN_LOOKUP.get(contractAddressLower);
  if (!handlers.length) {
    log.debug("Empty pair handlers for contract {}", [contractAddressLower]);
    return null;
  }

  const handler = handlers[0];
  log.debug("Found handler pair: {}", [handler.getContract()]);
  return handler;
};

/**
 * Returns the handlers for an ERC20 token.
 *
 * @param contractAddress the contract address to look up
 * @returns Array of PairHandlers
 */
export const getPairHandlers = (contractAddress: string): PairHandler[] => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!LIQUIDITY_POOL_TOKEN_LOOKUP.has(contractAddressLower)) return [];

  return LIQUIDITY_POOL_TOKEN_LOOKUP.get(contractAddressLower);
};

/**
 * Array of liquidity pairs that Olympus has added
 * liquidity to.
 */
export const LIQUIDITY_OWNED = [
  new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_OHM_V2_BTRFLY_V2_ID),
  pairHandlerBalancerOhmDaiEth,
  pairHandlerBalanceOhmDai,
  pairHandlerBalanceOhmWEth,
  new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_OHM_WSTETH_ID),
  new PairHandler(PairHandlerTypes.Balancer, BALANCER_VAULT, POOL_BALANCER_WETH_FDT_ID),
  new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_FRAX_USDC),
  new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_OHM_ETH),
  new PairHandler(PairHandlerTypes.Curve, PAIR_CURVE_OHM_FRAXBP),
  new PairHandler(PairHandlerTypes.FraxSwap, PAIR_FRAXSWAP_V1_OHM_FRAX),
  new PairHandler(PairHandlerTypes.FraxSwap, PAIR_FRAXSWAP_V2_OHM_FRAX),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI_V2),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_DAI),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_ETH_V2),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_ETH),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_LUSD_V2),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_LUSD),
  new PairHandler(PairHandlerTypes.UniswapV2, PAIR_UNISWAP_V2_OHM_BTRFLY_V1),
];
// TODO if extending far into the past, add OHM-FRAX V1 & V2

export const LIQUIDITY_PAIR_TOKENS = new Map<string, string[]>();
LIQUIDITY_PAIR_TOKENS.set(PAIR_CURVE_ETH_STETH, [ERC20_WETH, ERC20_STETH]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_CURVE_FRAX_USDC, [ERC20_FRAX, ERC20_USDC]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_CURVE_OHM_ETH, [ERC20_OHM_V2, NATIVE_ETH, ERC20_WETH]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_CURVE_OHM_FRAXBP, [ERC20_OHM_V2, ERC20_FRAX_BP]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_FRAXSWAP_V1_OHM_FRAX, [ERC20_OHM_V2, ERC20_FRAX]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_FRAXSWAP_V2_OHM_FRAX, [ERC20_OHM_V2, ERC20_FRAX]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_BTRFLY_V1, [ERC20_OHM_V2, ERC20_BTRFLY_V1]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_DAI_V2, [ERC20_DAI, ERC20_OHM_V2]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_DAI, [ERC20_DAI, ERC20_OHM_V1]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_ETH_V2, [ERC20_WETH, ERC20_OHM_V2]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_ETH, [ERC20_WETH, ERC20_OHM_V1]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_LUSD_V2, [ERC20_LUSD, ERC20_OHM_V2]);
LIQUIDITY_PAIR_TOKENS.set(PAIR_UNISWAP_V2_OHM_LUSD, [ERC20_LUSD, ERC20_OHM_V1]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_AURA_WETH_ID, [ERC20_WETH, ERC20_AURA]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_BAL_WETH_ID, [ERC20_BAL, ERC20_WETH]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_GRAVIAURA_AURABAL_WETH_ID, [ERC20_AURA_BAL, ERC20_AURA_GRAVI, ERC20_WETH]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_OHM_DAI_WETH_ID, [ERC20_WETH, ERC20_OHM_V2, ERC20_DAI]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_OHM_DAI, [ERC20_OHM_V2, ERC20_DAI]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_OHM_V2_BTRFLY_V2_ID, [ERC20_OHM_V2, ERC20_BTRFLY_V2]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_OHM_WETH, [ERC20_OHM_V2, ERC20_WETH]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_OHM_WSTETH_ID, [ERC20_OHM_V2, ERC20_WSTETH]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_WETH_FDT_ID, [ERC20_WETH, ERC20_FDT]);
LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_WSTETH_WETH_ID, [ERC20_WSTETH, ERC20_WETH]);
// LIQUIDITY_PAIR_TOKENS.set(POOL_BALANCER_BB_A_WSTETH_ID, [ERC20_WSTETH, ERC20_BB_A_USD]);

const getLiquidityPairTokens = (pairAddress: string): string[] => {
  const pairAddressLower = pairAddress.toLowerCase();
  if (!LIQUIDITY_PAIR_TOKENS.has(pairAddressLower)) return [];

  return LIQUIDITY_PAIR_TOKENS.get(pairAddressLower);
};

/**
 * Determines if {tokenAddress} is contained within the liquidity pair
 * represented by {pairAddress}.
 *
 * @param pairAddress
 * @param tokenAddress
 * @returns
 */
export const liquidityPairHasToken = (pairAddress: string, tokenAddress: string): bool => {
  return getLiquidityPairTokens(pairAddress).includes(tokenAddress.toLowerCase());
};

// TODO consider merging convex allocator and wallet addresses constants
export const CONVEX_ALLOCATORS = [
  CONVEX_ALLOCATOR1,
  CONVEX_ALLOCATOR2,
  CONVEX_ALLOCATOR3,
  CONVEX_CVX_ALLOCATOR,
  CONVEX_CVX_VL_ALLOCATOR,
  CONVEX_STAKING_PROXY_FRAXBP,
  CONVEX_STAKING_PROXY_OHM_FRAXBP,
  DAO_WALLET,
];

const TREASURY_BLACKLIST = new Map<string, string[]>();

/**
 * OHM and gOHM in the following wallets are blacklisted (not indexed) as we do not want the value
 * being considered as part of the protocol or DAO treasuries.
 */
TREASURY_BLACKLIST.set(ERC20_OHM_V1, WALLET_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_OHM_V2, WALLET_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_GOHM, WALLET_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_SOHM_V1, WALLET_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_SOHM_V2, WALLET_ADDRESSES);
TREASURY_BLACKLIST.set(ERC20_SOHM_V3, WALLET_ADDRESSES);

/**
 * Some wallets (e.g. {DAO_WALLET}) have specific treasury assets mixed into them.
 * For this reason, the wallets to be used differ on a per-contract basis.
 *
 * This function returns the wallets that should be iterated over for the given
 * contract, {contractAddress}.
 *
 * @param contractAddress
 * @returns
 */
export const getWalletAddressesForContract = (contractAddress: string): string[] => {
  const walletAddresses = WALLET_ADDRESSES.slice(0);

  // If the contract isn't on the blacklist, return as normal
  if (!TREASURY_BLACKLIST.has(contractAddress.toLowerCase())) {
    log.debug("getWalletAddressesForContract: token {} is not on treasury blacklist", [contractAddress]);
    return walletAddresses;
  }

  // Otherwise remove the values in the blacklist
  // AssemblyScript doesn't yet have closures, so filter() cannot be used
  const walletBlacklist = TREASURY_BLACKLIST.get(contractAddress.toLowerCase());
  for (let i = 0; i < walletBlacklist.length; i++) {
    // If the blacklisted address is not in the array, skip
    const arrayIndex = walletAddresses.indexOf(walletBlacklist[i]);
    if (arrayIndex < 0) {
      continue;
    }

    // Otherwise the blacklist address is removed from the array in-place
    const splicedValues = walletAddresses.splice(arrayIndex, 1);
    log.debug("getWalletAddressesForContract: removed values: {}", [splicedValues.toString()]);
  }

  return walletAddresses;
};

const ALLOCATOR_ONSEN_ID = new Map<string, i32>();
ALLOCATOR_ONSEN_ID.set(ERC20_DAI, OHMDAI_ONSEN_ID);
ALLOCATOR_ONSEN_ID.set(ERC20_LUSD, OHMLUSD_ONSEN_ID);

export const ALLOCATOR_ONSEN_ID_NOT_FOUND = -1;

/**
 * Returns the ID of a given contract in the Onsen Allocator.
 *
 * @param contractAddress the contract address to look up
 * @returns a number or {ALLOCATOR_ONSEN_ID_NOT_FOUND} if not found
 */
export const getOnsenAllocatorId = (contractAddress: string): i32 => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!ALLOCATOR_ONSEN_ID.has(contractAddressLower)) return ALLOCATOR_ONSEN_ID_NOT_FOUND;

  return ALLOCATOR_ONSEN_ID.get(contractAddressLower);
};

/**
 * The Rari Allocator contract ({RARI_ALLOCATOR}) has a function
 * amountAllocated() that returns the balance of an ERC20 token.
 *
 * This map records the ID for a given token.
 */
const ALLOCATOR_RARI_ID = new Map<string, i32>();
ALLOCATOR_RARI_ID.set(ERC20_DAI, 3);
ALLOCATOR_RARI_ID.set(ERC20_LUSD, 1);
ALLOCATOR_RARI_ID.set(ERC20_TRIBE, 4);
ALLOCATOR_RARI_ID.set(ERC20_TOKE, 9);

// Allocator IDs
// Source: https://etherscan.io/address/0xb32Ad041f23eAfd682F57fCe31d3eA4fd92D17af allocators()
// 1: LUSD
// 2: Aave V2
// 3: Rari
// 4: Rari
// 5: CVX V2
// 6: CVX V2
// 7: CVX V2
// 8: Btrfly
// 9: Tokemak
// 10:

export const ALLOCATOR_RARI_ID_NOT_FOUND = -1;
/**
 * Returns the ID of a given contract in the Rari Allocator.
 *
 * @param contractAddress the contract address to look up
 * @returns a number or {ALLOCATOR_RARI_ID_NOT_FOUND} if not found
 */
export const getRariAllocatorId = (contractAddress: string): i32 => {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!ALLOCATOR_RARI_ID.has(contractAddressLower)) return ALLOCATOR_RARI_ID_NOT_FOUND;

  return ALLOCATOR_RARI_ID.get(contractAddressLower);
};

const VENDOR_DEPLOYMENTS = new Map<string, LendingMarketDeployment[]>();
VENDOR_DEPLOYMENTS.set(ERC20_DAI, [
  new LendingMarketDeployment(ERC20_DAI, BigInt.fromString("16897393"), BigDecimal.fromString("500000"), VENDOR_LENDING), // https://etherscan.io/tx/0x0d4a3d19f4c35d8635793760050c3be4f54e1e2b43fb857282c4db992bce1469
]);

/**
 * Returns Vendor Finance deployments for the given contract address.
 * 
 * The details of the deployment are manually recorded, as the deposited principal (e.g. DAI)
 * is what is recognised until a default takes place - irrespective of the actual balance of 
 * DAI and gOHM in the contract. 
 */
export function getVendorDeployments(contractAddress: string): LendingMarketDeployment[] {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!VENDOR_DEPLOYMENTS.has(contractAddressLower)) return [];

  return VENDOR_DEPLOYMENTS.get(contractAddressLower);
}

const MYSO_DEPLOYMENTS = new Map<string, LendingMarketDeployment[]>();
MYSO_DEPLOYMENTS.set(ERC20_DAI.toLowerCase(), [
  new LendingMarketDeployment(ERC20_DAI, BigInt.fromString("16898161"), BigDecimal.fromString("500000"), MYSO_LENDING), // https://etherscan.io/tx/0xe26e451b069fcc387eb71c1dc86a05307e58e918ad5ca2fcc13baf3887795e24
]);

/**
 * Returns Myso Finance deployments for the given contract address.
 * 
 * The details of the deployment are manually recorded, as the deposited principal (e.g. DAI)
 * is what is recognised until a default takes place - irrespective of the actual balance of 
 * DAI and gOHM in the contract. 
 */
export function getMysoDeployments(contractAddress: string): LendingMarketDeployment[] {
  const contractAddressLower = contractAddress.toLowerCase();
  if (!MYSO_DEPLOYMENTS.has(contractAddressLower)) return [];

  return MYSO_DEPLOYMENTS.get(contractAddressLower);
}

export const SILO_DEPLOYMENTS = new Array<LendingMarketDeployment>();
SILO_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("16627144"), BigDecimal.fromString("20000"), SILO_ADDRESS)); // https://etherscan.io/tx/0xf9bbcc923182fb6406e97fce0f92c22c87a284d55812eeae41dc484759422b4a
SILO_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("16834221"), BigDecimal.fromString("28081.19399535"), SILO_ADDRESS)); // https://etherscan.io/tx/0x4676080481af6128cd1eef788bf7526632509176fb28d9bc69a4276c05c58349
SILO_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("17016622"), BigDecimal.fromString("25000"), SILO_ADDRESS)); // https://etherscan.io/tx/0x8d71fa055470f4654cf52e64452aebf02b2dd3c3b338c0a3edaae4ac7a4376a0
SILO_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("17464332"), BigDecimal.fromString("-25000"), SILO_ADDRESS)); // https://etherscan.io/tx/0x6b429c97403c5e8c60396c07248138cf6cab5d224e3984e1a5159f3ee525b6f6

export const EULER_DEPLOYMENTS = new Array<LendingMarketDeployment>();
EULER_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("16627152"), BigDecimal.fromString("30000"), EULER_ADDRESS)); // https://etherscan.io/tx/0xa7495eba745bd67279969c1b8687f816e0d83a60bf0c8b43900ef1dfaf97277e
EULER_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("16818299"), BigDecimal.fromString("-27239.193995359"), EULER_ADDRESS)); // https://etherscan.io/tx/0x54bb9ecb66c66aaa6bca677cff8fe8d64fcdbb44a7f00a0ee32f1670526e1c23
EULER_DEPLOYMENTS.push(new LendingMarketDeployment(ERC20_OHM_V2, BigInt.fromString("17348446"), BigDecimal.fromString("-2760.806004641"), EULER_ADDRESS)); // https://etherscan.io/tx/0x8fac17c10e7d3b077344809c9f7c70ee2afcae99323c8f81b81a0e50a327a722 // Settlement in ETH/USDC. This entry balances out the remaining deployed OHM.

export const CONTRACT_STARTING_BLOCK_MAP = new Map<string, string>();
CONTRACT_STARTING_BLOCK_MAP.set(AAVE_ALLOCATOR_V2, AAVE_ALLOCATOR_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(BONDING_CALCULATOR, BONDING_CALCULATOR_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(CIRCULATING_SUPPLY_CONTRACT, CIRCULATING_SUPPLY_CONTRACT_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(CONVEX_ALLOCATOR1, CONVEX_ALLOCATOR1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(CONVEX_ALLOCATOR2, CONVEX_ALLOCATOR2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(CONVEX_ALLOCATOR3, CONVEX_ALLOCATOR3_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(DAIBOND_CONTRACTS1, DAIBOND_CONTRACTS1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(DAIBOND_CONTRACTS2, DAIBOND_CONTRACTS2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(DAIBOND_CONTRACTS3, DAIBOND_CONTRACTS3_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_CVX_VL_V1, ERC20_CVX_VL_V1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_CVX, ERC20_CVX_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_FXS_VE, ERC20_FXS_VE_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_FXS, ERC20_FXS_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_FXS, ERC20_FPIS_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_LUSD, ERC20_LUSD_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_OHM_V2, ERC20_OHM_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_SOHM_V2, ERC20_SOHM_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_SOHM_V3, ERC20_SOHM_V3_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ERC20_UST, ERC20_UST_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(ETHBOND_CONTRACT1, ETHBOND_CONTRACT1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(FRAXBOND_CONTRACT1, FRAXBOND_CONTRACT1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(LUSD_ALLOCATOR, LUSD_ALLOCATOR_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(LUSDBOND_CONTRACT1, LUSDBOND_CONTRACT1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMDAISLPBOND_CONTRACT1, OHMDAISLPBOND_CONTRACT1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMDAISLPBOND_CONTRACT2, OHMDAISLPBOND_CONTRACT2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMDAISLPBOND_CONTRACT3, OHMDAISLPBOND_CONTRACT3_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMDAISLPBOND_CONTRACT4, OHMDAISLPBOND_CONTRACT4_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMFRAXLPBOND_CONTRACT1, OHMFRAXLPBOND_CONTRACT1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMFRAXLPBOND_CONTRACT2, OHMFRAXLPBOND_CONTRACT2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(OHMLUSDBOND_CONTRACT1, OHMLUSDBOND_CONTRACT1_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V2_OHM_DAI_V2, PAIR_UNISWAP_V2_OHM_DAI_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V2_OHM_ETH_V2, PAIR_UNISWAP_V2_OHM_ETH_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V2_OHM_ETH, PAIR_UNISWAP_V2_OHM_ETH_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V2_OHM_FRAX_V2, PAIR_UNISWAP_V2_OHM_FRAX_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V2_OHM_FRAX, PAIR_UNISWAP_V2_OHM_FRAX_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V2_OHM_LUSD_V2, PAIR_UNISWAP_V2_OHM_LUSD_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(PAIR_UNISWAP_V3_FXS_ETH, PAIR_UNISWAP_V3_FXS_ETH_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(RARI_ALLOCATOR, RARI_ALLOCATOR_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(STAKING_CONTRACT_V2, STAKING_CONTRACT_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(STAKING_CONTRACT_V3, STAKING_CONTRACT_V3_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(TREASURY_ADDRESS_V2, TREASURY_ADDRESS_V2_BLOCK);
CONTRACT_STARTING_BLOCK_MAP.set(TREASURY_ADDRESS_V3, TREASURY_ADDRESS_V3_BLOCK);

const CONTRACT_ABBREVIATION_MAP = new Map<string, string>();
CONTRACT_ABBREVIATION_MAP.set(ERC20_ADAI, "aDAI");
CONTRACT_ABBREVIATION_MAP.set(ERC20_ALCX, "ALCX");
CONTRACT_ABBREVIATION_MAP.set(ERC20_AURA_VL, "vlAURA");
CONTRACT_ABBREVIATION_MAP.set(ERC20_AURA, "AURA");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BAL, "BAL");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BARNBRIDGE, "BOND");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BB_A_USD, "bb-a-USD");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BTRFLY_V1_STAKED, "xBTRFLY");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BTRFLY_V1, "BTRFLY");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BTRFLY_V2_RL, "rlBTRFLY");
CONTRACT_ABBREVIATION_MAP.set(ERC20_BTRFLY_V2, "BTRFLY");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CRV_3POOL, "3CRV");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CRV, "CRV");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX_CRV, "cvxCRV");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX_FRAX_3CRV, "cvxFRAX3CRV");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX_FXS, "cvxFXS");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX_OHMETH, "cvxOHMETH");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX_VL_V1, "vlCVX V1");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX_VL_V2, "vlCVX");
CONTRACT_ABBREVIATION_MAP.set(ERC20_CVX, "CVX");
CONTRACT_ABBREVIATION_MAP.set(ERC20_FRAX_3CRV, "FRAX3CRV");
CONTRACT_ABBREVIATION_MAP.set(ERC20_FRAX_BP, "FraxBP");
CONTRACT_ABBREVIATION_MAP.set(ERC20_FXS_VE, "veFXS");
CONTRACT_ABBREVIATION_MAP.set(ERC20_LDO, "LDO");
CONTRACT_ABBREVIATION_MAP.set(ERC20_PRIME, "D2D");
CONTRACT_ABBREVIATION_MAP.set(ERC20_SUSHI, "SUSHI");
CONTRACT_ABBREVIATION_MAP.set(ERC20_XSUSHI, "xSUSHI");

export function getContractAbbreviation(
  contractAddress: string,
): string | null {
  const contractAddressLower = contractAddress.toLowerCase();

  return CONTRACT_ABBREVIATION_MAP.has(contractAddressLower)
    ? CONTRACT_ABBREVIATION_MAP.get(contractAddressLower)
    : null;
}

const CONTRACT_NAME_MAP = new Map<string, string>();
// CONTRACT_NAME_MAP.set(POOL_BALANCER_BB_A_WSTETH_ID, "Balancer BB-A-wstETH Liquidity Pool");
CONTRACT_NAME_MAP.set(AAVE_ALLOCATOR_V2, "Aave Allocator V2");
CONTRACT_NAME_MAP.set(AAVE_ALLOCATOR, "Aave Allocator V1");
CONTRACT_NAME_MAP.set(AURA_ALLOCATOR_V2, "AURA Allocator V2");
CONTRACT_NAME_MAP.set(AURA_ALLOCATOR, "AURA Allocator");
CONTRACT_NAME_MAP.set(AURA_STAKING_AURA_BAL, "auraBAL Staking Vault");
CONTRACT_NAME_MAP.set(AURA_STAKING_OHM_DAI_WETH, "Aura OHM-DAI-wETH Deposit Vault");
CONTRACT_NAME_MAP.set(AURA_STAKING_OHM_DAI, "Aura OHM-DAI Deposit Vault");
CONTRACT_NAME_MAP.set(AURA_STAKING_OHM_WETH, "Aura OHM-wETH Deposit Vault");
CONTRACT_NAME_MAP.set(AURA_STAKING_OHM_WSTETH, "Aura OHM-wstETH Deposit Vault");
CONTRACT_NAME_MAP.set(BALANCER_ALLOCATOR, "Balancer Allocator");
CONTRACT_NAME_MAP.set(BALANCER_LIQUIDITY_GAUGE_OHM_DAI_WETH, "Balancer Liquidity Gauge OHM-DAI-wETH");
CONTRACT_NAME_MAP.set(BALANCER_LIQUIDITY_GAUGE_OHM_DAI, "Balancer Liquidity Gauge OHM-DAI");
CONTRACT_NAME_MAP.set(BALANCER_LIQUIDITY_GAUGE_OHM_WETH, "Balancer Liquidity Gauge OHM-wETH");
CONTRACT_NAME_MAP.set(BALANCER_LIQUIDITY_GAUGE_OHM_WSTETH, "Balancer Liquidity Gauge OHM-wstETH");
CONTRACT_NAME_MAP.set(BALANCER_LIQUIDITY_GAUGE_WETH_FDT, "Balancer Liquidity Gauge wETH-FDT");
CONTRACT_NAME_MAP.set(BALANCER_VAULT, "Balancer Vault");
CONTRACT_NAME_MAP.set(BOND_FIXED_EXPIRY_TELLER, "Bond Fixed Expiry Teller");
CONTRACT_NAME_MAP.set(BOND_MANAGER, "Bond Manager");
CONTRACT_NAME_MAP.set(BONDING_CALCULATOR, "Bonding Calculator");
CONTRACT_NAME_MAP.set(BONDS_DEPOSIT, "Bond Depository");
CONTRACT_NAME_MAP.set(BONDS_INVERSE_DEPOSIT, "Bond (Inverse) Depository");
CONTRACT_NAME_MAP.set(CIRCULATING_SUPPLY_CONTRACT, "Circulating Supply");
CONTRACT_NAME_MAP.set(CONVEX_ALLOCATOR1, "Convex Allocator 1");
CONTRACT_NAME_MAP.set(CONVEX_ALLOCATOR2, "Convex Allocator 2");
CONTRACT_NAME_MAP.set(CONVEX_ALLOCATOR3, "Convex Allocator 3");
CONTRACT_NAME_MAP.set(CONVEX_CVX_ALLOCATOR, "Convex Allocator");
CONTRACT_NAME_MAP.set(CONVEX_CVX_VL_ALLOCATOR, "Convex vlCVX Allocator");
CONTRACT_NAME_MAP.set(CONVEX_STAKING_CRV_REWARD_POOL, "Convex CRV Reward Pool");
CONTRACT_NAME_MAP.set(CONVEX_STAKING_FRAX_3CRV_REWARD_POOL, "Convex FRAX3CRV Reward Pool");
CONTRACT_NAME_MAP.set(CONVEX_STAKING_OHM_ETH_REWARD_POOL, "Convex OHMETH Reward Pool");
CONTRACT_NAME_MAP.set(CONVEX_STAKING_PROXY_FRAXBP, "Convex Staking Proxy - FraxBP");
CONTRACT_NAME_MAP.set(CONVEX_STAKING_PROXY_OHM_FRAXBP, "Convex Staking Proxy - OHM-FraxBP");
CONTRACT_NAME_MAP.set(CROSS_CHAIN_ARBITRUM, "Cross-Chain Arbitrum");
CONTRACT_NAME_MAP.set(CROSS_CHAIN_FANTOM, "Cross-Chain Fantom");
CONTRACT_NAME_MAP.set(CROSS_CHAIN_POLYGON, "Cross-Chain Polygon");
CONTRACT_NAME_MAP.set(DAIBOND_CONTRACTS1, "DAI Bond 1");
CONTRACT_NAME_MAP.set(DAIBOND_CONTRACTS2, "DAI Bond 2");
CONTRACT_NAME_MAP.set(DAIBOND_CONTRACTS3, "DAI Bond 3");
CONTRACT_NAME_MAP.set(DAO_WALLET, "Treasury MS (Formerly DAO Wallet)");
CONTRACT_NAME_MAP.set(DAO_WORKING_CAPITAL, "DAO Working Capital");
CONTRACT_NAME_MAP.set(ERC20_ADAI, "DAI - Aave");
CONTRACT_NAME_MAP.set(ERC20_AGEUR, "agEUR");
CONTRACT_NAME_MAP.set(ERC20_ALCX, "Alchemix");
CONTRACT_NAME_MAP.set(ERC20_AURA_BAL, "auraBAL");
CONTRACT_NAME_MAP.set(ERC20_AURA_GRAVI, "graviAURA");
CONTRACT_NAME_MAP.set(ERC20_AURA_VL, "Aura Finance - Vote-Locked");
CONTRACT_NAME_MAP.set(ERC20_AURA, "Aura Finance");
CONTRACT_NAME_MAP.set(ERC20_BAL, "Balancer");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_AURA_WETH, "Balancer AURA-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_BAL_WETH, "Balancer BAL-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_BB_A_WSTETH, "Balancer BB-A-wstETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_GRAVIAURA_AURABAL_WETH, "Balancer graviAURA-auraBAL-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_BTRFLY_V2, "Balancer OHM V2-BTRFLY V2 Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_DAI_AURA, "Balancer OHM-DAI Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_DAI_WETH_AURA, "Balancer OHM-DAI-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_DAI_WETH, "Balancer OHM-DAI-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_DAI, "Balancer OHM-DAI Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_WETH_AURA, "Balancer OHM-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_WETH, "Balancer OHM-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_WSTETH_AURA, "Balancer OHM-wstETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_OHM_WSTETH, "Balancer OHM-wstETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_WETH_FDT, "Balancer wETH-FDT Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BALANCER_WSTETH_WETH, "Balancer wstETH-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_BARNBRIDGE, "BarnBridge Governance");
CONTRACT_NAME_MAP.set(ERC20_BB_A_USD, "Balancer Aave Boosted StablePool");
CONTRACT_NAME_MAP.set(ERC20_BTRFLY_V1_STAKED, "Redacted Cartel V1 - Staked");
CONTRACT_NAME_MAP.set(ERC20_BTRFLY_V1, "Redacted Cartel V1");
CONTRACT_NAME_MAP.set(ERC20_BTRFLY_V2_RL, "Redacted Cartel V2 - Staked");
CONTRACT_NAME_MAP.set(ERC20_BTRFLY_V2, "Redacted Cartel V2");
CONTRACT_NAME_MAP.set(ERC20_CRV_3POOL, "Curve 3Pool");
CONTRACT_NAME_MAP.set(ERC20_CRV_FRAX_USDC, "Curve Frax-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_CRV_OHMETH, "Curve OHM-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_CRV_OHMFRAXBP, "Curve OHM-FraxBP Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_CRV, "Curve");
CONTRACT_NAME_MAP.set(ERC20_CVX_CRV, "Curve");
CONTRACT_NAME_MAP.set(ERC20_CVX_FRAX_3CRV, "Curve FRAX3Pool");
CONTRACT_NAME_MAP.set(ERC20_CVX_FRAX_USDC_STAKED, "Curve FraxBP");
CONTRACT_NAME_MAP.set(ERC20_CVX_FRAX_USDC, "Curve FraxBP");
CONTRACT_NAME_MAP.set(ERC20_CVX_FXS, "FXS");
CONTRACT_NAME_MAP.set(ERC20_CVX_OHM_FRAXBP_STAKED, "Curve OHM-FraxBP");
CONTRACT_NAME_MAP.set(ERC20_CVX_OHM_FRAXBP, "Curve OHM-FraxBP Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_CVX_OHMETH, "Curve OHM-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(ERC20_CVX_VL_V1, "Convex - Vote-Locked");
CONTRACT_NAME_MAP.set(ERC20_CVX_VL_V2, "Convex - Vote-Locked");
CONTRACT_NAME_MAP.set(ERC20_CVX, "Convex");
CONTRACT_NAME_MAP.set(ERC20_DAI, "DAI");
CONTRACT_NAME_MAP.set(ERC20_FDT, "FDT");
CONTRACT_NAME_MAP.set(ERC20_FEI, "FEI");
CONTRACT_NAME_MAP.set(ERC20_FOX, "FOX");
CONTRACT_NAME_MAP.set(ERC20_FPIS, "FPIS");
CONTRACT_NAME_MAP.set(ERC20_FRAX_3CRV, "Curve FRAX3Pool");
CONTRACT_NAME_MAP.set(ERC20_FRAX_BP, "FRAX-USDC LP Token");
CONTRACT_NAME_MAP.set(ERC20_FRAX, "FRAX");
CONTRACT_NAME_MAP.set(ERC20_FXS_VE, "FXS - Staked");
CONTRACT_NAME_MAP.set(ERC20_FXS, "FXS");
CONTRACT_NAME_MAP.set(ERC20_GOHM, "gOHM");
CONTRACT_NAME_MAP.set(ERC20_KP3R, "KP3R");
CONTRACT_NAME_MAP.set(ERC20_LDO, "Lido");
CONTRACT_NAME_MAP.set(ERC20_LQTY, "LQTY");
CONTRACT_NAME_MAP.set(ERC20_LUSD, "LUSD");
CONTRACT_NAME_MAP.set(ERC20_OHM_V1, "OHM V1");
CONTRACT_NAME_MAP.set(ERC20_OHM_V2, "OHM V2");
CONTRACT_NAME_MAP.set(ERC20_PRIME, "PrimeDAO");
CONTRACT_NAME_MAP.set(ERC20_SOHM_V1, "sOHM V1");
CONTRACT_NAME_MAP.set(ERC20_SOHM_V2, "sOHM V2");
CONTRACT_NAME_MAP.set(ERC20_SOHM_V3, "sOHM V3");
CONTRACT_NAME_MAP.set(ERC20_STETH, "stETH");
CONTRACT_NAME_MAP.set(ERC20_SUSHI, "SushiSwap");
CONTRACT_NAME_MAP.set(ERC20_SYN, "SYN");
CONTRACT_NAME_MAP.set(ERC20_THOR, "THOR");
CONTRACT_NAME_MAP.set(ERC20_TOKE, "TOKE");
CONTRACT_NAME_MAP.set(ERC20_TRIBE, "TRIBE");
CONTRACT_NAME_MAP.set(ERC20_USDC, "USDC");
CONTRACT_NAME_MAP.set(ERC20_UST, "UST");
CONTRACT_NAME_MAP.set(ERC20_WBTC, "wBTC");
CONTRACT_NAME_MAP.set(ERC20_WETH, "wETH");
CONTRACT_NAME_MAP.set(ERC20_WSTETH, "wstETH");
CONTRACT_NAME_MAP.set(ERC20_XSUSHI, "SUSHI - Staked");
CONTRACT_NAME_MAP.set(ETHBOND_CONTRACT1, "ETH Bond 1");
CONTRACT_NAME_MAP.set(EULER_ADDRESS, "Euler Finance");
CONTRACT_NAME_MAP.set(EULER_ADDRESS, "Euler Protocol");
CONTRACT_NAME_MAP.set(FRAX_LOCKING_FRAX_USDC, "Frax Farm - FraxBP");
CONTRACT_NAME_MAP.set(FRAX_LOCKING_OHM_FRAXBP, "Frax Farm - OHM-FraxBP");
CONTRACT_NAME_MAP.set(FRAXBOND_CONTRACT1, "FRAX Bond 1");
CONTRACT_NAME_MAP.set(LIQUITY_STABILITY_POOL, "Liquity Stability Pool");
CONTRACT_NAME_MAP.set(LQTY_STAKING, "LQTY Staking");
CONTRACT_NAME_MAP.set(LUSD_ALLOCATOR, "LUSD Allocator");
CONTRACT_NAME_MAP.set(LUSDBOND_CONTRACT1, "LUSD Bond 1");
CONTRACT_NAME_MAP.set(MAKER_DSR_ALLOCATOR_PROXY, "Maker DSR Allocator Proxy");
CONTRACT_NAME_MAP.set(MAKER_DSR_ALLOCATOR, "Maker DSR Allocator");
CONTRACT_NAME_MAP.set(MIGRATION_CONTRACT, "Migration Contract");
CONTRACT_NAME_MAP.set(MYSO_LENDING, "Myso Finance");
CONTRACT_NAME_MAP.set(NATIVE_ETH, "Native ETH");
CONTRACT_NAME_MAP.set(OHMDAISLPBOND_CONTRACT1, "OHM-DAI SLP Bond 1");
CONTRACT_NAME_MAP.set(OHMDAISLPBOND_CONTRACT2, "OHM-DAI SLP Bond 2");
CONTRACT_NAME_MAP.set(OHMDAISLPBOND_CONTRACT3, "OHM-DAI SLP Bond 3");
CONTRACT_NAME_MAP.set(OHMDAISLPBOND_CONTRACT4, "OHM-DAI SLP Bond 4");
CONTRACT_NAME_MAP.set(OHMFRAXLPBOND_CONTRACT1, "OHM-FRAX Bond 1");
CONTRACT_NAME_MAP.set(OHMFRAXLPBOND_CONTRACT2, "OHM-FRAX Bond 2");
CONTRACT_NAME_MAP.set(OHMLUSDBOND_CONTRACT1, "OHM-LUSD Bond 1");
CONTRACT_NAME_MAP.set(OLYMPUS_ASSOCIATION_WALLET, "Olympus Association");
CONTRACT_NAME_MAP.set(OLYMPUS_BOOSTED_LIQUIDITY_REGISTRY, "Boosted Liquidity Vault Registry");
CONTRACT_NAME_MAP.set(OLYMPUS_INCUR_DEBT, "IncurDebt");
CONTRACT_NAME_MAP.set(ONSEN_ALLOCATOR, "Onsen Allocator");
CONTRACT_NAME_MAP.set(OTC_ESCROW, "OTC Escrow");
CONTRACT_NAME_MAP.set(PAIR_CURVE_ETH_STETH, "Curve ETH-stETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_CURVE_FRAX_USDC, "Curve FRAX-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_CURVE_FXS_CVX_FXS, "Curve FXS-cvxFXS Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_CURVE_OHM_ETH, "Curve OHM V2-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_CURVE_OHM_FRAXBP, "Curve OHM-FraxBP Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_FRAXSWAP_V1_OHM_FRAX, "FraxSwap V1 OHM-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_FRAXSWAP_V2_OHM_FRAX, "FraxSwap V2 OHM-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_ALCX_ETH, "Uniswap V2 ALCX-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_CRV_ETH, "Uniswap V2 CRV-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_CVX_CRV_ETH, "Uniswap V2 cvxCRV-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_CVX_ETH, "Uniswap V2 CVX-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_FOX_ETH, "Uniswap V2 FOX-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_KP3R_ETH, "Uniswap V2 KP3R-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_BTRFLY_V1, "Uniswap V2 OHM-BTRFLY V1 Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_DAI_V2, "SushiSwap OHM V2-DAI Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_DAI, "SushiSwap OHM V1-DAI Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_ETH_V2, "SushiSwap OHM V2-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_ETH, "SushiSwap OHM V1-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_FRAX_V2, "Uniswap V2 OHM V2-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_FRAX, "Uniswap V2 OHM-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_LUSD_V2, "Uniswap V2 OHM V2-LUSD Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_OHM_LUSD, "Uniswap V2 OHM V1-LUSD Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_SUSHI_ETH, "Uniswap V2 SUSHI-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V2_SYN_FRAX, "Uniswap V2 SYN-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_3CRV_USD, "Uniswap V3 3CRV-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_AGEUR_USDC, "Uniswap V3 agEUR-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_FEI_USDC, "Uniswap V3 FEI-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_FPIS_FRAX, "Uniswap V3 FPIS-FRAX Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_FXS_ETH, "Uniswap V3 FXS-ETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_LDO_WETH, "Uniswap V3 LDO-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_LQTY_WETH, "Uniswap V3 LQTY-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_LUSD_USDC, "Uniswap V3 LUSD-USDC Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_WETH_BTRFLY_V1, "Uniswap V3 wETH-BTRFLY V1 Liquidity Pool");
CONTRACT_NAME_MAP.set(PAIR_UNISWAP_V3_WETH_BTRFLY_V2, "Uniswap V3 wETH-BTRFLY V2 Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_AURA_WETH_ID, "Balancer AURA-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_BAL_WETH_ID, "Balancer BAL-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_GRAVIAURA_AURABAL_WETH_ID, "Balancer graviAURA-auraBAL-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_OHM_DAI_WETH_ID, "Balancer OHM-DAI-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_OHM_DAI, "Balancer OHM-DAI Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_OHM_V2_BTRFLY_V2_ID, "Balancer OHM V2-BTRFLY V2 Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_OHM_WETH, "Balancer OHM-wETH Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_OHM_WSTETH_ID, "Balancer OHM-wstETH Liquidity Pool");
CONTRACT_NAME_MAP.set(POOL_BALANCER_WETH_FDT_ID, "Balancer wETH-FDT Liquidity Pool");
CONTRACT_NAME_MAP.set(RARI_ALLOCATOR, "Rari Allocator");
CONTRACT_NAME_MAP.set(SILO_ADDRESS, "Silo Finance");
CONTRACT_NAME_MAP.set(SILO_ADDRESS, "Silo Router");
CONTRACT_NAME_MAP.set(STAKING_CONTRACT_V1, "Staking V1");
CONTRACT_NAME_MAP.set(STAKING_CONTRACT_V2, "Staking V2");
CONTRACT_NAME_MAP.set(STAKING_CONTRACT_V3, "Staking V3");
CONTRACT_NAME_MAP.set(TOKE_ALLOCATOR, "Tokemak Allocator");
CONTRACT_NAME_MAP.set(TOKE_STAKING, "Tokemak Staking");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V1, "Treasury Wallet V1");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V2, "Treasury Wallet V2");
CONTRACT_NAME_MAP.set(TREASURY_ADDRESS_V3, "Treasury Wallet V3");
CONTRACT_NAME_MAP.set(TRSRY, "Bophades Treasury");
CONTRACT_NAME_MAP.set(VEFXS_ALLOCATOR, "VeFXS Allocator");
CONTRACT_NAME_MAP.set(VENDOR_LENDING, "Vendor Finance");

/**
 * Returns the name of a contract, given the {contractAddress}.
 *
 * The name will be returned in the following format:
 * <contract name> - <suffix> (<abbreviation>)
 *
 * If the suffix is not provided or an abbreviation cannot be found, they will be omitted.
 *
 * @param contractAddress this string will be converted into lowercase and a lookup performed in {CONTRACT_NAME_MAP}. If it cannot be found, the contract address will be returned.
 * @param suffix optional suffix to be appended after the contract name and before the abbreviation
 * @returns
 */
export const getContractName = (contractAddress: string, suffix: string | null = null, abbreviation: string | null = null): string => {
  const contractAddressLower = contractAddress.toLowerCase();

  // Assemble the first part
  const contractName = CONTRACT_NAME_MAP.has(contractAddressLower)
    ? CONTRACT_NAME_MAP.get(contractAddressLower)
    : contractAddressLower;

  // Suffix
  const contractSuffix = suffix ? ` - ${suffix}` : "";

  // Abbreviation
  const contractAbbreviation = abbreviation
    ? ` (${abbreviation})`
    : CONTRACT_ABBREVIATION_MAP.has(contractAddressLower)
      ? ` (${CONTRACT_ABBREVIATION_MAP.get(contractAddressLower)})`
      : "";

  return `${contractName}${contractSuffix}${contractAbbreviation}`;
};

/**
 * Determines if two addresses (in string format) are equal.
 *
 * This ensures that:
 * - Both addresses are lowercase
 * - The correct equality test (==) is used: https://github.com/AssemblyScript/assemblyscript/issues/621
 */
export const addressesEqual = (one: string, two: string): boolean => {
  return one.toLowerCase() == two.toLowerCase();
};
