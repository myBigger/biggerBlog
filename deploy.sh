#!/bin/bash
# 博客自动化部署脚本
# 用法: ./deploy.sh

set -e

echo '🚀 开始部署博客...'

# 1. 进入博客目录
cd /home/parallels/Desktop/my-blog

# 2. 安装依赖（如果需要）
echo '📦 检查依赖...'
if [ ! -d "node_modules" ] || [ "$1" == "--force" ]; then
    echo '安装/更新依赖...'
    npm install
else
    echo '依赖已安装，跳过...'
fi

# 3. 构建博客
echo '🔨 构建博客...'
npm run build

# 4. 备份文章到桌面
echo '📦 备份文章到桌面...'
BACKUP_DIR="/home/parallels/Desktop/blog-backup"
mkdir -p "$BACKUP_DIR"
cp -r src/data/blog/*.md "$BACKUP_DIR/"
echo "已备份到: $BACKUP_DIR"

# 5. 重启Python HTTP服务器
echo '🔄 重启HTTP服务器...'
pkill -f "python3 -m http.server 8080" || true
cd dist
nohup python3 -m http.server 8080 > /tmp/blog-server.log 2>&1 &
sleep 2

# 6. 检查服务状态
echo '📊 检查服务状态...'
if pgrep -f "python3 -m http.server 8080" > /dev/null; then
    echo '✅ HTTP服务器运行正常'
    echo '📄 日志文件: /tmp/blog-server.log'
else
    echo '❌ HTTP服务器启动失败'
    exit 1
fi

# 7. 显示构建信息
echo '📈 构建完成！'
echo '📁 构建目录: dist/'
echo '🌐 本地访问: http://localhost:8080'
echo '🔗 公网访问: https://forethoughtfully-enchondromatous-anastacia.ngrok-free.dev'

echo '🎉 部署完成！'