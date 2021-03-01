const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')
const enableWs = require('express-ws')
const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');
const ytdl = require('ytdl-core')
const ytpl = require('ytpl')

const app = express();

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({limit: '50mb'}));
app.use(cors())
enableWs(app)

app.post('/video', (req, res) => {
  const video = ytdl(req.body.url, {format: req.body.format[1]})
  const audio = ytdl(req.body.url, {format: req.body.format[0]})
  const ffmpegProcess = cp.spawn(ffmpeg, [
    '-loglevel', '8', '-hide_banner',
    '-i', 'pipe:4',
    '-i', 'pipe:5',
    '-map', '0:a',
    '-map', '1:v',
    '-c:v', 'copy',
    '-f', 'matroska',
    'pipe:3',
  ], {
    windowsHide: true,
    stdio: [
      'inherit', 'inherit', 'inherit',
      'pipe', 'pipe', 'pipe',
    ],
  });

  audio.pipe(ffmpegProcess.stdio[4]);
  video.pipe(ffmpegProcess.stdio[5]);

  ffmpegProcess.stdio[3].on('close', () => {
    console.log('done')
    res.end()
  });
  ffmpegProcess.stdio[3].pipe(res);
})

const getInfo = (url) => {
  return new Promise(async (res, rej) => {
    try {
      const info = await ytdl.getInfo(url);
      const highestvideo = await ytdl.chooseFormat(info.formats, {quality: 'highestvideo'})
      const highestaudio = await ytdl.chooseFormat(info.formats, {quality: 'highestaudio'})
      res({info, formats: [highestaudio, highestvideo]})
    } catch (error) {
      res({})
    }
  })
}

app.ws('/info', (socket, req) => {
  socket.on('message', async (msg) => {
    console.log(msg)
    let videos;
      try {
        const result = await ytpl(msg, { pages: Infinity })
        videos = result.items.map((val, i) => val.shortUrl);
      } catch {
        videos = [msg]
      }
      console.log(videos)
      const all = [];

      for(const vid of videos) {
        all.push(getInfo(vid))
      }

      Promise.all(all)
      .then(val => {
        const filtered = val.filter((val, i) => val.info)
        console.log(filtered)
        socket.send(JSON.stringify(filtered))
      })
    })

  socket.on('close', () => {
    console.log('WebSocket was closed')
  })
})

app.listen(8080, () => {console.log(`Server open on port 8080`)})
