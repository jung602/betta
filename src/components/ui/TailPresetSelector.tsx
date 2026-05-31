import { TAIL_PRESETS, type TailPresetKey } from '../fish'
import RadialSelector, { type RadialItem } from './RadialSelector'

const TAIL_ICONS: Record<TailPresetKey, string> = {
  plakat: 'plakat.png',
  delta: 'delta.png',
  halfmoon: 'halfmoon.png',
  crowntail: 'crowntail.png',
  rosetail: 'rosetail.png',
  veiltail: 'veiltail.png',
  doubletail: 'doubletail.png',
}

const HIDDEN: TailPresetKey[] = ['delta', 'halfmoon']

const items: RadialItem<TailPresetKey>[] = (Object.keys(TAIL_PRESETS) as TailPresetKey[])
  .filter(k => !HIDDEN.includes(k))
  .map(key => ({
    key,
    icon: `${import.meta.env.BASE_URL}icon/${TAIL_ICONS[key]}`,
    label: TAIL_PRESETS[key].label,
  }))

interface TailPresetSelectorProps {
  selected: TailPresetKey
  onSelect: (key: TailPresetKey) => void
  visible: boolean
}

export default function TailPresetSelector({ selected, onSelect, visible }: TailPresetSelectorProps) {
  return (
    <RadialSelector
      items={items}
      selected={selected}
      onSelect={onSelect}
      visible={visible}
      startAngle={210}
      endAngle={50}
    />
  )
}
