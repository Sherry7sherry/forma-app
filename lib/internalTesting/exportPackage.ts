export async function createExportPackage(payload: {run:unknown;attempts:unknown[];events:unknown[]}) {
  const body=JSON.stringify({schemaVersion:1,...payload}); const bytes=new TextEncoder().encode(body)
  const digest=await crypto.subtle.digest('SHA-256',bytes); const checksum=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  return {schemaVersion:1,checksum,createdAt:new Date().toISOString(),payload}
}
export function downloadExportPackage(value:unknown,name='forma-internal-test.json') { const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})); const link=document.createElement('a'); link.href=url; link.download=name; link.click(); URL.revokeObjectURL(url) }
