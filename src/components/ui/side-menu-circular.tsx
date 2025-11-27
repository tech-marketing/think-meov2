import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
} from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'

type CircularMenuItem = {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  active?: boolean
}

type CircularSideMenuProps = {
  items: CircularMenuItem[]
  className?: string
  spring?: SpringOptions
  expandable?: boolean
  defaultExpanded?: boolean
  onExpandChange?: (expanded: boolean) => void
}

export function CircularSideMenu({
  items,
  className,
  spring = { stiffness: 180, damping: 14, mass: 0.2 },
  expandable = true,
  defaultExpanded = false,
  onExpandChange,
}: CircularSideMenuProps) {
  const mouseY = useMotionValue(Infinity)
  const distance = 120
  const magnification = 64
  
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleExpanded = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onExpandChange?.(newState)
  }

  const actuallyExpanded = isExpanded && !isMobile

  return (
    <motion.aside
      className={cn(
        'fixed top-[calc(50%-10px)] -translate-y-1/2 flex flex-col py-4 z-50 gap-2',
        'md:left-4 left-2',
        className
      )}
      animate={{
        width: actuallyExpanded ? '240px' : 'auto',
        alignItems: 'flex-start',
        paddingLeft: '0',
        paddingRight: '0',
      }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      onMouseMove={(e) => mouseY.set(e.clientY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      data-side-menu
    >
      {expandable && !isMobile && (
        <motion.button
          onClick={toggleExpanded}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center mb-1 relative left-[10px]',
            'bg-muted/30 hover:bg-muted/60 transition-all duration-200',
            'border border-border/20 hover:border-border/40',
            'text-muted-foreground hover:text-foreground',
            'shadow-sm hover:shadow-md'
          )}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          aria-label={actuallyExpanded ? 'Colapsar menu' : 'Expandir menu'}
        >
          {actuallyExpanded ? <ChevronsLeft size={12} /> : <ChevronsRight size={12} />}
        </motion.button>
      )}
      
      {items.map((item, i) => (
        <CircularItem
          key={i}
          label={item.label}
          icon={item.icon}
          mouseY={mouseY}
          distance={distance}
          magnification={magnification}
          onClick={item.onClick}
          spring={spring}
          active={item.active}
          isExpanded={actuallyExpanded}
          isMobile={isMobile}
        />
      ))}
    </motion.aside>
  )
}

function CircularItem({
  label,
  icon,
  mouseY,
  distance,
  magnification,
  onClick,
  spring,
  active,
  isExpanded,
  isMobile,
}: {
  label: string
  icon: React.ReactNode
  mouseY: any
  distance: number
  magnification: number
  onClick?: () => void
  spring: SpringOptions
  active?: boolean
  isExpanded?: boolean
  isMobile?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  
  const baseSize = isMobile ? 40 : 48
  const maxSize = isMobile ? 52 : 64
  
  const sizeTransform = useTransform(mouseY, (val: number) => {
    if (!ref.current) return baseSize
    const rect = ref.current.getBoundingClientRect()
    const itemCenterY = rect.top + rect.height / 2
    const distanceFromCursor = Math.abs(val - itemCenterY)
    
    if (val === Infinity || distanceFromCursor > distance) {
      return baseSize
    }
    
    const normalized = Math.max(0, 1 - distanceFromCursor / distance)
    return baseSize + normalized * (maxSize - baseSize)
  })
  const size = useSpring(sizeTransform, spring)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      <motion.div
        style={{ width: size, height: size }}
        onMouseEnter={() => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
          }
          hoverTimeoutRef.current = setTimeout(() => setHovered(true), 100)
        }}
        onMouseLeave={() => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
          }
          setHovered(false)
        }}
        onClick={onClick}
        tabIndex={0}
        role="button"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          'flex items-center justify-center rounded-full cursor-pointer transition-colors',
          'bg-muted/60 hover:bg-muted/80',
          'border border-border/40 hover:border-border/60',
          active && 'bg-primary/20 border-primary/50'
        )}
      >
        <div className="text-foreground text-lg">
          {icon}
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium text-foreground whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isExpanded && hovered && (
          <motion.div
            initial={{ opacity: 0, x: 0, scale: 0.95 }}
            animate={{ opacity: 1, x: 12, scale: 1 }}
            exit={{ opacity: 0, x: 0, scale: 0.95 }}
            transition={{ 
              duration: 0.15,
              ease: [0.4, 0, 0.2, 1]
            }}
            className={cn(
              'absolute left-full ml-2 whitespace-nowrap rounded-md shadow-lg',
              'bg-popover text-popover-foreground border border-border',
              'text-xs px-2 py-1 z-50'
            )}
            role="tooltip"
            data-side-menu-label
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
