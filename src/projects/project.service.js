/**
 * Project Service: Business logic for project lifecycle, validation, idempotency, and transitions.
 */

import { randomUUID } from 'node:crypto';
import { ProjectRepository } from './project.repository.js';
import { ExecutionRepository } from '../executions/execution.repository.js';
import { withTransaction } from '../db/connection.js';
import {
  PROJECT_STATUS,
  validateProjectInput,
  validateUuid,
  validateIdempotencyKey
} from './project.schema.js';
import { assertValidTransition } from './project.transitions.js';
import {
  NotFoundError,
  VersionConflictError,
  IdempotencyConflictError
} from '../errors/app-errors.js';
import { sanitizeData, logger } from '../logging/logger.js';

export class ProjectService {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   * @param {ProjectRepository} [projectRepo]
   * @param {ExecutionRepository} [executionRepo]
   */
  constructor(db, projectRepo, executionRepo) {
    this.db = db;
    this.projectRepo = projectRepo || new ProjectRepository(db);
    this.executionRepo = executionRepo || new ExecutionRepository(db);
  }

  /**
   * Idempotently creates a new project record.
   * @param {object} input
   * @param {string} [idempotencyKey]
   * @returns {object} Created or existing Project
   */
  createProject(input, idempotencyKey = null) {
    const validatedInput = validateProjectInput(input);
    const cleanKey = validateIdempotencyKey(idempotencyKey);

    // 1. Idempotency Check
    if (cleanKey) {
      const existingExecution = this.executionRepo.findByIdempotencyKey(cleanKey);
      if (existingExecution) {
        const existingProject = this.projectRepo.findById(existingExecution.projectId);
        if (existingProject) {
          // Verify payload compatibility
          const sameTitle = existingProject.title === validatedInput.title;
          const sameTopic = existingProject.topic === validatedInput.topic;
          const sameChannel = existingProject.channelName === validatedInput.channelName;

          if (sameTitle && sameTopic && sameChannel) {
            logger.info('Idempotent project creation replay', {
              projectId: existingProject.id,
              idempotencyKey: cleanKey
            });
            return existingProject;
          }

          throw new IdempotencyConflictError(
            `Idempotency key '${cleanKey}' was previously used with different project parameters.`,
            {
              idempotencyKey: cleanKey,
              existing: {
                title: existingProject.title,
                topic: existingProject.topic,
                channelName: existingProject.channelName
              },
              incoming: validatedInput
            }
          );
        }
      }
    }

    // 2. Create Project in Transaction
    const projectId = randomUUID();
    const now = new Date().toISOString();

    const newProject = {
      id: projectId,
      title: validatedInput.title,
      topic: validatedInput.topic,
      channelName: validatedInput.channelName,
      status: PROJECT_STATUS.CREATED,
      input: validatedInput,
      metadata: sanitizeData(validatedInput.metadata || {}),
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      version: 1
    };

    const created = withTransaction(this.db, () => {
      const project = this.projectRepo.create(newProject);

      if (cleanKey) {
        this.executionRepo.create({
          id: randomUUID(),
          projectId,
          operation: 'create_project',
          status: 'succeeded',
          attemptNumber: 1,
          idempotencyKey: cleanKey,
          startedAt: now,
          finishedAt: now,
          errorCode: null,
          errorMessage: null,
          result: { projectId, status: PROJECT_STATUS.CREATED }
        });
      }

      return project;
    });

    logger.info('Project created successfully', { projectId, title: created.title, status: created.status });
    return created;
  }

  /**
   * Retrieves a project by ID.
   * @param {string} projectId
   * @returns {object}
   */
  getProject(projectId) {
    const validId = validateUuid(projectId, 'projectId');
    const project = this.projectRepo.findById(validId);
    if (!project) {
      throw new NotFoundError(`Project with ID '${validId}' was not found.`, { projectId: validId });
    }
    return project;
  }

  /**
   * Lists projects with optional filters and pagination.
   * @param {object} [filters={}]
   * @param {string} [filters.status]
   * @param {string} [filters.topic]
   * @param {number} [filters.limit=20]
   * @param {number} [filters.offset=0]
   */
  listProjects(filters = {}) {
    return this.projectRepo.list(filters);
  }

  /**
   * Transitions a project to a new status with optimistic concurrency checks.
   * @param {string} projectId
   * @param {string} targetStatus
   * @param {number} [expectedVersion]
   * @param {object} [metadata]
   * @returns {object} Updated project
   */
  transitionProject(projectId, targetStatus, expectedVersion = null, metadata = null) {
    const validId = validateUuid(projectId, 'projectId');
    const current = this.getProject(validId);

    // If the project is already in the target status, treat the transition as idempotent success
    if (current.status === targetStatus) {
      logger.info('Project already in target status, idempotent transition returning current state', {
        projectId: validId,
        status: targetStatus
      });
      return current;
    }

    // Validate optimistic lock version if provided
    if (expectedVersion !== null && expectedVersion !== undefined) {
      const parsedVersion = parseInt(expectedVersion, 10);
      if (current.version !== parsedVersion) {
        throw new VersionConflictError(
          `Version conflict on project '${validId}'. Expected version ${parsedVersion}, but current version is ${current.version}.`,
          { projectId: validId, expectedVersion: parsedVersion, currentVersion: current.version }
        );
      }
    }

    // Validate state machine rule
    assertValidTransition(current.status, targetStatus, validId);

    const now = new Date().toISOString();
    const extraUpdates = {};

    if (metadata && typeof metadata === 'object') {
      extraUpdates.metadata = { ...current.metadata, ...sanitizeData(metadata) };
    }

    // Set timestamps based on status
    if (targetStatus === PROJECT_STATUS.PLANNING && !current.startedAt) {
      extraUpdates.startedAt = now;
    }

    if (targetStatus === PROJECT_STATUS.PUBLISHED || targetStatus === PROJECT_STATUS.CANCELLED) {
      extraUpdates.completedAt = now;
    }

    const versionToMatch = expectedVersion !== null && expectedVersion !== undefined ? parseInt(expectedVersion, 10) : current.version;
    const changed = this.projectRepo.updateStatus(validId, targetStatus, versionToMatch, extraUpdates);

    if (changed === 0) {
      throw new VersionConflictError(
        `Failed to transition project '${validId}'. The project was concurrently modified.`,
        { projectId: validId, targetStatus }
      );
    }

    const updated = this.getProject(validId);
    logger.info('Project status transitioned', {
      projectId: validId,
      fromStatus: current.status,
      toStatus: updated.status,
      version: updated.version
    });

    return updated;
  }

  /**
   * Records a project failure.
   * @param {string} projectId
   * @param {Error|string} error
   * @param {number} [expectedVersion]
   */
  recordProjectFailure(projectId, error, expectedVersion = null) {
    const validId = validateUuid(projectId, 'projectId');
    const current = this.getProject(validId);

    assertValidTransition(current.status, PROJECT_STATUS.FAILED, validId);

    const errorMsg = typeof error === 'string' ? error : (error?.message || 'Unknown error occurred');
    this.projectRepo.recordFailure(validId, errorMsg, expectedVersion);

    return this.getProject(validId);
  }

  /**
   * Retrieves all executions associated with a project.
   * @param {string} projectId
   * @returns {object[]}
   */
  getProjectExecutions(projectId) {
    const validId = validateUuid(projectId, 'projectId');
    // Ensure project exists
    this.getProject(validId);
    return this.executionRepo.findByProjectId(validId);
  }
}
