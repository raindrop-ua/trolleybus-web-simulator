import { lazy, Suspense, useEffect, useRef } from 'react';
import { bootstrap } from './bootstrap';
import { useUIStore } from '../state/useUIStore';
import { Icon } from '../ui/components/Icon';
import { clockText } from '../ui/components/format';
import { FleetPanel } from '../ui/panels/FleetPanel';
import '../ui/styles/global.css';

const DebugPanel = import.meta.env.DEV ? lazy(() => import('../ui/panels/DebugPanel')) : null;

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const {
    snapshot,
    paused,
    speed,
    togglePause,
    setSpeed,
    cameraMode,
    setCamera,
    debug,
    toggleDebug,
    help,
    toggleHelp,
    error,
    reset,
  } = useUIStore();
  useEffect(() => {
    if (!host.current) return;
    try {
      return bootstrap(host.current);
    } catch (error) {
      useUIStore.setState({
        error: error instanceof Error ? error.message : 'The miniature could not start.',
      });
    }
  }, []);
  return (
    <main className="app">
      <div className="scene" ref={host} />
      <div className="vignette" />
      <header className="identity">
        <div className="brand">
          <Icon name="bus" size={24} />
          <span>
            trolleybus<span className="brand-dot">.</span>
          </span>
          <span className="edition">MINIATURE NO. 01</span>
        </div>
        <div className="route-title">
          <span className="route-number">6</span>
          <div>
            <p className="eyebrow">DNIPRO, UKRAINE</p>
            <h1>A city in motion.</h1>
            <p className="subtitle">Three trolleybuses. One little world.</p>
          </div>
        </div>
      </header>
      <div className="time-card glass">
        <Icon name="sun" size={23} />
        <div>
          <time>{clockText(snapshot?.time ?? 26640)}</time>
          <span>Morning on the line</span>
        </div>
        <i className={`live-dot ${paused ? 'paused' : ''}`} />
      </div>
      {!snapshot && !error && (
        <div className="loading glass">
          <Icon name="bus" size={32} />
          <p>Waking up the city…</p>
        </div>
      )}
      {error && (
        <div className="error-card glass" role="alert">
          <h2>The city needs a moment.</h2>
          <p>{error}</p>
          <button className="text-button" onClick={() => window.location.reload()}>
            Reload the miniature <Icon name="reset" size={16} />
          </button>
        </div>
      )}
      <FleetPanel />
      <div className="playback glass" role="group" aria-label="Simulation playback">
        <button
          className="pause-button"
          onClick={togglePause}
          aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
          title="Pause / resume (Space)"
        >
          <Icon name={paused ? 'play' : 'pause'} size={20} />
        </button>
        <span className="playback-label">{paused ? 'Paused' : 'City time'}</span>
        <div className="speed-buttons">
          {([1, 2, 4] as const).map((value) => (
            <button
              key={value}
              aria-label={`${value}× simulation speed`}
              aria-pressed={speed === value}
              className={speed === value ? 'active' : ''}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
      <nav className="camera-controls" aria-label="Camera controls">
        <div className="camera-group glass">
          {(['overview', 'follow', 'free'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setCamera(mode)}
              aria-pressed={cameraMode === mode}
              className={cameraMode === mode ? 'active' : ''}
              title={
                mode === 'follow'
                  ? 'Follow selected vehicle (F)'
                  : mode === 'overview'
                    ? 'Overview (Esc)'
                    : 'Drag to explore'
              }
            >
              <Icon name={mode} size={18} />
              <span>{mode === 'free' ? 'Explore' : mode === 'follow' ? 'Follow' : 'Overview'}</span>
            </button>
          ))}
        </div>
        <div className="utility-group glass">
          <button
            className="icon-button"
            onClick={reset}
            title="Restart simulation"
            aria-label="Restart simulation"
          >
            <Icon name="reset" size={18} />
          </button>
          <button
            className={`icon-button ${help ? 'active' : ''}`}
            onClick={toggleHelp}
            aria-expanded={help}
            aria-label="Controls and about"
          >
            <Icon name="help" size={19} />
          </button>
        </div>
      </nav>
      <div className="scene-caption">
        <span className="caption-line" />A small ode to everyday journeys.
      </div>
      {import.meta.env.DEV && (
        <button
          className={`network-toggle glass ${debug ? 'active' : ''}`}
          onClick={toggleDebug}
          aria-pressed={debug}
          title="Contact network diagnostics (D)"
        >
          <Icon name="wire" size={18} />
          <span>Wire view</span>
        </button>
      )}
      {import.meta.env.DEV && debug && DebugPanel && (
        <Suspense>
          <DebugPanel />
        </Suspense>
      )}
      {help && (
        <aside className="help glass" aria-label="Controls and about">
          <button className="icon-button close-help" onClick={toggleHelp} aria-label="Close help">
            <Icon name="close" size={18} />
          </button>
          <div className="eyebrow">TAKE THE SCENIC ROUTE</div>
          <h2>Just watch the city go.</h2>
          <p>
            Three autonomous blue trolleybuses share a route, stop for passengers, and keep their
            poles on the wires.
          </p>
          <dl>
            <div>
              <dt>Drag / right-drag</dt>
              <dd>Orbit / pan</dd>
            </div>
            <div>
              <dt>Scroll / + −</dt>
              <dd>Zoom</dd>
            </div>
            <div>
              <dt>Click a trolleybus</dt>
              <dd>Select</dd>
            </div>
            <div>
              <dt>Double-click / F</dt>
              <dd>Follow</dd>
            </div>
            <div>
              <dt>Space</dt>
              <dd>Pause</dd>
            </div>
            <div>
              <dt>1 / 2 / 4</dt>
              <dd>City speed</dd>
            </div>
            <div>
              <dt>Escape</dt>
              <dd>Overview</dd>
            </div>
          </dl>
          <p className="help-note">
            A compact, fictional Dnipro district inspired by the blue trolleybuses of Route 6. Best
            enjoyed on a desktop.
          </p>
        </aside>
      )}
    </main>
  );
}
