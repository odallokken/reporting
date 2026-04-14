import { redirect } from 'next/navigation'

export default async function VMRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/vmrs/dynamic/${id}`)
}
