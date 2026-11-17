#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "================================"
echo "       FROST VISUALS BUILD"
echo "================================"

echo ""
echo "[1/4] Проверка сайта..."
if [ -f web/app.js ]; then
  node --check web/app.js
  echo "JavaScript: OK"
else
  echo "Файл web/app.js не найден"
  exit 1
fi

echo ""
echo "[2/4] Сборка Minecraft 1.21.4..."
gradle -p mod/1.21.4 build --no-daemon

echo ""
echo "[3/4] Сборка Minecraft 1.21.11..."
gradle -p mod/1.21.11 build --no-daemon

echo ""
echo "[4/4] Проверка готовых модов..."
for version in 1.21.4 1.21.11; do
  FILE=$(find "mod/$version/build/libs" -maxdepth 1 -name "frost-visuals-$version-*.jar" ! -name "*-sources.jar" | head -n 1)
  if [ -z "$FILE" ]; then
    echo "ОШИБКА: мод для $version не найден"
    exit 1
  fi
  echo "Minecraft $version: $FILE"
  ls -lh "$FILE"
done

echo ""
echo "================================"
echo "       BUILD SUCCESSFUL"
echo "================================"
