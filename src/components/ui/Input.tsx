'use client'
import { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400',
        className
      )}
      {...rest}
    />
  )
}
