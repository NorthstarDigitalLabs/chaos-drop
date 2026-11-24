#!/usr/bin/env bash
set -euo pipefail
mkdir -p assets media build
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
A="https://cdn.shopify.com/s/files/1/0790/6230/2948/files/2026_Annual_Ornament-_tree-_aluminum-_web.jpg?v=1791910668"
B="https://cdn.shopify.com/s/files/1/0790/6230/2948/files/Woodland_Deer-_Hero_Web__06859.jpg?v=1791910478"
curl --fail --location --silent --show-error --retry 3 "$A" -o assets/a.jpg
curl --fail --location --silent --show-error --retry 3 "$B" -o assets/b.jpg
ffmpeg -y -loglevel error -f lavfi -i "color=c=0x0b0b0e:s=720x1280:r=24" -t 3 \
-vf "drawtext=fontfile=$FONT:text='A OR B?':fontsize=84:fontcolor=0xE7B762:x=(w-text_w)/2:y=445,drawtext=fontfile=$FONT:text='CHRISTMAS TREE VOTE':fontsize=34:fontcolor=white:x=(w-text_w)/2:y=595,drawtext=fontfile=$FONT:text='JEMSBOTIQUE':fontsize=32:fontcolor=0xE7B762:x=(w-text_w)/2:y=1070" \
-r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 build/01.mp4
ffmpeg -y -loglevel error -loop 1 -framerate 24 -i assets/a.jpg -t 5 \
-vf "scale=700:870:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0e,drawtext=fontfile=$FONT:text='A - COZY CHRISTMAS HEARTH':fontsize=31:fontcolor=0xE7B762:x=(w-text_w)/2:y=99:box=1:boxcolor=black@0.85:boxborderw=15,drawtext=fontfile=$FONT:text='2026 ALUMINUM ORNAMENT':fontsize=26:fontcolor=white:x=(w-text_w)/2:y=1050,drawtext=fontfile=$FONT:text='ONE FOR USD 20.99':fontsize=36:fontcolor=0xE7B762:x=(w-text_w)/2:y=1115" \
-r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 build/02.mp4
ffmpeg -y -loglevel error -loop 1 -framerate 24 -i assets/b.jpg -t 5 \
-vf "scale=700:870:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0e,drawtext=fontfile=$FONT:text='B - WOODLAND DEER':fontsize=39:fontcolor=0xE7B762:x=(w-text_w)/2:y=99:box=1:boxcolor=black@0.85:boxborderw=15,drawtext=fontfile=$FONT:text='RUSTIC HOLIDAY ORNAMENT':fontsize=27:fontcolor=white:x=(w-text_w)/2:y=1050,drawtext=fontfile=$FONT:text='ONE FOR USD 29.99':fontsize=36:fontcolor=0xE7B762:x=(w-text_w)/2:y=1115" \
-r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 build/03.mp4
ffmpeg -y -loglevel error -f lavfi -i "color=c=0x0b0b0e:s=720x1280:r=24" -t 4 \
-vf "drawtext=fontfile=$FONT:text='WHICH ONE WINS?':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=445,drawtext=fontfile=$FONT:text='COMMENT A OR B':fontsize=50:fontcolor=0xE7B762:x=(w-text_w)/2:y=555,drawtext=fontfile=$FONT:text='JEMSBOTIQUE.COM':fontsize=35:fontcolor=white:x=(w-text_w)/2:y=1000,drawtext=fontfile=$FONT:text='DELIVERY VARIES BY ADDRESS':fontsize=20:fontcolor=0xD5C9B8:x=(w-text_w)/2:y=1095" \
-r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 build/04.mp4
printf "file '01.mp4'\nfile '02.mp4'\nfile '03.mp4'\nfile '04.mp4'\n" > build/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i build/list.txt -c copy build/visual.mp4
python3 - <<'PY'
import wave,math,struct
sr=22050; dur=17; notes=[261.63,329.63,392.0,523.25]
with wave.open('build/music.wav','wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr)
 for i in range(int(sr*dur)):
  t=i/sr
  beat=int(t/.55); part=t%(.55)
  envelope=min(1,part*22)*math.exp(-part*6)
  freq=notes[beat%4]*(2 if beat%8==7 else 1)
  sample=.12*envelope*(math.sin(2*math.pi*freq*t)+.18*math.sin(4*math.pi*freq*t))
  w.writeframesraw(struct.pack('<h',int(32767*sample)))
PY
ffmpeg -y -loglevel error -i build/visual.mp4 -i build/music.wav -t 17 -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 96k -movflags +faststart media/jemsbotique_ornament_vote_17s.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 media/jemsbotique_ornament_vote_17s.mp4
