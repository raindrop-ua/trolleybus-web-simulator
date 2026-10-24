/** The renderer supplies elapsed wall time; only this clock chooses simulation ticks. */
export class SimulationClock {
  static readonly timestep = 1 / 60;
  private accumulator = 0;
  private paused = false;
  private speed: 1 | 2 | 4 = 1;

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    // Discard a partial frame so resuming never consumes time accumulated while paused.
    this.accumulator = 0;
  }

  setSpeed(speed: 1 | 2 | 4): void {
    this.speed = speed;
  }

  advance(realDeltaSeconds: number, tick: (dt: number) => void): number {
    if (this.paused || !Number.isFinite(realDeltaSeconds) || realDeltaSeconds <= 0) return 0;
    // Tab suspension cannot produce an unbounded catch-up loop. At 4x this is 60 ticks.
    this.accumulator += Math.min(realDeltaSeconds, 0.25) * this.speed;
    let steps = 0;
    while (this.accumulator + 1e-10 >= SimulationClock.timestep && steps < 60) {
      tick(SimulationClock.timestep);
      this.accumulator -= SimulationClock.timestep;
      steps += 1;
    }
    return steps;
  }
}
