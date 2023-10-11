import { BaseNetworkHandler } from "../../networkHandler";
import { getLatestBlock, getOhmPrice, getTestDate, getTokenRecords, getTokenSupplies } from "../../subgraph";
import {
  combineOutput,
  compareBackedSupplyRecords,
  compareCirculatingSupplyRecords,
  compareFloatingSupplyRecords,
  compareLiquidBackingRecords,
  compareMarketValueRecords,
  doLiquidBackingCheck,
  doMarketValueCheck,
} from "./compare";
import { readComparisonFile, writeComparisonFile } from "./results";

export default class EthereumHandler extends BaseNetworkHandler {
  async doLatestDate(): Promise<void> {
    const comparisonFile = readComparisonFile(this.outputPath);

    const latestDate = await getTestDate(this.subgraphId);
    comparisonFile.latestDate = latestDate;

    writeComparisonFile(comparisonFile, this.outputPath);
  }

  async doQuery(): Promise<void> {
    const comparisonFile = readComparisonFile(this.outputPath);
    const branchInfo = {
      subgraphId: "",
      blockNumber: "",
    };

    // Fetch the latest block for each branch
    const latestBlock = await getLatestBlock(this.subgraphId, comparisonFile.latestDate);
    branchInfo.blockNumber = latestBlock;

    const tokenRecords = await getTokenRecords(this.subgraphId, latestBlock);
    const tokenSupplies = await getTokenSupplies(this.subgraphId, latestBlock);

    // Update the comparison results and write
    branchInfo.subgraphId = this.subgraphId;

    comparisonFile.records.tokenRecords[this.branch] = tokenRecords;
    comparisonFile.records.tokenSupplies[this.branch] = tokenSupplies;
    comparisonFile.branches[this.branch] = branchInfo;

    writeComparisonFile(comparisonFile, this.outputPath);
  }

  async doComparison(): Promise<void> {
    const comparisonFile = readComparisonFile(this.outputPath);

    // Read TokenRecord files, parse into JSON
    const tokenRecordsBase = comparisonFile.records.tokenRecords.base;
    const tokenRecordsBranch = comparisonFile.records.tokenRecords.branch;

    const tokenSuppliesBase = comparisonFile.records.tokenSupplies.base;
    const tokenSuppliesBranch = comparisonFile.records.tokenSupplies.branch;

    compareMarketValueRecords(tokenRecordsBase, tokenRecordsBranch, comparisonFile);
    compareLiquidBackingRecords(tokenRecordsBase, tokenRecordsBranch, comparisonFile);

    // Get OHM price
    const subgraphId = comparisonFile.branches.branch.subgraphId;
    const block = comparisonFile.branches.branch.blockNumber;
    const ohmPrice = await getOhmPrice(subgraphId, block);

    doLiquidBackingCheck(tokenRecordsBranch, tokenSuppliesBranch, ohmPrice, comparisonFile);
    doMarketValueCheck(tokenRecordsBranch, comparisonFile);

    compareCirculatingSupplyRecords(tokenSuppliesBase, tokenSuppliesBranch, comparisonFile);
    compareFloatingSupplyRecords(tokenSuppliesBase, tokenSuppliesBranch, comparisonFile);
    compareBackedSupplyRecords(tokenSuppliesBase, tokenSuppliesBranch, comparisonFile);

    combineOutput(this.network, comparisonFile);

    writeComparisonFile(comparisonFile, this.outputPath);
  }
}
