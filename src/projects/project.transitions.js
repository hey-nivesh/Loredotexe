/**
 * Project Lifecycle Transition Rules and State Machine Validator.
 */

import { PROJECT_STATUS } from './project.schema.js';
import { InvalidStateTransitionError } from '../errors/app-errors.js';

/**
 * Strict transition allowlist according to Phase 1 lifecycle specifications.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [PROJECT_STATUS.CREATED]: Object.freeze([
    PROJECT_STATUS.PLANNING,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.PLANNING]: Object.freeze([
    PROJECT_STATUS.PLANNED,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.PLANNED]: Object.freeze([
    PROJECT_STATUS.GENERATING,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.GENERATING]: Object.freeze([
    PROJECT_STATUS.REVIEW_READY,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.REVIEW_READY]: Object.freeze([
    PROJECT_STATUS.APPROVED,
    PROJECT_STATUS.MEDIA_GENERATING,
    PROJECT_STATUS.REJECTED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.APPROVED]: Object.freeze([
    PROJECT_STATUS.MEDIA_GENERATING,
    PROJECT_STATUS.PUBLISHING,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.MEDIA_GENERATING]: Object.freeze([
    PROJECT_STATUS.MEDIA_READY,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.MEDIA_READY]: Object.freeze([
    PROJECT_STATUS.AUDIO_GENERATING,
    PROJECT_STATUS.ASSEMBLING,
    PROJECT_STATUS.APPROVED,
    PROJECT_STATUS.PUBLISHING,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.AUDIO_GENERATING]: Object.freeze([
    PROJECT_STATUS.ASSEMBLING,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.ASSEMBLING]: Object.freeze([
    PROJECT_STATUS.VIDEO_READY,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.VIDEO_READY]: Object.freeze([
    PROJECT_STATUS.REVIEW_READY,
    PROJECT_STATUS.APPROVED,
    PROJECT_STATUS.PUBLISHING,
    PROJECT_STATUS.FAILED,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.REJECTED]: Object.freeze([
    PROJECT_STATUS.PLANNING,
    PROJECT_STATUS.CANCELLED
  ]),
  [PROJECT_STATUS.PUBLISHING]: Object.freeze([
    PROJECT_STATUS.PUBLISHED,
    PROJECT_STATUS.FAILED
  ]),
  [PROJECT_STATUS.FAILED]: Object.freeze([
    PROJECT_STATUS.PLANNING,
    PROJECT_STATUS.GENERATING,
    PROJECT_STATUS.MEDIA_GENERATING,
    PROJECT_STATUS.AUDIO_GENERATING,
    PROJECT_STATUS.ASSEMBLING,
    PROJECT_STATUS.PUBLISHING,
    PROJECT_STATUS.CANCELLED
  ]),
  // Terminal states
  [PROJECT_STATUS.PUBLISHED]: Object.freeze([]),
  [PROJECT_STATUS.CANCELLED]: Object.freeze([])
});

/**
 * Checks if a transition from currentStatus to targetStatus is allowed.
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
export function canTransition(currentStatus, targetStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) {
    return false;
  }
  return allowed.includes(targetStatus);
}

/**
 * Asserts that a state transition is permitted. Throws InvalidStateTransitionError if illegal.
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @param {string} [projectId]
 */
export function assertValidTransition(currentStatus, targetStatus, projectId) {
  if (!PROJECT_STATUS[targetStatus]) {
    throw new InvalidStateTransitionError(
      `Unknown target status: '${targetStatus}'. Must be one of: ${Object.values(PROJECT_STATUS).join(', ')}`,
      { currentStatus, targetStatus, projectId }
    );
  }

  if (currentStatus === targetStatus) {
    throw new InvalidStateTransitionError(
      `Cannot transition project from '${currentStatus}' to identical status '${targetStatus}'.`,
      { currentStatus, targetStatus, projectId }
    );
  }

  if (!canTransition(currentStatus, targetStatus)) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)';
    throw new InvalidStateTransitionError(
      `Illegal transition from '${currentStatus}' to '${targetStatus}'. Allowed target statuses: [${allowedStr}].`,
      { currentStatus, targetStatus, allowedTargets: allowed, projectId }
    );
  }
}
