/**
 * Implement this interface to handle queries related to a specific network.
 */
export interface NetworkHandler {
  network: string;
  outputPath: string;
  subgraphId: string;
  branch: string;

  doLatestBlock(): void;
  doQuery(): void;
  doComparison(): void;
}

export class BaseNetworkHandler implements NetworkHandler {
  network: string;
  subgraphId: string;
  branch: string;
  outputPath: string;

  constructor(network: string, outputPath: string, subgraphId?: string, branch?: string) {
    console.info(`Created network handler with network ${network}, outputPath ${outputPath}, subgraphId ${subgraphId}, branch ${branch}`);

    this.network = network;
    this.subgraphId = subgraphId;
    this.branch = branch;
    this.outputPath = outputPath;
  }

  public doLatestBlock(): void {
    throw new Error("Method not implemented.");
  }
  public doQuery(): void {
    throw new Error("Method not implemented.");
  }
  public doComparison(): void {
    throw new Error("Method not implemented.");
  }
}
