#!/bin/bash
# 博客自动化部署脚本
# 用法: ./deploy.sh

set -e

echo '🚀 开始部署博客...'

# 1. 进入博客目录
cd /home/parallels/Desktop/my-blog

# 2. 备份文章到桌面
echo '📦 备份文章到桌面...'
BACKUP_DIR="/home/parallels/Desktop/blog-backup"
mkdir -p "$BACKUP_DIR"
cp -r src/data/blog/*.md "$BACKUP_DIR/"
echo "已备份到: $BACKUP_DIR"

# 3. Git add & commit
echo '📝 Git 提交...'
git add -A
git status

# 4. Git push
echo '⬆️ 推送到 GitHub...'
git push origin main

echo '🎉 部署完成！'
echo '🔗 博客地址: https://biggerblog.vercel.app/'
echo '⏰ Vercel 会自动检测并更新'