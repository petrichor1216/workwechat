# 使用 Node.js 18 Alpine 镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package*.json ./
COPY client/package*.json ./client/

# 安装依赖
RUN npm install --production=false

# 复制源代码
COPY . .

# 构建前端
RUN cd client && npm run build

# 清理开发依赖，减小镜像体积
RUN npm prune --production && \
    rm -rf client/node_modules client/src

# 暴露端口
EXPOSE 80

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# 启动服务
CMD ["node", "server/index.js"]
