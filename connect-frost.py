from pathlib import Path

html_file = Path("web/index.html")
config_file = Path("web/supabase-config.js")

if not html_file.exists():
    raise SystemExit("Не найден web/index.html")

config_file.write_text('''window.frostSupabase = window.supabase.createClient(
  "https://cvqnvflmnbruxsntlzom.supabase.co",
  "sb_publishable_tK5X7k243uJHXfh5xedWig_SpQz4BW8"
);
console.log("Frost: Supabase подключён");
''')

html = html_file.read_text()
sdk = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
cfg = '<script src="supabase-config.js"></script>'

if "supabase-config.js" not in html:
    pos = html.lower().rfind("</body>")
    if pos < 0:
        raise SystemExit("Не найден </body>")
    html = html[:pos] + sdk + "\n" + cfg + "\n" + html[pos:]
    html_file.write_text(html)

Path("connect-frost.py").unlink()
print("ГОТОВО: конфигурация Supabase создана и подключена.")
