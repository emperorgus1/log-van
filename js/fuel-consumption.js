export function fuelConsumptionIntervals(fuelRecords) {
  const sorted = fuelRecords
    .filter((record) => typeof record.odometer === 'number')
    .sort((a, b) => a.odometer - b.odometer);
  const intervals = [];
  let previousFullIndex = -1;

  sorted.forEach((record, index) => {
    if (!record.fullTank) return;

    if (previousFullIndex !== -1) {
      const previous = sorted[previousFullIndex];
      const distance = record.odometer - previous.odometer;
      const liters = sorted.slice(previousFullIndex + 1, index + 1)
        .reduce((sum, item) => sum + (item.liters || 0), 0);

      if (distance > 0 && liters > 0) {
        intervals.push({
          record,
          distance,
          liters,
          consumption: (liters / distance) * 100,
        });
      }
    }

    previousFullIndex = index;
  });

  return intervals;
}

export function totalAverageConsumption(fuelRecords) {
  const intervals = fuelConsumptionIntervals(fuelRecords);
  if (!intervals.length) return null;

  const distance = intervals.reduce((sum, interval) => sum + interval.distance, 0);
  const liters = intervals.reduce((sum, interval) => sum + interval.liters, 0);
  return distance > 0 && liters > 0 ? (liters / distance) * 100 : null;
}

export function latestConsumption(fuelRecords) {
  const intervals = fuelConsumptionIntervals(fuelRecords);
  return intervals.length ? intervals[intervals.length - 1].consumption : null;
}
