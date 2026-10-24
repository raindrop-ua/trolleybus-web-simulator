# Trolleybus Simulator — Technical Specification

**Version:** 0.1.0 — Autonomous Route Prototype

**Target:** Browser / Desktop

**Stack:** React, Three.js, TypeScript, Vite

**Primary goal:** A small, visually appealing, maintainable 3D trolleybus simulation featuring three autonomous vehicles operating on a shared bidirectional route with realistic overhead wire contact.

---

## 1. Project Overview

Build a browser-based, isometric 3D trolleybus simulator.

The first version is an autonomous simulation. The player observes three trolleybuses operating on a short route through a stylized miniature city.

There is no manual driving in v0.1.

The simulation should feel like a living miniature transport system rather than a static animation.

### Core principles

1. Maintainable, modular, strongly typed architecture.
2. Simulation logic independent of Three.js and React.
3. Physically and geometrically coherent trolleybus movement.
4. Accurate visual contact between trolley poles and overhead wires.
5. Deterministic, fixed-timestep simulation.
6. Data-driven route, infrastructure, and vehicle definitions.
7. Clean, stylized low-poly graphics.
8. Architecture designed for future manual driving, additional routes, and more vehicles.

**Important:** Do not implement everything in a single component, file, or monolithic game loop.

Prefer clear module boundaries, dependency injection, explicit interfaces, and testable domain logic.

Avoid speculative abstractions with no defined responsibility, but prioritize long-term maintainability over minimizing file count.

---

## 2. Technology Stack

Required:

- Vite
- React
- TypeScript (strict mode)
- Three.js
- Zustand for application/UI state
- Vitest for unit tests
- ESLint and Prettier

Recommended:

- React Three Fiber for declarative scene integration.
- Drei for camera controls and scene utilities.
- CSS Modules for interface styling.
- Zod for validating route and infrastructure configuration data.

React Three Fiber is optional if a standalone Three.js renderer provides cleaner ownership of the simulation lifecycle.

### Architectural constraint

React must not own the simulation update loop.

The simulation engine must be independent of React, Three.js, Zustand, and browser rendering APIs.

React handles presentation and user interactions.

Three.js handles visualization.

The simulation engine handles world state, vehicle movement, schedules, and overhead wire mechanics.

---

## 3. Visual Direction

### Style

Stylized realism with a slightly cartoon-like appearance.

Visual references: the blue low-floor trolleybus shown in the provided reference photographs.

The trolleybus must remain recognizable, with realistic overall proportions rather than exaggerated toy-like geometry.

### Vehicle appearance

Model a modern, single-section, low-floor trolleybus inspired by the reference vehicle.

Required characteristics:

- Bright blue body.
- Black panoramic windshield.
- Large dark side windows.
- Three double-leaf passenger doors on the right side.
- White decorative wave near the bottom.
- Orange LED destination display.
- Roof-mounted electrical equipment.
- Two long trolley poles mounted near the rear roof area.
- Realistic wheel placement and body proportions.
- Fleet numbers and route information.

Approximate dimensions:

- Length: 12 m
- Width: 2.55 m
- Height: 3.5 m, excluding poles

These are provisional modeling dimensions, not verified manufacturer specifications.

### Environment

Create a small stylized Eastern European city environment.

Include:

- Asphalt roads with markings.
- Sidewalks and pedestrian crossings.
- Simple apartment buildings.
- Low-poly trees and bushes.
- Streetlights.
- Trolleybus stops.
- Overhead wire support poles.
- Overhead wires and suspension structures.
- A few parked cars.

Use soft lighting, ambient occlusion where affordable, and subtle shadows.

Avoid photorealistic materials and unnecessarily complex geometry.

The trolleybuses should be more detailed than the surrounding environment.

---

## 4. Route and Map

Implement one bidirectional trolleybus route.

### Route structure

Five stops in each direction, ten directional stop visits per complete round trip.

Example:

**Outbound:**

1. Railway Station
2. Central Square
3. University
4. Riverside
5. Park

**Inbound:**

1. Park
2. Riverside
3. University
4. Central Square
5. Railway Station

The two terminal stops are shared physical locations.

The route should contain approximately 2–3 km of roadway per direction, adjusted to the scale of the prototype.

Include:

- Straight road segments.
- Several smooth curves.
- At least two intersections.
- One turnaround loop at each terminus.
- At least one overhead wire junction.
- Separate directional wire paths where appropriate.

Vehicles must complete round trips indefinitely.

### Route representation

Represent roads as a directed graph.

Each road segment must provide a continuous geometric path with arc-length-based sampling.

Suggested interface:

```ts
interface RoadSegment {
  id: string;
  length: number;
  speedLimit: number;
  geometry: CurveDefinition;
  nextSegmentIds: string[];
}
```

Do not hardcode vehicle movement using arrays of arbitrary animation positions.

Road geometry must be reusable for AI movement, rendering, navigation, and stop placement.

---

## 5. Vehicle Fleet

Create exactly three trolleybuses initially.

Example fleet:

- Vehicle 2001
- Vehicle 2002
- Vehicle 2003

All vehicles operate on the same route.

### Initial conditions

- Vehicles begin at different positions along the route.
- Their scheduled departures are staggered.
- All three remain active.
- Vehicles must never overlap or pass through each other.
- Each vehicle maintains its own operational state.

### Vehicle state

```ts
interface VehicleState {
  id: string;
  routeId: string;
  distanceAlongRoute: number;
  speed: number;
  acceleration: number;
  steeringAngle: number;
  rollAngle: number;
  pitchAngle: number;
  currentStopId: string | null;
  scheduleDeviationSeconds: number;
  operationalState: VehicleOperationalState;
}
```

Keep simulation state separate from rendering state.

Use stable identifiers rather than object references across subsystem boundaries.

---

## 6. Autonomous Driving

Implement a dedicated autonomous driver controller.

The controller should generate driving commands rather than directly modifying vehicle position.

Suggested interface:

```ts
interface DrivingCommand {
  traction: number;
  braking: number;
  steering: number;
  doorsRequestedOpen: boolean;
}
```

Traction, braking, and steering should use normalized values.

### Driving behavior

Vehicles must:

- Accelerate smoothly.
- Respect speed limits.
- Reduce speed before curves.
- Brake progressively before stops.
- Stop at designated stopping points.
- Open passenger doors.
- Wait for passenger exchange.
- Close doors before departing.
- Continue along the route.
- Maintain safe following distances.

Implement acceleration and braking limits.

Avoid instantaneous speed changes.

### Vehicle dynamics

Use a simplified kinematic bicycle model or equivalent.

The model must support:

- Vehicle position and orientation.
- Front-wheel steering.
- Turning radius.
- Acceleration and deceleration.
- Longitudinal and lateral acceleration.
- Visual body roll.
- Visual body pitch.

### Body roll

The reference trolleybus has substantial roof-mounted equipment.

Its visual behavior should reflect a relatively high center of gravity.

Implement a damped spring model for body roll.

Roll should respond to lateral acceleration, with configurable stiffness, damping, and maximum angle.

The body should lean outward during turns and settle naturally afterward.

The visual roll must not move the wheel contact points off the road.

Separate the vehicle chassis transform from the suspension/body transform.

Use a subtle pitch response during acceleration and braking.

**Do not implement actual rollover physics in v0.1.**

---

## 7. Overhead Contact Network

**This is a critical subsystem and must receive special attention.**

The trolley poles must visibly and consistently maintain contact with the overhead wires.

Do not implement trolley poles as static decorative objects.

Do not simply rotate the poles toward an approximate wire location.

### 7.1 Network representation

Represent the overhead contact network as an independent directed geometric graph.

The graph must contain:

- Contact wire segments.
- Wire paths for each travel direction.
- Connection nodes.
- Junctions.
- Switches.
- Segment transitions.
- Explicit wire elevation.

Each trolleybus requires two separate contact paths corresponding to its two poles.

A contact path must provide continuous 3D geometry and support sampling by arc length.

Example:

```ts
interface ContactWireSegment {
  id: string;
  geometry: Curve3DDefinition;
  length: number;
  startNodeId: string;
  endNodeId: string;
  polarity: 'positive' | 'negative';
}
```

Polarity is included as a domain property for future electrical simulation.

No detailed power-grid simulation is required yet.

### 7.2 Pole mechanics

Each vehicle has two independently articulated trolley poles.

Each pole must have:

- A fixed base attachment point on the vehicle roof.
- A defined physical length.
- Horizontal and vertical angular movement.
- A contact head.
- An assigned contact wire path.
- A current contact state.

The contact head must remain geometrically attached to the assigned wire during normal operation.

### 7.3 Contact calculation

For each simulation update:

1. Calculate the pole base position in world coordinates.
2. Identify the active wire segment for that pole.
3. Determine the valid contact point on the wire.
4. Solve the pole orientation using the base position, fixed pole length, and wire geometry.
5. Update the contact head position.
6. Validate pole reach and angular constraints.
7. Preserve contact continuity when transitioning between wire segments.

For a fixed-length pole, the contact point must satisfy:

```text
distance(poleBase, contactPoint) ≈ poleLength
```

The contact point must also lie on the assigned wire geometry.

Use a numerical or analytical solver where appropriate.

Do not independently snap a pole head to a wire while stretching the pole to an arbitrary length.

### 7.4 Curves

The contact network must account for the fact that the poles are mounted near the rear of the vehicle.

When the trolleybus turns, the pole bases follow a different trajectory from the front axle.

The contact solver must operate in world space and use actual vehicle geometry.

The two poles must move independently.

### 7.5 Junctions and switches

Implement at least one branching overhead wire junction.

The network must explicitly define which outgoing contact path each pole follows.

For v0.1, autonomous vehicles may select the correct branch automatically based on their route.

Design the switch subsystem to support future current-operated switches:

- Traction applied through the control contact selects one branch.
- Coasting through the control contact selects the other branch.

The exact switch configuration must be data-driven rather than universally hardcoded.

Detailed electrical actuation may be deferred, but the architecture must support it.

### 7.6 Failure handling

If a valid pole-to-wire contact cannot be maintained:

- Mark the pole as disconnected.
- Expose a diagnostic event.
- Do not silently teleport the contact head.
- Do not stretch the pole.
- Do not hide the error.

Full derailment animation and manual pole reconnection are outside v0.1 scope.

### 7.7 Debug visualization

Implement a toggleable overhead network debug mode.

Show:

- Contact wire splines.
- Contact points.
- Pole base points.
- Pole reach constraints.
- Active wire segment IDs.
- Contact status.
- Junction connectivity.

This is mandatory for development and testing.

---

## 8. Stops and Passenger Simulation

Each stop must have:

- Unique ID.
- Name.
- Position.
- Direction.
- Associated route.
- Defined stopping point.
- Configurable dwell time.

Vehicles must stop accurately.

For v0.1, passenger exchange may use a simple simulated duration.

Example:

```text
dwellTime = baseDwellTime + passengerDelay
```

Use seeded randomness for passenger delays.

Suggested dwell duration: 8–20 simulated seconds.

Show a small number of low-poly passengers waiting at stops.

Passenger animation is optional.

Vehicle doors must visibly open and close.

Vehicles must not depart with doors open.

---

## 9. Timetable and Delays

Each vehicle must have its own schedule.

Use simulation time rather than real-world wall-clock time.

### Scheduling requirements

- Define planned arrival/departure times.
- Track actual arrival/departure times.
- Calculate schedule deviation.
- Display early/on-time/late status.
- Preserve delay across subsequent stops unless recovered through normal operation.

Do not generate arbitrary delay values solely for display.

Delays must result from simulated conditions such as:

- Longer dwell times.
- Slower driving.
- Waiting behind another trolleybus.
- Traffic signals, if implemented.

### Vehicle interactions

Vehicles must maintain safe following distances.

If a leading trolleybus is stopped, the following trolleybus must slow down and wait.

Do not allow vehicles to occupy the same physical space.

Simple same-lane longitudinal separation is sufficient for v0.1.

Complex traffic AI is not required.

---

## 10. Simulation Engine

Implement a fixed-timestep simulation.

Recommended timestep:

```text
1 / 60 seconds
```

The simulation must be independent of rendering frame rate.

### Requirements

- Deterministic update order.
- Explicit simulation clock.
- Pause/resume support.
- Simulation speed multiplier.
- Seeded random number generator.
- Stable state snapshots.
- No dependency on React rendering frequency.

Supported simulation speeds:

- 1×
- 2×
- 4×

Use an accumulator-based fixed-step loop with a maximum catch-up budget to avoid runaway updates after tab suspension.

Visual rendering may interpolate between simulation snapshots.

---

## 11. Camera System

Implement an isometric-style perspective camera.

Use an orthographic camera initially.

### Camera modes

**Overview**

Shows the entire miniature route or a substantial portion of it.

**Follow Vehicle**

Smoothly follows a selected trolleybus.

**Free Camera**

Allows panning, zooming, and rotating around the city.

### Controls

- Mouse wheel: zoom.
- Mouse drag: pan or rotate.
- Click trolleybus: select vehicle.
- Double-click trolleybus: follow vehicle.
- Escape: return to overview.

Camera behavior must be independent of vehicle simulation.

---

## 12. User Interface

Use React for the interface.

Keep the UI minimalist and unobtrusive.

### Main HUD

Display:

- Route number.
- Current simulation time.
- Simulation speed.
- Pause/play control.
- Camera mode.
- Selected vehicle.

### Fleet panel

Show all three vehicles.

For each vehicle:

- Fleet number.
- Current stop or next stop.
- Current speed.
- Schedule deviation.
- Operational status.

Example:

```text
ROUTE 6

2001  Central Square   +0:30
2002  University       +2:15
2003  Riverside        -0:45
```

Clicking a vehicle selects it and optionally focuses the camera.

### Debug panel

Provide a developer-only panel for:

- FPS.
- Simulation timestep.
- Vehicle coordinates.
- Active road segment.
- Active wire segments.
- Pole contact status.
- Current vehicle speed.
- Simulation diagnostics.

Debug UI must be removable from production builds.

---

## 13. Architecture

Use a layered, modular architecture.

Suggested directory structure:

```text
src/
  app/
    App.tsx
    bootstrap.ts
    providers/

  core/
    math/
    geometry/
    time/
    events/
    random/

  simulation/
    SimulationEngine.ts
    SimulationClock.ts
    SimulationWorld.ts
    systems/
    interfaces/

  domain/
    vehicles/
      Vehicle.ts
      VehicleState.ts
      VehicleDynamics.ts
      VehicleConfiguration.ts

    driving/
      DrivingController.ts
      AutonomousDriver.ts
      DrivingCommand.ts

    roads/
      RoadNetwork.ts
      RoadSegment.ts
      RoadPath.ts

    overhead/
      ContactNetwork.ts
      ContactWire.ts
      PoleKinematics.ts
      PoleContactSolver.ts
      ContactSwitch.ts

    routes/
      Route.ts
      RouteService.ts
      RouteProgress.ts

    stops/
      Stop.ts
      StopService.ts

    schedules/
      Timetable.ts
      ScheduleTracker.ts

  rendering/
    SceneRenderer.ts
    vehicles/
    roads/
    overhead/
    environment/
    cameras/
    materials/
    debug/

  ui/
    components/
    panels/
    hooks/
    styles/

  state/
    useUIStore.ts

  data/
    routes/
    roads/
    overhead/
    vehicles/
    stops/
    environment/

  assets/
    models/
    textures/

  tests/
    unit/
    integration/
```

This is a suggested structure, not a requirement to create empty directories or unnecessary classes.

### Dependency rules

**Core**

Contains reusable mathematical and infrastructure utilities.

Must not depend on simulation, rendering, or UI.

**Domain**

Contains simulation concepts and business rules.

Must not import React or Three.js.

**Simulation**

Coordinates domain objects and updates world state.

Must not depend on rendering or UI.

**Rendering**

Reads simulation snapshots and produces visual representations.

Must not directly mutate simulation state.

**UI**

Reads presentation state and dispatches application commands.

Must not contain vehicle physics or contact wire calculations.

### Extensibility

The architecture must allow a future human-controlled driver to replace the autonomous driver without changing vehicle dynamics.

Suggested abstraction:

```ts
interface DrivingController {
  update(context: DrivingContext, deltaTime: number): DrivingCommand;
}
```

Likewise, vehicle rendering must be independent of whether a vehicle is controlled by AI or a human.

---

## 14. Data-Driven Configuration

The route and map must be defined outside the simulation engine.

Prefer typed configuration files or validated JSON.

The following must be configurable:

- Road geometry.
- Wire geometry.
- Stops.
- Routes.
- Timetables.
- Vehicle definitions.
- Pole dimensions.
- Driving parameters.
- Camera defaults.

Do not embed route coordinates inside vehicle controller classes.

Changing the route should not require modifying the simulation engine.

---

## 15. Performance

Target:

- Desktop browsers.
- Chrome, Firefox, and Edge.
- 60 FPS on a reasonably modern laptop GPU.
- Three active trolleybuses.
- A small environment with lightweight assets.

Optimization guidelines:

- Reuse geometries and materials.
- Use instancing for repeated scenery.
- Avoid unnecessary allocations inside update loops.
- Avoid React state updates every simulation tick.
- Minimize draw calls.
- Use appropriate shadow quality.
- Dispose of GPU resources correctly.

Do not introduce complex optimization infrastructure before profiling.

---

## 16. Testing Requirements

Use Vitest for unit and integration tests.

### Required unit tests

**Vehicle dynamics**

- Acceleration.
- Braking.
- Steering.
- Speed limiting.
- Body roll response.

**Route system**

- Segment transitions.
- Stop ordering.
- Route wrapping.
- Distance-based path sampling.

**Contact network**

- Wire sampling.
- Pole length constraints.
- Contact point calculation.
- Curved wire tracking.
- Junction transitions.
- Disconnected contact detection.

**Scheduling**

- Arrival deviation.
- Departure deviation.
- Delay propagation.

**Simulation**

- Deterministic updates.
- Fixed timestep.
- Pause/resume.
- Simulation speed scaling.

### Required integration tests

- Three vehicles complete repeated route cycles.
- Vehicles stop at the correct stops.
- Vehicles do not overlap.
- Pole contact remains valid along the normal route.
- Wire segment transitions do not introduce visible jumps.
- Simulation produces consistent results with the same seed.

---

## 17. Acceptance Criteria

The prototype is complete when:

1. The application starts using `npm run dev`.
2. A stylized 3D city is rendered.
3. Three blue trolleybuses are visible.
4. All three autonomously follow the same bidirectional route.
5. Each direction contains five scheduled stop visits.
6. Vehicles accelerate, brake, steer, and stop smoothly.
7. Passenger doors open and close at stops.
8. Vehicles maintain safe separation.
9. The fleet panel displays actual schedule deviations.
10. The user can select and follow any vehicle.
11. Pause and simulation speed controls work.
12. Trolleybus bodies visibly lean during turns.
13. Both trolley poles remain in geometric contact with their assigned wires during normal operation.
14. Pole movement remains continuous through curves and supported junctions.
15. Contact failures are reported rather than visually concealed.
16. The architecture keeps simulation, rendering, UI, and configuration separate.
17. Unit and integration tests pass.
18. TypeScript compilation, linting, and production build succeed.

### Contact quality requirements

For normal connected operation:

- Pole length error should remain below 1 cm in world units.
- Contact head-to-wire distance should remain below 1 cm.
- Contact heads must not visibly jump between frames.
- Both poles must follow their respective wires independently.

If a geometric constraint cannot be satisfied, report the invalid configuration or disconnected state rather than violating the constraints.

These tolerances apply to simulation geometry, not pixel-space rendering.

---

## 18. Implementation Plan

Implement the project incrementally.

### Phase 1 — Foundation

- Initialize Vite, React, TypeScript, Three.js.
- Configure linting, formatting, and testing.
- Implement simulation clock and update loop.
- Establish architectural boundaries.
- Create basic isometric camera and scene.

### Phase 2 — Vehicle and Roads

- Implement road graph.
- Implement vehicle dynamics.
- Create procedural low-poly trolleybus model.
- Add autonomous driver.
- Validate movement along curved roads.

### Phase 3 — Overhead Network

- Implement wire geometry.
- Implement pole kinematics.
- Implement contact solver.
- Add contact debug visualization.
- Validate curved wire tracking and junction transitions.

**Do not proceed to fleet simulation until normal pole-to-wire contact works reliably.**

### Phase 4 — Route Operations

- Implement ten directional stop visits.
- Add timetable and route progression.
- Add three autonomous vehicles.
- Implement stop dwell times.
- Add safe following behavior.
- Add delay tracking.

### Phase 5 — Presentation

- Build stylized city environment.
- Improve trolleybus appearance.
- Add doors and body roll animation.
- Implement camera modes.
- Build fleet panel and HUD.

### Phase 6 — Verification

- Run automated tests.
- Verify complete round trips.
- Test pole contact throughout the entire route.
- Check performance.
- Fix visual and simulation defects.
- Verify production build.

At the end of each phase, keep the application runnable.

---

## 19. Explicitly Out of Scope

Do not implement these features in v0.1:

- Manual driving.
- Full electrical circuit simulation.
- Detailed passenger pathfinding.
- Complex automobile traffic AI.
- Pedestrian collision physics.
- Multiplayer.
- Persistent backend.
- Account system.
- Economy or progression system.
- Vehicle damage.
- Full rollover physics.
- Manual trolley pole reconnection.
- Route editor.
- Multiple independent routes.
- Mobile controls.

However, avoid architectural decisions that would make these features unnecessarily difficult to introduce later.

---

## 20. Development Instructions for Codex

Treat this specification as the implementation contract.

**Deliver a working application, not merely a scaffold or architectural proposal.**

Before implementation:

1. Inspect the existing repository.
2. Identify reusable code and project conventions.
3. Propose a concise implementation plan.
4. Define module responsibilities and dependency boundaries.
5. Identify technical risks, especially trolley pole contact geometry.

During implementation:

- Use strict TypeScript.
- Avoid `any` unless justified.
- Keep modules cohesive and reasonably sized.
- Prefer composition over deep inheritance.
- Use explicit interfaces at meaningful boundaries.
- Avoid circular dependencies.
- Do not introduce unnecessary global state.
- Do not put simulation logic inside React components.
- Do not use frame-dependent physics.
- Do not hardcode wire contact positions.
- Add tests for nontrivial mathematical and domain logic.
- Keep the project runnable after each phase.

For initial assets, use procedural geometry if necessary.

Do not block the project waiting for external 3D models.

Prefer a recognizable, well-proportioned procedural trolleybus over an elaborate asset pipeline that prevents delivery of a working prototype.

### Verification

After implementation:

1. Install dependencies.
2. Run type checking.
3. Run linting.
4. Run unit and integration tests.
5. Run the production build.
6. Start the application.
7. If browser testing is available, inspect the rendered scene and test interaction.
8. Verify that three vehicles move continuously.
9. Verify that both poles remain attached to their wires.
10. Report remaining issues and limitations.

Do not claim that visual behavior has been verified if only compilation and unit tests were performed.

### Final deliverables

Provide:

- Complete source code.
- Working development and production builds.
- README with setup and controls.
- Architecture overview.
- Module dependency explanation.
- Configuration documentation.
- Automated tests.
- Known limitations.
- Recommended next steps for v0.2.

**Priority order:**

1. Working simulation.
2. Correct overhead wire contact.
3. Clean, extensible architecture.
4. Reliable autonomous vehicle behavior.
5. Visual polish.
6. Additional decorative details.

The defining experience should be watching three recognizable blue trolleybuses operate naturally in a miniature city, with their trolley poles accurately following the overhead contact network.

**End of specification.**
