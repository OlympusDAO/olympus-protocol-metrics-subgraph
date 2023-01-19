import { BigDecimal } from "@graphprotocol/graph-ts";

export function getDelta(a: BigDecimal, b: BigDecimal | null): BigDecimal | null {
    if (!b || b.equals(BigDecimal.zero())) {
        return null;
    }

    return a.div(b).minus(BigDecimal.fromString("1"));
}

export function getMean(values: BigDecimal[]): BigDecimal {
    let total = BigDecimal.zero();

    for (let i = 0; i < values.length; i++) {
        total = total.plus(values[i]);
    }

    return total.div(BigDecimal.fromString(values.length.toString()));
}

export function getStandardDeviation(values: BigDecimal[], count: u32): BigDecimal | null {
    if (values.length != count) {
        return null;
    }

    // https://www.mathsisfun.com/data/standard-deviation-formulas.html
    const mean = getMean(values);

    const meanDifferences: BigDecimal[] = [];
    for (let i = 0; i < values.length; i++) {
        const currentValue = values[i];
        const meanDifference = currentValue.minus(mean);
        const meanDifferenceSq = meanDifference.times(meanDifference);

        meanDifferences.push(meanDifferenceSq);
    }

    const meanDifferencesMean = getMean(meanDifferences);

    return BigDecimal.fromString(sqrt(parseFloat(meanDifferencesMean.toString())).toString());
}
