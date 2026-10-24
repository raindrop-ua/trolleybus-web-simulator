import type { ContactSwitch } from '../types';

/** The timetable route specifies an outgoing edge; electrical actuation is data. */
export function selectRouteBranch(contactSwitch: ContactSwitch): string {
  if (!contactSwitch.outgoingSegmentIds.includes(contactSwitch.routeBranchId)) {
    throw new Error(
      `Switch ${contactSwitch.id} cannot select route edge ${contactSwitch.routeBranchId}.`,
    );
  }
  return contactSwitch.routeBranchId;
}

/** Current-operation hook: the configured actuation selects the route branch. */
export function selectActuatedBranch(
  contactSwitch: ContactSwitch,
  tractionApplied: boolean,
): string {
  const actuation = tractionApplied ? 'traction' : 'coasting';
  if (actuation === contactSwitch.actuation) return selectRouteBranch(contactSwitch);
  return (
    contactSwitch.outgoingSegmentIds.find((id) => id !== contactSwitch.routeBranchId) ??
    selectRouteBranch(contactSwitch)
  );
}
