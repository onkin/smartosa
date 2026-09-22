# Local go2rtc

Turns a camera RTSP stream into video the browser can play (WebRTC / MSE).

```bash
pnpm go2rtc:up
```

Then:

1. Open http://127.0.0.1:1984 for go2rtc's own page.
2. In Smartosa, open the camera card, paste the RTSP URL, and choose **Отдать превью в go2rtc**.
3. Set **Режим в браузере** to **go2rtc**.

Stop it with `pnpm go2rtc:down`.

Camera passwords belong only in `config/go2rtc.yaml` (not in git) or in the go2rtc page. Do not commit that file.
