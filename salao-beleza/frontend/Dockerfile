# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 5173

# Start dev server (for development)
# For production, use: CMD ["npm", "run", "preview"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]