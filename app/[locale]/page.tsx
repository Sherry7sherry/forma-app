import { notFound } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { isPublicLocale, resolveLocale } from '@/lib/i18n'

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh' }]
}

export default async function LocalizedLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isPublicLocale(locale)) notFound()
  return <LandingPage locale={resolveLocale({ publicLocale: locale })} />
}
