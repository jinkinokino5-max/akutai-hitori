# audio/*.mp3 を base64 にして audio/audio_data.js に埋め込む（file:// 起動用の予備）。
# MP3 を差し替えたら再実行する:  python tools/make_audio_data.py
import base64, json, os, re
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')
src = open(os.path.join(base, '..', 'src', 'audio_engine.js'), encoding='utf-8').read()
ids = re.findall(r"'([a-z0-9_]+)'", re.search(r"var FILES = \[(.*?)\];", src, re.S).group(1))
out = {i: base64.b64encode(open(os.path.join(base, i + '.mp3'), 'rb').read()).decode('ascii') for i in ids}
with open(os.path.join(base, 'audio_data.js'), 'w', encoding='utf-8') as f:
    f.write('// 自動生成（tools/make_audio_data.py）。file:// 起動で fetch できないときの予備。\n')
    f.write('window.AT = window.AT || {}; AT.AUDIO_DATA = ' + json.dumps(out) + ';\n')
print(len(ids), 'files')
