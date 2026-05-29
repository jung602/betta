import { TANK_MODELS, type TankModelKey } from '../tank'
import RadialSelector, { type RadialItem } from './RadialSelector'

const TANK_ICONS: Record<TankModelKey, string> = {
  square: 'square.png',
  round: 'tank.png',
  imac: 'imac.png',
}

const items: RadialItem<TankModelKey>[] = (Object.keys(TANK_MODELS) as TankModelKey[])
  .map(key => ({
    key,
    icon: `${import.meta.env.BASE_URL}${TANK_ICONS[key]}`,
    label: TANK_MODELS[key].label,
  }))

interface TankSelectorProps {
  selected: TankModelKey
  onSelect: (key: TankModelKey) => void
  visible: boolean
}

export default function TankSelector({ selected, onSelect, visible }: TankSelectorProps) {
  return (
    <RadialSelector
      items={items}
      selected={selected}
      onSelect={onSelect}
      visible={visible}
      startAngle={100}
      endAngle={10}
    />
  )
}
