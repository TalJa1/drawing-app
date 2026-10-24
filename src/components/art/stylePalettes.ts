import type { GenStyle } from '@/types'

/** Default palettes for each generative painting style. */
export const STYLE_PALETTES: Record<GenStyle, string[]> = {
  impressionist: ['#9DC3E6', '#F7D9A8', '#E8A0A8', '#7FB28F', '#F2C14E', '#5B7DB1'],
  cubist: ['#8C6A4F', '#C9B79C', '#5C6B73', '#D9A441', '#3D3B3C', '#A65E46'],
  abstract: ['#F6F1E7', '#E4572E', '#2F80C4', '#F2A93B', '#1B1A17', '#C93C6B'],
  pop: ['#FFDE00', '#FF3B6B', '#00A8E8', '#1B1A17', '#FFFFFF', '#FF8A00'],
  minimal: ['#B83A2E', '#E8A33D', '#3B2A2A', '#D96B3B', '#F2E6D0'],
  surreal: ['#E9C891', '#5B8DB8', '#2E3A59', '#D97B48', '#F4E3C1', '#7A4E3A'],
  ukiyoe: ['#F1E4C8', '#1F3A5F', '#4F7CAC', '#FFFFFF', '#C8553D', '#2B2B2B'],
  pointillist: ['#5DA9E9', '#F6D55C', '#8BC34A', '#F28E2B', '#E15759', '#FFFFFF'],
  expressionist: ['#E4572E', '#F2A93B', '#1E3A8A', '#0F766E', '#7C2D12', '#FDE68A'],
  renaissance: ['#3E2C23', '#8A5A3B', '#C9A66B', '#5F7161', '#1F3B4D', '#E8D5B5'],
  geometric: ['#0E4C5A', '#F2E6C9', '#C8963E', '#1F6F8B', '#8C2F39', '#FFFFFF'],
  dots: ['#3B1F14', '#C2562A', '#E8B04A', '#F4E9D8', '#8C3B1F', '#D97A3A'],
  ink: ['#F4EFE4', '#1B1A17', '#5A5650', '#9C978E', '#C8553D'],
  lacquer: ['#120C0A', '#B8282E', '#D4AF37', '#F3E7C9', '#5A2A1A', '#8C6A2F'],
  folk: ['#F2E3C6', '#C8553D', '#2E6B4F', '#E2B13C', '#1B1A17', '#8E4A7A'],
  baroque: ['#120D09', '#5A3A1F', '#C99A4B', '#F2D9A0', '#7A1E1E', '#2C3E2D'],
  cave: ['#D9B48F', '#A0522D', '#5C3317', '#2B1B10', '#C98B5B'],
  mosaic: ['#1F5F8B', '#E8C547', '#C2452D', '#F4EBD9', '#2E8B6F', '#3B2F2F'],
  fauve: ['#FF5E3A', '#2EC4B6', '#FFBE0B', '#8338EC', '#3A86FF', '#FB5607'],
  digital: ['#0B0F2A', '#FF2E88', '#00E5FF', '#7B2FFF', '#FFE45E', '#14F195'],
}
