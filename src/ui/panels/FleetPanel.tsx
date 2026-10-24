import { world } from '../../app/world';
import { useUIStore } from '../../state/useUIStore';
import { Icon } from '../components/Icon';
import { deviationText } from '../components/format';

export function FleetPanel() {
  const { snapshot, selectedId, select, setCamera, fleetOpen, toggleFleet } = useUIStore();
  const stops = world.stops;
  return (
    <aside className={`fleet glass ${fleetOpen ? '' : 'collapsed'}`} aria-label="Fleet">
      <button className="fleet-heading" onClick={toggleFleet} aria-expanded={fleetOpen}>
        <span>
          On the line <span className="fleet-count">03</span>
        </span>
        <Icon name="chevron" size={17} />
      </button>
      {fleetOpen && (
        <>
          <div className="fleet-list">
            {snapshot?.vehicles.map((vehicle) => {
              const stop = stops.find(
                (s) => s.id === (vehicle.currentStopId ?? vehicle.nextStopId),
              );
              const atStop = vehicle.currentStopId !== null;
              const late = vehicle.scheduleDeviationSeconds > 20;
              return (
                <div
                  key={vehicle.id}
                  className={`fleet-row ${selectedId === vehicle.id ? 'selected' : ''}`}
                >
                  <button
                    className="vehicle-select"
                    onClick={() => select(vehicle.id)}
                    aria-pressed={selectedId === vehicle.id}
                    aria-label={`Select vehicle ${vehicle.id}`}
                  >
                    <span className="vehicle-symbol">
                      <Icon name="bus" size={22} />
                    </span>
                    <span className="vehicle-content">
                      <span className="vehicle-top">
                        <b>{vehicle.id}</b>
                        <span className={late ? 'delay late' : 'delay'}>
                          {deviationText(vehicle.scheduleDeviationSeconds)}
                        </span>
                      </span>
                      <span className="vehicle-stop">
                        {atStop ? 'At' : 'To'} {stop?.name}
                      </span>
                      <span className="vehicle-meta">
                        <i className={`status-dot ${atStop ? 'stopped' : ''}`} />
                        {vehicle.operationalState === 'disconnected'
                          ? 'Contact lost'
                          : atStop
                            ? 'Passenger exchange'
                            : vehicle.operationalState === 'waiting'
                              ? 'Scheduled departure'
                              : 'In service'}
                        <span>
                          {Math.round(vehicle.speed * 3.6)} <small>km/h</small>
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    className="follow-row icon-button"
                    title={`Follow ${vehicle.id}`}
                    aria-label={`Follow vehicle ${vehicle.id}`}
                    onClick={() => {
                      select(vehicle.id);
                      setCamera('follow');
                    }}
                  >
                    <Icon name="follow" size={17} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="route-strip">
            <span>Railway Station</span>
            <span className="route-line">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>Park</span>
          </div>
          <div className="fleet-footnote">
            5 stops each way <span>All-electric. Always moving.</span>
          </div>
        </>
      )}
    </aside>
  );
}
