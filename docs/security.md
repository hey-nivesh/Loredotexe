# Loredotexe Security & Secrets Management Policy

This document outlines the security architecture, secrets handling rules, and network boundaries for **Loredotexe**.

---

## 1. Core Security Principles

1. **Zero Secret Exposure in Version Control**:
   - Real API keys, tokens, passwords, and private certificates must **never** be committed to Git.
   - All secrets reside exclusively in the local `.env` file (ignored by `.gitignore`) or inside encrypted n8n credential stores.
   - Use `.env.example` as a template containing strictly non-secret placeholder keys.

2. **Local-Only Network Boundary**:
   - **n8n Community Edition** must bind exclusively to `localhost` (`127.0.0.1:5678`).
   - Do **NOT** expose port `5678` to public internet interfaces or configure port-forwarding without authenticated TLS reverse proxying (e.g., Cloudflare Tunnel / Caddy / Nginx with HTTP Basic Auth / OAuth).

3. **Human-in-the-Loop Gate for Publishing**:
   - All workflows capable of external mutations (YouTube video uploads, public social posts, cloud storage deletion) must incorporate a blocking human review gate.

---

## 2. Secrets Management Matrix

| Secret Type | Storage Location | Protection Mechanism | Git Allowed? |
|---|---|---|---|
| **Free-Tier API Keys** (e.g. Gemini, Groq) | `.env` | File system permissions, `.gitignore` | ❌ **NEVER** |
| **Google / YouTube OAuth2 Secrets** | Local n8n Credential Store | SQLite AES-256 encryption via `N8N_ENCRYPTION_KEY` | ❌ **NEVER** |
| **n8n Encryption Key** | `.env` (`N8N_ENCRYPTION_KEY`) | Local environment only | ❌ **NEVER** |
| **Template Placeholders** | `.env.example` | Generic mock keys | ✅ **ALLOWED** |
| **Non-secret App Config** | `config/app.config.example.json` | Public configuration constants | ✅ **ALLOWED** |

---

## 3. Workflow Sanitization Checklist

Before committing any workflow JSON file to `workflows/`:

- [ ] Inspect the JSON file for literal API keys, bearer tokens, or basic auth headers.
- [ ] Ensure all credential references use n8n credential identifiers rather than plaintext secrets.
- [ ] Strip out execution run history and test payloads containing personal data.

---

## 4. Safe Script Execution

All automation scripts within `scripts/`:
- Run with standard user privileges (no Administrator elevation required).
- Do not download executable payloads from unverified remote sources.
- Execute idempotently without altering operating system configuration or global registry keys.
