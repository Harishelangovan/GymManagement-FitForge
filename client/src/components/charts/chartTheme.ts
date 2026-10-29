import type { Theme } from '@/theme/themeContext'

/**
 * Chart colours, validated with the dataviz palette validator against FitForge's card surfaces
 * (dark #16191b, light #ffffff):
 *  - categorical pair (blue / orange): all checks pass in both modes (CVD ΔE 26.8 dark, 24.7 light)
 *  - brand lime for single-series charts: contrast 13.8:1 dark, 4.1:1 light
 * Status colours are the reference status palette and always appear with an icon + label.
 * SVG presentation attributes can't read CSS variables, so the hex values live here per theme.
 */
export interface ChartColors {
  accent: string
  series1: string
  series2: string
  grid: string
  axis: string
  surface: string
  cursor: string
  status: { good: string; warning: string; critical: string; neutral: string }
}

const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' }

export const CHART_COLORS: Record<Theme, ChartColors> = {
  dark: {
    accent: '#c6f432',
    series1: '#3987e5',
    series2: '#d95926',
    grid: '#252a2e',
    axis: '#9ca3a8',
    surface: '#16191b',
    cursor: 'rgb(255 255 255 / 0.04)',
    status: { ...STATUS, neutral: '#4a5257' },
  },
  light: {
    accent: '#5f8a00',
    series1: '#2a78d6',
    series2: '#eb6834',
    grid: '#ececE6',
    axis: '#6b7378',
    surface: '#ffffff',
    cursor: 'rgb(0 0 0 / 0.04)',
    status: { ...STATUS, neutral: '#c9c9bd' },
  },
}
