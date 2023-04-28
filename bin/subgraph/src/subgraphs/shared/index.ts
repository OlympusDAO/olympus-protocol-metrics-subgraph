import { BaseNetworkHandler } from "../../networkHandler";
import { getTestBlock, getTokenRecords, getTokenSupplies } from "../../subgraph";
import {
  combineOutput,
  compareLiquidBackingRecords,
  compareMarketValueRecords,
  compareOHMSupplyRecords,
  doMarketValueCheck,
} from "./compare";
import { readComparisonFile, writeComparisonFile } from "./results";

export default class EthereumHandler extends BaseNetworkHandler {
  async doLatestBlock(): Promise<void> {
    const comparisonFile = readComparisonFile(this.outputPath);

    const latestBlock = await getTestBlock(this.subgraphId);

    comparisonFile.latestBlock = latestBlock;
    writeComparisonFile(comparisonFile, this.outputPath);
  }

  async doQuery(): Promise<void> {
    const comparisonFile = readComparisonFile(this.outputPath);

    const tokenRecords = await getTokenRecords(this.subgraphId, comparisonFile.latestBlock);
    const tokenSupplies = await getTokenSupplies(this.subgraphId, comparisonFile.latestBlock);

    // Update the comparison results and write
    comparisonFile.branches[this.branch] = {
      subgraphId: this.subgraphId,
    };

    comparisonFile.records.tokenRecords[this.branch] = tokenRecords;
    comparisonFile.records.tokenSupplies[this.branch] = tokenSupplies;

    writeComparisonFile(comparisonFile, this.outputPath);
  }

  async doComparison(): Promise<void> {
    const comparisonFile = readComparisonFile(this.outputPath);

    // Read TokenRecord files, parse into JSON
    const baseRecords = comparisonFile.records.tokenRecords.base;
    const branchRecords = comparisonFile.records.tokenRecords.branch;

    const tokenSuppliesBase = comparisonFile.records.tokenSupplies.base;
    const tokenSuppliesBranch = comparisonFile.records.tokenSupplies.branch;

    compareMarketValueRecords(baseRecords, branchRecords, comparisonFile);
    compareLiquidBackingRecords(baseRecords, branchRecords, comparisonFile);
    compareOHMSupplyRecords(tokenSuppliesBase, tokenSuppliesBranch, comparisonFile);

    doMarketValueCheck(branchRecords, comparisonFile);

    combineOutput(this.network, comparisonFile);

    writeComparisonFile(comparisonFile, this.outputPath);
  }
}
