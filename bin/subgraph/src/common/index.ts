import { BaseNetworkHandler } from "../networkHandler";
import { getTestBlock, getTokenRecords } from "../subgraph";
import {
  combineOutput,
  compareLiquidBackingRecords,
  compareMarketValueRecords,
  doMarketValueCheck,
} from "./compare";
import { readComparisonFile, writeComparisonFile } from "./results";

export default class EthereumHandler extends BaseNetworkHandler {
  doLatestBlock(): void {
    const comparisonFile = readComparisonFile(this.outputPath);

    getTestBlock(this.subgraphId).then((latestBlock: string) => {
      comparisonFile.latestBlock = latestBlock;
      writeComparisonFile(comparisonFile, this.outputPath);
    });
  }

  doQuery(): void {
    const comparisonFile = readComparisonFile(this.outputPath);

    getTokenRecords(this.subgraphId, comparisonFile.latestBlock).then((tokenRecords) => {
      // Update the comparison results and write
      comparisonFile.branches[this.branch] = {
        subgraphId: this.subgraphId,
      };

      comparisonFile.records.tokenRecords[this.branch] = tokenRecords;

      writeComparisonFile(comparisonFile, this.outputPath);
    });
  }

  doComparison(): void {
    const comparisonFile = readComparisonFile(this.outputPath);

    // Read TokenRecord files, parse into JSON
    const baseRecords = comparisonFile.records.tokenRecords.base;
    const branchRecords = comparisonFile.records.tokenRecords.branch;

    compareMarketValueRecords(baseRecords, branchRecords, comparisonFile);
    compareLiquidBackingRecords(baseRecords, branchRecords, comparisonFile);

    doMarketValueCheck(branchRecords, comparisonFile);
    combineOutput(this.network, comparisonFile);

    writeComparisonFile(comparisonFile, this.outputPath);
  }
}
