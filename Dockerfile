FROM node:22-alpine

WORKDIR /app

# Copy and build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy and install backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY backend/ ./backend/

# Expose port
EXPOSE 3001

# Start
WORKDIR /app/backend
CMD ["node", "server.js"]
