import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Category } from '@/types'

interface Props {
  categories: string[]
  selected: Category[]
  setSelected: (cats: Category[]) => void
}

export function CategoryFilterDropdown({ categories, selected, setSelected }: Props) {
  const selectedSet = new Set(selected)
  const allSelected = selected.length === categories.length

  const toggleCategory = (cat: Category) => {
    if (selectedSet.has(cat)) {
      const next = selected.filter(c => c !== cat)
      setSelected(next.length > 0 ? next : [...categories])
      return
    }
    setSelected([...selected, cat])
  }

  const toggleAll = () => {
    setSelected([...categories])
  }

  const label = allSelected ? 'All categories' : `${selected.length} categories`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Categories</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={toggleAll}>
          All
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {categories.map(cat => (
          <DropdownMenuCheckboxItem
            key={cat}
            checked={selectedSet.has(cat)}
            onCheckedChange={() => toggleCategory(cat)}
          >
            {cat}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
