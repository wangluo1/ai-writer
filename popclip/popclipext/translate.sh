#!/bin/bash
# AI Writer - Translate (中↔英)

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

CHINESE_COUNT=$(echo "$TEXT" | grep -oP '[\x{4e00}-\x{9fff}]' | wc -l | tr -d ' ')
TOTAL=$(echo "$TEXT" | sed 's/\s//g' | wc -c | tr -d ' ')
IS_CN=false
if [ "$CHINESE_COUNT" -gt 0 ] && [ $((CHINESE_COUNT * 100 / TOTAL)) -gt 30 ]; then
  IS_CN=true
fi

if $IS_CN; then
  SYSTEM="你是专业中英翻译。只输出英文译文，不要解释。"
  PROMPT="将以下中文翻译成自然、地道的英文：\n\n$TEXT\n\n译文："
else
  SYSTEM="你是专业英中翻译。只输出中文译文，不要解释。"
  PROMPT="将以下英文翻译成自然、地道的中文：\n\n$TEXT\n\n译文："
fi

ESCAPED=$(echo "$PROMPT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null)
SYSTEM_ESC=$(echo "$SYSTEM" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null)

BODY=$(cat <<EOF
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": $SYSTEM_ESC},
    {"role": "user", "content": $ESCAPED}
  ],
  "temperature": 0.3,
  "max_tokens": 2048
}
EOF
)

curl -s "https://api.deepseek.com/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'])" 2>/dev/null || echo "API 调用失败"
