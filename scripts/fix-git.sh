#!/bin/bash
# 修复因中断克隆导致的不完整 .git，重新关联 GitHub 远程仓库
set -euo pipefail
cd "$(dirname "$0")/.."
echo ">>> 当前目录: $(pwd)"

if [ -d .git ] && git rev-parse --is-inside-work-tree &>/dev/null; then
  echo ">>> Git 已正常，跳过"
  git remote -v
  git status -sb
  exit 0
fi

echo ">>> 重新初始化 Git..."
rm -rf .git
git init
git remote add origin https://github.com/myBigger/biggerBlog.git
git fetch origin main
git checkout -B main origin/main
git branch --set-upstream-to=origin/main main

echo ">>> 完成"
git status -sb
git log -1 --oneline
