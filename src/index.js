const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const ytdl = require('ytdl-core')
const ytpl = require('ytpl')
const YoutubeDlWrap = require('youtube-dl-wrap');
const PassThrough = require('stream').PassThrough;


const youtubeDlWrap = new YoutubeDlWrap("./src/youtube.exe");

(async () => {
  // await YoutubeDlWrap.downloadFromWebsite("./src/youtube.exe", "win32");
  console.log(`Set youtube dl path: ${youtubeDlWrap}`)
})()


const app = express();

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({limit: '50mb'}));
app.use(cors())

app.post('/info', async (req, res) => {
  const {url} = req.body;
  let videos;
    try {
      const result = await ytpl(url, { pages: Infinity })
      videos = result.items.map((val, i) => val.shortUrl);
    } catch {
      videos = [url]
    }
    const all = [];

    for(const vid of videos) {
      all.push(getInfo(vid))
    }

    Promise.all(all)
    .then(val => {
      const filtered = val.filter((val, i) => val.info)
      res.send(JSON.stringify(filtered))
    })
})

app.post('/video', (req, res) => {
  const video = execStream([req.body.url, '-f', 'bestvideo'])
  const audio = execStream([req.body.url, '-f', 'bestaudio'])

  video.on('close', () => video.destroy())
  audio.on('close', () => audio.destroy())

  const ffmpegProcess = spawn(ffmpeg, [
    '-loglevel', '8', '-hide_banner',
    '-i', 'pipe:4',
    '-i', 'pipe:5',
    '-map', '0:a',
    '-map', '1:v',
    '-c:v', 'copy',
    '-f', 'matroska',
    '-metadata', 'major_brand=\"mp42\"',
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
      const info = await youtubeDlWrap.getVideoInfo(url);
      res({ info })
    } catch (error) {
      res({})
    }
  })
}

const execStream = (youtubeDlArguments = []) => {
  youtubeDlArguments = youtubeDlArguments.concat(["-o", "-"]);
  const youtubeDlProcess = spawn(youtubeDlWrap.binaryPath, youtubeDlArguments, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 1024
  });

  let stderrData = "";
  youtubeDlProcess.stderr.on("data", (data) =>
  {
    let stringData = data.toString();
    stderrData += stringData
  });
  youtubeDlProcess.on("error", (error) => console.log(`Youtube DL exited with code ${error}, heres some error data: ${stderrData}`));
  return youtubeDlProcess.stdout;
}

app.listen(8080, () => {console.log(`Server open on port 8080`)})
