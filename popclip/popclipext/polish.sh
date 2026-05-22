#!/bin/bash
# AI Writer - Polish
# PopClip passes selected text via $POPCLIP_TEXT

# API Key - set in ~/.aiwriter_key or hardcode
KEY_FILE="$HOME/.aiwriter_key"
if [ -f "$KEY_FILE" ]; then
  API_KEY=$(cat "$KEY_FILE" | tr -d '\n')
else
  API_KEY="${AIWRITER_KEY:-}"
fi

if [ -z "$API_KEY" ]; then
  echo "请设置 API Key: echo 'sk-xxx' > ~/.aiwriter_key"
  exit 1
fi

TEXT="${POPCLIP_TEXT:-$(cat)}"
if [ -z "$TEXT" ]; then
  echo "未选中文字"
  exit 1
fi

# Detect language
CHINESE_COUNT=$(echo "$TEXT" | grep -oP '[\x{4e00}-\x{9fff}]' | wc -l | tr -d ' ')
TOTAL=$(echo "$TEXT" | sed 's/\s//g' | wc -c | tr -d ' ')
IS_CN=false
if [ "$CHINESE_COUNT" -gt 0 ] && [ $((CHINESE_COUNT * 100 / TOTAL)) -gt 30 ]; then
  IS_CN=true
fi

if $IS_CN; then
  SYSTEM="你是专业中文写作者。只输出润色后的文本，不要解释。"
  PROMPT="润色以下文字，使其更流畅、更有力，保持原意：\n\n$TEXT\n\n润色后："
else
  SYSTEM="You are a professional English writer. Output only the polished text."
  PROMPT="Polish the following text to be clearer and more impactful:\n\n$TEXT\n\nPolished:"
fi

# JSON escape
ESCAPED=$(echo "$PROMPT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
SYSTEM_ESC=$(echo "$SYSTEM" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')

BODY=$(cat <<EOF
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": $SYSTEM_ESC},
    {"role": "user", "content": $ESCAPED}
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
EOF
)

curl -s "https://api.deepseek.com/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'])" 2>/dev/null || echo "API 调用失败"
