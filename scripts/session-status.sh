#!/bin/sh
# Hook SessionStart (.claude/settings.json): in trạng thái dự án để Claude khỏi đọc cả docs/plan/README.md.
cd "$(dirname "$0")/.." || exit 0
echo "# Trạng thái dự án Wisp (tự chèn – scripts/session-status.sh)"
echo "## Các bước (docs/plan/)"
sed -n '/^## Các bước/,/^Thêm bước mới/p' docs/plan/README.md | grep '^| \[' | sed 's|](|](docs/plan/|'
n=$(grep -c '^- \[ \]' docs/checks.md 2>/dev/null)
echo "- **Chờ người dùng kiểm tra tay:** ${n:-0} việc (docs/checks.md)"
echo "- **Git:** nhánh $(git branch --show-current 2>/dev/null), $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') file chưa commit; commit gần nhất: $(git log -1 --format='%h %s' 2>/dev/null)"
