#!/bin/bash
# AI Writer PopClip Extension - Installer

EXT_DIR="$HOME/Library/Application Support/PopClip/Extensions"

echo "AI Writer - PopClip 安装"
echo "========================"

# Ask for API key
if [ -f "$HOME/.aiwriter_key" ]; then
  echo "✓ API Key 已配置: $(cat $HOME/.aiwriter_key | head -c 15)..."
else
  echo ""
  echo "请输入 DeepSeek API Key (从 https://platform.deepseek.com/api_keys 获取):"
  read -s API_KEY
  echo "$API_KEY" > "$HOME/.aiwriter_key"
  chmod 600 "$HOME/.aiwriter_key"
  echo "✓ API Key 已保存到 ~/.aiwriter_key"
fi

# Install extension
mkdir -p "$EXT_DIR"
SRC="$(cd "$(dirname "$0")" && pwd)/popclipext"
DST="$EXT_DIR/AIWriter.popclipext"

rm -rf "$DST"
cp -r "$SRC" "$DST"

echo "✓ PopClip 扩展已安装"
echo ""
echo "使用方式：选中任意文字 → PopClip 弹出 → 点「润色」或「翻译」"
echo "结果自动替换原文"
