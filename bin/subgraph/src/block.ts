import { ComparisonResults, writeComparisonFile } from "./helpers/results";
import { getTestBlock } from "./subgraph";

/**
 * Fetches the latest block for the given subgraphId, and writes it to ${COMPARISON_FILE}.
 *
 * @param subgraphId
 * @param comparisonFile
 */
export const writeLatestBlock = (subgraphId: string, comparisonFile: ComparisonResults): void => {
  getTestBlock(subgraphId).then((latestBlock) => {
    comparisonFile.latestBlock = latestBlock;
    writeComparisonFile(comparisonFile);
  });
};
