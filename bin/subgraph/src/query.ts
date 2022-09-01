import { writeFileSync } from "fs";

import { ComparisonResults, writeComparisonFile } from "./helpers/results";
import { getTokenRecords } from "./subgraph";

export const writeTokenRecords = (
  subgraphId: string,
  branch: string,
  block: string,
  comparisonFile: ComparisonResults,
): void => {
  const FILENAME = `records-${branch}.json`;
  getTokenRecords(subgraphId, block).then((tokenRecords) => {
    // Write to a JSON file
    writeFileSync(FILENAME, JSON.stringify(tokenRecords, null, 2));
    console.info(`TokenRecord results written to ${FILENAME}`);

    // Update the comparison results and write
    comparisonFile.branches[branch] = {
      subgraphId: subgraphId,
    };
    writeComparisonFile(comparisonFile);
  });
};
