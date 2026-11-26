#!/bin/bash
# 打安卓安装包：构建网页 → 同步进安卓工程 → 打 debug 包 → 复制到项目根目录 pinyin-shooter.apk
# 用法：npm run apk
set -e
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
# 公司网络有 SSL 检查时，Node / Java 需要信任它的根证书（文件不存在就忽略）
if [ -f "$HOME/.android/cacerts-with-fortinet.jks" ]; then
  export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=$HOME/.android/cacerts-with-fortinet.jks -Djavax.net.ssl.trustStorePassword=changeit"
fi

npm run build:app
(cd android && ./gradlew assembleDebug)
cp android/app/build/outputs/apk/debug/app-debug.apk pinyin-shooter.apk
echo "完成：$(pwd)/pinyin-shooter.apk"
