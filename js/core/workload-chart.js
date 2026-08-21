const PIE_CENTER = 50;
const PIE_RADIUS = 44;
const FULL_TURN = Math.PI * 2;

function pointAt(ratio) {
  const angle = (ratio * FULL_TURN) - (Math.PI / 2);
  return {
    x: PIE_CENTER + (PIE_RADIUS * Math.cos(angle)),
    y: PIE_CENTER + (PIE_RADIUS * Math.sin(angle))
  };
}

function coordinate(value) {
  return Number(value.toFixed(3));
}

export function workloadPiePath(startRatio, endRatio) {
  const start = Math.max(0, Math.min(1, Number(startRatio) || 0));
  const end = Math.max(start, Math.min(1, Number(endRatio) || 0));
  const span = end - start;
  if (span <= 0) return '';
  if (span >= 0.999999) {
    return `M ${PIE_CENTER} ${PIE_CENTER} L ${PIE_CENTER} ${PIE_CENTER - PIE_RADIUS} A ${PIE_RADIUS} ${PIE_RADIUS} 0 1 1 ${PIE_CENTER} ${PIE_CENTER + PIE_RADIUS} A ${PIE_RADIUS} ${PIE_RADIUS} 0 1 1 ${PIE_CENTER} ${PIE_CENTER - PIE_RADIUS} Z`;
  }
  const first = pointAt(start);
  const last = pointAt(end);
  const largeArc = span > 0.5 ? 1 : 0;
  return `M ${PIE_CENTER} ${PIE_CENTER} L ${coordinate(first.x)} ${coordinate(first.y)} A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${coordinate(last.x)} ${coordinate(last.y)} Z`;
}

export function createWorkloadChartModel(rows, maximumSegments = 6) {
  const normalized = (Array.isArray(rows) ? rows : []).map((row) => ({
    label: String(row && row.display_name || '').trim() || 'Staff member',
    count: Math.max(0, Math.round(Number(row && row.completed_count) || 0))
  })).filter((row) => row.count > 0);

  const segmentLimit = Math.max(2, Math.round(Number(maximumSegments) || 6));
  let segments = normalized;
  if (normalized.length > segmentLimit) {
    const visible = normalized.slice(0, segmentLimit - 1);
    const groupedCount = normalized.slice(segmentLimit - 1).reduce((sum, row) => sum + row.count, 0);
    segments = visible.concat({ label: 'Other inspectors', count: groupedCount });
  }

  const total = segments.reduce((sum, row) => sum + row.count, 0);
  const exactPercentages = segments.map((segment) => total > 0 ? (segment.count / total) * 100 : 0);
  const percentages = exactPercentages.map((percentage) => Math.floor(percentage));
  let percentageRemainder = Math.max(0, 100 - percentages.reduce((sum, percentage) => sum + percentage, 0));
  exactPercentages.map((percentage, index) => ({
    index,
    fraction: percentage - Math.floor(percentage)
  })).sort((a, b) => b.fraction - a.fraction || a.index - b.index).forEach((entry) => {
    if (percentageRemainder <= 0) return;
    percentages[entry.index] += 1;
    percentageRemainder -= 1;
  });
  let cursor = 0;
  return {
    total,
    segments: segments.map((segment, index) => {
      const startRatio = total > 0 ? cursor / total : 0;
      cursor += segment.count;
      const endRatio = total > 0 ? cursor / total : 0;
      return {
        ...segment,
        index,
        percentage: percentages[index] || 0,
        path: workloadPiePath(startRatio, endRatio)
      };
    })
  };
}
