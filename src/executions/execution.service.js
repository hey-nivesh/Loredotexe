/**
 * Execution Service: Tracks orchestration operations, provides retry classification and idempotency.
 */

import { randomUUID } from 'node:crypto';
import { ExecutionRepository } from './execution.repository.js';
import { validateUuid, validateIdempotencyKey } from '../projects/project.schema.js';
import { ValidationError, NotFoundError, AppError } from '../errors/app-errors.js';
import { sanitizeData } from '../logging/logger.js';

export class ExecutionService {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   * @param {ExecutionRepository} [executionRepo]
   */
  constructor(db, executionRepo) {
    this.db = db;
    this.executionRepo = executionRepo || new ExecutionRepository(db);
  }

  /**
   * Starts a new tracked execution.
   * @param {object} params
   * @param {string} params.projectId
   * @param {string} params.operation
   * @param {number} [params.attemptNumber=1]
   * @param {string} [params.idempotencyKey]
   */
  startExecution({ projectId, operation, attemptNumber = 1, idempotencyKey = null }) {
    validateUuid(projectId, 'projectId');

    if (!operation || typeof operation !== 'string' || !operation.trim()) {
      throw new ValidationError('Operation name is required for execution tracking.');
    }

    const cleanKey = validateIdempotencyKey(idempotencyKey);

    // If idempotencyKey provided, check if execution already exists
    if (cleanKey) {
      const existing = this.executionRepo.findByIdempotencyKey(cleanKey);
      if (existing) {
        return existing;
      }
    }

    const executionId = randomUUID();
    const now = new Date().toISOString();

    const record = {
      id: executionId,
      projectId,
      operation: operation.trim(),
      status: 'running',
      attemptNumber: Math.max(1, parseInt(attemptNumber, 10) || 1),
      idempotencyKey: cleanKey,
      startedAt: now,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      result: null
    };

    return this.executionRepo.create(record);
  }

  /**
   * Marks an execution as successfully finished.
   * @param {string} executionId
   * @param {object} [result={}]
   */
  completeExecution(executionId, result = {}) {
    validateUuid(executionId, 'executionId');
    const existing = this.executionRepo.findById(executionId);
    if (!existing) {
      throw new NotFoundError(`Execution '${executionId}' not found.`);
    }

    const sanitizedResult = sanitizeData(result);
    return this.executionRepo.update(executionId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
      result: sanitizedResult
    });
  }

  /**
   * Marks an execution as failed with sanitized error details.
   * @param {string} executionId
   * @param {Error|AppError|string} error
   * @param {string} [fallbackErrorCode='OPERATION_FAILED']
   */
  failExecution(executionId, error, fallbackErrorCode = 'OPERATION_FAILED') {
    validateUuid(executionId, 'executionId');
    const existing = this.executionRepo.findById(executionId);
    if (!existing) {
      throw new NotFoundError(`Execution '${executionId}' not found.`);
    }

    let errorCode = fallbackErrorCode;
    let errorMessage = 'An unexpected operation error occurred.';

    if (error instanceof AppError) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return this.executionRepo.update(executionId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      errorCode,
      errorMessage,
      result: null
    });
  }

  /**
   * Classifies whether an error is transient (retryable) or permanent.
   * @param {unknown} error
   * @returns {boolean}
   */
  isRetryable(error) {
    if (!error) {
      return false;
    }

    if (error instanceof AppError) {
      return error.isTransient === true;
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      // SQLite lock / busy errors or transient timeouts
      if (msg.includes('busy') || msg.includes('locked') || msg.includes('timeout') || msg.includes('econnrefused')) {
        return true;
      }
    }

    return false;
  }
}
