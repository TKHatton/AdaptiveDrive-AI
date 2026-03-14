# Stage 1: Build the frontend
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install all deps (including devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Build the Vite frontend (injects GEMINI_API_KEY at build time)
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=${GEMINI_API_KEY}
RUN npm run build

# Stage 2: Production image
FROM node:20-slim AS production

WORKDIR /app

# Copy package files and install production deps + tsx for running TS server
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx

# Copy built frontend and server
COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY tsconfig.json ./

# Cloud Run provides PORT env var
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run the Express server that serves the built SPA
CMD ["npx", "tsx", "server.ts"]
