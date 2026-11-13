// RR-105: a radar's legend placement and value axis, decided once so the preview draws and the PPTX export writes the same radar.
//
// The preview lays a radar out in its chart box: the series legend at the side (two or more series), the spoke labels around the web
// (each at most a fifth of the box wide, a second line when a label breaks at a space), and the web's radius in what is left. In a box
// taller than it is wide a side legend takes the width the web needs, so three radars in a row drew at a fifth of their boxes. The
// legend goes under the radar when that gives the web a radius larger by RADAR_BOTTOM_LEGEND_GAIN; the value axis takes as many
// intervals as the radius holds lines of text (the rule every value axis follows, niceScale with endOnTick), so a small web no longer
// steps by 5 to 10 for data up to 5.
import {chartTextSize, maxIntervalsFor, niceScale} from './chart-axis.js';
import {chartNumber, type ResolvedChartData} from './chart-data.js';

interface Box {x: number; y: number; width: number; height: number}
/** The geometry a radar is laid out in (chart-layer.ts ChartLayerGeometry). */
interface RadarGeometry {box: Box; scale: number; minFontSize?: number; measure: (text: string, size: number, weight: 400 | 700) => number}

/** RR-105: a radar's layout, read by both engines: where its legend stands and its value axis. */
export interface ChartLayerRadar {
  /** `bottom`: the legend is a row under the web; `right`: at the side (the default chart legend). */
  legend: 'right' | 'bottom';
  /**
   * A bottom legend's band (slide pixels): its rows of entries centered across the box, `pad` above the box's bottom edge; the web and its
   * labels are laid out in the box above it. The PPTX export writes it as the legend's manual layout.
   */
  legendBox?: Box;
  /** The value axis (ticks from `min` to `max` every `majorUnit`), which the PPTX export writes as the radar's c:valAx scaling. */
  axis: {min: number; max: number; majorUnit: number};
}

/** The legend moves under the web only when the web grows by at least this share, so a radar near the balance keeps its side legend. */
export const RADAR_BOTTOM_LEGEND_GAIN = 1.1;
const RADAR_TYPES: Readonly<Record<string, 'line' | 'filled'>> = {radar: 'line', 'radar-with-markers': 'line', 'filled-radar': 'filled'};
// Whitespace a label may break at; no-break spaces stay inside their word (as the preview's category labels).
const BREAKABLE = /[^\S  ﻿]+/u;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const flat = (value: unknown): string => value === null || value === undefined ? '' : String(value).replace(/[\r\n]+/g, ' ');

/**
 * The layout of a radar chart (`radar`, `radar-with-markers`, `filled-radar`) in `geometry.box`, or undefined for any other chart. A chart
 * with an authored `legend` keeps it: only the default legend of two or more series may move under the web.
 */
export function chartRadarLayout(chart: unknown, data: ResolvedChartData, geometry: RadarGeometry): ChartLayerRadar | undefined {
  if (!record(chart) || !data.ok || typeof chart.type !== 'string') return undefined;
  const style = RADAR_TYPES[chart.type.trim().toLowerCase()];
  const {box, scale} = geometry;
  if (!style || ![box.width, box.height, scale].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || scale <= 0) return undefined;
  const fontPx = chartTextSize({width: box.width, height: box.height, scale, minFontSize: geometry.minFontSize}) * scale;
  const pad = 10 * scale, lineHeight = fontPx * 1.5, textHeight = fontPx * 1.22;
  const width = (text: string) => text ? geometry.measure(text, fontPx, 400) : 0;
  const categories = data.rows.map(row => flat(row[0]));
  const names = data.columns.slice(1).map(flat);
  // The spoke labels: at most a fifth of the box wide; a label that fits there on two lines (broken at a space) keeps a second line of room.
  const labelWidth = Math.min(box.width * 0.2, Math.max(0, ...categories.map(width)) + fontPx * 0.5);
  const wraps = categories.some(text => {
    if (width(text) <= labelWidth + 0.01) return false;
    const words = text.split(BREAKABLE).filter(Boolean);
    let best = Infinity;
    for (let split = 1; split < words.length; split++) best = Math.min(best, Math.max(width(words.slice(0, split).join(' ')), width(words.slice(split).join(' '))));
    return best <= labelWidth + 0.01;
  });
  const radiusIn = (area: {width: number; height: number}) => Math.max(1, Math.min(area.width / 2 - labelWidth, area.height / 2 - lineHeight - (wraps ? textHeight : 0)));
  const inner = {width: Math.max(1, box.width - 2 * pad), height: Math.max(1, box.height - 2 * pad)};
  let legend: ChartLayerRadar['legend'] = 'right', radius = radiusIn(inner), legendBox: Box | undefined;
  if (chart.legend === undefined && names.length > 1) {
    // The side legend: its key (a line for a line radar, a swatch for a filled one), the space and the widest name.
    const keyWidth = style === 'line' ? fontPx * 1.4 : fontPx * 0.6, gap = fontPx * 0.4;
    const side = Math.min(box.width * 0.45, keyWidth + gap + Math.max(...names.map(width)) + fontPx * 0.5) + pad;
    const right = radiusIn({width: Math.max(1, inner.width - side), height: inner.height});
    // The bottom legend: the entries in centered rows across the box, each its key, space, name and 0.8 text sizes after it.
    const spacing = fontPx * 0.8, rows: number[] = [];
    for (const entry of names.map(name => Math.min(inner.width, keyWidth + gap + width(name) + spacing))) {
      if (rows.length && rows[rows.length - 1]! + entry <= inner.width + 0.01) rows[rows.length - 1]! += entry; else rows.push(entry);
    }
    const bottom = radiusIn({width: inner.width, height: Math.max(1, inner.height - rows.length * lineHeight - pad)});
    if (bottom >= right * RADAR_BOTTOM_LEGEND_GAIN) {
      const widest = Math.max(...rows) - spacing, band = rows.length * lineHeight;
      legend = 'bottom'; radius = bottom;
      legendBox = {x: box.x + (box.width - widest) / 2, y: box.y + box.height - pad - band, width: widest, height: band};
    } else radius = right;
  }
  const values = data.rows.flatMap(row => data.columns.slice(1).map((_, series) => chartNumber(row[series + 1]))).filter((value): value is number => value !== null);
  const axis = niceScale(values.length ? Math.min(...values) : 0, values.length ? Math.max(...values) : 1, maxIntervalsFor(radius, lineHeight), {endOnTick: true});
  return {legend, ...(legendBox ? {legendBox} : {}), axis: {min: axis.min, max: axis.max, majorUnit: axis.step}};
}
