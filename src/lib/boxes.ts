import generated from '@/data/boxes.generated.json'
import { list } from './db'
import type { BoxRecord } from './types'

export interface BoxCalculatorForm {
  length: string
  width: string
  height: string
  qty: string
  adjustmentMm: string
  adjustmentMode: 'add' | 'subtract'
  uprightOnly: boolean
  mixedStack: boolean
}

export interface BoxCalculatorInput {
  length_cm: number
  width_cm: number
  height_cm: number
  original_length_cm: number
  original_width_cm: number
  original_height_cm: number
  adjustment_mm: number
  adjustment_mode: 'add' | 'subtract'
  qty: number
  upright_only: boolean
  mixed_stack: boolean
}

export interface BoxPlanSegment {
  type: 'single' | 'upright' | 'lying_top'
  orientation: number[]
  counts: number[]
  layers?: number
  capacity: number
  index?: number
  perLayer?: number
  usedItems?: number
  usedLayers?: number
  drawnLayerItems?: number
  usedHeight?: number
}

export interface BoxPlan {
  capacity: number
  counts: number[]
  orientation: number[]
  packing_mode: 'single' | 'mixed_stack'
  segments: BoxPlanSegment[]
  used_height: number
}

export interface BoxMatch extends BoxRecord {
  length_cm: number
  width_cm: number
  height_cm: number
  volume_cm3: number
  capacity: number
  counts: number[]
  orientation: number[]
  packing_mode: 'single' | 'mixed_stack'
  segments: BoxPlanSegment[]
  used_height_cm: number
  upright_only: boolean
  mixed_stack: boolean
  free_volume_cm3: number
  fill_percent: number
}

export type NormalizedBoxInput =
  | { ok: true; input: BoxCalculatorInput }
  | { ok: false; error: string }

export type BoxMatchResult =
  | { ok: true; input: BoxCalculatorInput; total_boxes: number; matches: BoxMatch[] }
  | { ok: false; error: string }

export interface BoxDataSource {
  source: string
  generatedAt: string
  boxes: BoxRecord[]
}

export const initialBoxForm: BoxCalculatorForm = {
  length: '',
  width: '',
  height: '',
  qty: '1',
  adjustmentMm: '0',
  adjustmentMode: 'add',
  uprightOnly: false,
  mixedStack: false,
}

export async function loadBoxes(): Promise<BoxDataSource> {
  try {
    const rows = await list('boxes')
    const boxes = normalizeBoxes(rows)
    if (boxes.length) {
      return {
        source: 'supabase',
        generatedAt: new Date().toISOString(),
        boxes,
      }
    }
  } catch (error) {
    console.warn('Boxes table is unavailable, falling back to generated JSON', error)
  }

  return {
    source: generated.source_file || 'box.xlsx',
    generatedAt: generated.generated_at,
    boxes: normalizeBoxes(generated.boxes),
  }
}

export function parsePositiveNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null
}

export function parseNonNegativeNumber(value: unknown): number | null {
  if (value == null || value === '') return 0
  const number = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null
}

export function formatBoxNumber(value: unknown, digits = 1): string {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return Number(value).toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

export function formatBoxInputNumber(value: unknown): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  return String(Math.round(Number(value) * 100) / 100).replace('.', ',')
}

export function formatBoxDims(boxOrDims: BoxRecord | BoxMatch | number[]): string {
  const dims = Array.isArray(boxOrDims)
    ? boxOrDims
    : [boxOrDims.length_cm, boxOrDims.width_cm, boxOrDims.height_cm]
  return `${formatBoxNumber(dims[0])} x ${formatBoxNumber(dims[1])} x ${formatBoxNumber(dims[2])} см`
}

export function titleForBox(box: BoxRecord): string {
  if (box.article) return `Арт. ${box.article}`
  return box.name || `Коробка ${box.source_row || ''}`.trim()
}

export function volumeOf(box: Pick<BoxRecord, 'length_cm' | 'width_cm' | 'height_cm'>): number {
  return Math.round(box.length_cm * box.width_cm * box.height_cm * 100) / 100
}

export function normalizeAdjustmentMode(value: unknown): 'add' | 'subtract' {
  return String(value || '').toLowerCase() === 'subtract' ? 'subtract' : 'add'
}

export function applyDimensionAdjustment(
  dimensions: number[],
  adjustmentMm = 0,
  mode: 'add' | 'subtract' = 'add',
): number[] {
  const sign = normalizeAdjustmentMode(mode) === 'subtract' ? -1 : 1
  const adjustmentCm = sign * (Number(adjustmentMm || 0) / 10)
  return dimensions.map((value) => Math.round((value + adjustmentCm) * 100) / 100)
}

export function normalizeCalculatorInput(form: BoxCalculatorForm): NormalizedBoxInput {
  const length = parsePositiveNumber(form.length)
  const width = parsePositiveNumber(form.width)
  const height = parsePositiveNumber(form.height)
  const qty = Math.max(1, Number.parseInt(form.qty || '1', 10) || 1)
  const adjustmentMm = parseNonNegativeNumber(form.adjustmentMm)
  const adjustmentMode = normalizeAdjustmentMode(form.adjustmentMode)

  if (!length || !width || !height) {
    return { ok: false, error: 'Введіть довжину, ширину і висоту товару.' }
  }

  if (adjustmentMm == null) {
    return { ok: false, error: 'Поправка має бути числом 0 або більше.' }
  }

  const originalDims = [length, width, height]
  const itemDims = applyDimensionAdjustment(originalDims, adjustmentMm, adjustmentMode)
  if (itemDims.some((value) => value <= 0)) {
    return { ok: false, error: 'Після поправки кожен розмір має бути більшим за 0.' }
  }

  return {
    ok: true,
    input: {
      length_cm: itemDims[0],
      width_cm: itemDims[1],
      height_cm: itemDims[2],
      original_length_cm: length,
      original_width_cm: width,
      original_height_cm: height,
      adjustment_mm: adjustmentMm,
      adjustment_mode: adjustmentMode,
      qty,
      upright_only: Boolean(form.uprightOnly),
      mixed_stack: Boolean(form.mixedStack),
    },
  }
}

export function matchBoxes(boxes: BoxRecord[], form: BoxCalculatorForm): BoxMatchResult {
  const normalized = normalizeCalculatorInput(form)
  if (!normalized.ok) return normalized

  const input = normalized.input
  const itemDims = [input.length_cm, input.width_cm, input.height_cm]
  const matches = boxes
    .map((box) => {
      const plan = fitBoxPlan(box, itemDims, {
        qty: input.qty,
        uprightOnly: input.upright_only,
        mixedStack: input.mixed_stack,
      })
      if (plan.capacity < input.qty) return null
      return applyPlan(box, plan, input)
    })
    .filter((box): box is BoxMatch => Boolean(box))
    .sort(
      (a, b) =>
        a.volume_cm3 - b.volume_cm3 ||
        a.free_volume_cm3 - b.free_volume_cm3 ||
        String(a.article || a.name).localeCompare(String(b.article || b.name), 'uk'),
    )

  return {
    ok: true,
    input,
    total_boxes: boxes.length,
    matches: matches.slice(0, 30),
  }
}

export function fitBoxPlan(
  box: Pick<BoxRecord, 'length_cm' | 'width_cm' | 'height_cm'>,
  itemDims: number[],
  options: { qty?: number; uprightOnly?: boolean; mixedStack?: boolean } = {},
): BoxPlan {
  const boxDims = [box.length_cm, box.width_cm, box.height_cm]
  const qty = Math.max(1, Number.parseInt(String(options.qty || 1), 10) || 1)
  const single = buildSinglePlan(boxDims, itemDims, Boolean(options.uprightOnly))
  if (!options.mixedStack) return single

  const mixed = buildMixedStackPlan(boxDims, itemDims, qty)
  if (!mixed) return single

  const singleFits = single.capacity >= qty
  const mixedFits = mixed.capacity >= qty
  if (mixedFits && !singleFits) return mixed
  if (!mixedFits && !singleFits && mixed.capacity > single.capacity) return mixed

  if (mixedFits && singleFits) {
    const mixedSpare = mixed.capacity - qty
    const singleSpare = single.capacity - qty
    if (mixedSpare <= singleSpare || mixed.capacity > single.capacity) return mixed
  }

  return single
}

export function applyPlan(box: BoxRecord, plan: BoxPlan, input: BoxCalculatorInput): BoxMatch {
  const itemVolume = input.length_cm * input.width_cm * input.height_cm
  const usedVolume = itemVolume * input.qty
  const boxVolume = volumeOf(box)

  return {
    ...box,
    volume_cm3: boxVolume,
    capacity: plan.capacity,
    counts: plan.counts,
    orientation: plan.orientation,
    packing_mode: plan.packing_mode,
    segments: plan.segments,
    used_height_cm: plan.used_height,
    upright_only: Boolean(input.upright_only),
    mixed_stack: Boolean(input.mixed_stack),
    free_volume_cm3: Math.round(Math.max(0, boxVolume - usedVolume) * 100) / 100,
    fill_percent: boxVolume ? Math.min(100, Math.round((usedVolume / boxVolume) * 1000) / 10) : 0,
  }
}

export function allocateSegments(box: BoxMatch, qty: number): Required<BoxPlanSegment>[] {
  const segments =
    Array.isArray(box.segments) && box.segments.length
      ? box.segments
      : [
          {
            type: box.upright_only ? 'upright' : 'single',
            orientation: box.orientation || [box.length_cm, box.width_cm, box.height_cm],
            counts: box.counts || [1, 1, 1],
            capacity: box.capacity || 0,
          } satisfies BoxPlanSegment,
        ]

  let remaining = qty
  return segments.map((segment, index) => {
    const [countX = 0, countY = 0, countZ = 0] = segment.counts || [0, 0, 0]
    const perLayer = Math.max(1, countX * countY)
    const capacity = segment.capacity ?? perLayer * countZ
    const usedItems = Math.min(Math.max(0, remaining), capacity)
    remaining -= usedItems
    const usedLayers = usedItems > 0 ? Math.min(countZ, Math.ceil(usedItems / perLayer)) : 0
    const drawnLayerItems = usedItems > 0 ? usedItems - (usedLayers - 1) * perLayer : 0
    const orientation = segment.orientation || box.orientation || [box.length_cm, box.width_cm, box.height_cm]

    return {
      ...segment,
      index,
      type: segment.type,
      counts: [countX, countY, countZ],
      orientation,
      layers: segment.layers ?? countZ,
      capacity,
      perLayer,
      usedItems,
      usedLayers,
      drawnLayerItems: drawnLayerItems || (usedItems > 0 ? perLayer : 0),
      usedHeight: usedLayers * (orientation[2] || 0),
    }
  })
}

export function layerInfo(box: BoxMatch, qty: number) {
  const segments = allocateSegments(box, qty)
  const usedSegments = segments.filter((segment) => segment.usedItems > 0)
  const active =
    usedSegments[usedSegments.length - 1] ||
    segments[0] || {
      counts: [0, 0, 0],
      orientation: [box.length_cm, box.width_cm, box.height_cm],
      perLayer: 1,
      drawnLayerItems: 0,
      usedLayers: 0,
    }
  const activeCounts = active.counts || [0, 0, 0]
  const activeOrientation = active.orientation || [box.length_cm, box.width_cm, box.height_cm]
  const usedHeight = usedSegments.reduce((total, segment) => total + segment.usedHeight, 0)

  return {
    mixed: box.packing_mode === 'mixed_stack',
    segments,
    active,
    counts: activeCounts,
    orientation: activeOrientation,
    perLayer: active.perLayer || Math.max(1, activeCounts[0] * activeCounts[1]),
    usedLayers: active.usedLayers || 0,
    drawnLayerItems: active.drawnLayerItems || 0,
    freeX: Math.max(0, box.length_cm - activeCounts[0] * activeOrientation[0]),
    freeY: Math.max(0, box.width_cm - activeCounts[1] * activeOrientation[1]),
    freeZ: Math.max(0, box.height_cm - usedHeight),
    usedHeight,
  }
}

function normalizeBoxes(rows: Partial<BoxRecord>[]): BoxRecord[] {
  return rows
    .map((row) => ({
      id: row.id ?? undefined,
      source_row: Number(row.source_row ?? 0),
      article: row.article ?? '',
      name: row.name ?? '',
      length_cm: Number(row.length_cm),
      width_cm: Number(row.width_cm),
      height_cm: Number(row.height_cm),
      volume_cm3: Number(row.volume_cm3 ?? Number(row.length_cm) * Number(row.width_cm) * Number(row.height_cm)),
      original: row.original ?? '',
      note: row.note ?? '',
      is_active: row.is_active ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
    .filter(
      (box) =>
        box.is_active &&
        box.length_cm > 0 &&
        box.width_cm > 0 &&
        box.height_cm > 0,
    )
    .sort(
      (a, b) =>
        a.volume_cm3 - b.volume_cm3 ||
        String(a.article || a.name).localeCompare(String(b.article || b.name), 'uk'),
    )
}

function permutations(values: number[]): number[][] {
  const result: { key: string; values: number[] }[] = []
  const used = Array(values.length).fill(false)

  function walk(current: number[]) {
    if (current.length === values.length) {
      const key = current.join('|')
      if (!result.some((item) => item.key === key)) result.push({ key, values: current.slice() })
      return
    }

    for (let index = 0; index < values.length; index += 1) {
      if (used[index]) continue
      used[index] = true
      current.push(values[index])
      walk(current)
      current.pop()
      used[index] = false
    }
  }

  walk([])
  return result.map((item) => item.values)
}

function orientationOptions(values: number[], uprightOnly: boolean): number[][] {
  if (!uprightOnly) return permutations(values)
  const [length, width, height] = values
  const options = [[length, width, height]]
  if (length !== width) options.push([width, length, height])
  return options
}

function lyingOrientationOptions(values: number[]): number[][] {
  const uprightHeight = values[2]
  return permutations(values).filter((orientation) => orientation[2] !== uprightHeight)
}

function layerCounts(boxDims: number[], orientation: number[], layersOverride: number | null = null) {
  const counts = boxDims.map((boxSide, index) => Math.floor((boxSide + 1e-9) / orientation[index]))
  const layers = layersOverride == null ? counts[2] : Math.max(0, layersOverride)
  const perLayer = counts[0] * counts[1]
  return {
    counts: [counts[0], counts[1], layers],
    maxLayers: counts[2],
    perLayer,
    capacity: perLayer * layers,
  }
}

function buildSinglePlan(boxDims: number[], itemDims: number[], uprightOnly: boolean): BoxPlan {
  let best: BoxPlan = {
    capacity: 0,
    counts: [0, 0, 0],
    orientation: itemDims,
    packing_mode: 'single',
    segments: [],
    used_height: 0,
  }

  for (const orientation of orientationOptions(itemDims, uprightOnly)) {
    const layer = layerCounts(boxDims, orientation)
    const candidate: BoxPlan = {
      capacity: layer.capacity,
      counts: layer.counts,
      orientation,
      packing_mode: 'single',
      segments: [
        {
          type: uprightOnly ? 'upright' : 'single',
          orientation,
          counts: layer.counts,
          layers: layer.counts[2],
          capacity: layer.capacity,
        },
      ],
      used_height: layer.counts[2] * orientation[2],
    }

    if (
      candidate.capacity > best.capacity ||
      (candidate.capacity === best.capacity && candidate.used_height < best.used_height)
    ) {
      best = candidate
    }
  }

  return best
}

function betterMixedCandidate(candidate: BoxPlan, best: BoxPlan | null, qty: number): boolean {
  if (!best) return true
  const candidateFits = candidate.capacity >= qty
  const bestFits = best.capacity >= qty
  if (candidateFits !== bestFits) return candidateFits

  if (candidateFits && bestFits) {
    const candidateSpare = candidate.capacity - qty
    const bestSpare = best.capacity - qty
    if (candidateSpare !== bestSpare) return candidateSpare < bestSpare
    if (candidate.used_height !== best.used_height) return candidate.used_height < best.used_height
  }

  if (candidate.capacity !== best.capacity) return candidate.capacity > best.capacity
  return candidate.used_height < best.used_height
}

function buildMixedStackPlan(boxDims: number[], itemDims: number[], qty: number): BoxPlan | null {
  const uprightOptions = orientationOptions(itemDims, true)
  const lyingOptions = lyingOrientationOptions(itemDims)
  let best: BoxPlan | null = null

  for (const upright of uprightOptions) {
    const uprightFull = layerCounts(boxDims, upright)
    if (!uprightFull.perLayer || !uprightFull.maxLayers) continue

    for (const lying of lyingOptions) {
      const lyingFull = layerCounts(boxDims, lying)
      if (!lyingFull.perLayer || !lyingFull.maxLayers) continue

      for (let uprightLayers = 1; uprightLayers <= uprightFull.maxLayers; uprightLayers += 1) {
        const remainingHeight = boxDims[2] - uprightLayers * upright[2]
        const lyingLayers = Math.floor((remainingHeight + 1e-9) / lying[2])
        if (lyingLayers < 1) continue

        const uprightLayer = layerCounts(boxDims, upright, uprightLayers)
        const lyingLayer = layerCounts(boxDims, lying, lyingLayers)
        const capacity = uprightLayer.capacity + lyingLayer.capacity
        if (capacity <= 0) continue

        const candidate: BoxPlan = {
          capacity,
          counts: [
            uprightLayer.counts[0],
            uprightLayer.counts[1],
            uprightLayer.counts[2] + lyingLayer.counts[2],
          ],
          orientation: upright,
          packing_mode: 'mixed_stack',
          segments: [
            {
              type: 'upright',
              orientation: upright,
              counts: uprightLayer.counts,
              layers: uprightLayer.counts[2],
              capacity: uprightLayer.capacity,
            },
            {
              type: 'lying_top',
              orientation: lying,
              counts: lyingLayer.counts,
              layers: lyingLayer.counts[2],
              capacity: lyingLayer.capacity,
            },
          ],
          used_height: uprightLayer.counts[2] * upright[2] + lyingLayer.counts[2] * lying[2],
        }

        if (betterMixedCandidate(candidate, best, qty)) best = candidate
      }
    }
  }

  return best
}
