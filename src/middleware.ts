import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export default auth((req) => {
  if (req.auth?.user) return NextResponse.next()
  if (req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/signin', req.nextUrl.origin))
})

export const config = {
  matcher: ['/((?!api/auth|signin|_next/static|_next/image|favicon.ico|logo.png).*)'],
}
