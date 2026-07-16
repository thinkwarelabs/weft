'use client'
import { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full cursor-pointer appearance-none rounded-lg border border-zinc-300 bg-white bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27%2371717a%27 viewBox=%270 0 16 16%27%3E%3Cpath d=%27M4.646 6.146a.5.5 0 0 1 .708 0L8 8.793l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z%27/%3E%3C/svg%3E")] bg-[position:right_0.6rem_center] bg-no-repeat px-3 pr-8 text-sm transition-colors focus:border-zinc-900 focus:outline-none',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
}
