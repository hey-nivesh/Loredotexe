/**
 * Local Project State & Research HTTP API Server.
 * Lightweight, zero-dependency REST server for n8n orchestrator integration.
 * Bound strictly to localhost (127.0.0.1).
 */

import http from 'node:http';
import { URL } from 'node:url';
import { config } from './config/load-config.js';
import { createDatabaseConnection, runMigrations } from './db/connection.js';
import { ProjectService } from './projects/project.service.js';
import { ExecutionService } from './executions/execution.service.js';
import { ResearchService } from './research/research-service.js';
import { ScriptService } from './scriptwriting/services/script-service.js';
import { validateScriptSchema } from './scriptwriting/schema/script-schema.js';
import { StoryboardService } from './storyboard/services/storyboard-service.js';
import { validateStoryboardPackage } from './storyboard/schema/storyboard-schema.js';
import { MediaService } from './media/index.js';
import { AssemblyService } from './assembly/index.js';
import { sourceRegistry } from './research/discovery/source-registry.js';
import { AppError, NotFoundError } from './errors/app-errors.js';
import { logger } from './logging/logger.js';

/**
 * Reads and parses JSON body from an incoming HTTP request.
 * @param {http.IncomingMessage} req
 * @returns {Promise<any>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // 2MB body limit protection
      if (body.length > 2097152) {
        reject(new AppError('Request body exceeds 2MB limit.', 'PAYLOAD_TOO_LARGE', 413));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new AppError('Invalid JSON body.', 'MALFORMED_JSON', 400));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

/**
 * Sends a JSON HTTP response.
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {object} data
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:5678',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, Authorization'
  });
  res.end(JSON.stringify(data));
}

/**
 * Creates the HTTP request listener.
 * @param {ProjectService} projectService
 * @param {ExecutionService} executionService
 * @param {ResearchService} researchService
 * @param {ScriptService} scriptService
 * @param {StoryboardService} storyboardService
 * @param {MediaService} mediaService
 * @param {AssemblyService} [assemblyService]
 */
export function createRequestListener(projectService, executionService, researchService, scriptService, storyboardService, mediaService, assemblyService = null) {
  const activeAssemblyService = assemblyService || (projectService?.db ? new AssemblyService(projectService.db) : null);
  return async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://localhost:5678',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, Authorization'
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      // 1. Health check
      if (method === 'GET' && pathname === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          app: config.appName,
          env: config.appEnv,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // --- Projects Endpoints ---

      // 2. POST /api/projects - Create project
      if (method === 'POST' && pathname === '/api/projects') {
        const body = await readJsonBody(req);
        const headerKey = req.headers['idempotency-key'];
        const idempotencyKey = body.idempotencyKey || headerKey;
        const project = projectService.createProject(body, idempotencyKey);
        sendJson(res, 201, { project });
        return;
      }

      // 3. GET /api/projects - List projects
      if (method === 'GET' && pathname === '/api/projects') {
        const status = parsedUrl.searchParams.get('status') || undefined;
        const topic = parsedUrl.searchParams.get('topic') || undefined;
        const limit = parsedUrl.searchParams.get('limit') || undefined;
        const offset = parsedUrl.searchParams.get('offset') || undefined;

        const result = projectService.listProjects({ status, topic, limit, offset });
        sendJson(res, 200, result);
        return;
      }

      // 4. Project ID routes: /api/projects/:id/...
      const projectRouteMatch = pathname.match(/^\/api\/projects\/([0-9a-fA-F-]{36})(?:\/([a-zA-Z0-9_-]+))?$/);
      if (projectRouteMatch) {
        const projectId = projectRouteMatch[1];
        const subRoute = projectRouteMatch[2];

        // GET /api/projects/:id
        if (method === 'GET' && !subRoute) {
          const project = projectService.getProject(projectId);
          sendJson(res, 200, { project });
          return;
        }

        // POST /api/projects/:id/transition
        if (method === 'POST' && subRoute === 'transition') {
          const body = await readJsonBody(req);
          const { targetStatus, expectedVersion, metadata } = body;
          const updated = projectService.transitionProject(projectId, targetStatus, expectedVersion, metadata);
          sendJson(res, 200, { project: updated });
          return;
        }

        // GET /api/projects/:id/executions
        if (method === 'GET' && subRoute === 'executions') {
          const executions = projectService.getProjectExecutions(projectId);
          sendJson(res, 200, { executions });
          return;
        }

        // GET /api/projects/:id/dossier
        if (method === 'GET' && subRoute === 'dossier') {
          const dossierRecord = researchService.dossierService.getDossierByProjectId(projectId);
          if (!dossierRecord) {
            throw new NotFoundError(`No research dossier found for project '${projectId}'.`);
          }
          sendJson(res, 200, { dossier: dossierRecord });
          return;
        }

        // GET /api/projects/:id/script
        if (method === 'GET' && subRoute === 'script') {
          const scriptRecord = scriptService.getScriptByProjectId(projectId);
          if (!scriptRecord) {
            throw new NotFoundError(`No script found for project '${projectId}'.`);
          }
          sendJson(res, 200, { script: scriptRecord });
          return;
        }

        // GET /api/projects/:id/scripts
        if (method === 'GET' && subRoute === 'scripts') {
          const revisions = scriptService.listScriptRevisions(projectId);
          sendJson(res, 200, { revisions });
          return;
        }

        // GET /api/projects/:id/storyboard
        if (method === 'GET' && subRoute === 'storyboard') {
          const storyboardRecord = storyboardService.getStoryboardByProjectId(projectId);
          if (!storyboardRecord) {
            throw new NotFoundError(`No storyboard found for project '${projectId}'.`);
          }
          sendJson(res, 200, { storyboard: storyboardRecord });
          return;
        }

        // GET /api/projects/:id/storyboards
        if (method === 'GET' && subRoute === 'storyboards') {
          const revisions = storyboardService.listStoryboardRevisions(projectId);
          sendJson(res, 200, { revisions });
          return;
        }

        // GET /api/projects/:id/media
        if (method === 'GET' && subRoute === 'media') {
          const manifest = mediaService ? mediaService.getManifest(projectId) : null;
          const assets = mediaService ? mediaService.listAssets(projectId) : [];
          sendJson(res, 200, { manifest, assets });
          return;
        }
      }

      // --- Executions Endpoints ---

      // 5. POST /api/executions
      if (method === 'POST' && pathname === '/api/executions') {
        const body = await readJsonBody(req);
        const headerKey = req.headers['idempotency-key'];
        const execution = executionService.startExecution({
          projectId: body.projectId,
          operation: body.operation,
          attemptNumber: body.attemptNumber,
          idempotencyKey: body.idempotencyKey || headerKey
        });
        sendJson(res, 201, { execution });
        return;
      }

      const executionMatch = pathname.match(/^\/api\/executions\/([0-9a-fA-F-]{36})\/(complete|fail)$/);
      if (method === 'POST' && executionMatch) {
        const executionId = executionMatch[1];
        const action = executionMatch[2];
        const body = await readJsonBody(req);

        if (action === 'complete') {
          const completed = executionService.completeExecution(executionId, body.result);
          sendJson(res, 200, { execution: completed });
          return;
        }

        if (action === 'fail') {
          const failed = executionService.failExecution(executionId, body.error || body.message, body.errorCode);
          sendJson(res, 200, { execution: failed });
          return;
        }
      }

      // --- Phase 2: Research Endpoints ---

      // 6. GET /api/research/sources
      if (method === 'GET' && pathname === '/api/research/sources') {
        const category = parsedUrl.searchParams.get('category') || 'all';
        const sources = sourceRegistry.getSourcesByCategory(category);
        sendJson(res, 200, { sources });
        return;
      }

      // 7. POST /api/research/discover
      if (method === 'POST' && pathname === '/api/research/discover') {
        const body = await readJsonBody(req);
        const result = await researchService.discoverCandidates({
          category: body.category || 'all',
          maxPerSource: body.maxPerSource || 10,
          timeoutMs: body.timeoutMs || 6000,
          sourceIds: body.sourceIds || null
        });
        sendJson(res, 200, result);
        return;
      }

      // 8. POST /api/research/plan
      if (method === 'POST' && pathname === '/api/research/plan') {
        const body = await readJsonBody(req);
        const plan = await researchService.planner.createPlan(body, researchService.adapter);
        sendJson(res, 200, { plan });
        return;
      }

      // 9. POST /api/research/pipeline - Execute complete end-to-end research
      if (method === 'POST' && pathname === '/api/research/pipeline') {
        const body = await readJsonBody(req);
        const candidate = body.candidate || {
          title: body.title || body.topic,
          normalized_topic: body.topic || body.title,
          category: body.category || 'general',
          summary: body.summary || '',
          source_url: body.source_url || body.url || null
        };

        const result = await researchService.executeResearchPipeline({
          candidate,
          projectId: body.projectId || null,
          prefetchedDocs: body.prefetchedDocs || null
        });

        sendJson(res, 200, result);
        return;
      }

      // 10. POST /api/research/dossiers - Save dossier
      if (method === 'POST' && pathname === '/api/research/dossiers') {
        const body = await readJsonBody(req);
        const saved = researchService.dossierService.saveDossier(body.dossier || body, body.projectId);
        sendJson(res, 201, { dossier: saved });
        return;
      }

      // 11. GET /api/research/dossiers/:id
      const dossierMatch = pathname.match(/^\/api\/research\/dossiers\/([0-9a-fA-F-]{36})$/);
      if (method === 'GET' && dossierMatch) {
        const dossierId = dossierMatch[1];
        const record = researchService.dossierService.getDossierById(dossierId);
        if (!record) {
          throw new NotFoundError(`Research dossier '${dossierId}' not found.`);
        }
        sendJson(res, 200, { dossier: record });
        return;
      }

      // --- Phase 3: Scriptwriting Endpoints ---

      // 12. POST /api/scriptwriting/generate - Generate script from dossier
      if (method === 'POST' && pathname === '/api/scriptwriting/generate') {
        const body = await readJsonBody(req);
        let dossier = body.dossier;
        if (typeof dossier === 'string') {
          try { dossier = JSON.parse(dossier); } catch (_) {}
        }
        if (!dossier && body.projectId) {
          const dossierRecord = researchService.dossierService.getDossierByProjectId(body.projectId);
          if (dossierRecord) {
            dossier = dossierRecord.dossier;
          }
        }
        if (dossier && dossier.dossier) {
          dossier = dossier.dossier;
        }
        if (!dossier) {
          throw new NotFoundError('No research dossier provided or found for project.');
        }

        const result = scriptService.generateScript({
          dossier,
          projectId: body.projectId || dossier.project_id,
          scriptVersion: body.scriptVersion || 1,
          maxRevisions: body.maxRevisions || 2,
          revisionReason: body.revisionReason || null
        });

        sendJson(res, 200, result);
        return;
      }

      // 13. POST /api/scriptwriting/validate - Validate script package and QA
      if (method === 'POST' && pathname === '/api/scriptwriting/validate') {
        const body = await readJsonBody(req);
        let scriptPackage = body.script || body.scriptPackage || body;
        if (typeof scriptPackage === 'string') {
          try { scriptPackage = JSON.parse(scriptPackage); } catch (_) {}
        }
        const dossier = body.dossier || {};
        const validated = validateScriptSchema(scriptPackage);
        const qaReport = scriptService.editorialQa.evaluateScript(validated, dossier);
        sendJson(res, 200, { valid: true, qaReport });
        return;
      }

      // --- Phase 4: Storyboard Endpoints ---

      // 14. POST /api/storyboard/generate - Generate storyboard from script
      if (method === 'POST' && pathname === '/api/storyboard/generate') {
        const body = await readJsonBody(req);
        let scriptPackage = body.scriptPackage || body.script;
        if (typeof scriptPackage === 'string') {
          try { scriptPackage = JSON.parse(scriptPackage); } catch (_) {}
        }
        if (!scriptPackage && body.projectId) {
          const scriptRecord = scriptService.getScriptByProjectId(body.projectId);
          if (scriptRecord) {
            scriptPackage = scriptRecord.script;
          }
        }
        if (scriptPackage && scriptPackage.scriptPackage) {
          scriptPackage = scriptPackage.scriptPackage;
        }
        if (scriptPackage && scriptPackage.script) {
          scriptPackage = scriptPackage.script;
        }
        if (!scriptPackage) {
          throw new NotFoundError('No script package provided or found for project.');
        }

        const result = storyboardService.generateStoryboard({
          scriptPackage,
          projectId: body.projectId || scriptPackage.project_id,
          scriptVersion: body.scriptVersion || scriptPackage.script_version || 1,
          customOptions: body.customOptions || {}
        });

        sendJson(res, 200, result);
        return;
      }

      // 15. POST /api/storyboard/validate - Validate storyboard package and continuity
      if (method === 'POST' && pathname === '/api/storyboard/validate') {
        const body = await readJsonBody(req);
        let storyboardPackage = body.storyboardPackage || body.storyboard || body;
        if (typeof storyboardPackage === 'string') {
          try { storyboardPackage = JSON.parse(storyboardPackage); } catch (_) {}
        }
        if (storyboardPackage && storyboardPackage.storyboardPackage) {
          storyboardPackage = storyboardPackage.storyboardPackage;
        }
        const scriptPackage = body.scriptPackage || body.script || null;
        const validated = validateStoryboardPackage(storyboardPackage);
        const validationReport = storyboardService.continuityValidator.validateStoryboard(validated, scriptPackage);
        sendJson(res, 200, { valid: validationReport.valid, validationReport });
        return;
      }

      // --- Phase 5: Media Generation Endpoints ---

      // 16. GET /api/media/hardware - Hardware detection and capability report
      if (method === 'GET' && pathname === '/api/media/hardware') {
        const report = mediaService.getHardwareReport();
        sendJson(res, 200, report);
        return;
      }

      // 17. POST /api/media/dry-run - Dry-run plan and resource estimation
      if (method === 'POST' && pathname === '/api/media/dry-run') {
        const body = await readJsonBody(req);
        let storyboardPackage = body.storyboardPackage || body.storyboard;
        if (typeof storyboardPackage === 'string') {
          try { storyboardPackage = JSON.parse(storyboardPackage); } catch (_) {}
        }
        if (!storyboardPackage && body.projectId) {
          const record = storyboardService.getStoryboardByProjectId(body.projectId);
          if (record) storyboardPackage = record.storyboard;
        }
        if (!storyboardPackage) {
          throw new NotFoundError('No storyboard package provided or found for project.');
        }

        const result = mediaService.dryRun({
          storyboardPackage,
          projectId: body.projectId || storyboardPackage.project_id,
          options: body.options || {}
        });

        sendJson(res, 200, result);
        return;
      }

      // 18. POST /api/media/generate - Execute media generation
      if (method === 'POST' && pathname === '/api/media/generate') {
        const body = await readJsonBody(req);
        let storyboardPackage = body.storyboardPackage || body.storyboard;
        if (typeof storyboardPackage === 'string') {
          try { storyboardPackage = JSON.parse(storyboardPackage); } catch (_) {}
        }
        if (!storyboardPackage && body.projectId) {
          const record = storyboardService.getStoryboardByProjectId(body.projectId);
          if (record) storyboardPackage = record.storyboard;
        }
        if (!storyboardPackage) {
          throw new NotFoundError('No storyboard package provided or found for project.');
        }

        const result = await mediaService.generateMedia({
          storyboardPackage,
          projectId: body.projectId || storyboardPackage.project_id,
          options: body.options || body
        });

        sendJson(res, 200, result);
        return;
      }

      // 19. GET /api/media/manifest/:projectId - Get latest media manifest
      const manifestMatch = pathname.match(/^\/api\/media\/manifest\/([0-9a-fA-F-]+)$/);
      if (method === 'GET' && manifestMatch) {
        const projectId = manifestMatch[1];
        const manifest = mediaService.getManifest(projectId);
        if (!manifest) {
          throw new NotFoundError(`No media manifest found for project '${projectId}'.`);
        }
        sendJson(res, 200, { manifest });
        return;
      }

      // 20. GET /api/media/assets/:projectId - List generated media assets
      const assetsMatch = pathname.match(/^\/api\/media\/assets\/([0-9a-fA-F-]+)$/);
      if (method === 'GET' && assetsMatch) {
        const projectId = assetsMatch[1];
        const assets = mediaService.listAssets(projectId);
        sendJson(res, 200, { assets });
        return;
      }

      // 21. POST /api/media/validate - Validate media file
      if (method === 'POST' && pathname === '/api/media/validate') {
        const body = await readJsonBody(req);
        const result = mediaService.validator.validateMedia(body.filePath || body.file_path, body.spec || {});
        sendJson(res, 200, result);
        return;
      }

      // --- Phase 6: Voice, Subtitles & Video Assembly Endpoints ---

      // 22. GET /api/assembly/ffmpeg - Detect FFmpeg / FFprobe availability
      if (method === 'GET' && pathname === '/api/assembly/ffmpeg') {
        const result = activeAssemblyService.ffmpegDetector.detect();
        sendJson(res, 200, result);
        return;
      }

      // 23. POST /api/assembly/dry-run - Dry-run assembly analysis
      if (method === 'POST' && pathname === '/api/assembly/dry-run') {
        const body = await readJsonBody(req);
        const scriptPackage = body.scriptPackage || body.script_package;
        const storyboardPackage = body.storyboardPackage || body.storyboard_package;
        const mediaManifest = body.mediaManifest || body.media_manifest;

        if (!storyboardPackage) {
          throw new AppError('storyboardPackage is required for Phase 6 dry-run.', 'MISSING_STORYBOARD', 400);
        }

        const result = activeAssemblyService.dryRun({
          scriptPackage,
          storyboardPackage,
          mediaManifest,
          projectId: body.projectId || storyboardPackage.project_id,
          options: body.options || body
        });

        sendJson(res, 200, result);
        return;
      }

      // 24. POST /api/assembly/assemble - Execute complete audio, subtitle & video assembly
      if (method === 'POST' && (pathname === '/api/assembly/assemble' || pathname === '/api/assembly/execute')) {
        const body = await readJsonBody(req);
        const scriptPackage = body.scriptPackage || body.script_package;
        const storyboardPackage = body.storyboardPackage || body.storyboard_package;
        const mediaManifest = body.mediaManifest || body.media_manifest;

        if (!storyboardPackage) {
          throw new AppError('storyboardPackage is required for Phase 6 video assembly.', 'MISSING_STORYBOARD', 400);
        }

        const result = await activeAssemblyService.assembleProject({
          scriptPackage,
          storyboardPackage,
          mediaManifest,
          projectId: body.projectId || storyboardPackage.project_id,
          options: body.options || body
        });

        sendJson(res, 200, result);
        return;
      }

      // 25. GET /api/assembly/manifest/:projectId - Get assembly manifest
      const assemblyManifestMatch = pathname.match(/^\/api\/assembly\/manifest\/([0-9a-fA-F-]+)$/);
      if (method === 'GET' && assemblyManifestMatch) {
        const projectId = assemblyManifestMatch[1];
        const assembly = activeAssemblyService.repository.getAssemblyByProject(projectId);
        if (!assembly) {
          throw new NotFoundError(`No assembly manifest found for project '${projectId}'.`);
        }
        sendJson(res, 200, { assembly });
        return;
      }

      // 26. POST /api/assembly/validate - Validate final video deliverable
      if (method === 'POST' && pathname === '/api/assembly/validate') {
        const body = await readJsonBody(req);
        const result = activeAssemblyService.validator.validateFinalVideo({
          videoPath: body.videoPath || body.video_path,
          audioPath: body.audioPath || body.audio_path,
          subtitlePath: body.subtitlePath || body.subtitle_path,
          expectedDurationSeconds: body.expectedDurationSeconds || body.duration_seconds
        });
        sendJson(res, 200, result);
        return;
      }

      // Not found
      throw new NotFoundError(`Endpoint '${method} ${pathname}' not found.`);
    } catch (err) {
      if (err instanceof AppError) {
        sendJson(res, err.statusCode, err.toJSON());
      } else {
        logger.error('Unhandled server error', { error: err.message, stack: err.stack });
        sendJson(res, 500, {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An internal server error occurred.',
            statusCode: 500,
            isTransient: false
          }
        });
      }
    }
  };
}

/**
 * Creates and starts the HTTP server.
 * @param {import('node:sqlite').DatabaseSync} [db]
 * @param {number} [port]
 * @param {string} [host]
 */
export function createServer(db = null, port = config.port, host = config.host) {
  const database = db || createDatabaseConnection();
  runMigrations(database);

  const projectService = new ProjectService(database);
  const executionService = new ExecutionService(database);
  const researchService = new ResearchService(database);
  const scriptService = new ScriptService(database);
  const storyboardService = new StoryboardService(database);
  const mediaService = new MediaService(database);
  const assemblyService = new AssemblyService(database);

  const requestListener = createRequestListener(
    projectService,
    executionService,
    researchService,
    scriptService,
    storyboardService,
    mediaService,
    assemblyService
  );
  const server = http.createServer(requestListener);

  return {
    server,
    db: database,
    projectService,
    executionService,
    researchService,
    scriptService,
    storyboardService,
    mediaService,
    assemblyService,
    listen: () =>
      new Promise((resolve) => {
        server.listen(port, host, () => {
          logger.info(`Loredotexe state & research server listening on http://${host}:${port}`);
          resolve(server);
        });
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  };
}

// Auto-start server when executed directly as main script
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const app = createServer();
  app.listen();
}
