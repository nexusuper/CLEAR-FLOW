import { useState, useEffect, useCallback } from 'react';
import ClayIcon from '../ui/ClayIcon';
import { apiFetch } from '@/lib/api-client';

export default function RouteTab({ savedPassword, onError }) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchRoute = useCallback(async () => {
    setLoading(true);
    try {
      setRoute(await apiFetch('/api/orders/route', { password: savedPassword }));
    } catch (e) {
      console.error('Failed to fetch route:', e);
    }
    setLoading(false);
  }, [savedPassword]);

  useEffect(() => { queueMicrotask(() => fetchRoute()); }, [fetchRoute]);

  async function updateStatus(id, status) {
    try {
      await apiFetch('/api/orders/' + id, { method: 'PATCH', password: savedPassword, body: { status } });
      await fetchRoute();
    } catch (e) {
      onError?.(e.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-clay-ink">Today&apos;s Deliveries</h2>
        <button onClick={fetchRoute} className="text-xs clay-raised-sm rounded-full px-3 py-1.5 font-semibold hover:bg-sky-50">
          <ClayIcon name="refresh" className="w-3.5 h-3.5 inline" /> Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-center py-12 text-gray-400">Loading route...</p>
      ) : !route || route.total === 0 ? (
        <p className="text-center py-12 text-gray-400">No deliveries scheduled for today.</p>
      ) : (
        route.barangays.map((grp) => (
          <div key={grp.barangay}>
            <h3 className="font-display font-bold text-clay-ink2 mb-2">{grp.barangay} ({grp.count})</h3>
            <div className="space-y-2">
              {grp.orders.map((o) => (
                <div key={o.id} className="clay-raised-sm rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-clay-ink flex items-center gap-2">
                        {o.customer_name}
                        {o.delivery_time && <span className="text-[10px] font-semibold text-sky-600">{o.delivery_date} {o.delivery_time}</span>}
                      </div>
                      <div className="text-sm text-gray-600">{o.address}</div>
                      <div className="text-xs text-gray-400">{o.product_type} x{o.quantity}</div>
                      <a href={`tel:${o.phone}`} className="text-xs text-clay-skydeep font-semibold mt-1 inline-flex items-center gap-1">
                        <ClayIcon name="phone" className="w-3.5 h-3.5" /> {o.phone}
                      </a>
                    </div>
                    <div className="flex flex-col gap-1">
                      {o.status === 'confirmed' && (
                        <button onClick={() => updateStatus(o.id, 'out_for_delivery')} className="text-[11px] bg-orange-100 text-orange-700 font-semibold px-2 py-1 rounded-full">Out</button>
                      )}
                      {o.status === 'out_for_delivery' && (
                        <button onClick={() => updateStatus(o.id, 'delivered')} className="text-[11px] bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">Delivered</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
