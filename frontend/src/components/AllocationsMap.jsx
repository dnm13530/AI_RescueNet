import { useMemo, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

function pinColor(score) {
    if (score >= 80) return { bg: '#ef4444', border: '#7f1d1d', glyph: '#fff' };
    if (score >= 50) return { bg: '#f59e0b', border: '#78350f', glyph: '#fff' };
    return { bg: '#10b981', border: '#064e3b', glyph: '#fff' };
}

export default function AllocationsMap({ allocations }) {
    const [active, setActive] = useState(null);

    const points = useMemo(
        () => allocations.filter(a => a.coords && typeof a.coords.lat === 'number' && typeof a.coords.lng === 'number'),
        [allocations]
    );

    const center = useMemo(() => {
        if (points.length === 0) return { lat: 22.2587, lng: 71.1924 }; // Gujarat fallback
        const sumLat = points.reduce((s, p) => s + p.coords.lat, 0);
        const sumLng = points.reduce((s, p) => s + p.coords.lng, 0);
        return { lat: sumLat / points.length, lng: sumLng / points.length };
    }, [points]);

    if (!API_KEY) {
        return (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <MapPin size={32} style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>Map disabled — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your environment to enable.</p>
            </div>
        );
    }

    return (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MapPin size={18} color="#34d399" />
                    <strong style={{ fontSize: '0.95rem' }}>Live Operations Map</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {points.length} request{points.length === 1 ? '' : 's'} geo-located
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Critical (≥80)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> High (50–79)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Standard (&lt;50)
                    </span>
                </div>
            </div>
            <div style={{ height: '420px', width: '100%' }}>
                <APIProvider apiKey={API_KEY}>
                    <Map
                        defaultCenter={center}
                        defaultZoom={points.length > 0 ? 6 : 5}
                        mapId={MAP_ID}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        colorScheme="DARK"
                    >
                        {points.map(p => {
                            const c = pinColor(p.score);
                            return (
                                <AdvancedMarker
                                    key={p.id}
                                    position={p.coords}
                                    onClick={() => setActive(p.id)}
                                >
                                    <Pin background={c.bg} borderColor={c.border} glyphColor={c.glyph} />
                                </AdvancedMarker>
                            );
                        })}
                        {active && (() => {
                            const p = points.find(x => x.id === active);
                            if (!p) return null;
                            return (
                                <InfoWindow position={p.coords} onCloseClick={() => setActive(null)}>
                                    <div style={{ color: '#111', minWidth: '200px', maxWidth: '260px' }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.75rem', color: '#444' }}>
                                            {p.type} • Score {p.score}
                                        </div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{p.location}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '6px' }}>
                                            👥 {p.peopleCount} people · {p.urgency}
                                        </div>
                                        {p.status && (
                                            <div style={{ fontSize: '0.75rem', color: p.status === 'Fully Fulfilled' ? '#059669' : p.status.includes('Partially') ? '#d97706' : '#dc2626' }}>
                                                {p.status}
                                            </div>
                                        )}
                                    </div>
                                </InfoWindow>
                            );
                        })()}
                    </Map>
                </APIProvider>
            </div>
        </div>
    );
}
