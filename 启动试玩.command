#!/bin/zsh
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
    python3 tools/serve.py
elif [ -x /opt/homebrew/bin/python3 ]; then
    /opt/homebrew/bin/python3 tools/serve.py
else
    echo '需要 Python 3 来运行本地试玩服务。'
    read
fi
