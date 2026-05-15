# ============================================
# WxBot Dockerfile - 多阶段构建
# ============================================

# ---- Stage 1: 构建前端 Dashboard ----
FROM node:20-alpine AS dashboard-builder
WORKDIR /app/dashboard

# 复制 dashboard 依赖文件
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

# 复制 dashboard 源码并构建
COPY dashboard/ ./
RUN npm run build

# ---- Stage 2: 编译后端 TypeScript ----
FROM node:20-alpine AS backend-builder
WORKDIR /app

# 复制主项目依赖文件（含 devDependencies，用于 tsc 编译）
COPY package.json package-lock.json ./
RUN npm ci

# 复制 TypeScript 源码和配置
COPY tsconfig.json ./
COPY src/ ./src/
COPY config/ ./config/

# 编译 TypeScript → dist/
RUN npm run build

# ---- Stage 3: 生产运行镜像 ----
FROM node:20-alpine AS production

# sharp 0.34+ 自带预编译的 libvips 静态链接库，无需额外安装系统包
# 如需支持更多图片格式可安装: apk add --no-cache vips

WORKDIR /app

# 复制生产依赖文件并安装（仅生产依赖）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 从构建阶段复制产物
COPY --from=backend-builder /app/dist ./dist
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist
COPY --from=backend-builder /app/config ./config

# 不需要 devDependencies 中的 ts-node，直接用 node 运行编译产物

# 暴露 Web 控制面板端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/status || exit 1

# 默认启动命令
CMD ["node", "dist/index.js"]
