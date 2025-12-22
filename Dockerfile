# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set dummy env vars for build (not used at runtime)
# At runtime, provide real values:
#   MONGODB_URI - MongoDB connection string
#   JWT_SECRET - Secret for JWT token signing
#   ENCRYPTION_KEY - 64 hex characters (32 bytes) for API key encryption
#                    Generate with: openssl rand -hex 32
ENV MONGODB_URI="mongodb://localhost:27017/probefish"
ENV JWT_SECRET="build-time-secret"
ENV ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
