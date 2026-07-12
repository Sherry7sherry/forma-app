'use client'
export function ActualRepCountField({value,onChange}:{value:number;onChange(value:number):void}){return <label className="block text-sm">Actual repetitions<input type="number" min={0} value={value} onChange={e=>onChange(Math.max(0,Number(e.target.value)))} className="mt-1 w-full rounded-xl border p-2 text-charcoal"/></label>}
