# Stage 1: Compile the React UI Production Assets
FROM node:20-alpine AS build
WORKDIR /app

# 🚀 TARGETED ADDITION: Accept build arguments from Docker Compose
ARG VITE_API_BASE_URL
ARG VITE_DEFAULT_ACADEMY_ID

# Expose these variables to the Node.js compiler shell environment
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DEFAULT_ACADEMY_ID=$VITE_DEFAULT_ACADEMY_ID

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy code arrays and build static production sheets
COPY . .
RUN npm run build

# Stage 2: Serve the application via Nginx
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
