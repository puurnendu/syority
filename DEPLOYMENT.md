# SYORITY Deployment Guide

This guide explains how to set up the GitHub CI/CD pipeline for the SYORITY platform.

## GitHub Secrets Setup

To enable automated deployments, go to your GitHub repository:
**Settings > Secrets and variables > Actions > New repository secret**

Add the following secrets:

### 1. SSH Access (Production)
- `PROD_HOST`: IP address or domain of the production server.
- `PROD_USER`: SSH username (e.g., `root` or `ubuntu`).
- `PROD_SSH_KEY`: The private key used to access the production server.

### 2. SSH Access (Staging)
- `STAGING_HOST`: IP address or domain of the staging server.
- `STAGING_USER`: SSH username.
- `STAGING_SSH_KEY`: The private key used to access the staging server.

### 3. Application Environment Variables
These are required by `docker-compose` and the application at runtime.

- `DATABASE_URL`: The full connection string for your production/staging database.
- `NEXTAUTH_SECRET`: A random string for session encryption.
- `NEXTAUTH_URL`: The public URL of your application (e.g., `https://app.syority.com`).
- `ENCRYPTION_KEY`: A random string for application-level data encryption.
- `DOMAIN`: The domain name for SSL setup (e.g., `app.syority.com`).

## Branch Strategy

- **`main`**: Pushes to this branch trigger deployment to the **Production** environment.
- **`dev`**: Pushes to this branch trigger deployment to the **Staging** environment.

## Deployment Script (`scripts/deploy.sh`)

The deployment script performs the following steps:
1. Validates environment variables.
2. Builds and starts Docker containers using `docker-compose.prod.yml`.
3. Waits for the database to be healthy.
4. Runs Prisma migrations (`npx prisma migrate deploy`).
5. Cleans up old Docker images.

## Manual Trigger

You can also trigger a deployment manually from the **Actions** tab in GitHub.
