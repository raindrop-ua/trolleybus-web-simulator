import { useUIStore } from '../../state/useUIStore';
export default function DebugPanel() {
  const { snapshot, selectedId, fps } = useUIStore();
  const v = snapshot?.vehicles.find((vehicle) => vehicle.id === selectedId);
  if (!v || !snapshot) return null;
  return (
    <aside className="debug glass" aria-label="Simulation diagnostics">
      <div className="eyebrow">CONTACT NETWORK / DEVELOPMENT</div>
      <p>{fps} FPS · Fixed step 1/60 s</p>
      <p>
        Vehicle {v.id} · {v.speed.toFixed(2)} m/s
        <br />
        {v.roadSegmentId}
        <br />X {v.position.x.toFixed(2)} / Z {v.position.z.toFixed(2)}
      </p>
      {v.poles.map((p, i) => (
        <p key={i}>
          <b className={p.connected ? 'connected' : 'late'}>
            Pole {i + 1}: {p.connected ? 'CONNECTED' : 'DISCONNECTED'}
          </b>
          <br />
          {p.wireSegmentId}
          <br />
          Length error {(p.lengthError * 1000).toFixed(3)} mm
          <br />
          Wire error {(p.wireError * 1000).toFixed(3)} mm
        </p>
      ))}
      <p>{snapshot.diagnostics.length} contact diagnostics</p>
      {snapshot.diagnostics.slice(-3).map((event, index) => (
        <p className="late" key={`${event.time}-${index}`}>
          {event.vehicleId}: {event.message}
        </p>
      ))}
      <p>
        Mint: heads · amber: bases
        <br />
        Sphere: fixed pole reach
        <br />
        Orange: wire paths & junctions
      </p>
    </aside>
  );
}
