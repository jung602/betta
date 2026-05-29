import { TAIL_PRESETS, type TailPresetKey } from '../fish'
import RadialSelector, { type RadialItem } from './RadialSelector'

const TAIL_ICONS: Record<TailPresetKey, string> = {
  plakat: '플라캇.png',
  delta: '델타.png',
  halfmoon: '하프문.png',
  crowntail: '크라운테일.png',
  rosetail: '로즈테일.png',
  veiltail: '베일테일.png',
  doubletail: '더블테일.png',
}

const HIDDEN: TailPresetKey[] = ['delta', 'halfmoon']

const items: RadialItem<TailPresetKey>[] = (Object.keys(TAIL_PRESETS) as TailPresetKey[])
  .filter(k => !HIDDEN.includes(k))
  .map(key => ({
    key,
    icon: `${import.meta.env.BASE_URL}tailicons/${TAIL_ICONS[key]}`,
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
