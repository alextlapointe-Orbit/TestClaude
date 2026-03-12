import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { portsApi } from '@/services/api'
import { X, Download } from 'lucide-react'
import { format } from 'date-fns'

interface Props {
  portId: number
  onClose: () => void
}

export default function PortCardExport({ portId, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  const { data: card, isLoading } = useQuery({
    queryKey: ['port-card', portId],
    queryFn: () => portsApi.getCard(portId).then((r) => r.data),
  })

  const handlePrint = () => window.print()

  const handleDownload = async () => {
    if (!cardRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const canvas = await html2canvas(cardRef.current, { backgroundColor: '#050d1a', scale: 2 })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const imgData = canvas.toDataURL('image/png')
    const w = pdf.internal.pageSize.getWidth()
    const h = (canvas.height * w) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, w, h)
    pdf.save(`port-card-${card.port.unlocode}.pdf`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 border border-navy-500 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-navy-500">
          <span className="font-semibold text-slate-100">Port Card Export</span>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="btn-primary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-100 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-cyan-maritime border-t-transparent rounded-full animate-spin" />
            </div>
          ) : card ? (
            <div ref={cardRef} className="bg-navy-900 p-6 rounded-lg text-sm space-y-5">
              {/* Header */}
              <div className="border-b border-navy-500 pb-4 flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-cyan-maritime">{card.port.name}</div>
                  <div className="text-slate-400">{card.port.unlocode} · {card.port.country}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {card.port.latitude.toFixed(4)}°N, {card.port.longitude.toFixed(4)}°E
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Generated</div>
                  <div className="text-xs text-slate-300">{format(new Date(), 'dd MMM yyyy HH:mm')}</div>
                  <div className={`mt-1 text-xs font-semibold px-2 py-0.5 rounded inline-block ${
                    card.port.congestion_level === 'low' ? 'text-emerald-400 bg-emerald-900/30' :
                    card.port.congestion_level === 'medium' ? 'text-amber-400 bg-amber-900/30' :
                    'text-red-400 bg-red-900/30'
                  }`}>
                    {card.port.congestion_level?.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Static info grid */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Port Characteristics</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    ['Terminals', card.port.num_terminals],
                    ['Quay Length', card.port.quay_length_m ? `${card.port.quay_length_m}m` : '—'],
                    ['Max Vessel LOA', card.port.max_vessel_loa_m ? `${card.port.max_vessel_loa_m}m` : '—'],
                    ['Max Draft', card.port.max_draft_m ? `${card.port.max_draft_m}m` : '—'],
                    ['Tidal Range', card.port.tidal_range_m ? `${card.port.tidal_range_m}m` : '—'],
                    ['Water Density', `${card.port.water_density} t/m³`],
                    ['Anchorage', card.port.anchorage_capacity ?? '—'],
                    ['Vessels Waiting', card.port.vessels_waiting],
                    ['Berth Util.', `${card.port.berth_utilization_pct?.toFixed(0)}%`],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="bg-navy-800 rounded p-2">
                      <div className="text-slate-400" style={{ fontSize: '10px' }}>{l}</div>
                      <div className="text-slate-200 font-medium">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terminals */}
              {card.terminals.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Terminals</div>
                  {card.terminals.map((t: any, i: number) => (
                    <div key={i} className="bg-navy-800 rounded p-3 mb-2">
                      <div className="font-medium text-slate-200">{t.name}</div>
                      <div className="text-slate-400 text-xs mt-1">{t.operator} · {t.berth_configuration} · {t.total_quay_length_m}m quay · {t.crane_count} cranes</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Supplementary */}
              {card.supplementary.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notices & Information</div>
                  {card.supplementary.map((s: any, i: number) => (
                    <div key={i} className="bg-navy-800 rounded p-3 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-slate-500 uppercase">{s.category}</span>
                        <span className="font-medium text-slate-200 text-xs">{s.title}</span>
                      </div>
                      <div className="text-slate-400 text-xs">{s.content}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[10px] text-slate-500 text-center pt-2 border-t border-navy-600">
                TMM - Traffic Management Module · Pacific International Lines
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
